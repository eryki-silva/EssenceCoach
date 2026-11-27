import {analyzeByRules} from './engine.mjs';
import {buildFarmRoute} from '../matches/farm-route.mjs';
import {buildDecisionBriefs} from './decisions.mjs';
import {publicDataFallback} from '../../shared/public-transport.mjs';
import {loadSettings} from '../../config/settings.mjs';
import {AppError,connectionError} from '../../shared/errors.mjs';
import {pick,safeText} from '../../shared/formatters.mjs';
import {matchId,accountId} from '../matches/schemas.mjs';
import {buildEvidence} from '../matches/evidence.mjs';
import {laneHeatmap} from '../matches/heatmap.mjs';
import {validateAnalysis} from './schema.mjs';
import {buildReplayReview} from './review.mjs';
import {createReplayStore} from '../replays/worker.mjs';
import {spatialEvidence} from '../replays/data.mjs';
export function createService({ fetcher = fetch, env = process.env, now = () => Date.now(), replayStore, settings=loadSettings(env) } = {}) {
  const replays = replayStore ?? createReplayStore({fetcher,now});
  const cache = new Map();
  async function request(url, options = {}) {
    let response;
    try { response = await fetcher(url, { ...options, signal: AbortSignal.timeout(options.timeout ?? settings.externalTimeoutMs) }); }
    catch (error) {
      // Windows native HTTPS can work when Node's network/certificate route fails.
      // Do not retry writes or Gemini generation (which may consume quota).
      if(!options.method || options.method==='GET') {
        try { response=await publicDataFallback(url); } catch { /* Preserve the original safe diagnostic. */ }
      }
      if(!response)throw connectionError(new URL(url).hostname,error);
    }
    if (!response.ok) {
      const host = new URL(url).hostname;
      if (response.status === 429) throw new AppError(`Limite de uso em ${host}. Aguarde ou verifique créditos/cota da API.`, 429);
      if (response.status === 404) throw new AppError('Partida ou recurso não encontrado. Confira o ID e se o histórico de partidas está público.', 404);
      if ([401, 403].includes(response.status)) throw new AppError(`Acesso negado em ${host}. Verifique a permissão de rede e a chave da API nas configurações do servidor.`, 502);
      throw new AppError(`O serviço ${host} retornou HTTP ${response.status}. Tente novamente mais tarde.`, 502);
    }
    const text = await response.text();
    if (text.length > 12_000_000) throw new AppError('Resposta externa excedeu o limite de segurança.', 502);
    try { return JSON.parse(text); } catch { throw new AppError('O serviço externo retornou uma resposta inválida.', 502); }
  }
  async function cached(url, ttl = settings.cacheTtlMs, options = {}) {
    const existing = cache.get(url);
    if (existing && now() - existing.at < ttl) return existing.value;
    const value = await request(url, options);
    if (cache.size > 100) cache.delete(cache.keys().next().value);
    cache.set(url, { at: now(), value }); return value;
  }
  const dotaUrl = path => `https://api.opendota.com/api${path}${env.OPENDOTA_API_KEY ? `${path.includes('?') ? '&' : '?'}api_key=${encodeURIComponent(env.OPENDOTA_API_KEY)}` : ''}`;
  async function getMatch(id) {
    const value = await cached(dotaUrl(`/matches/${matchId(id)}`), 30_000);
    if (!value || !Array.isArray(value.players) || !value.players.length || String(value.match_id) !== String(id)) throw new AppError('A partida ainda não possui dados disponíveis no OpenDota.', 404);
    return value;
  }
  async function matchView(id, account, hero = '') {
    const match = await getMatch(id);
    const heroes = await cached('https://raw.githubusercontent.com/odota/dotaconstants/master/build/heroes.json', 3600_000).catch(() => ({}));
    const selectedAccount = accountId(account);
    if (typeof hero !== 'string' || hero.length > 100) throw new AppError('Informe um nome de herói com até 100 caracteres.');
    const normalizeHero = text => String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const heroChoice = hero.trim() ? match.players.find(p => normalizeHero(heroes[p.hero_id]?.localized_name ?? '') === normalizeHero(hero) || String(p.hero_id) === hero.trim()) : null;
    return {
      ...pick(match, ['match_id', 'duration', 'start_time', 'radiant_win', 'patch']),
      parsed: match.version != null && match.players.some(p => Array.isArray(p.purchase_log)),
      replay_status: await replays.status(id), replay_parser_available: await replays.available(), replay_mode:env.VERCEL==='1'?'cloud-limited':'local',
      selected_slot: hero.trim() ? heroChoice?.player_slot ?? null : selectedAccount ? match.players.find(p => p.account_id === selectedAccount)?.player_slot ?? null : null,
      selection_method: hero.trim() ? 'hero' : selectedAccount ? 'account' : 'manual',
      players: match.players.map(p => ({ heatmap: laneHeatmap(p), ...pick(p, ['player_slot', 'hero_id', 'account_id', 'kills', 'deaths', 'assists', 'gold_per_min', 'xp_per_min', 'last_hits', 'denies', 'level', 'net_worth', 'hero_damage', 'hero_healing', 'tower_damage']), hero_image: /^[a-z0-9_]+$/.test((heroes[p.hero_id]?.name || '').replace('npc_dota_hero_', '')) ? 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/' + heroes[p.hero_id].name.replace('npc_dota_hero_', '') + '.png' : null, hero: heroes[p.hero_id]?.localized_name ?? `Herói ${p.hero_id}`, name: safeText(p.personaname || 'Jogador anônimo').slice(0, 80), team: p.player_slot < 128 ? 'Radiant' : 'Dire' }))
    };
  }
  async function parse(id) {
    matchId(id);
    const result = await request(dotaUrl(`/request/${id}`), { method: 'POST' });
    cache.delete(dotaUrl(`/matches/${id}`));
    return { job_id: result.job?.jobId ?? result.jobId ?? null, message: 'Solicitação enviada ao OpenDota. Aguarde e recarregue a partida. Replays antigos podem ter expirado; o processamento não é garantido.' };
  }
  async function analyze(id,slot,focus='') {
    if(!Number.isInteger(slot))throw new AppError('Selecione seu jogador na partida.');
    const match=await getMatch(id),player=match.players.find(p=>p.player_slot===slot);
    if(!player)throw new AppError('Jogador não encontrado nesta partida.');
    const urls={heroes:'https://raw.githubusercontent.com/odota/dotaconstants/master/build/heroes.json',items:'https://raw.githubusercontent.com/odota/dotaconstants/master/build/items.json',patches:'https://raw.githubusercontent.com/odota/dotaconstants/master/build/patch.json'};
    const results=await Promise.allSettled(Object.values(urls).map(url=>cached(url,3600000,{timeout:8000}))),values={},sources=[],warnings=[];
    Object.keys(urls).forEach((key,i)=>{if(results[i].status==='fulfilled'){values[key]=results[i].value;sources.push({name:key,url:urls[key],fetched_at:new Date(cache.get(urls[key]).at).toISOString()});}else warnings.push(key+': indisponível nesta consulta.');});
    const hero=values.heroes?.[player.hero_id]?.localized_name??'Herói '+player.hero_id;
    const ctx={hero,match_patch:Array.isArray(values.patches)?values.patches.find(p=>p.id===match.patch):null,sources,warnings,hero_analysis:{sample_size:0,role:'Sem comparação externa; referência do próprio jogador.'}};
    const {evidence,availability}=buildEvidence(match,player,values.items??{});
    const fullReplay=await replays.data(id);
    if(fullReplay){spatialEvidence(fullReplay,player,values.heroes??{},evidence);sources.push({name:'replay local',url:'https://github.com/odota/parser',fetched_at:fullReplay.provenance?.parsed_at??new Date(now()).toISOString()});}
    availability.spatial_replay=Boolean(fullReplay);
    ctx.decision_briefs=buildDecisionBriefs(evidence,player);
    const route=buildFarmRoute(fullReplay,slot,match.duration);
    const result=analyzeByRules({match,player,hero,evidence,route,focus,context:ctx});
    validateAnalysis(result.analysis,evidence);
    return {match_id:match.match_id,player_slot:slot,hero,model:'Motor de regras · '+result.version,engine:{type:'deterministic',version:result.version,rules:result.rules},metrics:result.metrics,route_windows:result.route_windows,farm_route:route,generated_at:new Date(now()).toISOString(),analysis:result.analysis,evidence,availability,context:ctx,replay_review:buildReplayReview(evidence,hero),coverage:fullReplay?'Eventos OpenDota e posições do replay completo':'Eventos disponíveis do OpenDota; rota completa depende de replay'};
  }
  async function checkGemini(){return {ok:true,engine:'deterministic',message:'Análise feita pelo código; nenhuma conexão com Gemini é necessária.'};}
  async function replayDownload(id) {
    matchId(id);
    return replays.download(id,async()=>{
      const match=await getMatch(id);
      if(match.replay_url)return match.replay_url;
      const urls=await request(dotaUrl(`/replays?match_id=${id}`));
      const entry=Array.isArray(urls)?urls.find(r=>String(r.match_id)===String(id)):null;
      return entry?.replay_url;
    });
  }
  return { matchView, parse, analyze, checkGemini, replayDownload, replayUpload:replays.upload, replayStatus:replays.status, replayData:replays.data, configured: () => true };
}

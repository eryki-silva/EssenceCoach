import {buildFarmRoute} from '../matches/farm-route.mjs';
import {buildDecisionBriefs,coachingFramework} from './decisions.mjs';
import {publicDataFallback} from '../../shared/public-transport.mjs';
import {loadSettings} from '../../config/settings.mjs';
import {AppError,connectionError,geminiKey} from '../../shared/errors.mjs';
import {pick,safeText} from '../../shared/formatters.mjs';
import {matchId,accountId} from '../matches/schemas.mjs';
import {buildEvidence} from '../matches/evidence.mjs';
import {laneHeatmap} from '../matches/heatmap.mjs';
import {analysisSchema,validateAnalysis} from './schema.mjs';
import {coachingPrompt} from './prompt.mjs';
import {buildReplayReview,groundedFindings} from './review.mjs';
import {loadHeroReferences} from '../meta/heroes.mjs';
import {loadCompetitiveContext} from '../meta/competitive.mjs';
import {createReplayStore} from '../replays/worker.mjs';
import {spatialEvidence} from '../replays/data.mjs';
export function createService({ fetcher = fetch, env = process.env, now = () => Date.now(), replayStore, settings=loadSettings(env) } = {}) {
  const replays = replayStore ?? createReplayStore({fetcher,now});
  const geminiUrl = model => {
    if (!/^[a-zA-Z0-9._-]+$/.test(model)) throw new AppError('GEMINI_MODEL inválido.', 400);
    return 'https://generativelanguage.googleapis.com/v1beta/models/' + model;
  };
  let selectedModel;
  async function resolveModel(key) {
    if (selectedModel) return selectedModel;
    const models = [];
    let token = '';
    do {
      const page = await request('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000' + (token ? '&pageToken=' + encodeURIComponent(token) : ''), { headers: { 'x-goog-api-key': key } });
      models.push(...(page.models || []));
      token = page.nextPageToken || '';
    } while (token);
    const names = models.filter(m => m.supportedGenerationMethods?.includes('generateContent'))
      .map(m => String(m.name).replace(/^models\//, ''))
      .filter(n => /^gemini-[a-zA-Z0-9._-]+$/.test(n) && !/image|audio|tts|live|robotics|computer|embedding/i.test(n));
    const configured = (env.GEMINI_MODEL || '').replace(/^models\//, '');
    const preferred = [configured, 'gemini-3.1-flash-lite', 'gemini-2.5-flash-lite', 'gemini-2.5-flash'];
    const chosen = preferred.find(n => n && names.includes(n)) || names.filter(n => /flash/.test(n)).sort((a,b) => b.localeCompare(a, undefined, { numeric: true }))[0];
    if (!chosen) throw new AppError('Nenhum modelo Gemini Flash de texto foi encontrado para esta chave. Confira os modelos disponíveis no Google AI Studio.', 404);
    selectedModel = chosen;
    return chosen;
  }
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
      if (host === 'generativelanguage.googleapis.com') {
        const messages = {
          400: 'O Google rejeitou a chave ou os parâmetros da solicitação (HTTP 400). Confira a chave do AI Studio e o modelo configurado.',
          401: 'O Google recusou a autenticação (HTTP 401). Reinicie e informe sua chave do AI Studio.',
          403: 'Acesso ao Gemini negado (HTTP 403). Confira as restrições da chave, o projeto e a disponibilidade da API.',
          404: 'Modelo Gemini não encontrado (HTTP 404). Confira GEMINI_MODEL e sua disponibilidade no AI Studio.',
          429: 'Limite do Gemini atingido (HTTP 429). Aguarde e confira a cota gratuita do projeto no Google AI Studio.'
        };
        if (messages[response.status]) throw new AppError(messages[response.status], response.status);
      }
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
  async function context(heroId, patchId, matchStart) {
    const urls = {
      patches: 'https://raw.githubusercontent.com/odota/dotaconstants/master/build/patch.json',
      items: 'https://raw.githubusercontent.com/odota/dotaconstants/master/build/items.json',
      heroes: 'https://raw.githubusercontent.com/odota/dotaconstants/master/build/heroes.json',
      meta: dotaUrl('/heroStats'), benchmarks: dotaUrl(`/benchmarks?hero_id=${heroId}`),
      itemPopularity: dotaUrl(`/heroes/${heroId}/itemPopularity`),
      news: 'https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=570&count=20&maxlength=6000'
    };
    const results = await Promise.allSettled(Object.values(urls).map(url => cached(url)));
    const values = {}, sources = [], warnings = [];
    for (const [i, key] of Object.keys(urls).entries()) {
      if (results[i].status === 'fulfilled') {
        values[key] = results[i].value;
        sources.push({ name: key, url: urls[key].replace(/([?&])api_key=[^&]*/g, ''), fetched_at: new Date(cache.get(urls[key]).at).toISOString() });
      } else warnings.push(`${key}: ${results[i].reason.message}`);
    }
    const patches = Array.isArray(values.patches) ? values.patches : [];
    const available = patches.filter(p => Date.parse(p.date) <= now()).sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
    const latestKnown = available[0] ?? null;
    const matchPatch = patches.find(p => p.id === patchId) ?? null;
    const news = (values.news?.appnews?.newsitems ?? []).filter(n => /patch|gameplay|update|\d\.\d{2}/i.test(n.title)).slice(0, 5).map(n => ({ title: safeText(n.title), date: n.date, url: n.url, content: safeText(n.contents) }));
    const heroStats = Array.isArray(values.meta) ? values.meta.find(h => h.id === heroId) : null;
    const meta = heroStats ? Object.fromEntries(Object.entries(heroStats).filter(([k]) => /^(id|localized_name|primary_attr|attack_type|roles|pro_pick|pro_win|pro_ban|turbo_picks|turbo_wins|\d+_pick|\d+_win)$/.test(k))) : null;
    const itemNames = Object.fromEntries(Object.entries(values.items ?? {}).map(([key, value]) => [value.id, { key, name: value.dname }]));
    const itemPopularity = values.itemPopularity ? Object.fromEntries(Object.entries(values.itemPopularity).map(([phase, counts]) => [phase, Object.entries(counts ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([id, count]) => ({ id: Number(id), item: itemNames[id]?.name ?? id, count }))])) : null;
    const competitive = await loadCompetitiveContext({ cached: url => cached(url, 300_000, { timeout: 8000 }), dotaUrl, heroId, matchStart, now: now() });
    sources.push(...competitive.sources); warnings.push(...competitive.warnings);
    return {
      official_patch: competitive.official_patch, recent_professional: competitive.recent_professional,
      items: values.items ?? {}, hero: values.heroes?.[heroId]?.localized_name ?? `Herói ${heroId}`,
      hero_names: Object.fromEntries(Object.entries(values.heroes ?? {}).map(([id, hero]) => [id, hero.localized_name])),
      item_names: itemNames,
      latest_known_patch: latestKnown, match_patch: matchPatch, meta, benchmarks: values.benchmarks?.result ?? null,
      item_popularity: itemPopularity, official_news: news, sources, warnings,
      freshness_note: 'O patch oficial vem do catálogo do dota2.com quando disponível. O patch histórico por data é uma estimativa. A amostra profissional inclui até oito jogos dos últimos 14 dias, posteriores ao patch oficial atual quando conhecido. Estatísticas gerais do OpenDota têm janela distinta. Picks, bans e vitórias não provam causalidade nem opinião dos profissionais.'
    };
  }
  async function analyze(id, slot, focus = '') {
    const key = geminiKey(env);
    if (!Number.isInteger(slot)) throw new AppError('Selecione seu jogador na partida.');
    const match = await getMatch(id);
    const player = match.players.find(p => p.player_slot === slot);
    if (!player) throw new AppError('Jogador não encontrado nesta partida.');
    const ctx = await context(player.hero_id, match.patch, match.start_time);
    const { evidence, availability } = buildEvidence(match, player, ctx.items);
    const fullReplay=await replays.data(id);
    if(fullReplay) {
      const heroes=await cached('https://raw.githubusercontent.com/odota/dotaconstants/master/build/heroes.json',3600_000).catch(()=>({}));
      const moments=spatialEvidence(fullReplay,player,heroes,evidence);
      ctx.replay_context={source:fullReplay.source,provenance:fullReplay.provenance,positions:fullReplay.samples.length,capabilities:fullReplay.capabilities??{},moments,limitations:fullReplay.limitations};
      ctx.sources.push({name:'local_replay_parser',url:'https://github.com/odota/parser'+(/^[a-f0-9]{40}$/.test(fullReplay.provenance?.parser_revision??'')?'/tree/'+fullReplay.provenance.parser_revision:''),fetched_at:fullReplay.provenance?.parsed_at??new Date(now()).toISOString(),date_note:'Data do processamento local do replay; fonte é o código do parser utilizado.'});
      availability.spatial_replay=true;
    } else {availability.spatial_replay=false;}
    const refs = await loadHeroReferences({cached: url => cached(url, 300_000, {timeout:8000}),dotaUrl,match,player,stats:ctx.meta,evidence,now:now(),heroName:ctx.hero});
    ctx.hero_analysis=refs.analysis; ctx.integrations=refs.integrations;
    const relevantItems=new Set([...refs.analysis.item_timings.map(x=>x.item),...evidence.filter(e=>e.kind==='purchase_log').map(e=>e.data.key)]);
    ctx.item_rules={historical:false,note:'Catálogo comunitário atual, sujeito a atraso; não prova efeitos no patch da partida.',items:Object.fromEntries([...relevantItems].slice(0,50).filter(k=>ctx.items[k]).map(k=>[k,pick(ctx.items[k],['id','dname','cost','desc','notes','attrib','components','recipe'])]))};
    ctx.sources.push(...refs.sources); ctx.warnings.push(...refs.warnings);
    const rulesUrl=`https://www.dota2.com/datafeed/herodata?language=english&hero_id=${player.hero_id}`;
    try {
      const rules=await cached(rulesUrl,300_000,{timeout:8000});
      const hero=rules?.result?.data?.heroes?.find(h=>h.id===player.hero_id);
      if(!hero) throw Error('schema');
      ctx.hero_rules={source:rulesUrl,historical:false,note:'Regras atuais da Valve; não garantem regras do patch histórico.',data:pick(hero,['id','name_loc','abilities','talents','facets','facet_abilities'])};
      ctx.sources.push({name:'official_hero_rules',url:rulesUrl,fetched_at:new Date(cache.get(rulesUrl).at).toISOString()});
    } catch {ctx.warnings.push('Regras atuais de habilidades e facets da Valve indisponíveis. Não inferir nomes ou efeitos.');}
    ctx.decision_briefs=buildDecisionBriefs(evidence,player);
    ctx.coaching_framework=coachingFramework(player);
    const replayReview = buildReplayReview(evidence, ctx.hero);
    const model = await resolveModel(key);
    const input = {
      hero: ctx.hero, won: (slot < 128) === match.radiant_win,
      replay_review: {
        phases: replayReview.phases, purchases: replayReview.purchases, coverage: replayReview.coverage,
        moments: replayReview.priorities.map(p=>({kind:p.kind,observation:p.observation,start:p.start,end:p.end,evidence_ids:p.evidence_ids}))
      },
      focus: String(focus).slice(0, 600), evidence, availability,
      context: { ...ctx, items: undefined, official_news: undefined, integrations: undefined, recent_professional: ctx.recent_professional?.selected_hero_examples?.length ? ctx.recent_professional : undefined },
      limitations: ['O ID consulta estatísticas e eventos de replay processados pelo OpenDota; não representa todas as ações do arquivo .dem.', 'Sem vídeo, posição contínua, visão de todos os jogadores e comunicações não se pode provar decisões de posicionamento ou intenções.', 'Ausência de evento não comprova ausência de ação; zero e dado indisponível são diferentes.']
    };
    const response = await request(geminiUrl(model) + ':generateContent', {
      method: 'POST', timeout: 100_000,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: coachingPrompt }] },
        contents: [{ role: 'user', parts: [{ text: JSON.stringify(input) }] }],
        generationConfig: { maxOutputTokens: 12000, responseMimeType: 'application/json', responseJsonSchema: analysisSchema }
      })
    });
    const candidate = response.candidates?.[0];
    if (candidate?.finishReason !== 'STOP') throw new AppError('O Gemini não concluiu a análise (limite de saída ou bloqueio). Tente novamente com outro foco.', 502);
    const text = candidate.content?.parts?.filter(p => !p.thought && typeof p.text === 'string').map(p => p.text).join('');
    let result;
    try { result = JSON.parse(text); } catch { throw new AppError('Não foi possível interpretar a análise do Google Gemini.', 502); }
    validateAnalysis(result, evidence);
    const grounded=groundedFindings(result.findings,evidence);
    const omitted=result.findings.length-grounded.length;
    result.findings=grounded;
    if(omitted) ctx.warnings.push(`${omitted} sugestão(ões) da IA omitida(s) por não mencionar número, momento ou compra das evidências citadas. Esse filtro não valida a interpretação causal.`);
    // Do not display a model's unverified claim about patch changes as a fact.
    result.patch_context = `Patch da partida no catálogo: ${ctx.match_patch?.name ?? 'não identificado'}. Patch oficial mais recente consultado: ${ctx.official_patch?.latest?.name ?? 'não confirmado'}. As referências atuais não comprovam as regras do patch histórico; mudanças específicas só devem ser usadas após conferir as notas vinculadas.`;
    return {
      match_id: match.match_id, player_slot: slot, hero: ctx.hero, model,
      farm_route:buildFarmRoute(fullReplay,slot,match.duration),
      generated_at: new Date(now()).toISOString(), analysis: result, evidence, availability, replay_review: replayReview,
      context: { ...ctx, items: undefined },
      coverage: fullReplay ? 'replay completo: posições e eventos locais disponíveis' : match.version != null && availability.purchase_log ? 'eventos processados disponíveis' : 'estatísticas parciais; solicite processamento do replay'
    };
  }
  async function checkGemini() {
    const key = geminiKey(env);
    const model = await resolveModel(key);
    return { ok: true, message: 'Conexão com Google Gemini confirmada. Modelo: ' + model + '. Nenhum conteúdo foi gerado. A cota de geração será verificada ao analisar.' };
  }
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
  return { matchView, parse, analyze, checkGemini, replayDownload, replayUpload:replays.upload, replayStatus:replays.status, replayData:replays.data, configured: () => Boolean((env.GEMINI_API_KEY || env.GOOGLE_API_KEY || '').trim()) };
}

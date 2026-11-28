// References are observations, never an optimal-build prescription.
const finite = Number.isFinite;
export function roleOf(p) {
  if (p.is_roaming === true) return 'suporte móvel (posição incerta)';
  if (p.lane_role === 2) return 'mid provável';
  if (p.lane_role === 1) return 'rota segura (posição 1 ou 5)';
  if (p.lane_role === 3) return 'offlane (posição 3 ou 4)';
  return 'posição desconhecida';
}
export function rankOf(value) {
  const tier = Math.floor(value / 10);
  return finite(value) && tier >= 1 && tier <= 8 ? tier : null;
}
const median = a => { const s = [...a].sort((a,b)=>a-b); return s.length ? (s[Math.floor((s.length-1)/2)] + s[Math.ceil((s.length-1)/2)])/2 : null; };
export function compareHero({match, player, references, stats, evidence, now}) {
  const rank = rankOf(match.avg_rank_tier);
  const eligible = references.filter(m => m.match_id !== match.match_id && m.start_time >= now/1000-14*86400 && m.start_time <= now/1000 && Number.isInteger(match.patch) && m.patch === match.patch && Number.isInteger(match.game_mode) && m.game_mode === match.game_mode && Number.isInteger(match.lobby_type) && m.lobby_type === match.lobby_type && (rank === null || rankOf(m.avg_rank_tier) === rank));
  const rows = eligible.flatMap(m => (m.players || []).filter(p => p.hero_id === player.hero_id && Number.isInteger(player.lane_role) && p.lane_role === player.lane_role).map(p => ({m,p})));
  const purchases = new Map(), skills = new Map(), facets = new Map();
  let purchaseCoverage=0, skillCoverage=0, facetCoverage=0;
  for (const {p} of rows) {
    if (Array.isArray(p.purchase_log)) {
      purchaseCoverage++;
      const first = new Map();
      for (const e of p.purchase_log) if (typeof e.key === 'string' && finite(e.time) && (!first.has(e.key) || e.time < first.get(e.key))) first.set(e.key,e.time);
      for (const [key,time] of first) { const a=purchases.get(key)||[]; a.push(time); purchases.set(key,a); }
    }
    if (Array.isArray(p.ability_upgrades_arr)) { skillCoverage++; p.ability_upgrades_arr.forEach((id,i)=>{const key=`${i+1}:${id}`;skills.set(key,(skills.get(key)||0)+1);}); }
    if (Number.isInteger(p.hero_variant)) { facetCoverage++; facets.set(p.hero_variant,(facets.get(p.hero_variant)||0)+1); }
  }
  const itemTimings = [...purchases].map(([item,times])=>{
    const observed=evidence.filter(e=>e.kind==='purchase_log' && e.data.key===item && finite(e.time)).sort((a,b)=>a.time-b.time)[0];
    return {item,sample_size:times.length,denominator:purchaseCoverage,median_seconds:median(times),min_seconds:Math.min(...times),max_seconds:Math.max(...times),observed_seconds:observed?.time??null,evidence_id:observed?.id??null,delta_seconds:observed?observed.time-median(times):null};
  }).sort((a,b)=>b.sample_size-a.sample_size).slice(0,20);
  // Exact minute samples only: do not interpolate across missing telemetry.
  const farm=[];
  for(const time of [600,1200,1800,2400]){
    const values=rows.flatMap(({p})=>{const i=p.times?.indexOf(time)??-1;return i>=0&&finite(p.lh_t?.[i])?[p.lh_t[i]]:[];});
    const i=player.times?.indexOf(time)??-1,observed=i>=0&&finite(player.lh_t?.[i])?player.lh_t[i]:null;
    if(values.length)farm.push({time,sample_size:values.length,median:median(values),min:Math.min(...values),max:Math.max(...values),observed,delta:observed===null?null:observed-median(values)});
  }
  return {hero_id:player.hero_id,role:roleOf(player),lane_role:player.lane_role??null,rank_tier:rank,rank_basis:'Faixa média da partida; não é o rank individual. Ausente: amostra mistura ranks.',rank_stats:rank && finite(stats?.[`${rank}_pick`]) ? {picks:stats[`${rank}_pick`],wins:stats[`${rank}_win`]??null,position_filtered:false,window:'Não informada pelo endpoint heroStats'}:null,
    sample_size:rows.length,purchase_coverage:purchaseCoverage,skill_coverage:skillCoverage,facet_coverage:facetCoverage,
    window_start:new Date(now-14*86400000).toISOString(),window_end:new Date(now).toISOString(),
    matches:rows.map(({m})=>({match_id:m.match_id,start_time:m.start_time,patch:m.patch,url:`https://www.opendota.com/matches/${m.match_id}`})),
    build_examples:rows.map(({m,p})=>({match_id:m.match_id,skills:p.ability_upgrades_arr??null,facet:p.hero_variant??null,purchases:Array.isArray(p.purchase_log)?p.purchase_log.filter(e=>typeof e.key==='string'&&finite(e.time)).sort((a,b)=>a.time-b.time).slice(0,40).map(e=>({item:e.key,time:e.time})):null})),
    item_timings:itemTimings,farm,
    skills:[...skills].map(([key,count])=>{const [level,ability_id]=key.split(':').map(Number);return {level,ability_id,count,denominator:skillCoverage,observed:player.ability_upgrades_arr?.[level-1]??null};}),
    facets:[...facets].map(([variant,count])=>({variant,count,denominator:facetCoverage,observed:player.hero_variant??null})),
    limitations:['Até seis partidas recentes do herói retornadas pelo OpenDota; amostra de conveniência, sujeita a falhas e viés de seleção.', 'Recorte exige mesmo patch numérico, modo, lobby e rota. Rota não distingue posições 1/5 e 3/4; subpatch não é garantido.', 'Compra não prova entrega, conclusão automática de receita ou uso. Timings usam primeira compra registrada e apenas compradores; ausência não significa erro.', 'Ordem de habilidades representa níveis, não timestamps. hero_variant é identificador de facet, sem assumir nome ou regras históricas.', 'Amostra pequena não sustenta melhor build, causalidade ou julgamento automático de atraso.', 'Farm usa LH acumulado em minutos exatos, sem interpolação. Mesma rota não garante mesma função, adversários ou acesso aos recursos. Referências dos últimos 14 dias podem não representar partidas antigas.']};
}

export async function loadHeroReferences({cached,dotaUrl,match,player,stats,evidence,now,heroName}) {
  const sources=[],warnings=[],references=[];
  const record=url=>sources.push({name:'hero_reference',url:url.replace(/([?&])api_key=[^&]*/g,''),fetched_at:new Date(now).toISOString(),date_note:'Hora da consulta ao cache (até cinco minutos); não data de atualização da fonte.'});
  try {
    const url=dotaUrl(`/heroes/${player.hero_id}/matches`),list=await cached(url);record(url);
    if(!Array.isArray(list)) throw Error('schema');
    const ids=[...new Set(list.filter(m=>Number.isSafeInteger(m.match_id)&&m.match_id!==match.match_id&&m.start_time>=now/1000-14*86400&&m.start_time<=now/1000).sort((a,b)=>b.start_time-a.start_time).map(m=>m.match_id))].slice(0,6);
    for(let i=0;i<ids.length;i+=2) {
      const results=await Promise.allSettled(ids.slice(i,i+2).map(id=>cached(dotaUrl(`/matches/${id}`))));
      results.forEach((r,j)=>{if(r.status==='fulfilled'&&r.value?.match_id===ids[i+j]){references.push(r.value);record(`https://www.opendota.com/matches/${ids[i+j]}`);}else warnings.push('Uma referência do herói não pôde ser carregada.');});
    }
  } catch { warnings.push('Amostra recente do herói indisponível; nenhuma build ou timing foi inventado.'); }
  const slug=String(heroName).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const integrations=[
    {name:'Dota2ProTracker',url:`https://dota2protracker.com/hero/${encodeURIComponent(heroName)}`,status:'referência manual; API de builds não validada',checked_at:'2026-10-28',population:'7000+ MMR e profissionais; não representa todos os ranks',verification_url:'https://dota2protracker.com/',limitation:'Site público confirmado; tentativa de acesso ao endpoint /api/hero/1/builds não foi validada. Nenhum dado deste provedor é importado automaticamente.'},
    {name:'Dotabuff',url:`https://www.dotabuff.com/heroes/${slug}`,status:'referência manual; API pública não confirmada',checked_at:'2026-10-28',verification_url:'https://www.dotabuff.com/pages/faq',limitation:'FAQ confirma que funções e rotas dependem de parsing TrueSight e que dados detalhados podem faltar. Não há importação automática nem bypass de proteção.'}
  ];
  const analysis=compareHero({match,player,references,stats,evidence,now});
  if(analysis.sample_size<5) warnings.push('Menos de cinco referências comparáveis do herói; comparações são exploratórias.');
  return {analysis,integrations,sources,warnings};
}

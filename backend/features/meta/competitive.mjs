const clean = x => String(x ?? '').replace(/<[^>]*>/g, ' ').slice(0, 200);
export function officialPatches(payload, now) {
  return (Array.isArray(payload?.patches) ? payload.patches : []).filter(p => /^\d+\.\d+[a-z]?$/.test(p.patch_number) && Number.isFinite(p.patch_timestamp) && p.patch_timestamp * 1000 <= now).sort((a,b) => b.patch_timestamp-a.patch_timestamp);
}
export function summarizePros(matches, heroId, from, until) {
  const valid = matches.filter(m => Array.isArray(m.players) && m.players.length === 10 && typeof m.radiant_win === 'boolean' && m.start_time >= from && m.start_time <= until);
  const counts = new Map(), leagues = new Map(), examples = [];
  for (const m of valid) {
    const league = clean(m.league?.name || m.league_name || `Liga ${m.leagueid}`);
    leagues.set(league,(leagues.get(league)||0)+1);
    for (const p of m.players) {
      const entry = counts.get(p.hero_id) || { hero_id:p.hero_id,picks:0,wins:0,bans:0 };
      entry.picks++; if ((p.player_slot<128) === m.radiant_win) entry.wins++;
      counts.set(p.hero_id,entry);
      if(p.hero_id===heroId) examples.push({match_id:m.match_id,url:`https://www.opendota.com/matches/${m.match_id}`,start_time:m.start_time,patch:m.patch,league,player:clean(p.name || p.personaname || 'Profissional não identificado'),team:clean(p.player_slot<128?m.radiant_team?.name:m.dire_team?.name),won:(p.player_slot<128)===m.radiant_win,kills:p.kills,deaths:p.deaths,assists:p.assists,gpm:p.gold_per_min,xpm:p.xp_per_min,final_items:[p.item_0,p.item_1,p.item_2,p.item_3,p.item_4,p.item_5].filter(Number.isInteger),purchases:(p.purchase_log||[]).slice(0,50).map(e=>({time:e.time,item:clean(e.key)}))});
    }
    for(const b of m.picks_bans || []) if(b.is_pick === false) {const e=counts.get(b.hero_id)||{hero_id:b.hero_id,picks:0,wins:0,bans:0};e.bans++;counts.set(b.hero_id,e);}
  }
  return {window_start:from,window_end:until,sample_size:valid.length,draft_sample_size:valid.filter(m=>Array.isArray(m.picks_bans)).length,leagues:[...leagues].map(([name,matches])=>({name,matches})),heroes:[...counts.values()].sort((a,b)=>(b.picks+b.bans)-(a.picks+a.bans)),selected_hero_examples:examples,note:'Amostra limitada aos jogos recentes retornados pelo OpenDota; não é censo de campeonatos nem opinião declarada dos profissionais. Ausência de picks não prova fraqueza. Inventário final não indica ordem de compra.'};
}
export async function loadCompetitiveContext({cached,dotaUrl,heroId,matchStart,now}) {
  const sources=[], warnings=[];
  const source=(name,url)=>sources.push({name,url,fetched_at:new Date(now).toISOString()});
  let patches=[],official=null;
  try {
    const url='https://www.dota2.com/datafeed/patchnoteslist?language=english';
    patches=officialPatches(await cached(url),now);source('official_patch_catalog',url);
    if(!patches.length) throw Error('Catálogo oficial sem patches reconhecidos');
    const latest=patches[0];
    const atMatch=patches.find(p=>p.patch_timestamp<=matchStart);
    const versions=[...new Set([latest.patch_number,atMatch?.patch_number].filter(Boolean))];
    const notes=[];
    for(const version of versions) {
      const url=`https://www.dota2.com/datafeed/patchnotes?version=${encodeURIComponent(version)}&language=english`;
      try {
        const data=await cached(url);
        if(!data || data.success === false || !Object.keys(data).some(k=>!['success','patch_number','patch_timestamp','patch_name'].includes(k))) throw Error('Notas vazias');
        // Preserve the original schema and explicitly disclose truncation.
        const text=JSON.stringify(data);
        notes.push({version,url:`https://www.dota2.com/patches/${version}`,data_excerpt:text.slice(0,45000),truncated:text.length>45000});source('official_notes_'+version,url);
      } catch {warnings.push(`Notas oficiais ${version} indisponíveis; não inferir buffs ou nerfs.`);}
    }
    official={latest:{name:latest.patch_number,date:new Date(latest.patch_timestamp*1000).toISOString(),url:`https://www.dota2.com/patches/${latest.patch_number}`},match_patch_by_date:atMatch?.patch_number||null,date_inference_note:'Patch da partida estimado pela data de publicação; horário exato de rollout pode divergir.',notes};
  } catch { warnings.push('Catálogo oficial do Dota 2 indisponível; patch atual não confirmado.'); }
  const until=Math.floor(now/1000),from=Math.max(until-14*86400,patches[0]?.patch_timestamp||0);
  let professional=null;
  try {
    const url=dotaUrl('/proMatches'),list=await cached(url);
    if(!Array.isArray(list)) throw Error('Lista inválida');
    source('recent_pro_matches','https://api.opendota.com/api/proMatches');
    const recent=[...new Map(list.filter(m=>Number.isSafeInteger(m.match_id)&&m.start_time>=from&&m.start_time<=until).map(m=>[m.match_id,m])).values()].sort((a,b)=>b.start_time-a.start_time).slice(0,8);
    const details=[];
    for(let i=0;i<recent.length;i+=2) {
      const results=await Promise.allSettled(recent.slice(i,i+2).map(m=>cached(dotaUrl('/matches/'+m.match_id))));
      results.forEach((r,j)=>{if(r.status==='fulfilled' && r.value?.match_id===recent[i+j].match_id){details.push({...r.value,league_name:recent[i+j].league_name});source('pro_match_'+r.value.match_id,`https://www.opendota.com/matches/${r.value.match_id}`);}else warnings.push('Uma partida profissional não pôde ser consultada.');});
    }
    professional=summarizePros(details,heroId,from,until);
    professional.requested_matches=recent.length;
    if(professional.sample_size<5) warnings.push('Amostra profissional muito pequena; não classificar heróis como fortes ou fracos com base nela.');
  } catch {warnings.push('Partidas profissionais recentes indisponíveis; não inventar tendências de campeonatos.');}
  return {official_patch:official,recent_professional:professional,sources,warnings};
}

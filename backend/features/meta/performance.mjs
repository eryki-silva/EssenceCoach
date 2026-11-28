// Distribution comparisons are descriptive, never role-specific targets.
export function comparePerformance(data,player){
 const fields={gold_per_min:['Ouro por minuto',player.gold_per_min],xp_per_min:['Experiência por minuto',player.xp_per_min],last_hits_per_min:['Últimos golpes por minuto',Number.isFinite(player.last_hits)&&player.duration>0?player.last_hits*60/player.duration:null]};
 return Object.entries(fields).flatMap(([key,[label,observed]])=>{
  const rows=(Array.isArray(data?.result?.[key])?data.result[key]:[]).filter(r=>Number.isFinite(r.percentile)&&r.percentile>=0&&r.percentile<=1&&Number.isFinite(r.value)).sort((a,b)=>a.percentile-b.percentile);
  const median=rows.find(r=>r.percentile===.5);
  if(!Number.isFinite(observed)||!median)return [];
  return [{key,label,observed:Math.round(observed*10)/10,median:median.value,delta:Math.round((observed-median.value)*10)/10}];
 });
}
export async function loadPerformance({cached,dotaUrl,player,match,now}){
 const sources=[],warnings=[];let stats=null,benchmarks=null;
 const urls=[dotaUrl('/heroStats'),dotaUrl('/benchmarks?hero_id='+player.hero_id)];
 const results=await Promise.allSettled(urls.map(url=>cached(url)));
 results.forEach((r,i)=>{if(r.status==='fulfilled'){sources.push({name:i?'OpenDota · distribuição do herói':'OpenDota · agregados por rank',url:urls[i].replace(/([?&])api_key=[^&]*/g,''),fetched_at:new Date(now).toISOString(),date_note:'Consulta ao cache de até cinco minutos; janela e atualização do agregado não informadas.'});if(i)benchmarks=r.value;else stats=Array.isArray(r.value)?r.value.find(x=>x.id===player.hero_id):null;}else warnings.push('OpenDota: '+(i?'distribuição do herói':'agregados por rank')+' indisponível.');});
 return {stats,performance:{rows:comparePerformance(benchmarks,{...player,duration:match.duration}),sample_size:null,scope:'Distribuição agregada do herói, sem filtro de posição, rank, duração ou patch. Janela, quantidade de partidas e atualização não informadas pelo endpoint. Não representa uma meta obrigatória e não determina erro de gameplay.'},sources,warnings};
}

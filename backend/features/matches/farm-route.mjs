// A trajectory from timestamped replay samples; lane_pos has no chronology.
export function buildFarmRoute(replay,slot,duration){
 if(!replay)return {available:false,reason:'A rota da partida inteira precisa do replay completo processado. Os dados lane_pos do OpenDota cobrem só a fase de rotas e não têm ordem temporal.'};
 const end=Number.isFinite(duration)?Math.max(0,duration):Math.max(0,replay.end??0);
 const points=(replay.samples??[]).filter(p=>p.player_slot===slot&&Number.isFinite(p.time)&&p.time>=0&&p.time<=end&&Number.isFinite(p.x)&&Number.isFinite(p.y)).map(p=>({time:p.time,x:p.x,y:p.y,life_state:p.life_state??null,lh:Number.isFinite(p.lh)?p.lh:null})).sort((a,b)=>a.time-b.time).filter((p,i,rows)=>!i||p.time!==rows[i-1].time);
 if(!points.length)return {available:false,reason:'O replay não contém posições temporais deste jogador durante a partida.'};
 return {available:true,source:replay.source??'Replay local processado',player_slot:slot,duration:end,start:points[0].time,end:points.at(-1).time,points,
  note:'Trajeto observado do herói, não uma rota ideal recomendada. Aumento de últimos golpes é associado ao intervalo entre amostras; não confirma a posição exata do creep nem farm por unidades controladas em outro local.'};
}

export function laneHeatmap(player) {
  const cells=[];
  const raw=player.lane_pos;
  if(raw && typeof raw==='object' && !Array.isArray(raw)) for(const [sx,row] of Object.entries(raw)) {
    const x=Number(sx);
    if(!Number.isFinite(x)||x<0||x>255||!row||typeof row!=='object'||Array.isArray(row))continue;
    for(const [sy,count] of Object.entries(row)) {
      const y=Number(sy);
      if(Number.isFinite(y)&&y>=0&&y<=255&&Number.isFinite(count)&&count>0)cells.push({x,y,count});
    }
  }
  return {available:cells.length>0,source:'OpenDota · lane_pos',coverage:'Fase de rotas · até 10 min (pode incluir pré-jogo)',cells,total_samples:cells.reduce((sum,p)=>sum+p.count,0)};
}

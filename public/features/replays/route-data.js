// Pure route geometry shared by the view and regression tests.
export function routeWindow(route,from=0,to=route.duration){
 const rows=route.points??[],segments=[],farm=[];let current=[];let interruptions=0;
 for(let i=0;i<rows.length;i++){
  const p=rows[i];if(p.time<from||p.time>to)continue;
  const previous=rows[i-1];
  const alive=p.life_state===null||p.life_state===undefined||p.life_state===0;
  const continuous=alive&&previous&&(previous.life_state==null||previous.life_state===0)&&p.time>previous.time&&p.time-previous.time<=4&&Math.hypot(p.x-previous.x,p.y-previous.y)*128<=1800;
  if(!alive||!continuous){if(current.length){segments.push(current);interruptions++;}current=[];}
  if(alive)current.push(p);
  // Do not assign a growth across a gap, death or teleport to a map location.
  if(continuous&&previous.time>=from&&Number.isFinite(previous.lh)&&Number.isFinite(p.lh)&&p.lh>previous.lh)farm.push({time:p.time,x:p.x,y:p.y,count:p.lh-previous.lh,from:previous.time});
 }
 if(current.length)segments.push(current);
 return {segments,farm,interruptions,samples:segments.reduce((n,s)=>n+s.length,0),last_hits:farm.reduce((n,f)=>n+f.count,0)};
}

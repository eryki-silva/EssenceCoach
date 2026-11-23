const levels={debug:10,info:20,warn:30,error:40,silent:Infinity};
const allowed=new Set(['status','duration_ms','action','match_id','job_state','version','reason','code','parser_available','signal','port','mode']);
export function createLogger({level='warn',sink=console}={}){
  const logger={};
  for(const name of ['debug','info','warn','error'])logger[name]=(event,details={})=>{
    if(levels[name]<levels[level])return;
    const safe=Object.fromEntries(Object.entries(details).filter(([key,value])=>allowed.has(key)&&['string','number','boolean'].includes(typeof value)).map(([key,value])=>[key,typeof value==='string'?value.slice(0,180):value]));
    (sink[name]||sink.log).call(sink,JSON.stringify({time:new Date().toISOString(),level:name,event,...safe}));
  };
  return logger;
}

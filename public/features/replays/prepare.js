import {apiPaths} from '../../core/api.js';
export async function prepareFarmReplay(api,id,{onProgress=()=>{},wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),now=()=>Date.now(),timeoutMs=180000}={}){
 const deadline=now()+timeoutMs;
 let status=await api(apiPaths.action(id,'replay'));
 if(status.state==='idle'||status.state==='failed')status=await api(apiPaths.action(id,'replay'),{method:'POST',body:'{}'});
 while(['receiving','downloading','parsing'].includes(status.state)&&now()<deadline){
  onProgress('Preparando a rota de farm: '+status.message);
  await wait(3000);status=await api(apiPaths.action(id,'replay'));
 }
 return {ready:status.state==='complete',message:status.state==='complete'?'Replay completo pronto.':status.message||'Replay ainda não disponível.'};
}

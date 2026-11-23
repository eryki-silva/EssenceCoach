export const apiPaths={health:'/api/health',check:'/api/gemini/check',match:id=>'/api/matches/'+encodeURIComponent(id),action:(id,action)=>'/api/matches/'+encodeURIComponent(id)+'/'+action};
export async function api(path,options={}){
 const {timeoutMs=125000,signal,...rest}=options;const timeout=AbortSignal.timeout(timeoutMs);
 const response=await fetch(path,{...rest,signal:signal?AbortSignal.any([signal,timeout]):timeout,headers:{'Content-Type':'application/json',...rest.headers}});
 let data;try{data=await response.json();}catch{throw new Error('O servidor não retornou uma resposta válida. Tente novamente.');}
 if(!response.ok)throw new Error(typeof data.error==='string'?data.error:data.error?.message||'Não foi possível concluir a solicitação.');return data;
}
export function errorMessage(error){return error.name==='TimeoutError'?'A solicitação demorou demais. Aguarde e tente novamente.':error.message||'Falha de conexão com o servidor.';}

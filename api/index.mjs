import {createApp} from '../backend/app.mjs';
import {createService} from '../lib.mjs';
import {loadSettings} from '../backend/config/settings.mjs';
import {AppError} from '../backend/shared/errors.mjs';
import {securityHeaders,sendJson} from '../backend/shared/http.mjs';
export function cloudSettings(env=process.env){
 const settings=loadSettings({...env,DOTA_ENV:'production',APP_ORIGIN:env.APP_ORIGIN||'https://essencecoach.vercel.app'},{publicAccess:true});
 const allowedOrigins=[settings.origin];
 for(const host of [env.VERCEL_URL,env.VERCEL_PROJECT_PRODUCTION_URL])if(host&&/^[a-z0-9.-]+\.vercel\.app$/.test(host))allowedOrigins.push('https://'+host);
 return {...settings,allowedOrigins};
}
export function cloudReplayStore(){
 const message='O processamento completo de replay e a rota de farm estão disponíveis na instalação Windows. A Vercel executa a aula com os eventos públicos do OpenDota; o parser Java precisa de um servidor próprio.';
 const unavailable=async()=>{throw new AppError(message,503);};
 return {available:async()=>false,data:async()=>null,status:async()=>({state:'unavailable',message}),download:unavailable,upload:unavailable};
}
export function createCloudHandler({env=process.env,fetcher=fetch}={}){
 const settings=cloudSettings(env);
 const service=createService({env,fetcher,settings,replayStore:cloudReplayStore()});
 return createApp(service,settings).listeners('request')[0];
}
export function configurationIssue(env=process.env){
 if(!(env.GEMINI_API_KEY||env.GOOGLE_API_KEY||'').trim())return 'GEMINI_API_KEY está vazia ou não foi aplicada em Production.';
 try{cloudSettings(env);}catch{return 'Confira APP_ORIGIN, PORT e as opções de ambiente da publicação.';}
 return 'Não foi possível inicializar a API. Consulte os logs de runtime da Vercel.';
}
let handler;
export default async function entry(req,res){
 try{handler??=createCloudHandler();return await handler(req,res);}
 catch{sendJson(res,{error:configurationIssue(),code:'APP_CONFIGURATION_ERROR'},503,securityHeaders(true));}
}

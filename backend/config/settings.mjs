import {readFileSync} from 'node:fs';
const pkg=JSON.parse(readFileSync(new URL('../../package.json',import.meta.url),'utf8'));
export const system=Object.freeze({name:'Ancient · Dota Coach',version:pkg.version});
function integer(env,key,fallback,min,max){const raw=env[key];const n=raw===undefined||raw===''?fallback:Number(raw);if(!Number.isInteger(n)||n<min||n>max)throw new Error(`${key} inválido.`);return n;}
export function loadSettings(env=process.env){
  const mode=env.DOTA_ENV||'local';if(!['local','production','test'].includes(mode))throw new Error('DOTA_ENV deve ser local, test ou production.');
  const production=mode==='production',port=integer(env,'PORT',3000,1,65535);
  let origin=null;
  if(env.APP_ORIGIN){try{const parsed=new URL(env.APP_ORIGIN);if(parsed.username||parsed.password||parsed.pathname!=='/'||parsed.search||parsed.hash||!['http:','https:'].includes(parsed.protocol))throw Error();origin=parsed.origin;}catch{throw new Error('APP_ORIGIN deve conter somente uma origem HTTP ou HTTPS válida.');}}
  const accessPassword=env.APP_ACCESS_PASSWORD||'';
  if(production){
    if(!origin?.startsWith('https://'))throw new Error('Produção exige APP_ORIGIN com HTTPS.');
    if(accessPassword.length<16||/change-me|senha-aqui/i.test(accessPassword))throw new Error('Produção exige APP_ACCESS_PASSWORD com pelo menos 16 caracteres.');
    if(!(env.GEMINI_API_KEY||env.GOOGLE_API_KEY||'').trim())throw new Error('Produção exige GEMINI_API_KEY ou GOOGLE_API_KEY.');
  }
  const logLevel=env.LOG_LEVEL||(production?'info':'warn');if(!['debug','info','warn','error','silent'].includes(logLevel))throw new Error('LOG_LEVEL inválido.');
  const host=env.HOST||(production?'0.0.0.0':'127.0.0.1');
  if(!production&&!['localhost','127.0.0.1','::1'].includes(host))throw new Error('No modo local, HOST deve ser uma interface de loopback.');
  return Object.freeze({mode,production,port,host,origin,accessPassword,logLevel,requestTimeoutMs:integer(env,'REQUEST_TIMEOUT_MS',120000,10000,600000),externalTimeoutMs:integer(env,'EXTERNAL_TIMEOUT_MS',25000,1000,120000),cacheTtlMs:integer(env,'CACHE_TTL_MS',300000,1000,3600000),system});
}

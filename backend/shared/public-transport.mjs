import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {join} from 'node:path';
const run=promisify(execFile);
// Only public, read-only data. No Gemini credentials or arbitrary destinations.
export function publicDataUrl(value){
 const url=new URL(value);
 if(url.protocol!=='https:'||url.port||url.username||url.password||url.hash)return null;
 if(url.hostname==='api.opendota.com'&&/^\/api\/matches\/[1-9]\d{5,11}$/.test(url.pathname)){url.search='';return url.href;}
 if(url.hostname==='api.opendota.com'&&(/^\/api\/heroes\/[1-9]\d{0,3}\/matches$/.test(url.pathname)||url.pathname==='/api/heroStats')){url.search='';return url.href;}
 if(url.hostname==='api.opendota.com'&&url.pathname==='/api/benchmarks'&&/^[1-9]\d{0,3}$/.test(url.searchParams.get('hero_id')??'')){const hero=url.searchParams.get('hero_id');url.search='';url.searchParams.set('hero_id',hero);return url.href;}
 if(url.hostname==='raw.githubusercontent.com'&&url.pathname==='/odota/dotaconstants/master/build/heroes.json'&&!url.search)return url.href;
 return null;
}
export async function publicDataFallback(url,{platform=process.platform,runner=run,systemRoot=process.env.SystemRoot||'C:\\Windows',timeoutMs=45000}={}){
 const safe=publicDataUrl(url);
 if(platform!=='win32'||!safe)return null;
 const {stdout}=await runner(join(systemRoot,'System32','curl.exe'),['--silent','--show-error','--proto','=https','--connect-timeout','10','--max-time',String(timeoutMs/1000),'--max-filesize','12000000','--write-out','\n%{http_code}',safe],{windowsHide:true,timeout:timeoutMs+2000,maxBuffer:12001000,encoding:'utf8'});
 const separator=stdout.lastIndexOf('\n'),status=Number(stdout.slice(separator+1));
 if(separator<0||!Number.isInteger(status)||status<200||status>599)throw new Error('Invalid public transport response');
 return new Response(stdout.slice(0,separator),{status,headers:{'Content-Type':'application/json'}});
}

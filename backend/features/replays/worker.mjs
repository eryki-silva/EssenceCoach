import {spawn} from 'node:child_process';
import {createReadStream,createWriteStream} from 'node:fs';
import {readFile,writeFile,mkdir,rename,unlink,access} from 'node:fs/promises';
import {createInterface} from 'node:readline';
import {pipeline} from 'node:stream/promises';
import {Readable,Transform} from 'node:stream';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {createReplayCollector,ReplayError} from './data.mjs';

const root=fileURLToPath(new URL('../../../',import.meta.url));
export const MAX_REPLAY_BYTES=512*1024*1024;
function validateId(id) {if(!/^[1-9]\d{5,11}$/.test(String(id)))throw new ReplayError('ID de partida inválido.');return String(id);}
export function safeReplayUrl(raw,id) {
  let u;try{u=new URL(raw);}catch{throw new ReplayError('Endereço de replay indisponível.');}
  if(!['http:','https:'].includes(u.protocol)||!/^replay\d+\.valve\.net$/.test(u.hostname)||u.port||u.username||u.password||u.search||u.hash||!new RegExp(`^/570/${validateId(id)}_\\d+\\.dem(?:\\.bz2|\\.zst)?$`).test(u.pathname))throw new ReplayError('O endereço não é um replay oficial desta partida.');
  return u.href;
}
export async function parserConfig() {
  try {
    const c=JSON.parse((await readFile(join(root,'.runtime','parser.json'),'utf8')).replace(/^\uFEFF/,''));
    if(!c.java||!c.jar)throw Error();
    await Promise.all([access(c.java),access(c.jar)]);return c;
  } catch {throw new ReplayError('Instale o leitor de replays com INSTALAR-REPLAY.cmd antes de processar o arquivo.',503);}
}
export async function runReplayParser(inputPath,id,config) {
  const collector=createReplayCollector(id);
  const env=Object.fromEntries(['SystemRoot','WINDIR','TEMP','TMP','PATH'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
  const child=spawn(config.java,['-Xmx2048m','-cp',config.jar,'opendota.CoachCli'],{windowsHide:true,stdio:['pipe','pipe','pipe'],env});
  const timeout=setTimeout(()=>child.kill(),600000);timeout.unref();
  child.stderr.resume(); // Never expose raw parser errors or replay metadata in HTTP responses.
  const exited=new Promise((resolve,reject)=>{child.once('error',()=>reject(new ReplayError('Não foi possível iniciar o leitor Java.',503)));child.once('close',code=>code===0?resolve():reject(new ReplayError('O replay não pôde ser processado. Ele pode estar incompleto, expirado ou usar um formato ainda incompatível.',422)));});
  const consume=(async()=>{const lines=createInterface({input:child.stdout,crlfDelay:Infinity});for await(const line of lines){if(line.length>2_000_000)throw new ReplayError('Evento externo excedeu o limite.');try{collector.add(JSON.parse(line));}catch(e){if(e instanceof ReplayError)throw e;throw new ReplayError('Formato inesperado retornado pelo leitor de replay.');}}})();
  try {
    await Promise.all([pipeline(createReadStream(inputPath),child.stdin),consume,exited]);
    const data=collector.finish();data.provenance={parser_revision:config.parser_revision,adapter:config.adapter,parsed_at:new Date().toISOString()};return data;
  } catch(e) {child.kill();await Promise.allSettled([exited,consume]);throw e instanceof ReplayError?e:new ReplayError('A leitura do arquivo foi interrompida.',422);}
  finally {clearTimeout(timeout);}
}
export function createReplayStore({directory=join(root,'.replays'),fetcher=fetch,getConfig=parserConfig,runner=runReplayParser,now=()=>Date.now()}={}) {
  const jobs=new Map();let active=null;
  const file=id=>join(directory,validateId(id)+'.json');
  const publicJob=job=>({state:job.state,message:job.message,updated_at:job.updated_at,match_id:job.id});
  function update(job,state,message){Object.assign(job,{state,message,updated_at:new Date(now()).toISOString()});}
  async function data(id){try{return JSON.parse(await readFile(file(id),'utf8'));}catch(e){if(e instanceof ReplayError)throw e;return null;}}
  async function status(id){validateId(id);const job=jobs.get(String(id));if(job)return publicJob(job);const saved=await data(id);return {state:saved?'complete':'idle',message:saved?'Replay processado disponível.':'Replay completo ainda não processado.',match_id:String(id)};}
  async function reserve(id){id=validateId(id);if(active)throw new ReplayError('Há um replay em processamento. Aguarde terminar.',429);const config=await getConfig();if(active)throw new ReplayError('Há um replay em processamento.',429);const job={id};active=job;update(job,'receiving','Recebendo arquivo de replay...');jobs.set(id,job);try{await mkdir(directory,{recursive:true});}catch{active=null;jobs.delete(id);throw new ReplayError('Não foi possível criar a pasta local de replays.',503);}if(jobs.size>50){const oldest=[...jobs.keys()].find(key=>key!==id);if(oldest)jobs.delete(oldest);}return {job,config};}
  async function saveInput(stream,path){let bytes=0;const limit=new Transform({transform(chunk,encoding,callback){bytes+=chunk.length;callback(bytes>MAX_REPLAY_BYTES?new ReplayError('Replay maior que o limite de 512 MB.',413):null,chunk);}});await pipeline(stream,limit,createWriteStream(path,{flags:'wx'}));if(!bytes)throw new ReplayError('Arquivo de replay vazio.');}
  async function processFile(job,config,path){try{update(job,'parsing','Lendo posições e eventos do replay...');const result=await runner(path,job.id,config);if(result.match_id!==job.id)throw new ReplayError('Replay de outra partida.');const target=file(job.id);const temporary=target+'.tmp';await writeFile(temporary,JSON.stringify(result));await rename(temporary,target);update(job,'complete','Replay pronto: mapa e contexto das decisões disponíveis.');}catch(e){update(job,'failed',e instanceof ReplayError?e.message:'Não foi possível processar o replay.');}finally{await unlink(path).catch(()=>{});if(active===job)active=null;}}
  async function upload(id,stream){const {job,config}=await reserve(id);const path=join(directory,job.id+'-'+randomUUID()+'.dem');try{await saveInput(stream,path);}catch(e){update(job,'failed','O envio do replay falhou.');active=null;await unlink(path).catch(()=>{});throw e;}void processFile(job,config,path);return publicJob(job);}
  async function download(id,getUrl){const {job,config}=await reserve(id);const path=join(directory,job.id+'-'+randomUUID()+'.dem');update(job,'downloading','Buscando replay nos servidores da Valve...');void(async()=>{try{const url=safeReplayUrl(await getUrl(),id);const response=await fetcher(url,{signal:AbortSignal.timeout(180000),redirect:'error'});if(!response.ok||!response.body)throw new ReplayError('Replay indisponível nos servidores da Valve. Envie o arquivo .dem baixado pelo Dota.');if(Number(response.headers.get('content-length'))>MAX_REPLAY_BYTES)throw new ReplayError('Replay excede 512 MB.');await saveInput(Readable.fromWeb(response.body),path);await processFile(job,config,path);}catch(e){update(job,'failed',e instanceof ReplayError?e.message:'Não foi possível baixar o replay. Tente enviar o arquivo .dem.');await unlink(path).catch(()=>{});if(active===job)active=null;}})();return publicJob(job);}
  return {data,status,upload,download,available:async()=>{try{await getConfig();return true;}catch{return false;}}};
}

import http from 'node:http';
import test from 'node:test';
import assert from 'node:assert/strict';
import {loadSettings,system} from '../backend/config/settings.mjs';
import {createLogger} from '../backend/shared/logger.mjs';
import {createApp} from '../backend/app.mjs';
import {assets} from '../backend/config/assets.mjs';
import {readFile} from 'node:fs/promises';
function request(url,{headers}={}){return new Promise((resolve,reject)=>{http.get(url,{headers},res=>{let body='';res.setEncoding('utf8');res.on('data',chunk=>body+=chunk);res.on('end',()=>resolve({status:res.statusCode,json:async()=>JSON.parse(body),text:async()=>body}));}).on('error',reject);});}
const production={DOTA_ENV:'production',APP_ORIGIN:'https://coach.example.com',APP_ACCESS_PASSWORD:'test-password-long-enough',GEMINI_API_KEY:'fixture-key',LOG_LEVEL:'silent'};
test('configuração local mantém chave opcional; produção falha antes de iniciar sem requisitos',()=>{
 assert.equal(loadSettings({}).host,'127.0.0.1');
 assert.throws(()=>loadSettings({HOST:'0.0.0.0'}),/loopback/);
 for(const key of ['APP_ORIGIN','APP_ACCESS_PASSWORD'])assert.throws(()=>loadSettings({...production,[key]:''}));
 assert.throws(()=>loadSettings({...production,APP_ORIGIN:'https://coach.example.com/path'}));
 assert.throws(()=>loadSettings({PORT:'NaN'}));
 assert.equal(loadSettings(production).host,'0.0.0.0');
});
test('logs estruturados descartam cabeçalhos, credenciais e corpos',()=>{
 const rows=[];const logger=createLogger({level:'info',sink:{info:r=>rows.push(JSON.parse(r))}});
 logger.info('request',{status:200,authorization:'secret',api_key:'secret',body:'private',focus:'private'});
 assert.equal(rows[0].status,200);assert(!JSON.stringify(rows).includes('secret'));assert(!JSON.stringify(rows).includes('private'));
});
test('produção protege páginas e API; health apresenta versão sem credenciais',async t=>{
 const app=createApp({configured:()=>true},loadSettings(production));
 await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>app.close(resolve)));
 const base='http://127.0.0.1:'+app.address().port,headers={Host:'coach.example.com'};
 let response=await request(base+'/api/health',{headers});assert.equal(response.status,200);const health=await response.json();assert.equal(health.version,system.version);assert(!JSON.stringify(health).includes('fixture-key'));
 response=await request(base+'/',{headers});assert.equal(response.status,401);
 response=await request(base+'/',{headers:{...headers,Authorization:'Basic '+Buffer.from('coach:'+production.APP_ACCESS_PASSWORD).toString('base64')}});assert.equal(response.status,200);assert.match(await response.text(),/começa no replay/);
 response=await request(base+'/api/health',{headers:{Host:'evil.example.com'}});assert.equal(response.status,403);
});
test('todos os recursos da interface estão na lista pública e existem',async()=>{
 for(const [url,[file]] of Object.entries(assets)){assert(!url.includes('..'));await readFile(new URL('../public/'+file,import.meta.url));}
 const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');assert.match(html,/type="module"/);
 const stylesheet=await readFile(new URL('../public/styles/studio.css',import.meta.url),'utf8');assert.match(stylesheet,/ancient-battlefield.jpg/);
});

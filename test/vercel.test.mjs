import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {cloudSettings,createCloudHandler,cloudReplayStore} from '../api/index.mjs';
const env={VERCEL:'1',GEMINI_API_KEY:'fixture-only-key',VERCEL_URL:'preview-test.vercel.app',LOG_LEVEL:'silent'};
function request(server,path,headers={},body){return new Promise((resolve,reject)=>{const req=http.request({hostname:'127.0.0.1',port:server.address().port,path,method:body===undefined?'GET':'POST',headers:{Host:'essencecoach.vercel.app',...headers}},res=>{let data='';res.setEncoding('utf8');res.on('data',chunk=>data+=chunk);res.on('end',()=>resolve({status:res.statusCode,data}));});req.on('error',reject);req.end(body);});}
test('Vercel exige segredos e permite apenas hosts confiáveis do projeto',()=>{
 assert.throws(()=>cloudSettings({}));const s=cloudSettings(env);assert.equal(s.publicAccess,true);assert(s.allowedOrigins.includes('https://essencecoach.vercel.app'));assert(s.allowedOrigins.includes('https://preview-test.vercel.app'));
 assert(!cloudSettings({...env,VERCEL_URL:'evil.example/path'}).allowedOrigins.includes('https://evil.example/path'));
});
test('replay na nuvem declara limitação sem receber arquivo nem iniciar Java',async()=>{
 const replay=cloudReplayStore();assert.equal(await replay.available(),false);assert.equal(await replay.data(),null);assert.equal((await replay.status()).state,'unavailable');await assert.rejects(()=>replay.upload(),e=>e.status===503);
});
test('adaptador atende health, permite consultas públicas e aceita corpo Vercel sem expor segredos',async t=>{
 const handler=createCloudHandler({env,fetcher:async url=>new Response(JSON.stringify(url.includes('/api/matches/')?{match_id:9101771071,duration:600,players:[{player_slot:0,hero_id:1}]}:url.endsWith('heroes.json')?{1:{localized_name:'Anti-Mage',name:'npc_dota_hero_antimage'}}:{models:[{name:'models/gemini-2.5-flash',supportedGenerationMethods:['generateContent']}]}))});
 const server=http.createServer((req,res)=>{if(req.url==='/api/gemini/check')Object.defineProperty(req,'body',{value:{}});return handler(req,res);});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 let result=await request(server,'/api/health');assert.equal(result.status,200);assert(!result.data.includes('fixture-only-key'));
 result=await request(server,'/api/matches/9101771071');assert.equal(result.status,200);
 result=await request(server,'/api/gemini/check',{'Content-Type':'application/json'},'{}');assert.equal(result.status,200);assert.match(result.data,/confirmada/);
 result=await request(server,'/api/health',{Host:'evil.example'});assert.equal(result.status,403);
 result=await request(server,'/api/health',{Host:'preview-test.vercel.app'});assert.equal(result.status,200);
});

test('diagnóstico de configuração identifica o campo sem expor valores secretos',async()=>{
 const {configurationIssue}=await import('../api/index.mjs');
 assert.match(configurationIssue({}),/GEMINI_API_KEY/);
 const short={...env,APP_ACCESS_PASSWORD:'secret-short'};assert.equal(cloudSettings(short).publicAccess,true);assert(!configurationIssue(short).includes(short.APP_ACCESS_PASSWORD));
 assert(!configurationIssue(env).includes(env.GEMINI_API_KEY));
});

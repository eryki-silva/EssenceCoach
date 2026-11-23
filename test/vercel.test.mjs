import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {cloudSettings,createCloudHandler,cloudReplayStore} from '../api/index.mjs';
const env={VERCEL:'1',GEMINI_API_KEY:'fixture-only-key',APP_ACCESS_PASSWORD:'fixture-password-at-least-16',VERCEL_URL:'preview-test.vercel.app',LOG_LEVEL:'silent'};
function request(server,path,headers={},body){return new Promise((resolve,reject)=>{const req=http.request({hostname:'127.0.0.1',port:server.address().port,path,method:body===undefined?'GET':'POST',headers:{Host:'essencecoach.vercel.app',...headers}},res=>{let data='';res.setEncoding('utf8');res.on('data',chunk=>data+=chunk);res.on('end',()=>resolve({status:res.statusCode,data}));});req.on('error',reject);req.end(body);});}
test('Vercel exige segredos e permite apenas hosts confiáveis do projeto',()=>{
 assert.throws(()=>cloudSettings({}));const s=cloudSettings(env);assert(s.allowedOrigins.includes('https://essencecoach.vercel.app'));assert(s.allowedOrigins.includes('https://preview-test.vercel.app'));
 assert(!cloudSettings({...env,VERCEL_URL:'evil.example/path'}).allowedOrigins.includes('https://evil.example/path'));
});
test('replay na nuvem declara limitação sem receber arquivo nem iniciar Java',async()=>{
 const replay=cloudReplayStore();assert.equal(await replay.available(),false);assert.equal(await replay.data(),null);assert.equal((await replay.status()).state,'unavailable');await assert.rejects(()=>replay.upload(),e=>e.status===503);
});
test('adaptador atende health, protege consultas e aceita corpo Vercel sem expor segredos',async t=>{
 const handler=createCloudHandler({env,fetcher:async()=>new Response(JSON.stringify({models:[{name:'models/gemini-2.5-flash',supportedGenerationMethods:['generateContent']}]}))});
 const server=http.createServer((req,res)=>{if(req.url==='/api/gemini/check')Object.defineProperty(req,'body',{value:{}});return handler(req,res);});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 let result=await request(server,'/api/health');assert.equal(result.status,200);assert(!result.data.includes('fixture-only-key'));
 result=await request(server,'/api/matches/9101771071');assert.equal(result.status,401);
 result=await request(server,'/api/gemini/check',{Authorization:'Basic '+Buffer.from('coach:'+env.APP_ACCESS_PASSWORD).toString('base64'),'Content-Type':'application/json'},'{}');assert.equal(result.status,200);assert.match(result.data,/confirmada/);
 result=await request(server,'/api/health',{Host:'evil.example'});assert.equal(result.status,403);
 result=await request(server,'/api/health',{Host:'preview-test.vercel.app'});assert.equal(result.status,200);
});

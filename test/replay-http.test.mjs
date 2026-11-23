import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {gunzipSync} from 'node:zlib';
import {createApp} from '../server.mjs';
const id='8123456789';
function call(server,path,{method='GET',body,headers={}}={}){return new Promise((resolve,reject)=>{const req=http.request({host:'127.0.0.1',port:server.address().port,path,method,headers},res=>{const chunks=[];res.on('data',b=>chunks.push(b));res.on('end',()=>{try{let bytes=Buffer.concat(chunks);if(res.headers['content-encoding']==='gzip')bytes=gunzipSync(bytes);resolve({status:res.statusCode,headers:res.headers,body:JSON.parse(bytes.toString())});}catch(e){reject(e);}});});req.on('error',reject);req.setTimeout(3000,()=>req.destroy(new Error('HTTP test timeout: '+path)));req.end(body);});}
test('rotas de replay validam conteúdo binário, tamanho, origem e dados ausentes',async t=>{
 let uploaded='';
 const service={configured:()=>false,replayStatus:async()=>({state:'idle'}),replayData:async()=>null,replayDownload:async()=>({state:'downloading'}),replayUpload:async(matchId,req)=>{assert.equal(matchId,id);for await(const chunk of req)uploaded+=chunk;return {state:'parsing'};}};
 const server=createApp(service);await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>{server.closeAllConnections();server.close();});
 assert.equal((await call(server,'/api/matches/'+id+'/replay')).body.state,'idle');
 assert.equal((await call(server,'/api/matches/'+id+'/replay-data')).status,404);
 assert.equal((await call(server,'/api/matches/'+id+'/replay',{method:'POST',headers:{'content-type':'application/json'},body:'{}'})).status,202);
 assert.equal((await call(server,'/api/matches/'+id+'/replay-upload',{method:'POST',headers:{'content-type':'application/json'},body:'{}'})).status,415);
 const good=await call(server,'/api/matches/'+id+'/replay-upload',{method:'POST',headers:{'content-type':'application/octet-stream'},body:'synthetic bytes'});assert.equal(good.status,202);assert.equal(uploaded,'synthetic bytes');
 assert.equal((await call(server,'/api/matches/'+id+'/replay-upload',{method:'POST',headers:{'content-type':'application/octet-stream','content-length':536870913}})).status,413);
 assert.equal((await call(server,'/api/matches/'+id+'/replay',{headers:{origin:'https://evil.example'}})).status,403);
 const script=await new Promise(resolve=>http.get({host:'127.0.0.1',port:server.address().port,path:'/replay-ui.js'},res=>{res.resume();resolve(res.statusCode);}));assert.equal(script,200);
});

test('mapa negocia gzip sem alterar dados e respeita cliente que recusa compressão',async t=>{
 const data={match_id:id,resource_catalog:[{name:'test_spell'}],states:[{mana:0,abilities:[[0,8.5]]}]};
 const server=createApp({replayData:async()=>data});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>{server.closeAllConnections();server.close();});
 const compressed=await call(server,'/api/matches/'+id+'/replay-data',{headers:{'accept-encoding':'gzip, deflate'}});
 assert.equal(compressed.headers['content-encoding'],'gzip');assert.deepEqual(compressed.body,data);
 const plain=await call(server,'/api/matches/'+id+'/replay-data',{headers:{'accept-encoding':'gzip;q=0'}});assert.equal(plain.headers['content-encoding'],undefined);assert.deepEqual(plain.body,data);
});

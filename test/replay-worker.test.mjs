import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {Readable} from 'node:stream';
import {setTimeout as delay} from 'node:timers/promises';
import {createReplayStore,safeReplayUrl} from '../replay-worker.mjs';
import {ReplayError} from '../replay-data.mjs';
const id='8123456789';
async function directory(t){const dir=await mkdtemp(join(tmpdir(),'dota-coach-replay-test-'));t.after(async()=>{assert.equal(dirname(resolve(dir)),resolve(tmpdir()));assert.match(dir,/dota-coach-replay-test-/);await rm(dir,{recursive:true,force:true});});return dir;}
async function done(store){for(let i=0;i<100;i++){const job=await store.status(id);if(['complete','failed'].includes(job.state))return job;await delay(5);}throw Error('job timeout');}
test('aceita só URLs de replay oficiais da partida, sem destinos arbitrários',()=>{
 assert.equal(safeReplayUrl('http://replay117.valve.net/570/'+id+'_123.dem.bz2',id),'http://replay117.valve.net/570/'+id+'_123.dem.bz2');
 for(const url of ['http://localhost/test','https://replay1.valve.net.evil.com/570/'+id+'_1.dem','http://replay1.valve.net:8080/570/'+id+'_1.dem','http://replay1.valve.net/570/999999999_1.dem','http://user@replay1.valve.net/570/'+id+'_1.dem'])assert.throws(()=>safeReplayUrl(url,id));
});
test('upload processa em segundo plano e persiste somente resultado validado',async t=>{
 const dir=await directory(t);let release;const gate=new Promise(r=>release=r);
 const store=createReplayStore({directory:dir,getConfig:async()=>({}),runner:async()=>{await gate;return {match_id:id,samples:[{x:100}],participants:[]};}});
 const job=await store.upload(id,Readable.from([Buffer.from('synthetic-replay')]));assert.equal(job.state,'parsing');
 await assert.rejects(()=>store.upload('8123456788',Readable.from(['test'])),e=>e.status===429);
 release();assert.equal((await done(store)).state,'complete');assert.equal((await store.data(id)).match_id,id);
 const restored=createReplayStore({directory:dir});assert.equal((await restored.status(id)).state,'complete');
});
test('erro do parser não expõe logs externos nem salva resultado falso',async t=>{
 const store=createReplayStore({directory:await directory(t),getConfig:async()=>({}),runner:async()=>{throw Error('secret-error-from-parser');}});
 await store.upload(id,Readable.from(['test']));const job=await done(store);assert.equal(job.state,'failed');assert(!job.message.includes('secret-error'));assert.equal(await store.data(id),null);
});
test('download rejeita redirecionamentos e verifica a origem antes de buscar o binário',async t=>{
 let fetched=false;
 const store=createReplayStore({directory:await directory(t),getConfig:async()=>({}),fetcher:async()=>{fetched=true;throw Error();}});
 await store.download(id,async()=>'http://localhost/private');assert.equal((await done(store)).state,'failed');assert.equal(fetched,false);
});
test('ausência de runtime não recebe arquivo nem deixa tarefa ocupada',async t=>{
 const store=createReplayStore({directory:await directory(t),getConfig:async()=>{throw new ReplayError('Instale o leitor',503);}});
 await assert.rejects(()=>store.upload(id,Readable.from(['test'])),e=>e.status===503);assert.equal((await store.status(id)).state,'idle');
});

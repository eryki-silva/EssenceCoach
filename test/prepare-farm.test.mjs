import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareFarmReplay} from '../public/features/replays/prepare.js';
test('replay pronto é reutilizado sem download nem espera antes da IA',async()=>{
 let calls=0;const result=await prepareFarmReplay(async()=>{calls++;return {state:'complete'};},'123456',{wait:()=>{throw Error('should not wait');}});assert(result.ready);assert.equal(calls,1);
});
test('replay ausente inicia download e aguarda processamento antes da análise',async()=>{
 const calls=[],progress=[];let ticks=0;const statuses=[{state:'idle'},{state:'downloading',message:'baixando'},{state:'parsing',message:'processando'},{state:'complete'}];
 const result=await prepareFarmReplay(async(path,options)=>{calls.push({path,options});return statuses.shift();},'123456',{onProgress:m=>progress.push(m),wait:async()=>{ticks++;},now:()=>ticks*3000});
 assert(result.ready);assert.equal(calls[1].options.method,'POST');assert.equal(progress.length,2);
});
test('falha ou processamento demorado não impede aula com dados disponíveis',async()=>{
 let clock=0;const result=await prepareFarmReplay(async()=>({state:'parsing',message:'ainda processando'}),'123456',{wait:async()=>{clock+=3000;},now:()=>clock,timeoutMs:6000});assert(!result.ready);assert.equal(clock,6000);
 const failed=await prepareFarmReplay(async()=>({state:'failed',message:'replay expirado'}),'123456');assert(!failed.ready);assert.equal(failed.message,'replay expirado');
});

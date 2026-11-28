import test from 'node:test';
import assert from 'node:assert/strict';
import {comparePerformance,loadPerformance} from '../backend/features/meta/performance.mjs';
test('distribuição compara valores presentes sem inventar percentil ou amostra',()=>{
 const rows=comparePerformance({result:{gold_per_min:[{percentile:.5,value:600}],xp_per_min:[{percentile:.5,value:900}],last_hits_per_min:[{percentile:.5,value:6}]}},{gold_per_min:450,last_hits:100,duration:1200});
 assert.equal(rows.length,2);assert.equal(rows[0].delta,-150);assert.equal(rows[1].observed,5);assert.equal(rows[1].delta,-1);
 assert.deepEqual(comparePerformance({result:{gold_per_min:[{percentile:.1,value:100}]}},{gold_per_min:0}),[]);
});
test('falha parcial não impede análise e fontes não revelam chave',async()=>{
 const r=await loadPerformance({cached:async url=>{if(url.includes('benchmarks'))throw Error('offline');return [{id:1,'5_pick':200,'5_win':100}];},dotaUrl:p=>'https://api.opendota.com/api'+p+(p.includes('?')?'&':'?')+'api_key=test-secret',player:{hero_id:1},match:{duration:1200},now:Date.now()});
 assert.equal(r.stats['5_pick'],200);assert.equal(r.performance.sample_size,null);assert.equal(r.performance.rows.length,0);assert.equal(r.warnings.length,1);assert(!JSON.stringify(r).includes('test-secret'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {compareHero,loadHeroReferences,roleOf,rankOf} from '../hero-analysis.mjs';
const now=Date.parse('2026-10-28T12:00:00Z');
const player={hero_id:1,lane_role:1,hero_variant:2,ability_upgrades_arr:[11,12]};
const match={match_id:100,patch:60,game_mode:22,lobby_type:7,avg_rank_tier:54};
const ref=(id,changes={})=>({...match,match_id:id,start_time:now/1000-100,players:[{...player,purchase_log:[{key:'boots',time:100},{key:'boots',time:200}]}],...changes});
const compare=(references,extra={})=>compareHero({match,player,references,stats:{'5_pick':100,'5_win':52},evidence:[{id:'E7',kind:'purchase_log',time:130,data:{key:'boots'}}],now,...extra});
test('recorta patch, rank, modo, lobby, rota, data e exclui a própria partida',()=>{
 const r=compare([ref(1),ref(2,{patch:61}),ref(3,{avg_rank_tier:64}),ref(4,{game_mode:23}),ref(5,{lobby_type:0}),ref(6,{start_time:now/1000+1}),ref(7,{players:[{...player,lane_role:2}]}),ref(100)]);
 assert.equal(r.sample_size,1);assert.equal(r.rank_stats.picks,100);assert.match(r.role,/1 ou 5/);
 assert.equal(compare([ref(1)],{match:{...match,patch:undefined}}).sample_size,0);
});
test('timings usam primeira compra por partida, mediana e IDs reais',()=>{
 const second=ref(2);second.players[0].purchase_log=[{key:'boots',time:120}];
 const r=compare([ref(1),second]); const item=r.item_timings[0];
 assert.equal(item.sample_size,2);assert.equal(item.median_seconds,110);assert.equal(item.delta_seconds,20);assert.equal(item.evidence_id,'E7');
 assert.equal(r.skills[0].denominator,2);assert.equal(r.facets[0].variant,2);assert.equal(r.build_examples.length,2);
});
test('ausência de logs não vira timing zero; rank ausente não vira Herald',()=>{
 const r=compare([ref(1,{players:[{hero_id:1,lane_role:1}]})],{match:{...match,avg_rank_tier:null}});
 assert.equal(r.purchase_coverage,0);assert.deepEqual(r.item_timings,[]);assert.equal(r.rank_tier,null);assert.equal(r.skill_coverage,0);
 assert.equal(rankOf(null),null);assert.equal(roleOf({}),'posição desconhecida');
});
test('fonte indisponível mantém transparência e não importa sites manuais',async()=>{
 const urls=[];
 const r=await loadHeroReferences({cached:async url=>{urls.push(url);throw Error('offline')},dotaUrl:p=>'https://api.opendota.com/api'+p,match,player,stats:null,evidence:[],now,heroName:'Anti-Mage'});
 assert.equal(r.analysis.sample_size,0);assert.equal(r.integrations.length,2);assert.equal(urls.length,1);assert(r.warnings.length>0);
 assert(!JSON.stringify(r).includes('api_key='));
});

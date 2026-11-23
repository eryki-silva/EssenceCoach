import test from 'node:test';
import assert from 'node:assert/strict';
import {officialPatches,summarizePros,loadCompetitiveContext} from '../meta-context.mjs';
test('catálogo oficial exclui futuro e ordena subpatches',()=>{
 assert.deepEqual(officialPatches({patches:[{patch_number:'7.41',patch_timestamp:1},{patch_number:'7.41f',patch_timestamp:3},{patch_number:'7.42',patch_timestamp:9}]},4000).map(p=>p.patch_number),['7.41f','7.41']);
});
const players=Array.from({length:10},(_,i)=>({hero_id:i+1,player_slot:i<5?i:128+i-5}));
test('amostra pro conta lados, bans e filtra jogos fora do período',()=>{
 const sample={match_id:123,start_time:50,players,radiant_win:false,league_name:'Liga teste',picks_bans:[{hero_id:1,is_pick:false},{hero_id:2,is_pick:true}]};
 const r=summarizePros([sample,{...sample,start_time:1}],1,40,60);
 assert.equal(r.sample_size,1);assert.equal(r.draft_sample_size,1);
 assert.equal(r.heroes.find(h=>h.hero_id===1).wins,0);assert.equal(r.heroes.find(h=>h.hero_id===6).wins,1);
 assert.equal(r.heroes.find(h=>h.hero_id===1).bans,1);assert.equal(r.selected_hero_examples[0].league,'Liga teste');
});
test('falhas de fontes não inventam patch nem partidas',async()=>{
 const result=await loadCompetitiveContext({cached:async()=>{throw Error('offline')},dotaUrl:p=>'https://api.opendota.com/api'+p,heroId:1,matchStart:1,now:100000});
 assert.equal(result.official_patch,null);assert.equal(result.recent_professional,null);assert.equal(result.warnings.length,2);
});
test('integra notas atuais e históricas e detalhes de campeonatos',async()=>{
 const result=await loadCompetitiveContext({cached:async url=>{
  if(url.includes('patchnoteslist'))return {patches:[{patch_number:'7.41',patch_timestamp:10},{patch_number:'7.41f',patch_timestamp:30}]};
  if(url.includes('patchnotes?'))return {general:[{note:'Alteração documentada de teste'}]};
  if(url.endsWith('proMatches'))return [{match_id:123,start_time:50,league_name:'Liga teste'}];
  return {match_id:123,start_time:50,players,radiant_win:true};
 },dotaUrl:p=>'https://api.opendota.com/api'+p,heroId:1,matchStart:20,now:60000});
 assert.equal(result.official_patch.latest.name,'7.41f');assert.equal(result.official_patch.match_patch_by_date,'7.41');assert.equal(result.official_patch.notes.length,2);assert.equal(result.recent_professional.sample_size,1);
});

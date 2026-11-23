import test from 'node:test';
import assert from 'node:assert/strict';
import {createReplayCollector,replayFrame,spatialEvidence,heroStateAt,worldAt} from '../replay-data.mjs';
const id='8123456789';
function collector(){const c=createReplayCollector(id);c.add({type:'coach_match_id',key:id});c.add({type:'player_slot',key:'0',value:0});c.add({type:'player_slot',key:'5',value:128});c.add({type:'epilogue'});return c;}
const sample=(slot,x,time=1)=>({type:'interval',slot,hero_id:slot===0?1:2,time,x,y:100,life_state:0,level:5,networth:1200});
test('normaliza posições reais, converte slots Dire e descarta chat e identificadores pessoais',()=>{
 const c=collector();c.add(sample(5,110));c.add(sample(0,100));c.add({type:'chat',unit:'private-user',key:'private-chat'});c.add({...sample(0,NaN),account_id:123});
 const d=c.finish();assert.equal(d.samples.length,2);assert.equal(d.participants.length,2);assert.equal(d.samples[1].player_slot,128);assert(!JSON.stringify(d).includes('private'));assert(!JSON.stringify(d).includes('account_id'));
});
test('rejeita arquivo incompleto e replay de outra partida',()=>{
 const c=createReplayCollector(id);c.add({type:'coach_match_id',key:id});assert.throws(()=>c.finish(),/incompleto/);
 const wrong=collector();wrong.add({type:'coach_match_id',key:'1234567890'});assert.throws(()=>wrong.finish(),/outra partida/);
});
test('contexto espacial usa amostra anterior ao evento, distância em unidades e IDs citáveis',()=>{
 const c=collector();c.add(sample(0,100));c.add(sample(5,110));c.add(sample(5,200,9));c.add({type:'DOTA_COMBATLOG_DEATH',time:2,targetname:'npc_dota_hero_antimage',targethero:true,targetillusion:false});
 const d=c.finish(),evidence=[{id:'E1',kind:'match'}];
 const moments=spatialEvidence(d,{hero_id:1,player_slot:0},{1:{name:'npc_dota_hero_antimage'},2:{localized_name:'Axe'}},evidence);
 assert.equal(moments.length,1);assert.equal(moments[0].evidence_id,'E2');assert.equal(evidence[1].data.other_heroes[0].distance_units,1280);assert.equal(evidence[1].data.snapshot_time,1);assert.match(evidence[1].data.perspective,/desconhecida/);assert.equal(evidence[1].time,2);
 assert.equal(replayFrame(d,6).length,0);assert.equal(replayFrame(d,1).length,2);
});
test('não fabrica contexto sem posição do jogador nem trata ilusão como morte real',()=>{
 const c=collector();c.add(sample(5,110));c.add({type:'DOTA_COMBATLOG_DEATH',time:2,targetname:'npc_dota_hero_antimage',targethero:true,targetillusion:true});
 const d=c.finish();assert.equal(d.events.length,0);assert.equal(spatialEvidence(d,{hero_id:1,player_slot:0},{1:{name:'npc_dota_hero_antimage'}},[]).length,0);
});

test('preserva zero observado, não inventa mana e compacta recursos sem perder recargas',()=>{
 const c=collector();c.add(sample(0,100));
 const row={health:0,max_health:600,mana:0,personaname:'private',abilities:[{name:'antimage_blink',slot:1,level:2,cooldown_remaining:8.5,mana_cost:60,activated:true,hidden:false},{name:'invalid name <html>',slot:2}],items:[{name:'item_blink',slot:7,cooldown_remaining:0}]};
 c.add({type:'coach_state',slot:0,time:1,key:JSON.stringify(row)});c.add({type:'coach_state',slot:0,time:3,key:JSON.stringify({...row,mana:undefined})});
 const d=c.finish();assert.equal(d.state_encoding,'resource_refs_v1');assert.equal(d.resource_catalog.length,2);
 const one=heroStateAt(d,0,1);assert.equal(one.health,0);assert.equal(one.mana,0);assert.equal(one.abilities[0].cooldown_remaining,8.5);assert.equal(one.items[0].main_inventory,false);assert.equal(one.items[0].cooldown_remaining,0);
 assert.equal(heroStateAt(d,0,3).mana,undefined);assert.equal(heroStateAt(d,0,10),null);assert.equal(heroStateAt(d,0,0),null);assert(!JSON.stringify(d).includes('private'));
});

test('mundo observado mantém equipes, descarta posições inválidas e converte dono das unidades',()=>{
 const c=collector();c.add(sample(0,100));c.add({type:'coach_world',time:0,key:JSON.stringify({lane_creeps:[{x:100,y:100,team:2},{x:999,y:10,team:3}],towers:[{x:110,y:110,team:3,health:0,max_health:1800}],wards:[{x:95,y:95,team:2,unit_class:'CDOTA_NPC_Observer_Ward'}],controlled_units:[{x:99,y:99,team:3,owner_slot:5,unit_class:'CDOTA_BaseNPC_Creep_Neutral'}]})});
 const d=c.finish();assert.equal(d.world[0].lane_creeps.length,1);assert.equal(d.world[0].controlled_units[0].owner_player_slot,128);assert.equal(d.world[0].towers[0].health,0);assert.equal(d.capabilities.wards,true);assert.equal(worldAt(d,7),null);assert.equal(worldAt(d,-1),null);
});

test('contexto da aula recebe mana, recarga e creeps do instante anterior; não lê o futuro',()=>{
 const c=collector();c.add(sample(0,100));c.add({type:'coach_state',slot:0,time:1,key:JSON.stringify({mana:20,health:300,abilities:[{name:'antimage_blink',slot:1,level:1,mana_cost:60,cooldown_remaining:4}],items:[]})});
 c.add({type:'coach_state',slot:0,time:5,key:JSON.stringify({mana:200,abilities:[],items:[]})});
 c.add({type:'coach_world',time:1,key:JSON.stringify({lane_creeps:[{x:101,y:100,team:2}],towers:[],controlled_units:[],wards:[]})});
 c.add({type:'DOTA_COMBATLOG_DEATH',time:2,targethero:true,targetname:'npc_dota_hero_antimage'});
 const evidence=[];spatialEvidence(c.finish(),{hero_id:1,player_slot:0},{1:{name:'npc_dota_hero_antimage'}},evidence);
 const state=evidence[0].data.self.resources;assert.equal(state.mana,20);assert.equal(state.abilities[0].mana_sufficient,false);assert.equal(state.abilities[0].cooldown_remaining,4);assert.equal(evidence[0].data.world.lane_creeps[0].distance_units,128);
});

test('também ensina ações do jogador e habilidades, sem rotular todo contexto como erro',()=>{
 const c=collector();c.add(sample(0,100));c.add({type:'DOTA_COMBATLOG_ABILITY',time:2,attackername:'npc_dota_hero_antimage',targetname:'npc_dota_hero_axe',inflictor:'antimage_mana_void'});
 const evidence=[];assert.equal(spatialEvidence(c.finish(),{hero_id:1,player_slot:0},{1:{name:'npc_dota_hero_antimage'}},evidence).length,1);assert.equal(evidence[0].data.player_is_actor,true);assert.equal(evidence[0].data.player_is_target,false);assert.equal(evidence[0].data.ability_or_item,'antimage_mana_void');
});

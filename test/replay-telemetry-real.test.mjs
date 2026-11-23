import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {heroStateAt,worldAt,spatialEvidence} from '../replay-data.mjs';

test('replay real: recarga corresponde ao uso e decresce entre amostras; creeps e torres vêm do arquivo',async t=>{
 let data;try{data=JSON.parse(await readFile(new URL('../.runtime/replay-v3.json',import.meta.url),'utf8'));}catch(e){if(e.code==='ENOENT'){t.skip('Fixture real opcional, gerada localmente pelo parser.');return;}throw e;}
 assert.equal(data.match_id,'9101771071');assert.equal(data.version,3);assert.equal(data.participants.length,10);
 const cast=data.events.find(e=>e.time===80&&e.type==='DOTA_COMBATLOG_ABILITY'&&e.attackername==='npc_dota_hero_kez'&&e.inflictor==='kez_echo_slash');assert(cast);
 const ability=time=>heroStateAt(data,0,time).abilities.find(a=>a.name==='kez_echo_slash');
 assert.equal(ability(79).cooldown_remaining,0);assert(ability(81).cooldown_remaining>15);
 assert.equal(Math.round(ability(81).cooldown_remaining-ability(83).cooldown_remaining),2);
 assert(heroStateAt(data,0,79).mana>heroStateAt(data,0,81).mana);
 const world=worldAt(data,61);assert(world.lane_creeps.length>20);assert(world.towers.length>10);assert(world.wards.length>0);
 assert(data.world.every(w=>w.controlled_units.every(u=>!u.unit_class.includes('Observer_Ward'))));
 const evidence=[];spatialEvidence(data,{hero_id:145,player_slot:0},{145:{name:'npc_dota_hero_kez'}},evidence);
 assert(evidence.some(e=>e.data.self.resources?.abilities.length));assert(evidence.some(e=>e.data.world?.lane_creeps.length));
 assert(data.resource_catalog.length<5000);assert(JSON.stringify(data).length<35000000);
});

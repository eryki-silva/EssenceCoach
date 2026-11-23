import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDecisionBriefs,coachingFramework} from '../backend/features/coaching/decisions.mjs';
const evidence=[{id:'E1',kind:'replay_decision_context',time:500,data:{event:'DOTA_COMBATLOG_DEATH',snapshot_time:499,self:{resources:{health:100,mana:50,abilities:[{name:'kez_echo_slash',level:1,cooldown_remaining:12,mana_cost:75},{name:'other',level:1,cooldown_remaining:0,mana_cost:25,activated:false}]}},other_heroes:[{hero:'Axe',team:'Dire',distance_units:500},{hero:'Chen',team:'Radiant',distance_units:800},{hero:'Pudge',team:'Dire',distance_units:2200}]}}];
test('aula recebe restrições reais e recorte explícito sem inventar visibilidade',()=>{
 const [b]=buildDecisionBriefs(evidence,{player_slot:0});assert.equal(b.evidence_id,'E1');assert.equal(b.observation.health,100);assert.equal(b.observation.enemies_nearby.length,1);assert.equal(b.observation.allies_nearby[0].hero,'Chen');assert.deepEqual(b.resources[0].restrictions,['cooldown','insufficient_mana']);assert.deepEqual(b.resources[1].restrictions,['inactive']);assert(b.missing.some(s=>s.includes('Visibilidade')));
 assert(!JSON.stringify(b).includes('erro de posicionamento'));
});
test('ausência de recursos continua desconhecida e perspectiva de Dire é respeitada',()=>{
 const b=buildDecisionBriefs([{...evidence[0],data:{...evidence[0].data,self:{}}}],{player_slot:128})[0];assert.equal(b.observation.health,null);assert.deepEqual(b.resources,[]);assert.equal(b.observation.allies_nearby[0].hero,'Axe');assert(b.missing.some(s=>s.includes('recargas indisponíveis')));
 assert.deepEqual(buildDecisionBriefs([],{player_slot:0}),[]);
});
test('rota não vira posição exata e perguntas não são regras históricas',()=>{
 assert.match(coachingFramework({lane_role:1}).role_basis,/1 ou 5/);assert.match(coachingFramework({}).role_basis,/não confirmada/);assert.match(coachingFramework({}).rule,/não fatos observados/);
});

test('item na mochila não é tratado como alternativa imediata',()=>{
 const b=buildDecisionBriefs([{...evidence[0],data:{...evidence[0].data,self:{resources:{mana:500,items:[{name:'item_blink',slot:6,cooldown_remaining:0}]}}}}],{player_slot:0})[0];
 assert.equal(b.resources[0].kind,'item');assert.deepEqual(b.resources[0].restrictions,['outside_main_slots']);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {buildReplayReview,groundedFindings} from '../replay-review.mjs';
const e=(id,kind,time,data)=>({id,kind,time,data});
const evidence=[
 e('E1','match',null,{duration:1800}),
 e('E2','phase_progress',600,{phase:'rotas',start:0,end:600,elapsed_seconds:600,xp_per_minute:400,last_hits_delta:20}),
 e('E3','phase_progress',1200,{phase:'transição',start:600,end:1200,elapsed_seconds:600,xp_per_minute:200,last_hits_delta:5}),
 e('E4','purchase_log',780,{key:'mekansm',item:'Mekansm'}),
 e('E5','teamfight',800,{start:800,end:830,player:{deaths:1,damage:150,healing:450,gold_delta:-200}}),
 e('E6','objective',870,{type:'CHAT_MESSAGE_ROSHAN_KILL',team:3}),
];
test('omite achado genérico mesmo com ID existente; preserva observação ancorada',()=>{
 const findings=[{observation:'Melhore o posicionamento e a execução.',evidence_ids:['E5']},{observation:'A luta teve 450 de cura e saldo de ouro -200.',evidence_ids:['E5']},{observation:'Mekansm foi comprado antes da luta.',evidence_ids:['E4']},{observation:'O jogador curou 99999.',evidence_ids:['E5']}];
 assert.deepEqual(groundedFindings(findings,evidence),[findings[1],findings[2]]);
});
test('produz tarefas específicas de combate, ritmo e item a partir de eventos reais',()=>{
 const r=buildReplayReview(evidence,'Chen');
 assert.equal(r.priorities.length,3);
 assert.match(r.priorities[0].observation,/450 de cura/);
 assert.match(r.priorities[0].observation,/saldo de ouro -200/);
 assert.match(r.priorities[0].observation,/Roshan/);
 assert.match(r.priorities[0].action,/Para Chen/);
 assert.match(r.priorities[1].observation,/400.*200.*50%/);
 assert.match(r.priorities[2].observation,/20s depois/);
 assert.match(r.priorities[2].observation,/não confirma uso/);
 const known=new Set(evidence.map(x=>x.id));
 for(const p of r.priorities) {assert(p.evidence_ids.length);assert(p.evidence_ids.every(id=>known.has(id)));assert(p.start>=0&&p.end<=1800);assert(p.metric.includes('3 partidas'));}
});
test('não inventa morte, recurso não usado ou objetivo perdido pelo jogador',()=>{
 const r=buildReplayReview(evidence,'Axe');
 assert(!r.priorities[0].action.includes('Para Chen'));
 assert.equal(r.coverage.death_events,0);
 assert(!JSON.stringify(r).includes('não usou Mekansm'));
 assert(!JSON.stringify(r).includes('perdeu Roshan'));
});
test('sem eventos informa falta de dados, sem fabricar diagnóstico ou padrões de meta',()=>{
 const r=buildReplayReview([e('E1','player_totals',null,{deaths:12,gold_per_min:400})],'Chen');
 assert.deepEqual(r.priorities,[]);assert.match(r.status,/insuficientes/);assert.equal(r.coverage.fights,0);
});
test('não compara XP ausente, intervalos descontínuos ou fase curta',()=>{
 for(const changes of [{xp_per_minute:null},{start:660},{elapsed_seconds:60}]) {
 const rows=structuredClone(evidence);Object.assign(rows[2].data,changes);
 assert(!buildReplayReview(rows).priorities.some(x=>x.kind==='economia'));
 }
});
test('log de morte gera janela limitada pela duração e não infere causa',()=>{
 const r=buildReplayReview([e('E1','match',null,{duration:100}),e('E2','deaths_log',95,{killer:'npc_dota_hero_axe'})]);
 assert.equal(r.priorities[0].end,100);assert.equal(r.priorities[0].start,75);assert.deepEqual(r.priorities[0].evidence_ids,['E2']);
});

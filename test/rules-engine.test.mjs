import test from 'node:test';import assert from 'node:assert/strict';
import {analyzeByRules}from'../backend/features/coaching/engine.mjs';import{buildEvidence}from'../lib.mjs';import{validateAnalysis}from'../backend/features/coaching/schema.mjs';
function run(p,extra={}){const match={duration:1200,players:[p],...extra};const {evidence}=buildEvidence(match,p);return {...analyzeByRules({match,player:p,hero:'Herói teste',evidence,route:extra.route}),evidence};}
test('farm compara janelas contínuas do próprio jogador e explica a queda com números',()=>{
 const p={player_slot:0,times:Array.from({length:16},(_,i)=>i*60),lh_t:[0,6,12,18,24,30,32,34,36,38,40,41,42,43,44,45]};const r=run(p);assert(r.rules.some(r=>r.rule==='farm_transition'));assert.match(r.analysis.lessons[0].teaching,/30 últimos golpes/);assert.match(r.analysis.lessons[0].teaching,/10 \(2\/min\)/);validateAnalysis(r.analysis,r.evidence);
 assert.deepEqual(r.analysis,run(p).analysis);
});
test('lacunas de timeline não são interpretadas como pausas sem farm',()=>{
 const r=run({player_slot:0,times:[0,600,1200],lh_t:[0,0,0]});assert(!r.rules.some(r=>r.rule==='farm_pause'));assert.equal(r.metrics.length,0);
});
test('dados ausentes não viram zeros e um suporte não recebe meta de carry',()=>{
 const r=run({player_slot:0,lane_role:1});assert.equal(r.metrics.length,0);assert.match(r.analysis.game_plan,/1 de 5/);assert(r.analysis.limitations.some(x=>x.includes('Sem replay')));assert(!r.analysis.summary.includes('0 mortes'));validateAnalysis(r.analysis,r.evidence);
});
test('luta com saldo negativo não é classificada automaticamente como erro',()=>{
 const p={player_slot:0};const r=run(p,{teamfights:[{start:400,end:420,players:[{deaths:1,gold_delta:-250,damage:1000}]}]});assert(r.rules.some(r=>r.rule==='fight_survival'));assert.match(r.analysis.lessons[0].teaching,/-250/);assert.match(r.analysis.lessons[0].exception,/troca favorável/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {buildReplayReview} from '../replay-review.mjs';
class Element {
 constructor(tag){this.tagName=tag;this.children=[];this.ownText='';this.hidden=false;}
 set textContent(v){this.ownText=String(v);this.children=[];}
 get textContent(){return this.ownText+this.children.map(c=>c.textContent??'').join(' ');}
 append(...nodes){this.children.push(...nodes);}
 replaceChildren(...nodes){this.children=nodes;this.ownText='';}
 addEventListener(){}
}
test('relatório ensina em prosa, mantém eventos automáticos recolhidos e exporta a aula',async()=>{
 const root=new Element('section');
 const context=vm.createContext({document:{createElement:tag=>new Element(tag),getElementById:()=>root},URL,Date,console,createFarmRoute:()=>new Element('section')});
 const scripts=await Promise.all(['core/state.js','core/dom.js','features/coaching/report.js'].map(p=>readFile(new URL('../public/'+p,import.meta.url),'utf8')));
 vm.runInContext(scripts.map(s=>s.replace(/^import .*?;\r?\n/gm,'').replace(/export /g,'')).join('\n'),context);
 const evidence=[{id:'E1',kind:'match',time:null,data:{duration:1200}},{id:'E2',kind:'teamfight',time:600,data:{end:630,player:{deaths:1,healing:500}}}];
 context.fixture={hero:'Chen',match_id:123,generated_at:'2026-10-28',model:'mock',coverage:'eventos',evidence,replay_review:buildReplayReview(evidence,'Chen'),availability:{},analysis:{summary:'Resumo de teste',confidence:'média',findings:[],strengths:[],training_plan:[],patch_context:'7.41',limitations:[]},context:{hero_analysis:{sample_size:0},hero_rules:{data:{abilities:[{name_loc:'Holy Persuasion',desc_loc:'Health is %health_min%'}]}},sources:[],warnings:[]}};
 context.fixture.analysis.game_plan='Jogue perto do aliado que consegue transformar sua presença em pressão.';
 context.fixture.analysis.lessons=[{title:'Apoiar sem comprometer todo o exército',teaching:'Na luta registrada há 500 de cura. Esse número mostra uma contribuição, mas não explica sozinho se você estava na distância certa para apoiar.\n\nA ideia é separar a função do herói da função das unidades.',application:'Se o aliado estiver sustentando a troca, eu aproximaria a unidade que pode ajudá-lo e manteria Chen fora da primeira entrada. Se o aliado já estiver recuando, eu preservaria a saída em vez de mandar todo o grupo atrás do adversário.',exception:'Se a equipe tiver uma oportunidade clara de finalizar a luta, acompanhar pode valer mais que preservar distância.',time:600,evidence_ids:['E2']}];
 context.fixture.context.decision_briefs=[{evidence_id:'E2',phase:'transição',observation:{snapshot_time:599,health:300,mana:20,allies_nearby:[{hero:'Axe',distance_units:900}],enemies_nearby:[],radius_units:1600},resources:[{name:'chen_penitence',restrictions:['insufficient_mana']}]}];
 vm.runInContext('renderReport(fixture)',context);
 const prose=n=>n.tagName==='pre'?'':n.ownText+n.children.map(prose).join(' ');
 const mainText=prose(root);
 assert.match(mainText,/500 de cura/);assert.match(mainText,/300 de vida/);assert.match(mainText,/mana insuficiente/);assert.match(mainText,/Axe \(900 unidades\)/);assert.match(mainText,/Apoiar sem comprometer/);
 assert.match(mainText,/eu aproximaria a unidade/);assert.match(mainText,/acompanhar pode valer mais/);
 assert(mainText.indexOf('O plano para este jogo')<mainText.indexOf('Vamos pensar nas decisões'));
 assert(mainText.indexOf('Vamos pensar nas decisões')<mainText.indexOf('Fontes e limites'));
 assert(!mainText.includes('Exercício e medida'));assert(!mainText.includes('Revise sua entrada na luta'));
 assert(!mainText.includes('%health_min%'));assert(!mainText.includes('Holy Persuasion'));assert(!mainText.includes('0/0'));
 const walk=n=>[n,...n.children.flatMap(walk)];
 const technical=walk(root).find(n=>n.className==='technical-context');
 assert(technical);assert(!technical.open);
 const md=vm.runInContext('markdown(fixture)',context);assert.match(md,/500 de cura/);assert.match(md,/E2/);
 assert.match(md,/eu aproximaria a unidade/);assert(!md.includes('Revise sua entrada na luta'));
});

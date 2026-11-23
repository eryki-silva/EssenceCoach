import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
class Element {
 constructor(tag){this.tagName=tag;this.children=[];this.ownText='';this.events={};this.attributes={};}
 set textContent(s){this.ownText=String(s);this.children=[];}
 get textContent(){return this.ownText+' '+this.children.map(n=>n.textContent).join(' ');}
 append(...n){this.children.push(...n);}
 replaceChildren(...n){this.children=n;this.ownText='';}
 setAttribute(k,v){this.attributes[k]=v;}
 addEventListener(k,f){this.events[k]=f;}
 getContext(){return new Proxy({measureText:()=>({width:40})},{get:(target,key)=>target[key]??(()=>{})});}
}
test('mapa apresenta recursos da amostra, decodifica catálogo e não afirma que magia estava utilizável',async()=>{
 const parent=new Element('section');const context=vm.createContext({document:{createElement:tag=>new Element(tag)},Image:class{},setInterval:()=>1,clearInterval:()=>{}});
 vm.runInContext((await readFile(new URL('../public/features/replays/viewer.js',import.meta.url),'utf8')).replace(/export /g,''),context);
 context.parent=parent;context.data={version:3,start:79,end:90,state_encoding:'resource_refs_v1',resource_catalog:[{name:'kez_echo_slash',slot:0,level:1,mana_cost:75,activated:true,hidden:false}],states:[{time:81,player_slot:0,health:532,max_health:620,mana:220,max_mana:327,abilities:[[0,20.8]],items:[]}],samples:[{time:81,player_slot:0,hero_id:145,x:100,y:100,life_state:0}],world:[{time:79,lane_creeps:[{x:101,y:101,team:2}],towers:[],wards:[],controlled_units:[]}],participants:[{hero_id:145,player_slot:0}],events:[]};
 vm.runInContext("var viewer=createReplayViewer(parent,data,{selectedSlot:0,players:[{hero:'Kez',player_slot:0}]});viewer.seek(82)",context);
 assert.match(parent.textContent,/Amostra 1:21/);assert.match(parent.textContent,/Vida 532 \/ 620/);assert.match(parent.textContent,/Kez Echo Slash/);assert.match(parent.textContent,/Recarga: 20.8s/);assert.match(parent.textContent,/Custo: 75 de mana/);assert.match(parent.textContent,/não comprovam/);
 vm.runInContext('viewer.seek(90)',context);assert.match(parent.textContent,/Não há estado recente/);assert(!parent.textContent.includes('Recarga: 20.8s'));
});

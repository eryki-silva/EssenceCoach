import test from 'node:test';
import assert from 'node:assert/strict';
import {buildFarmRoute} from '../backend/features/matches/farm-route.mjs';
import {routeWindow} from '../public/features/replays/route-data.js';
const sample=(time,x,y,lh,life_state=0,player_slot=0)=>({time,x,y,lh,life_state,player_slot});
test('rota inclui o meio e fim da partida, filtra o herói e não reutiliza lane_pos',()=>{
 const route=buildFarmRoute({samples:[sample(0,80,80,0),sample(2,81,80,1),sample(1200,90,90,200),sample(1202,91,90,202),sample(3600,100,100,500),sample(3600,110,110,20,0,128)]},0,3600);
 assert.equal(route.points.length,5);assert.equal(route.end,3600);assert.equal(routeWindow(route,1200,1202).last_hits,2);assert.equal(routeWindow(route).segments.length,3);
 assert.equal(buildFarmRoute(null,0,3600).available,false);
});
test('morte, salto e lacuna não viram linhas de farm nem atribuem LH acumulado ao novo local',()=>{
 const route=buildFarmRoute({samples:[sample(0,80,80,0),sample(2,81,80,1),sample(4,150,150,50),sample(6,151,150,51),sample(8,151,150,51,2),sample(10,151,150,51,2),sample(40,80,80,60),sample(42,81,80,62)]},0,100);
 const view=routeWindow(route);assert.equal(view.segments.length,3);assert.equal(view.last_hits,4);assert.equal(view.interruptions,2);assert.deepEqual(view.farm.map(f=>f.time),[2,6,42]);
});
test('recorte não conta LH anterior, contador ausente não vira zero e amostras são ordenadas',()=>{
 const route=buildFarmRoute({samples:[sample(1002,82,80,104),sample(1000,81,80,100),sample(998,80,80,90),sample(1004,83,80,undefined),sample(1006,84,80,110)]},0,1100);
 assert.equal(routeWindow(route,1000,1006).last_hits,4);assert.equal(route.points[0].time,998);assert.equal(route.points[3].lh,null);
 assert.equal(buildFarmRoute({samples:[sample(-10,80,80,0)]},0,100).available,false);
});

test('replay real mantém posições além de uma hora e o trecho de farm após a rota',async t=>{
 const {readFile}=await import('node:fs/promises');let replay;
 try{replay=JSON.parse(await readFile(new URL('../.runtime/replay-v3.json',import.meta.url),'utf8'));}catch(e){if(e.code==='ENOENT'){t.skip('Fixture real opcional.');return;}throw e;}
 const route=buildFarmRoute(replay,0,4133);assert.equal(route.end,4133);assert(route.points.some(p=>p.time>3600));
 const middle=routeWindow(route,1200,1500);assert.equal(middle.samples,253);assert.equal(middle.last_hits,46);
});

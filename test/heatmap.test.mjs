import test from 'node:test';
import assert from 'node:assert/strict';
import {laneHeatmap} from '../heatmap.mjs';
test('mapa usa apenas lane_pos e preserva pesos e coordenadas',()=>{
 const h=laneHeatmap({lane_pos:{80:{90:4,100:8},130:{150:2}},obs_log:[{x:200,y:200}]});
 assert.equal(h.total_samples,14);assert.equal(h.cells.length,3);assert.equal(h.cells[0].x,80);assert.equal(h.cells[0].y,90);
 assert.match(h.coverage,/10 min/);
});
test('mapa ausente não inventa posições e descarta valores inválidos',()=>{
 assert.equal(laneHeatmap({obs_log:[{x:90,y:80}]}).available,false);
 const h=laneHeatmap({lane_pos:{bad:{90:2},80:{90:-1,91:0,92:'4',93:Infinity},300:{90:2}}});assert.equal(h.available,false);
});

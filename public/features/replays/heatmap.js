import {el,time} from '../../core/dom.js';
import {routeWindow} from './route-data.js';
export function createFarmRoute(route,hero){
 const root=el('section','panel farm-route');root.setAttribute('aria-label','Rota de farm de '+hero);
 root.append(el('p','eyebrow','SUA PARTIDA NO MAPA'),el('h3','report-section-title',hero+' · rota de farm'));
 if(!route?.available){root.append(el('p','heatmap-empty',route?.reason||'A rota da partida inteira precisa do replay completo processado. Busque o replay da Valve ou processe seu arquivo .dem na seção Replay completo antes de gerar a aula.'));return root;}
 root.append(el('p','heatmap-note','O caminho que você percorreu durante a partida, com evolução dos últimos golpes. Escolha um trecho para entender a ordem dos deslocamentos.'));
 const toolbar=el('div','farm-route-toolbar'),preset=el('select');preset.setAttribute('aria-label','Trecho da rota de farm');
 for(const [value,label]of [['all','Partida inteira'],...Array.from({length:Math.ceil(route.duration/300)},(_,i)=>[String(i*300),time(i*300)+' – '+time(Math.min(route.duration,(i+1)*300))])]){const option=el('option','',label);option.value=value;preset.append(option);}
 const start=el('input'),end=el('input');for(const input of [start,end]){input.type='range';input.min='0';input.max=String(route.duration);input.step='1';}start.value='0';end.value=String(route.duration);start.setAttribute('aria-label','Início da rota de farm');end.setAttribute('aria-label','Fim da rota de farm');
 const range=el('output','farm-route-range');const startLabel=el('label','','De'),endLabel=el('label','','Até');startLabel.append(start);endLabel.append(end);toolbar.append(preset,startLabel,endLabel,range);
 const canvas=el('canvas','heatmap-canvas farm-route-canvas');canvas.width=720;canvas.height=720;canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Rota de farm de '+hero+' ao longo da partida');
 const summary=el('p','farm-route-summary');summary.setAttribute('aria-live','polite');
 const legend=el('div','farm-route-legend');legend.append(el('span','','● Início'),el('span','','→ Ordem do trajeto'),el('span','','● Fim'),el('span','','◉ Crescimento de últimos golpes'));
 root.append(toolbar,canvas,legend,summary,el('p','heatmap-note',route.note),el('p','heatmap-note','Fonte: '+route.source+' · posições disponíveis de '+time(route.start)+' a '+time(route.end)+'. Linhas interrompidas em mortes, lacunas ou saltos grandes; elas não representam o caminho de um teleporte. Terreno OpenDota 7.40: pode divergir do patch da partida.'));
 const ctx=canvas.getContext('2d');if(!ctx)return root;const map=new Image();let ready=false;
 const project=p=>[(p.x-64)*720/127,(191-p.y)*720/127];
 const color=t=>{const ratio=route.duration?t/route.duration:0;return ratio<.5?'rgb('+Math.round(100+ratio*140)+','+Math.round(210-ratio*80)+',220)':'rgb('+Math.round(170+(ratio-.5)*160)+','+Math.round(170+(ratio-.5)*70)+','+Math.round(220-(ratio-.5)*140)+')';};
 function draw(){
  const from=Number(start.value),to=Number(end.value),data=routeWindow(route,from,to);range.textContent=time(from)+' → '+time(to);
  summary.textContent=data.samples+' posições · '+data.last_hits+' últimos golpes registrados em intervalos contínuos · '+data.interruptions+' interrupções. Círculos de farm indicam a posição do herói ao final da amostra, não o local exato de cada abate de creep.';
  ctx.clearRect(0,0,720,720);if(ready){ctx.drawImage(map,0,0,720,720);ctx.fillStyle='#07091255';ctx.fillRect(0,0,720,720);}else{ctx.fillStyle='#101720';ctx.fillRect(0,0,720,720);}
  ctx.lineCap='round';ctx.lineJoin='round';
  for(const segment of data.segments){
   for(let i=1;i<segment.length;i++){const p=segment[i],prev=segment[i-1],[x,y]=project(p),[px,py]=project(prev);ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(x,y);ctx.strokeStyle='#080b13bb';ctx.lineWidth=6;ctx.stroke();ctx.strokeStyle=color(p.time);ctx.lineWidth=2.5;ctx.stroke();
    if(Math.floor(p.time/45)!==Math.floor(prev.time/45)&&Math.hypot(x-px,y-py)>1){const angle=Math.atan2(y-py,x-px);ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.beginPath();ctx.moveTo(-7,-4);ctx.lineTo(0,0);ctx.lineTo(-7,4);ctx.strokeStyle='#f0eaf5';ctx.lineWidth=1.7;ctx.stroke();ctx.restore();}
   }
  }
  for(const p of data.farm){const[x,y]=project(p);ctx.beginPath();ctx.arc(x,y,Math.min(8,3+Math.sqrt(p.count)),0,Math.PI*2);ctx.fillStyle='#e6bd5860';ctx.fill();ctx.strokeStyle='#f5d17f';ctx.lineWidth=1;ctx.stroke();}
  const points=data.segments.flat();
  for(const [p,label,fill]of [[points[0],'INÍCIO','#8bdfcf'],[points.at(-1),'FIM','#f3ce94']]){if(!p)continue;const[x,y]=project(p);ctx.beginPath();ctx.arc(x,y,6,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle='#101019';ctx.lineWidth=2;ctx.stroke();ctx.font='bold 11px Segoe UI';ctx.lineWidth=3;ctx.strokeText(label+' '+time(p.time),Math.min(625,Math.max(5,x+10)),Math.min(710,Math.max(14,y-8)));ctx.fillText(label+' '+time(p.time),Math.min(625,Math.max(5,x+10)),Math.min(710,Math.max(14,y-8)));}
  if(!points.length){ctx.fillStyle='#ede7f5';ctx.font='16px Segoe UI';ctx.fillText('Sem posições vivas neste intervalo.',170,360);}
 }
 preset.addEventListener('change',()=>{start.value=preset.value==='all'?'0':preset.value;end.value=String(preset.value==='all'?route.duration:Math.min(route.duration,Number(preset.value)+300));draw();});
 start.addEventListener('input',()=>{if(Number(start.value)>Number(end.value))end.value=start.value;preset.value='all';draw();});end.addEventListener('input',()=>{if(Number(end.value)<Number(start.value))start.value=end.value;preset.value='all';draw();});
 map.onload=()=>{ready=true;draw();};map.onerror=()=>{root.append(el('p','heatmap-note','O terreno não carregou; o trajeto continua disponível sobre o fundo neutro.'));draw();};map.src='/dota-map-740.webp';draw();return root;
}

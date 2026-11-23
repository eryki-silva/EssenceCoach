export function createReplayViewer(parent,data,{selectedSlot,players=[]}={}) {
  parent.replaceChildren();
  const make=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
  const clock=n=>`${n<0?'−':''}${Math.floor(Math.abs(n)/60)}:${String(Math.floor(Math.abs(n)%60)).padStart(2,'0')}`;
  const title=make('h3','A partida no mapa');
  const note=make('p','Arraste o tempo para acompanhar as posições reais. Este mapa mostra a perspectiva do observador; não reproduz o que cada jogador enxergava.');note.className='heatmap-note';
  const canvas=make('canvas');canvas.width=720;canvas.height=720;canvas.className='heatmap-canvas';canvas.setAttribute('aria-label','Mapa temporal com posições dos heróis');
  const controls=make('div');controls.className='replay-controls';
  const play=make('button','Reproduzir');play.type='button';play.className='secondary';
  const slider=make('input');slider.type='range';slider.min=Math.ceil(data.start);slider.max=Math.floor(data.end);slider.step=1;slider.value=Math.max(Number(slider.min),0);slider.setAttribute('aria-label','Momento da partida');
  const stamp=make('output');stamp.setAttribute('aria-live','off');
  const speed=make('select');speed.setAttribute('aria-label','Velocidade de reprodução');
  for(const n of [1,2,4,8]){const option=make('option',n+'×');option.value=n;speed.append(option);}
  controls.append(play,stamp,speed,slider);
  const layers=make('button','Mostrar creeps, torres e wards');layers.type='button';layers.className='secondary';layers.setAttribute('aria-pressed','false');controls.append(layers);
  const info=make('p');info.className='heatmap-note';
  const resourcePanel=make('details');resourcePanel.className='replay-resources';const resourceTitle=make('summary','Recursos neste momento');const resourceBody=make('div');resourcePanel.append(resourceTitle,resourceBody);
  const legend=make('div');legend.className='replay-roster';
  const bySlot=new Map(players.map(p=>[p.player_slot,p]));
  for(const p of data.participants){const label=make('span',bySlot.get(p.player_slot)?.hero||`Herói ${p.hero_id}`);label.className=(p.player_slot<128?'replay-radiant':'replay-dire')+(p.player_slot===selectedSlot?' replay-selected':'');legend.append(label);}
  const jumps=make('div');jumps.className='replay-jumps';
  const context=canvas.getContext('2d');const terrain=new Image();let terrainReady=false,timer=null,showWorld=false;
  const tracks=new Map();for(const sample of data.samples){const track=tracks.get(sample.player_slot)||[];track.push(sample);tracks.set(sample.player_slot,track);}
  const stateTracks=new Map();for(const state of data.states??[]){const track=stateTracks.get(state.player_slot)||[];track.push(state);stateTracks.set(state.player_slot,track);}
  const at=(track,t,maxAge=2)=>{let lo=0,hi=track.length-1,found=null;while(lo<=hi){const m=(lo+hi)>>1;if(track[m].time<=t){found=track[m];lo=m+1;}else hi=m-1;}return found&&t-found.time<=maxAge?found:null;};
  const project=p=>[(p.x-64)*720/127,(191-p.y)*720/127];
  const readable=name=>String(name).replace(/^item_/,'').split('_').map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(' ');
  const unpack=r=>Array.isArray(r)?{...data.resource_catalog[r[0]],...(Number.isFinite(r[1])?{cooldown_remaining:r[1]}:{})}:r;
  function resources(time){
    resourceBody.replaceChildren();const state=at(stateTracks.get(selectedSlot)||[],time,3);
    if(!state){resourceBody.append(make('p',data.version<2?'Reprocesse este replay para incluir vida, mana, inventário e recargas.':'Não há estado recente dos recursos do jogador neste instante.'));return;}
    const amount=n=>Number.isFinite(n)?Math.round(n).toLocaleString('pt-BR'):'indisponível';
    const stats=make('p','Amostra '+clock(state.time)+' · Vida '+amount(state.health)+' / '+amount(state.max_health)+' · Mana '+amount(state.mana)+' / '+amount(state.max_mana));stats.className='replay-resource-values';resourceBody.append(stats);
    for(const [title,rows]of [['Habilidades',(state.abilities||[]).map(unpack).filter(a=>a.level>0&&!a.hidden&&!a.name.startsWith('special_bonus_'))],['Inventário principal',(state.items||[]).map(unpack).filter(a=>a.main_inventory)]]){
      resourceBody.append(make('h4',title));const list=make('div');list.className='replay-resource-list';
      for(const r of rows){const row=make('div');row.append(make('b',readable(r.name)),make('span',Number.isFinite(r.cooldown_remaining)?'Recarga: '+r.cooldown_remaining+'s':'Recarga indisponível'),make('span',Number.isFinite(r.mana_cost)?'Custo: '+r.mana_cost+' de mana':'Custo indisponível'));if(r.activated===false)row.append(make('span','Desativada nesta amostra'));if(r.charges>0)row.append(make('span',r.charges+' carga(s)'));list.append(row);}if(!rows.length)list.append(make('p','Sem registros neste grupo.'));resourceBody.append(list);
    }
    const limit=make('p','Mana e recarga não comprovam que era possível usar: alvo, alcance, silêncio, stun e outras restrições precisam ser considerados.');limit.className='heatmap-note';resourceBody.append(limit);
  }
  function draw(){
    const t=Number(slider.value);stamp.textContent=clock(t)+' / '+clock(data.end);
    if(!context)return;
    context.clearRect(0,0,720,720);context.fillStyle='#0c0915';context.fillRect(0,0,720,720);
    if(terrainReady){context.globalAlpha=.82;context.drawImage(terrain,0,0,720,720);context.globalAlpha=1;}
    const world=at(data.world??[],t,6);
    if(showWorld&&world){
      for(const p of world.lane_creeps||[]){const [x,y]=project(p);context.fillStyle=p.team===2?'#61e1b7':'#ff99bc';context.fillRect(x-2,y-2,4,4);}
      for(const p of world.towers||[]){const [x,y]=project(p);context.fillStyle=p.team===2?'#2a8b76':'#ad456b';context.strokeStyle='#f4d6ff';context.lineWidth=1;context.fillRect(x-5,y-5,10,10);context.strokeRect(x-5,y-5,10,10);}
      for(const p of world.wards||[]){const [x,y]=project(p);context.strokeStyle=p.team===2?'#9cf0cb':'#ffbed4';context.lineWidth=1.5;context.beginPath();context.arc(x,y,5,0,Math.PI*2);context.stroke();}
      for(const p of (world.controlled_units||[]).filter(p=>p.owner_player_slot===selectedSlot)){const [x,y]=project(p);context.fillStyle='#f5d889';context.beginPath();context.arc(x,y,4,0,Math.PI*2);context.fill();}
    }
    const selected=tracks.get(selectedSlot)||[];const trail=selected.filter(p=>p.time>=t-20&&p.time<=t&&p.life_state===0);
    context.strokeStyle='#dfbeff';context.lineWidth=2;context.beginPath();
    trail.forEach((p,i)=>{const [x,y]=project(p);if(i===0||p.time-trail[i-1].time>2)context.moveTo(x,y);else context.lineTo(x,y);});context.stroke();
    const current=[],labelBoxes=[];
    for(const [slot,track]of tracks){const p=at(track,t);if(!p)continue;current.push(p);const [x,y]=project(p);const chosen=slot===selectedSlot;
      context.globalAlpha=p.life_state===0?1:.4;context.fillStyle=slot<128?'#69dcc2':'#ff8cb4';context.strokeStyle=chosen?'#efceff':'#141021';context.lineWidth=chosen?4:2;context.beginPath();context.arc(x,y,chosen?11:8,0,Math.PI*2);context.fill();context.stroke();
      context.font=chosen?'bold 13px sans-serif':'12px sans-serif';context.textAlign='center';context.lineWidth=4;context.strokeStyle='#080611';const text=bySlot.get(slot)?.hero||`H${p.hero_id}`;const w=context.measureText(text).width;let labelY=y-16;for(const offset of [-16,-32,-48,24,40,56]){const candidate=y+offset;if(!labelBoxes.some(b=>Math.abs(b.x-x)<(b.w+w)/2+6&&Math.abs(b.y-candidate)<15)){labelY=candidate;break;}}labelBoxes.push({x,y:labelY,w});context.strokeText(text,x,labelY);context.fillStyle='#fff';context.fillText(text,x,labelY);context.globalAlpha=1;
    }
    const p=current.find(p=>p.player_slot===selectedSlot);
    info.textContent=current.length+' posições com amostra recente'+(p?' · '+(bySlot.get(selectedSlot)?.hero||'Jogador')+(p.level!==undefined?' · nível '+p.level:'')+(p.networth!==undefined?' · patrimônio '+p.networth.toLocaleString('pt-BR'):''):' · sem posição recente do jogador neste instante')+(showWorld&&world?' · creeps/estruturas amostrados em '+clock(world.time):'')+'.';resources(t);
  }
  function seek(time){slider.value=Math.max(Number(slider.min),Math.min(Number(slider.max),Number(time)));draw();parent.scrollIntoView?.({behavior:'smooth',block:'start'});}
  for(const e of data.events.filter(e=>e.time>=0&&((e.type==='DOTA_COMBATLOG_DEATH'&&e.targethero===true)||(e.type==='DOTA_COMBATLOG_ITEM'&&/smoke_of_deceit/.test(e.inflictor||'')))).slice(0,24)){
    const button=make('button',clock(e.time)+' · '+(e.type==='DOTA_COMBATLOG_DEATH'?'morte':'smoke'));button.type='button';button.className='text-button';button.addEventListener('click',()=>seek(Math.max(0,e.time-10)));jumps.append(button);
  }
  play.addEventListener('click',()=>{if(timer){clearInterval(timer);timer=null;play.textContent='Reproduzir';return;}if(Number(slider.value)>=Number(slider.max))slider.value=slider.min;play.textContent='Pausar';timer=setInterval(()=>{slider.value=Math.min(Number(slider.max),Number(slider.value)+Number(speed.value));draw();if(Number(slider.value)>=Number(slider.max)){clearInterval(timer);timer=null;play.textContent='Reproduzir';}},1000);});
  slider.addEventListener('input',draw);
  layers.addEventListener('click',()=>{showWorld=!showWorld;layers.setAttribute('aria-pressed',String(showWorld));layers.textContent=showWorld?'Ocultar creeps, torres e wards':'Mostrar creeps, torres e wards';draw();});
  terrain.onload=()=>{terrainReady=true;draw();};terrain.onerror=()=>{note.textContent+=' A imagem do terreno não carregou; os marcadores continuam disponíveis.';};terrain.src='/dota-map-740.webp';
  parent.append(title,note,controls,canvas,info,resourcePanel,legend,jumps);draw();
  return {seek,destroy(){if(timer)clearInterval(timer);terrain.onload=null;terrain.onerror=null;}};
}

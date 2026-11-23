const finite = Number.isFinite;
const validSlot = x => Number.isInteger(x) && ((x>=0&&x<=4)||(x>=128&&x<=132));
const fields = ['time','type','attackername','targetname','inflictor','valuename','value','gold_reason','targethero','targetillusion'];
const safe = s => typeof s==='string' ? s.slice(0,160) : s;
const bounded=(x,min,max)=>finite(x)&&x>=min&&x<=max;
function resource(r,item) {
  if(!r||typeof r.name!=='string'||!/^\w{1,100}$/.test(r.name)||!Number.isInteger(r.slot)||r.slot<0||r.slot>(item?16:31))return null;
  const out={name:r.name,slot:r.slot};
  for(const key of ['level','mana_cost','charges','secondary_charges','cooldown_remaining'])if(bounded(r[key],0,key==='cooldown_remaining'?14400:100000))out[key]=r[key];
  for(const key of ['hidden','activated'])if(typeof r[key]==='boolean')out[key]=r[key];
  if(item)out.main_inventory=r.slot<=5;
  return out;
}
function unit(p) {
  if(!p||!bounded(p.x,0,256)||!bounded(p.y,0,256)||![2,3].includes(p.team))return null;
  const out={x:p.x,y:p.y,team:p.team};
  for(const key of ['entity','health','max_health'])if(bounded(p[key],0,100000000))out[key]=p[key];
  if(Number.isInteger(p.owner_slot)&&p.owner_slot>=0&&p.owner_slot<=9)out.owner_slot=p.owner_slot;
  if(typeof p.unit_class==='string')out.unit_class=p.unit_class.slice(0,120);
  return out;
}
export class ReplayError extends Error {
  constructor(message,status=400) {super(message);this.status=status;}
}
export function createReplayCollector(expectedId) {
  const slots=new Map(), intervals=[], events=[],states=[],world=[];
  let actualId=null,complete=false;
  return {
    add(e) {
      if(!e||typeof e!=='object')throw new ReplayError('Evento inválido no processamento.');
      if(e.type==='coach_match_id')actualId=String(e.key);
      if(e.type==='epilogue')complete=true;
      if(e.type==='player_slot'&&/^\d+$/.test(e.key)&&validSlot(e.value))slots.set(Number(e.key),e.value);
      if(!finite(e.time)||e.time < -600||e.time>14400)return;
      if(['coach_state','coach_world'].includes(e.type)) {
        let payload;try{payload=JSON.parse(e.key);}catch{throw new ReplayError('Estado detalhado inválido no replay.');}
        if(!payload||typeof payload!=='object'||Array.isArray(payload))throw new ReplayError('Estado detalhado inválido no replay.');
        if(e.type==='coach_state'&&Number.isInteger(e.slot)&&e.slot>=0&&e.slot<=9) {
          if(states.length>=76000)throw new ReplayError('Limite de estados detalhados do replay excedido.');
          const state={time:e.time,slot:e.slot};
          for(const key of ['health','max_health','mana','max_mana','life_state','team','visibility_mask_raw'])if(bounded(payload[key],0,100000000))state[key]=payload[key];
          state.abilities=(Array.isArray(payload.abilities)?payload.abilities:[]).slice(0,32).map(r=>resource(r,false)).filter(Boolean);
          state.items=(Array.isArray(payload.items)?payload.items:[]).slice(0,17).map(r=>resource(r,true)).filter(Boolean);
          states.push(state);
        } else if(e.type==='coach_world') {
          if(world.length>=3100)throw new ReplayError('Limite de estados do mapa excedido.');
          world.push({time:e.time,...Object.fromEntries([['lane_creeps',250],['towers',64],['controlled_units',150],['wards',128]].map(([key,max])=>[key,(Array.isArray(payload[key])?payload[key]:[]).slice(0,max).map(unit).filter(Boolean)]))});
        }
        return;
      }
      if(e.type==='interval'&&Number.isInteger(e.slot)&&Number.isInteger(e.hero_id)&&e.hero_id>0&&finite(e.x)&&finite(e.y)&&e.x>=0&&e.x<=256&&e.y>=0&&e.y<=256) {
        if(intervals.length>=150000)throw new ReplayError('Replay excede quatro horas de posições suportadas.');
        intervals.push({slot:e.slot,time:e.time,hero_id:e.hero_id,x:e.x,y:e.y,...Object.fromEntries(['life_state','level','networth','xp','lh'].filter(k=>finite(e[k])).map(k=>[k,e[k]]))});
      }
      const relevant=['DOTA_COMBATLOG_ABILITY','DOTA_COMBATLOG_ITEM','DOTA_COMBATLOG_PURCHASE','DOTA_COMBATLOG_GOLD'].includes(e.type) || (e.type==='DOTA_COMBATLOG_DEATH'&&!e.targetillusion);
      if(relevant&&events.length<100000)events.push(Object.fromEntries(fields.filter(k=>e[k]!==undefined).map(k=>[k,safe(e[k])])));
    },
    finish() {
      if(!complete)throw new ReplayError('Replay incompleto: o parser não confirmou o fim do arquivo.');
      if(actualId!==String(expectedId))throw new ReplayError('O arquivo de replay pertence a outra partida.');
      const samples=intervals.filter(e=>slots.has(e.slot)).map(({slot,...e})=>({...e,player_slot:slots.get(slot)})).sort((a,b)=>a.time-b.time||a.player_slot-b.player_slot);
      if(!samples.length)throw new ReplayError('O parser não encontrou posições válidas neste replay.');
      const participants=[...new Map(samples.map(e=>[e.player_slot,{player_slot:e.player_slot,hero_id:e.hero_id}])).values()];
      const mappedStates=states.filter(e=>slots.has(e.slot)).map(({slot,...e})=>({...e,player_slot:slots.get(slot)})).sort((a,b)=>a.time-b.time||a.player_slot-b.player_slot);
      const mappedWorld=world.sort((a,b)=>a.time-b.time).map(w=>({...w,controlled_units:w.controlled_units.filter(u=>slots.has(u.owner_slot)).map(({owner_slot,...u})=>({...u,owner_player_slot:slots.get(owner_slot)}))}));
      const capabilities={hero_resources:mappedStates.some(s=>finite(s.health)||finite(s.mana)),cooldowns:mappedStates.some(s=>s.abilities.some(a=>finite(a.cooldown_remaining))),lane_creeps:mappedWorld.some(w=>w.lane_creeps.length>0),towers:mappedWorld.some(w=>w.towers.length>0),wards:mappedWorld.some(w=>w.wards.length>0),controlled_units:mappedWorld.some(w=>w.controlled_units.length>0)};
      const resource_catalog=[],catalogIndex=new Map();
      const pack=r=>{const {cooldown_remaining,...base}=r;const key=JSON.stringify(base);let index=catalogIndex.get(key);if(index===undefined){if(resource_catalog.length>=20000)throw new ReplayError('Limite do catálogo de recursos excedido.');index=resource_catalog.length;catalogIndex.set(key,index);resource_catalog.push(base);}return [index,cooldown_remaining??null];};
      const compactStates=mappedStates.map(s=>({...s,abilities:s.abilities.map(pack),items:s.items.map(pack)}));
      return {version:3,match_id:String(expectedId),source:'OpenDota parser · arquivo .dem',coordinate_system:'source2_cell_128',sample_interval_seconds:1,state_interval_seconds:2,world_interval_seconds:6,state_encoding:'resource_refs_v1',resource_catalog,participants,samples,states:compactStates,world:mappedWorld,events:events.sort((a,b)=>a.time-b.time),start:samples[0].time,end:samples.at(-1).time,capabilities,
        limitations:['Mapa do observador: posições dos inimigos não comprovam o que seu jogador enxergava. A máscara bruta de visibilidade não é interpretada.', 'Recursos são amostrados a cada 2 segundos; creeps e torres, a cada 6 segundos. Não há câmera, ordens de micro, nem reconstrução integral de fog of war.', 'Cooldown zerado não prova que era possível agir: silêncio, stun, alvo, alcance, cargas e outras restrições podem impedir o uso.', 'Posições dos creeps são observadas, mas direção e prioridade da wave exigem interpretar a sequência; não são inferidas de last hits.', 'Terreno ilustrativo local 7.40; patches posteriores podem ter diferenças.']};
    }
  };
}
export function replayFrame(data,time,maxAge=2) {
  const frame=new Map();
  for(const sample of data.samples) {if(sample.time>time)break;if(sample.time>=time-maxAge)frame.set(sample.player_slot,sample);}
  return [...frame.values()];
}
export function heroStateAt(data,slot,time,maxAge=3) {
  let found=null;for(const state of data.states??[]){if(state.time>time)break;if(state.player_slot===slot&&state.time>=time-maxAge)found=state;}
  if(!found||data.state_encoding!=='resource_refs_v1')return found;
  const unpack=r=>({...data.resource_catalog[r[0]],...(finite(r[1])?{cooldown_remaining:r[1]}:{})});return {...found,abilities:found.abilities.map(unpack),items:found.items.map(unpack)};
}
export function worldAt(data,time,maxAge=6) {
  let found=null;for(const world of data.world??[]){if(world.time>time)break;if(world.time>=time-maxAge)found=world;}return found;
}
function decisionResources(state) {
  if(!state)return null;
  return {...state,visibility_mask_raw:undefined,abilities:(state.abilities??[]).filter(a=>a.level>0&&a.hidden!==true).slice(0,16).map(a=>({...a,mana_sufficient:finite(a.mana_cost)&&finite(state.mana)?state.mana>=a.mana_cost:null})),items:state.items??[],note:'Cooldown e mana são componentes observados, não confirmação de que a habilidade podia ser usada.'};
}
export function spatialEvidence(data,player,heroes,evidence) {
  const heroName=heroes[player.hero_id]?.name;
  if(!heroName)return [];
  const all=data.events.filter(e=>e.time>=0&&((e.type==='DOTA_COMBATLOG_DEATH'&&((e.targetname===heroName&&e.targethero===true)||(e.attackername===heroName&&(e.targethero===true||/tower/.test(e.targetname??'')))))||(e.type==='DOTA_COMBATLOG_ITEM'&&e.attackername===heroName&&/smoke|blink|black_king_bar|mekansm|pipe/.test(e.inflictor||''))||(e.type==='DOTA_COMBATLOG_ABILITY'&&e.attackername===heroName&&/^npc_dota_hero_/.test(e.targetname??'')&&e.targetname!==heroName)));
  const candidates=[];
  for(const [from,to] of [[0,600],[600,1200],[1200,2400],[2400,14401]]) {
    const inPhase=all.filter(e=>e.time>=from&&e.time<to);
    const selected=[];
    for(const type of ['DOTA_COMBATLOG_DEATH','DOTA_COMBATLOG_ITEM','DOTA_COMBATLOG_ABILITY'])for(const event of inPhase.filter(e=>e.type===type)) {
      if(selected.some(e=>e.type===type))break;
      if(!selected.some(e=>Math.abs(e.time-event.time)<30))selected.push(event);
    }
    candidates.push(...selected);
  }
  candidates.sort((a,b)=>a.time-b.time);
  const moments=[];
  for(const event of candidates) {
    const beforeTime=event.time-1,frame=replayFrame(data,beforeTime),self=frame.find(p=>p.player_slot===player.player_slot);
    if(!self)continue;
    const near=frame.filter(p=>p.player_slot!==self.player_slot&&p.life_state===0).map(p=>{
      const state=heroStateAt(data,p.player_slot,beforeTime);
      return {hero_id:p.hero_id,hero:heroes[p.hero_id]?.localized_name??`Herói ${p.hero_id}`,team:p.player_slot<128?'Radiant':'Dire',distance_units:Math.round(Math.hypot(p.x-self.x,p.y-self.y)*128),position:{x:p.x,y:p.y},resources:state?Object.fromEntries(['time','health','max_health','mana','max_mana'].filter(k=>finite(state[k])).map(k=>[k,state[k]])):null};
    }).sort((a,b)=>a.distance_units-b.distance_units);
    const id=`E${evidence.length+1}`;
    const entry={id,kind:'replay_decision_context',time:event.time,data:{event:event.type,ability_or_item:event.inflictor??null,snapshot_time:beforeTime,self:{hero_id:self.hero_id,x:self.x,y:self.y,level:self.level??null,networth:self.networth??null},other_heroes:near,known_positions:frame.length,perspective:'Observador; visibilidade para o jogador desconhecida',note:'Distância geométrica em unidades do jogo, não tempo de caminhada nem alcance efetivo de habilidade.'}};
    entry.data.event_actor=event.attackername??null;entry.data.event_target=event.targetname??null;
    entry.data.player_is_actor=event.attackername===heroName;entry.data.player_is_target=event.targetname===heroName;
    entry.data.approach=[-15,-5,-1].map(delta=>{const time=event.time+delta;const p=replayFrame(data,time).find(p=>p.player_slot===player.player_slot);return p?{time,x:p.x,y:p.y,life_state:p.life_state??null}:null;}).filter(Boolean);
    entry.data.nearby_events=data.events.filter(e=>e.time>=event.time-15&&e.time<=event.time+15&&e.type!=='DOTA_COMBATLOG_GOLD'&&(e.attackername===heroName||e.targetname===heroName)).slice(0,24);
    entry.data.self.resources=decisionResources(heroStateAt(data,player.player_slot,beforeTime));
    const world=worldAt(data,beforeTime);
    if(world) {
      const distance=u=>Math.round(Math.hypot(u.x-self.x,u.y-self.y)*128);
      const nearest=units=>units.map(u=>({...u,distance_units:distance(u)})).sort((a,b)=>a.distance_units-b.distance_units);
      entry.data.world={snapshot_time:world.time,lane_creeps:nearest(world.lane_creeps).slice(0,20),towers:nearest(world.towers).slice(0,6),wards:nearest(world.wards??[]).slice(0,8),controlled_units:nearest(world.controlled_units.filter(u=>u.owner_player_slot===player.player_slot)).slice(0,12),note:'Entidades observadas. Ausência nesta lista não comprova ausência no jogo; amostra e lista são limitadas. Ward presente não comprova que o caminho estava visível ou seguro.'};
      const previous=worldAt(data,beforeTime-12);
      if(previous){const currentIds=new Set(entry.data.world.lane_creeps.map(c=>c.entity));entry.data.world.previous_creep_positions={snapshot_time:previous.time,creeps:previous.lane_creeps.filter(c=>currentIds.has(c.entity)).slice(0,20)};}
    }
    evidence.push(entry);moments.push({evidence_id:id,time:event.time,event:event.type,ability_or_item:event.inflictor??null});
  }
  return moments;
}

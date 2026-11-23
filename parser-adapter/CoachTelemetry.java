package opendota;

import java.util.*;
import com.google.gson.Gson;
import skadistats.clarity.model.Entity;
import skadistats.clarity.model.StringTable;
import skadistats.clarity.processor.entities.Entities;
import skadistats.clarity.processor.stringtables.StringTables;
import skadistats.clarity.processor.runner.Context;

/** Additional sampled state; missing properties stay missing, never become zeros. */
public final class CoachTelemetry {
    private final Parse parser;
    private final Gson gson = new Gson();
    private final Map<Integer,Integer> lastHero = new HashMap<>();
    private final Map<Integer,Integer> owners = new HashMap<>();
    private int lastWorld = Integer.MIN_VALUE;
    public CoachTelemetry(Parse parser) { this.parser=parser; }
    private Object value(Entity e,String field) { return parser.getEntityProperty(e,field,null); }
    private Number number(Entity e,String field) { Object v=value(e,field); return v instanceof Number && Double.isFinite(((Number)v).doubleValue()) ? (Number)v : null; }
    private void copy(Map<String,Object> out,String key,Entity e,String field) { Object v=value(e,field);if(v instanceof Number && Double.isFinite(((Number)v).doubleValue()) || v instanceof Boolean) out.put(key,v); }
    private Map<String,Object> position(Entity e) {
        Number x=number(e,"CBodyComponent.m_cellX"), y=number(e,"CBodyComponent.m_cellY");
        Number vx=number(e,"CBodyComponent.m_vecX"), vy=number(e,"CBodyComponent.m_vecY");
        if(x==null||y==null||vx==null||vy==null)return null;
        Map<String,Object> p=new LinkedHashMap<>();p.put("x",x.doubleValue()+vx.doubleValue()/128);p.put("y",y.doubleValue()+vy.doubleValue()/128);return p;
    }
    private String name(Context ctx,Entity e) {
        Number index=number(e,"m_pEntity.m_nameStringTableIndex");
        if(index==null)index=number(e,"m_pEntity.m_nameStringableIndex");
        if(index==null)return null;
        StringTable table=ctx.getProcessor(StringTables.class).forName("EntityNames");
        return table==null?null:table.getNameByIndex(index.intValue());
    }
    private List<Map<String,Object>> resources(Context ctx,Entity hero,boolean item,int time) {
        List<Map<String,Object>> out=new ArrayList<>();Entities entities=ctx.getProcessor(Entities.class);
        for(int slot=0;slot<(item?17:32);slot++) {
            Number handle=parser.getEntityProperty(hero,item?"m_hItems.%i":"m_hAbilities.%i",slot);
            if(handle==null&&!item)handle=parser.getEntityProperty(hero,"m_vecAbilities.%i",slot);
            if(handle==null||handle.intValue()==0xFFFFFF)continue;
            Entity e=entities.getByHandle(handle.intValue());if(e==null)continue;
            String id=name(ctx,e);if(id==null||id.isBlank())continue;
            Map<String,Object> r=new LinkedHashMap<>();r.put("name",id);r.put("slot",slot);
            copy(r,"level",e,"m_iLevel");copy(r,"mana_cost",e,"m_iManaCost");copy(r,"hidden",e,"m_bHidden");copy(r,"activated",e,"m_bActivated");
            if(!item && (number(e,"m_iLevel")==null || number(e,"m_iLevel").intValue()<=0 || id.startsWith("special_bonus_")))continue;
            copy(r,"charges",e,"m_iCurrentCharges");
            Number cd=number(e,"m_fCooldown");
            // This network field is a remaining duration, not an absolute timestamp.
            // Verified against actual casts and successive snapshots in replay 9101771071.
            if(cd!=null && cd.doubleValue()>=0 && cd.doubleValue()<14400)r.put("cooldown_remaining",Math.round(cd.doubleValue()*10)/10.0);
            if(item) {copy(r,"charges",e,"m_iCurrentCharges");copy(r,"secondary_charges",e,"m_iSecondaryCharges");}
            out.add(r);
        }
        return out;
    }
    public void capture(Context ctx,Entity hero,int slot,int time) {
        owners.put(hero.getHandle(),slot);
        if(time-lastHero.getOrDefault(slot,Integer.MIN_VALUE/2)<2)return;
        lastHero.put(slot,time);
        Map<String,Object> state=new LinkedHashMap<>();
        copy(state,"health",hero,"m_iHealth");copy(state,"max_health",hero,"m_iMaxHealth");
        copy(state,"mana",hero,"m_flMana");copy(state,"max_mana",hero,"m_flMaxMana");
        copy(state,"life_state",hero,"m_lifeState");copy(state,"team",hero,"m_iTeamNum");
        copy(state,"visibility_mask_raw",hero,"m_iTaggedAsVisibleByTeam");
        state.put("abilities",resources(ctx,hero,false,time));state.put("items",resources(ctx,hero,true,time));
        emit("coach_state",slot,time,state);
        if(time-lastWorld>=5 || lastWorld==Integer.MIN_VALUE) {lastWorld=time;captureWorld(ctx,time);}
    }
    private void captureWorld(Context ctx,int time) {
        List<Map<String,Object>> creeps=new ArrayList<>(),structures=new ArrayList<>(),controlled=new ArrayList<>(),wards=new ArrayList<>();
        ctx.getProcessor(Entities.class).stream().filter(e->e.isActive()&&e.isExistent()).forEach(e->{
            String type=e.getDtClass().getDtName();boolean lane=type.contains("Creep_Lane"),tower=type.contains("Tower")&&!type.contains("Watch"),ward=type.contains("Observer_Ward");
            Number owner=number(e,"m_hOwnerEntity");Integer ownerSlot=owner==null?null:owners.get(owner.intValue());
            if(!lane&&!tower&&!ward&&ownerSlot==null)return;
            Number life=number(e,"m_lifeState");if(life==null||life.intValue()!=0)return;
            Map<String,Object> p=position(e);if(p==null)return;
            p.put("entity",e.getHandle());copy(p,"team",e,"m_iTeamNum");copy(p,"health",e,"m_iHealth");copy(p,"max_health",e,"m_iMaxHealth");
            if(lane&&creeps.size()<250)creeps.add(p);
            if(tower&&structures.size()<64)structures.add(p);
            if(ward&&wards.size()<128) {Map<String,Object> w=new LinkedHashMap<>(p);w.put("unit_class",type);wards.add(w);}
            if(ownerSlot!=null&&type.contains("Creep")&&controlled.size()<150) {Map<String,Object> unit=new LinkedHashMap<>(p);unit.put("owner_slot",ownerSlot);unit.put("unit_class",type);controlled.add(unit);}
        });
        Map<String,Object> world=new LinkedHashMap<>();world.put("lane_creeps",creeps);world.put("towers",structures);world.put("controlled_units",controlled);world.put("wards",wards);emit("coach_world",null,time,world);
    }
    private void emit(String type,Integer slot,int time,Object data) {Entry e=new Entry(time);e.type=type;e.slot=slot;e.key=gson.toJson(data);parser.output(e);}
}

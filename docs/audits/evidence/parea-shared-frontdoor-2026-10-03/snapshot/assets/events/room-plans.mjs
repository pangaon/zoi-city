import {MONTREAL_PLAN_SOURCE,MONTREAL_TABLES,MONTREAL_CATEGORIES} from './opa/montreal-room-plan.mjs';
// A reviewed source plan is bound to an exact event and the currently published
// floor-plan field. An owner clearing or replacing that field removes this room.
export function eventRoomPlan(entity){
 if(entity?.id!=='9b241a00-f0c9-5748-8e22-79e2e0b57f79'||entity.family!=='event')return null;
 const source=String(entity.floor_plan_url||'');
 if(![MONTREAL_PLAN_SOURCE.image,MONTREAL_PLAN_SOURCE.url,'https://www.zoi.city'+MONTREAL_PLAN_SOURCE.image,'https://zoi.city'+MONTREAL_PLAN_SOURCE.image].includes(source))return null;
 return {plan:MONTREAL_PLAN_SOURCE,tables:MONTREAL_TABLES,categories:MONTREAL_CATEGORIES};
}
export function eventTablePreference(entity,id){
 const room=eventRoomPlan(entity);return room?.tables.find(t=>t.id===String(id))||null;
}

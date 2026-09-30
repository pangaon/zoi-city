import {zonedToInstant,UUID} from './model.mjs';
const DAY=86400000;
function date(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))throw Error('Choose a complete date range.');const n=Date.parse(value+'T00:00:00Z');if(!Number.isFinite(n)||new Date(n).toISOString().slice(0,10)!==value)throw Error('Choose valid calendar dates.');return n;}
function minute(value){if(!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value||''))throw Error('Choose opening and closing times.');return Number(value.slice(0,2))*60+Number(value.slice(3));}
export function planAvailability({dateFrom,dateTo,weekdays,opens,closes,timezone,durationMinutes,bufferMinutes,now=Date.now()}){
 const from=date(dateFrom),to=date(dateTo),start=minute(opens),end=minute(closes);
 if(to<from||(to-from)/DAY>=90)throw Error('Choose a range of 1–90 days.');
 if(!Array.isArray(weekdays)||!weekdays.length||weekdays.length>7||weekdays.some(n=>!Number.isInteger(n)||n<0||n>6)||new Set(weekdays).size!==weekdays.length)throw Error('Choose each weekday at most once.');
 if(!Number.isInteger(durationMinutes)||durationMinutes<5||durationMinutes>480||!Number.isInteger(bufferMinutes)||bufferMinutes<0||bufferMinutes>120)throw Error('Review the service duration and buffer.');
 if(end<=start)throw Error('Closing time must be later on the same day.');
 if(!Number.isFinite(now))throw Error('The current time is unavailable.');
 const cadence=durationMinutes+bufferMinutes,slots=[];
 for(let day=from;day<=to;day+=DAY){if(!weekdays.includes(new Date(day).getUTCDay()))continue;const d=new Date(day).toISOString().slice(0,10);
  for(let m=start;m+cadence<=end;m+=cadence){const wall=d+'T'+String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');let begins,blockedWall;
   try{begins=zonedToInstant(wall,timezone);const bm=m+cadence;blockedWall=zonedToInstant(d+'T'+String(Math.floor(bm/60)).padStart(2,'0')+':'+String(bm%60).padStart(2,'0'),timezone);}catch(e){throw Error(wall+': '+e.message);}
   const n=Date.parse(begins);if(n<=now||n>now+365*DAY)throw Error('Every start must be in the future and within 365 days.');
   // Reject a window crossing a clock change, even when its endpoints are unambiguous.
   if(Date.parse(blockedWall)-n!==cadence*60000)throw Error(wall+': This appointment crosses a clock change. Choose another window.');
   slots.push({local_start:wall,starts_at:begins,ends_at:new Date(n+durationMinutes*60000).toISOString(),blocked_until:blockedWall});
   if(slots.length>200)throw Error('A plan can contain at most 200 available times. Narrow the range.');
  }
 }
 if(!slots.length)throw Error('This pattern has no available times. Include a selected weekday and room for the service plus buffer.');
 return slots;
}
export function findConflicts(planned,existing){return planned.map(slot=>({...slot,conflicts:existing.filter(x=>x.active&&Date.parse(x.starts_at)<Date.parse(slot.blocked_until)&&Date.parse(x.blocked_until)>Date.parse(slot.starts_at)).map(x=>x.id)}));}
export function validatePreview(value,{workspace,service,resource,slots}){
 if(value?.ok!==true||value.workspace_id!==workspace||value.service_id!==service||value.resource_id!==resource||!Array.isArray(value.slots)||value.slots.length!==slots.length||!UUID.test(value.plan_id)||!Number.isFinite(Date.parse(value.expires_at)))throw Error('The server did not confirm this preview.');
 value.slots.forEach((s,i)=>{if(s.local_start!==slots[i].local_start||Date.parse(s.starts_at)!==Date.parse(slots[i].starts_at)||Date.parse(s.ends_at)!==Date.parse(slots[i].ends_at)||Date.parse(s.blocked_until)!==Date.parse(slots[i].blocked_until)||!Array.isArray(s.conflicts))throw Error('Timezone rules or service settings changed. Refresh and preview again.');});return value;
}
export function validatePlanReceipt(result,preview){if(result?.ok!==true||result.plan_id!==preview.plan_id||result.workspace_id!==preview.workspace_id||!Array.isArray(result.slots)||result.slots.length!==preview.slots.length||new Set(result.slots.map(s=>s.id)).size!==result.slots.length||result.slots.some((s,i)=>!UUID.test(s.id)||s.workspace_id!==preview.workspace_id||s.resource_id!==preview.resource_id||s.service_id!==preview.service_id||s.version!==1||Date.parse(s.starts_at)!==Date.parse(preview.slots[i].starts_at)||Date.parse(s.ends_at)!==Date.parse(preview.slots[i].ends_at)||Date.parse(s.blocked_until)!==Date.parse(preview.slots[i].blocked_until)))throw Error('The server did not confirm every created time. Keep this preview and retry to check the receipt.');return result;}

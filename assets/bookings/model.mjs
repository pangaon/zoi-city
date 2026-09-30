export const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
export function displayTime(value,timezone){return new Intl.DateTimeFormat(undefined,{timeZone:timezone,dateStyle:'medium',timeStyle:'short'}).format(new Date(value));}
export function money(cents,currency){try{return new Intl.NumberFormat(undefined,{style:'currency',currency}).format(cents/100);}catch{return String(currency)+' '+(cents/100).toFixed(2);}}
export function localInput(value,timezone){const p=parts(new Date(value),timezone);return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;}
function parts(date,timezone){return Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date).map(p=>[p.type,p.value]));}
// Reject nonexistent and ambiguous DST wall times rather than silently shifting appointments.
export function zonedToInstant(input,timezone){
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input))throw new Error('Enter a complete date and time.');
 const wall=Date.parse(input+':00Z');if(!Number.isFinite(wall))throw new Error('Enter a valid date and time.');
 const offsets=new Set();for(const delta of [-86400000,0,86400000]){const sample=wall+delta,p=parts(new Date(sample),timezone);offsets.add(Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`)-sample);}
 const matches=[...offsets].map(offset=>new Date(wall-offset)).filter(date=>localInput(date,timezone)===input);
 if(matches.length!==1)throw new Error(matches.length?'This time occurs twice when clocks change. Choose a time outside the clock change.':'This time does not exist when clocks change. Choose another time.');
 return matches[0].toISOString();
}
export function range(days=14){const from=new Date();return {from:from.toISOString(),to:new Date(from.getTime()+days*86400000).toISOString()};}
export function confirmed(result,key){if(result?.ok!==true||!result[key])throw new Error('The server did not confirm this change. Refresh before retrying.');return result[key];}
export function errorMessage(error){const code=String(error?.message||error),map={booking_listing_is_immutable:'This schedule already has availability or booking history and cannot be moved to another business page.',slot_version_conflict:'The business changed this time or price. Refresh and review the updated availability before booking.',availability_overlap:'This table or staff member already has availability at that time, including its buffer.',slot_unavailable:'That time is no longer available. Refresh and choose another.',slot_has_reservation:'This time has a booking. Cancel the booking before changing availability.',party_exceeds_capacity:'Your party is larger than this table or appointment allows.',version_conflict:'Someone changed this record. Refresh before saving your changes.',workspace_permission_denied:'Only workspace owners and admins can manage bookings.',booking_not_owned:'This booking belongs to another account.',booking_status_final:'This booking has already been closed.',booking_not_started:'The appointment has not started yet.',published_owned_listing_required:'Choose a published business page owned by this workspace.',request_id_conflict:'This request was already used for another selection. Refresh your bookings.'};return map[code]||code;}

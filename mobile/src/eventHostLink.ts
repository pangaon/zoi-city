const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function guestEventHostLink(event: string): string {
  if (!UUID.test(event)) throw Error('Choose a valid event first.');
  return 'https://www.zoi.city/tickets/hosts/?event=' + event.toLowerCase();
}
export async function organiserEventHostLink({event, workspace, actor, current, rpc}: {
  event: string; workspace: string; actor: string;
  current: () => boolean; rpc: (name: string, args: Record<string, unknown>) => Promise<any>;
}): Promise<string> {
  const guestLink = guestEventHostLink(event);
  const check = () => { if (!current()) throw Error('Your account or selected workspace changed.'); };
  if (!UUID.test(actor) || !UUID.test(workspace)) throw Error('Select your organisation workspace in Grow first.');
  check();
  const me = await rpc('zoi_me', {}); check();
  if (!UUID.test(me?.profile?.id || '') || !Array.isArray(me?.workspaces)) throw Error('Your workspace access could not be verified.');
  const matches = me.workspaces.filter((row: any) => typeof row?.id === 'string' && row.id.toLowerCase() === workspace.toLowerCase());
  if (matches.length !== 1 || !['owner', 'admin'].includes(matches[0].role)) throw Error('Owner or admin access to your selected workspace is required.');
  const inventory = await rpc('table_inventory_operator', {p_workspace: workspace, p_event: event}); check();
  if (inventory?.ok !== true || inventory.event_id !== event || !Number.isSafeInteger(inventory.version) || inventory.version < 0 || !Array.isArray(inventory.tables)) throw Error('This event could not be verified for your selected workspace.');
  return guestLink + '&workspace=' + workspace.toLowerCase();
}

/** Fence refresh before any private handoff proof is dispatched. Credentials stay in memory. */
export async function scopedEventHostRpc(client: {
  session: {user: {id: string}} | null;
  token: () => Promise<string>;
  request: (path: string, body: unknown, token: string) => Promise<any>;
}, actor: string, current: () => boolean, name: string, args: Record<string, unknown>): Promise<any> {
  const check = () => {
    if (!UUID.test(actor) || client.session?.user.id !== actor || !current()) throw Error('Your account or selected workspace changed.');
  };
  if (!['zoi_me', 'table_inventory_operator','event_host_list','event_host_get','event_host_claim_preview'].includes(name)) throw Error('Unsupported event handoff check.');
  check();
  const token = await client.token();
  check();
  if(!token)throw Error('Please sign in again.');
  const result = await client.request('/rest/v1/rpc/' + name, args, token);
  check();
  return result;
}

/** Only the canonical, explicitly supplied bearer invitation; never persist it. */
export function privateEventInvitation(value: string, event: string): {url: string; token: string} {
  guestEventHostLink(event);
  let u: URL;try{u=new URL(value.trim());}catch{throw Error('Paste your complete private Zoi invitation link.');}
  if(u.protocol!=='https:'||u.host!=='www.zoi.city'||u.username||u.password||u.pathname!=='/tickets/hosts/'||u.searchParams.getAll('event').length!==1||[...u.searchParams.keys()].some(k=>k!=='event')||u.searchParams.get('event')?.toLowerCase()!==event.toLowerCase()||!/^#claim=[a-f0-9]{64}$/.test(u.hash))throw Error('This must be a private invitation for the selected event.');
  return {url:guestEventHostLink(event)+u.hash,token:u.hash.slice(7)};
}
export function currentPareaGroup(response: any,event: string,profile: string,now=Date.now()) {
  const a=response?.allocation;
  if(response?.ok!==true||response.payment_collected!==false||!UUID.test(profile)||!a||!UUID.test(a.id||'')||a.event_id!==event||!UUID.test(a.table_id||'')||a.host_profile_id!==profile||!Number.isInteger(a.quota)||a.quota<1||a.quota>100||!Number.isFinite(Date.parse(a.expires_at))||!['active','released','expired','invalidated'].includes(a.status)||!Number.isSafeInteger(a.price_per_guest_cents)||a.price_per_guest_cents<0||!['CAD','USD','EUR','GBP','AUD','NZD','CHF'].includes(a.currency)||!Array.isArray(response.guests))throw Error('Your current table allocation could not be verified.');
  const ids=new Set();let accepted=0,waiting=0;
  for(const g of response.guests){if(!UUID.test(g.id||'')||ids.has(g.id)||!Number.isInteger(g.quantity)||g.quantity<1||!['accepted','invited','revoked'].includes(g.status))throw Error('Your guest quantities could not be verified.');ids.add(g.id);if(g.status==='accepted')accepted+=g.quantity;if(g.status==='invited')waiting+=g.quantity;}
  if(accepted+waiting>a.quota)throw Error('The group quantities exceed the current allocation.');
  return {id:a.id,label:typeof a.label==='string'?a.label.slice(0,160):'Your table',quota:a.quota,accepted,waiting,unassigned:a.quota-accepted-waiting,expires:a.expires_at,active:a.status==='active'&&Date.parse(a.expires_at)>now,unitPrice:a.price_per_guest_cents,currency:a.currency};
}
export function currentInvitationPreview(response:any,event:string,now=Date.now()) {
  if(response?.ok!==true||response.event_id!==event||!UUID.test(response.table_id||'')||!['invited','accepted'].includes(response.status)||!Number.isInteger(response.quantity)||response.quantity<1||response.quantity>100||!Number.isSafeInteger(response.price_per_guest_cents)||response.price_per_guest_cents<0||!['CAD','USD','EUR','GBP','AUD','NZD','CHF'].includes(response.currency)||!Number.isFinite(Date.parse(response.expires_at))||Date.parse(response.expires_at)<=now||response.payment_collected!==false||response.ticket_issued!==false)throw Error('This invitation is unavailable or its details could not be verified.');
  return {tableId:response.table_id,event:typeof response.event_name==='string'?response.event_name.slice(0,160):'Your event',table:typeof response.table_label==='string'?response.table_label.slice(0,160):'Your table',quantity:response.quantity,unitPrice:response.price_per_guest_cents,currency:response.currency,expires:response.expires_at,status:response.status};
}
export async function ownPareaGroups(event:string,rpc:(name:string,args:Record<string,unknown>)=>Promise<any>){
  guestEventHostLink(event);const me=await rpc('zoi_me',{});if(!UUID.test(me?.profile?.id||''))throw Error('Your host profile could not be verified.');
  const list=await rpc('event_host_list',{p_workspace:null,p_event:event});if(list?.ok!==true||!Array.isArray(list.allocations)||list.allocations.length>100)throw Error('Your allocations could not be verified.');
  const ids=new Set();const result=[];for(const a of list.allocations){if(!UUID.test(a?.id||'')||a.event_id!==event||a.host_profile_id!==me.profile.id||ids.has(a.id))throw Error('An allocation does not match this event and host.');ids.add(a.id);const detail=await rpc('event_host_get',{p_allocation:a.id});if(detail?.allocation?.id!==a.id)throw Error('The allocation response changed.');result.push(currentPareaGroup(detail,event,me.profile.id));}return result;
}

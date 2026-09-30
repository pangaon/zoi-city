// The same RPC client is usable by web and native callers (token supplied).
export function createVenueClient({getToken,fetchImpl=fetch,base='https://csebihpaychdkanjjsmz.supabase.co',key='sb_publishable_BM4ZQtOCUhjg7VqyFGJGRw_eFyTgI4j'}={}){
 return async function call(fn,params={},anonymous=false){
  const token=await getToken?.();
  if(!anonymous&&!token)throw new Error('Sign in to use your workspace and reserve seats.');
  let response;
  try{response=await fetchImpl(`${base}/rest/v1/rpc/${fn}`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${token||key}`,'Content-Type':'application/json'},body:JSON.stringify(params),signal:AbortSignal.timeout(15000)});}
  catch{throw new Error('The request could not be confirmed. Refresh the saved state before retrying.');}
  let data;try{data=await response.json();}catch{throw new Error('The server returned an unreadable response.');}
  if(!response.ok||data?.error||data?.ok===false){
   const code=String(data?.message||data?.error||'');
   const messages={revision_conflict:'Another save changed this plan. Export your draft, then load the current version.',workspace_permission_denied:'Only workspace owners and admins can change venue plans.',seat_inventory_not_enabled:'Named-seat booking is not enabled for this workspace yet.',seats_unavailable:'One or more seats are no longer available. Refresh the seating plan.',hold_expired:'Your hold expired. Select your seats again.',hold_no_longer_active:'This hold is no longer active. Refresh the seating plan.',release_existing_hold_first:'Release your existing seat hold before choosing a new group.',event_unavailable:'This event is not currently available.',choose_seats_for_this_event:'Choose named seats from this event’s seating plan.',free_tier_required:'This seating workflow currently supports free reservations.',published_layout_is_immutable:'This event already has a published layout. Create a new event to use a different layout.'};
   throw new Error(messages[code]||'This action is unavailable. Check your permissions and try again.');
  }
  return data;
 };
}

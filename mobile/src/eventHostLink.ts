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
  if (!['zoi_me', 'table_inventory_operator'].includes(name)) throw Error('Unsupported event handoff check.');
  check();
  const token = await client.token();
  check();
  const result = await client.request('/rest/v1/rpc/' + name, args, token);
  check();
  return result;
}

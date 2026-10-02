export type RecordKind = 'company' | 'contact' | 'project' | 'task';
export type OpsRecord = { id: string; workspace_id: string; kind: RecordKind; title: string; data: Record<string, unknown>; status: 'open' | 'in_progress' | 'blocked' | 'completed'; company_id?: string | null; project_id?: string | null; contact_id?: string | null; due_at?: string | null; assignee_profile_id?: string | null; version: number; created_at?: string; updated_at?: string; archived_at?: string | null };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isOpsRecord(value: unknown, workspace: string): value is OpsRecord {
  if (!value || typeof value !== 'object') return false;
  const row = value as OpsRecord;
  return typeof row.id === 'string' && uuid.test(row.id) && row.workspace_id === workspace && ['company', 'contact', 'project', 'task'].includes(row.kind) && typeof row.title === 'string' && row.title.trim().length > 0 && Number.isInteger(row.version) && row.version > 0 && !!row.data && typeof row.data === 'object' && !Array.isArray(row.data) && ['open', 'in_progress', 'blocked', 'completed'].includes(row.status);
}
export function assertOpsReceipt(value: unknown, workspace: string, kind: RecordKind, previous?: OpsRecord): OpsRecord {
  const receipt = value as { ok?: boolean; record?: unknown };
  if (!receipt || receipt.ok !== true || !isOpsRecord(receipt.record, workspace) || receipt.record.kind !== kind || (previous && (receipt.record.id !== previous.id || receipt.record.version !== previous.version + 1))) throw new Error('We could not verify the saved record. Reload before trying again.');
  return receipt.record;
}
export function canWrite(role: string, kind: RecordKind) { return role === 'owner' || role === 'admin' || (role === 'editor' && kind !== 'company'); }
export function toForm(row?: OpsRecord): Record<string, string> {
  return { title: row?.title || '', notes: String(row?.data.notes || ''), sector: String(row?.data.sector || 'business'), legal_name: String(row?.data.legal_name || ''), jurisdiction: String(row?.data.jurisdiction || ''), registration_number: String(row?.data.registration_number || ''), website: String(row?.data.website || ''), email: String(row?.data.email || ''), phone: String(row?.data.phone || ''), status: row?.status || 'open', due_at: row?.due_at?.slice(0, 10) || '', company_id: row?.company_id || '', project_id: row?.project_id || '', contact_id: row?.contact_id || '', assignee_profile_id: row?.assignee_profile_id || '' };
}
export function recordPayload(form: Record<string, string>, existing?: OpsRecord, kind: RecordKind = existing?.kind || 'contact') {
  if (!form.title.trim() || form.title.trim().length > 200) throw new Error('Enter a title of 1–200 characters.');
  if (kind === 'company' && !['business','lawyer','church','restaurant','stylist','creator'].includes(form.sector)) throw new Error('Choose a business sector.');
  if (kind === 'project' && !form.company_id) throw new Error('Link this project to a company first.');
  if (kind === 'task' && !form.project_id) throw new Error('Link this task to a project first.');
  let due: string | null = null;
  if (form.due_at) { if (!/^\d{4}-\d{2}-\d{2}$/.test(form.due_at) || Number.isNaN(Date.parse(form.due_at)) || new Date(form.due_at).toISOString().slice(0, 10) !== form.due_at) throw new Error('Enter a valid due date as YYYY-MM-DD.'); due = existing?.due_at?.slice(0, 10) === form.due_at ? existing.due_at : form.due_at + 'T23:59:59Z'; }
  const payload = { ...(existing?.data || {}), ...form, title: form.title.trim(), due_at: due, company_id: form.company_id || null, project_id: form.project_id || null, contact_id: form.contact_id || null, assignee_profile_id: form.assignee_profile_id || null };
  let bytes = 0; for (const character of JSON.stringify(payload)) { const code = character.codePointAt(0)!; bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4; }
  if (bytes > 30000) throw new Error('This record is too large. Shorten the notes before saving.');
  return payload;
}

/** Context from a saved record only; relationship IDs never become user identities. */
export function linkedWorkForm(row:OpsRecord,workspace:string):{kind:RecordKind;form:Record<string,string>}{
 if(!isOpsRecord(row,workspace)||row.archived_at||!['contact','project'].includes(row.kind))throw Error('Choose an active saved contact or project.');
 const form=toForm();
 if(row.kind==='contact'){form.contact_id=row.id;form.company_id=row.company_id||'';return{kind:'project',form};}
 form.project_id=row.id;form.contact_id=row.contact_id||'';return{kind:'task',form};
}

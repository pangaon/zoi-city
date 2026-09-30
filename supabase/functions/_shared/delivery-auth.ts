// Payment setup is a merchant administrative action, not customer checkout.
export const isUuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export async function authenticatedUser(req: Request): Promise<string | null> {
 const authorization=req.headers.get('Authorization')||'';
 if(!/^Bearer\s+\S+$/i.test(authorization))return null;
 const base=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_ANON_KEY');
 if(!base||!key)return null;
 try{const response=await fetch(base+'/auth/v1/user',{headers:{apikey:key,Authorization:authorization},signal:AbortSignal.timeout(15000)});if(!response.ok)return null;const user=await response.json();return isUuid(user.id)?user.id:null;}catch{return null;}
}
export async function canAdministerListing(sql: any, listing: string, user: string): Promise<boolean> {
 const rows=await sql`SELECT 1 FROM zoi.listings l JOIN zoi.workspace_members m ON m.workspace_id=l.owner_workspace_id JOIN zoi.user_profiles p ON p.id=m.profile_id WHERE l.id=${listing} AND p.auth_user_id=${user} AND m.role IN ('owner','admin') LIMIT 1`;
 return rows.length===1;
}
export function safeReturnUrl(value: unknown): boolean {
 try{const u=new URL(String(value));return ['https://zoi.city','https://www.zoi.city'].includes(u.origin)&&!u.username&&!u.password;}catch{return false;}
}

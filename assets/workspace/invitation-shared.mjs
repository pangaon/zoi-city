export const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const TOKEN=/^[0-9a-f]{64}$/;
export function secret(){const b=new Uint8Array(32);crypto.getRandomValues(b);return Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');}
export function element(tag,text,cls){const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;}
export function save(key,value){if(value===null){sessionStorage.removeItem(key);if(sessionStorage.getItem(key)!==null)throw Error('Recovery storage unavailable.');}else{const raw=JSON.stringify(value);sessionStorage.setItem(key,raw);if(sessionStorage.getItem(key)!==raw)throw Error('Recovery storage unavailable.');}}
export function denied(e){return [401,403].includes(Number(e?.status||e?.statusCode))||e?.code==='suite_session_unavailable'||e?.message==='suite_session_unavailable'||/not_authorized|42501|invitation_unavailable/.test(`${e?.code||''} ${e?.message||''}`);}
export function rejected(e){return ['invalid_invitation','invitation_request_limit','invitation_receipt_capacity','invitation_capacity','invitation_already_pending'].includes(e?.message);}
export function validInvitation(i){return i&&UUID.test(i.id)&&UUID.test(i.workspace_id)&&UUID.test(i.revision)&&typeof i.recipient_email==='string'&&['admin','editor','viewer'].includes(i.role)&&['pending','accepted','revoked','expired','invalidated'].includes(i.state)&&Number.isFinite(Date.parse(i.expires_at));}

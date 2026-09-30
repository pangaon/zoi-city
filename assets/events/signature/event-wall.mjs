/** Event-wall policy model, NOT a live upload, moderation or screen service.
 * Trusted inputs must come from authenticated server records: actor/role, finalized
 * media provenance, moderation revision and consent. Browser-provided booleans are
 * never authorization. Render caption/credit/hashtags with textContent, not HTML.
 * Pending: scoped upload/finalization, consent receipts, moderator RPC+audit,
 * screen token/feed, revocation push/refresh, retention cleanup and reporting.
 * No social-account scraping, hashtag ingestion or automatic posting is implemented.
 */
import { sponsorForPlacement } from './planning.mjs';
const id=x=>typeof x==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(x);
const time=x=>typeof x==='string'&&/T.*(?:Z|[+-]\d\d:\d\d)$/.test(x)?Date.parse(x):NaN;
const text=(x,max)=>typeof x==='string'&&x.length<=max&&!/[\u0000-\u0008\u000b-\u001f]/.test(x);
const operator=c=>id(c?.actorId)&&['owner','admin','moderator'].includes(c?.role)&&c?.membershipCurrent===true;
export function wallMedia(value,{eventId,authorId,allowedMediaOrigins=[]}={}){
 if(!value||value.provider!=='zoi_upload'||value.state!=='ready'||value.eventId!==eventId||value.authorId!==authorId||!id(value.id))return null;
 const extensions={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'},ext=extensions[value.mime];if(!ext)return null;
 try{const u=new URL(value.url);if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||!allowedMediaOrigins.some(origin=>{try{return new URL(origin).origin===origin&&origin===u.origin;}catch{return false;}}))return null;
 // A future uploader must emit this exact event-scoped immutable object path.
 if(u.pathname!==`/event-wall/${eventId}/${value.id}.${ext}`)return null;
 return {id:value.id,kind:'image',url:u.href,mime:value.mime};}catch{return null;}
}
export function createWallSubmission(input,context={}){
 const {actorId,eventId,policyVersion,now=Date.now()}=context;
 if(!id(actorId)||!id(eventId)||!id(policyVersion)||!Number.isFinite(now)||!id(input?.id))throw Error('invalid_context');
 if(!text(input.caption??'',400)||!text(input.credit??'',80))throw Error('invalid_text');
 const tags=input.hashtags??[];if(!Array.isArray(tags)||tags.length>5||tags.some(t=>typeof t!=='string'||!/^#[\p{L}\p{N}_]{1,40}$/u.test(t)))throw Error('invalid_hashtags');
 const c=input.consent;if(!c||c.publicScreen!==true||c.ownRights!==true||c.peoplePermission!==true||c.policyVersion!==policyVersion||c.eventId!==eventId||!Number.isFinite(time(c.expiresAt))||time(c.expiresAt)<=now)throw Error('explicit_consent_required');
 const media=wallMedia(input.media,{...context,authorId:actorId});if(!media)throw Error('invalid_media');
 return {id:input.id,eventId,authorId:actorId,version:1,caption:input.caption??'',credit:input.credit??'',hashtags:[...new Set(tags)],media:{...input.media,...media},consent:{publicScreen:true,ownRights:true,peoplePermission:true,policyVersion,eventId,grantedAt:new Date(now).toISOString(),expiresAt:c.expiresAt},status:'pending',submittedAt:new Date(now).toISOString(),moderation:null,revokedAt:null,removedAt:null};
}
export function moderateWallSubmission(entry,{decision,expectedVersion,...context}={}){
 if(!operator(context)||context.eventId!==entry?.eventId)throw Error('not_authorized');
 if(!Number.isSafeInteger(entry?.version)||entry.version<1)throw Error('invalid_revision');
 if(expectedVersion!==entry.version)throw Error('version_conflict');
 if(!['approved','rejected','removed'].includes(decision)||entry.revokedAt||entry.removedAt)throw Error('invalid_transition');
 const now=context.now??Date.now();if(!Number.isFinite(now))throw Error('invalid_time');
 if(decision==='approved'&&(!Number.isFinite(time(entry.submittedAt))||!Number.isFinite(time(entry.consent?.grantedAt))||time(entry.submittedAt)>time(entry.consent.grantedAt)||time(entry.consent.grantedAt)>now))throw Error('invalid_chronology');
 if(decision==='approved'&&(!entry.consent?.publicScreen||!Number.isFinite(time(entry.consent.expiresAt))||time(entry.consent.expiresAt)<=now||entry.consent.policyVersion!==context.policyVersion))throw Error('consent_expired');
 const version=entry.version+1;
 return {...entry,version,status:decision,removedAt:decision==='removed'?new Date(now).toISOString():null,moderation:{actorId:context.actorId,at:new Date(now).toISOString(),version,decision}};
}
export function revokeWallSubmission(entry,{actorId,eventId,expectedVersion,now=Date.now()}={}){
 if(!id(actorId)||!id(eventId)||!entry||actorId!==entry.authorId||eventId!==entry.eventId)throw Error('not_authorized');
 if(!Number.isSafeInteger(entry.version)||entry.version<1)throw Error('invalid_revision');
 if(entry.revokedAt)return entry; // Idempotent owner retry; cannot restore publication.
 if(expectedVersion!==entry.version)throw Error('version_conflict');if(!Number.isFinite(now))throw Error('invalid_time');
 return {...entry,version:entry.version+1,status:'revoked',revokedAt:new Date(now).toISOString()};
}
export function screenItem(entry,context={}){
 const {eventId,policyVersion,startsAt,endsAt,now=Date.now()}=context;
 if(!id(eventId)||!id(policyVersion)||!Number.isFinite(now)||!Number.isFinite(time(startsAt))||!Number.isFinite(time(endsAt))||now<time(startsAt)||now>=time(endsAt))return null;
 const c=entry?.consent,m=entry?.moderation;
 if(!id(entry?.id)||!id(entry?.authorId)||!Number.isSafeInteger(entry?.version)||entry.version<1||entry?.eventId!==eventId||entry.status!=='approved'||entry.revokedAt||entry.removedAt||m?.decision!=='approved'||m.version!==entry.version||!id(m.actorId)||!Number.isFinite(time(m.at))||time(m.at)>now)return null;
 if(!c||c.publicScreen!==true||c.ownRights!==true||c.peoplePermission!==true||c.eventId!==eventId||c.policyVersion!==policyVersion||!Number.isFinite(time(c.grantedAt))||time(c.grantedAt)>now||!Number.isFinite(time(c.expiresAt))||time(c.expiresAt)<=now)return null;
 const submitted=time(entry.submittedAt),granted=time(c.grantedAt),moderated=time(m.at);
 if(!Number.isFinite(submitted)||submitted>granted||granted>moderated)return null;
 const media=wallMedia(entry.media,{...context,authorId:entry.authorId});if(!media||!text(entry.caption,400)||!text(entry.credit,80)||!Array.isArray(entry.hashtags)||entry.hashtags.length>5||entry.hashtags.some(t=>!/^#[\p{L}\p{N}_]{1,40}$/u.test(t)))return null;
 return {id:entry.id,eventId,media,caption:entry.caption,credit:entry.credit,hashtags:[...entry.hashtags]}; // Never author ID, consent evidence or moderator identity.
}
export function wallSponsor(value,context={}){
 if(value?.eventId!==context.eventId||!id(context.eventId)||value.removedAt||value.revokedAt)return null;
 return sponsorForPlacement(value,context);
}

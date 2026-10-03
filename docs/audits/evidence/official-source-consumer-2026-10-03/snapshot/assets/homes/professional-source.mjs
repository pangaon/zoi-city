import {auxiliaryImage} from '../../supabase/functions/zoi-enrich/_image-context.js';
const normalized=v=>String(v||'').normalize('NFKC').toLocaleLowerCase().replace(/\s+/g,' ').trim();
export const professionalText=v=>typeof v==='string'?v.replace(/<\/?[a-z!][^>]*(?:>|$)/gi,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim().slice(0,4000):'';
// Same-site metadata may identify a practice. It never identifies a team member's
// portrait: no page-image gallery is used, and directory/company quarantine wins.
export function professionalSource(entity){
 const q=entity?.profile?._enrich||{},empty={kind:'unconfirmed',image:'',description:''};
 if(entity?.entity_type!=='professional'||q.member||q.member_source||q.source_affiliation||q.source_kind==='association_directory'||q.organization_identity_quarantine||q.identity_scope==='organization')return empty;
 try{const site=new URL(entity.website),source=new URL(q.source_url);if(site.protocol!=='https:'||source.protocol!=='https:'||site.username||site.password||source.username||source.password||site.hostname.replace(/^www\./,'')!==source.hostname.replace(/^www\./,'')||site.pathname.replace(/\/$/,'')!==source.pathname.replace(/\/$/,''))return empty;}catch{return empty;}
 const title=professionalText(q.tagline),parts=title.split(/\s*[|·]\s*/);
 const roles=/^(?:brokerage|real estate agency|law firm|legal practice|accounting firm|medical clinic|dental clinic|architecture firm)$/i;
 const practice=q.provenance?.tagline==='og'&&parts.length===2&&((roles.test(parts[0])&&normalized(parts[1])===normalized(entity.name))||(roles.test(parts[1])&&normalized(parts[0])===normalized(entity.name)));
 if(!practice)return empty;
 let image='';if(q.provenance?.hero_url==='og'&&typeof q.hero_url==='string')try{const u=new URL(q.hero_url);if(u.protocol==='https:'&&!u.username&&!u.password&&!auxiliaryImage(u.href)&&! /\.(?:mp4|webm|mov|m3u8)$/i.test(u.pathname)&&!/(?:^|[/_. -])(?:logo|icon|avatar|placeholder|screenshot)(?:[/_. -]|$)/i.test(u.pathname))image=u.href;}catch{}
 return {kind:'practice',image,description:professionalText(q.description)};
}

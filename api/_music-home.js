import{officialURL}from'../assets/homes/official-url.mjs';
import{publicMedia}from'../supabase/functions/zoi-enrich/_media.js';
import {hasSocialOverride,resolveSocialLinks} from '../assets/homes/social-links.mjs';
import{profileMedia,interfaceArtwork}from'./_profile-media.js';
import{reviewedArtistMedia}from'../assets/homes/templates/music/reviewed-media.mjs';
import{completeHomeMetadata}from'./_home-metadata.js';
import{personData,eligiblePerson,personURL}from'../assets/homes/person-data.mjs';
import{ownerHomeContent}from'./_owner-home-content.js';
import{ARTIST_SOURCES}from'../assets/homes/templates/music/sources.mjs';
import{renderMusic}from'../assets/homes/templates/music/render.mjs';
import{esc,safeHttps,TEMPLATES}from'../assets/homes/templates/music/model.mjs';
const json=value=>JSON.stringify(value).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
function sameSource(url,source){try{const a=new URL(url),b=new URL(source);return officialURL(url)&&officialURL(source)&&a.port===b.port&&a.hostname.replace(/^www\./,'')===b.hostname.replace(/^www\./,'')&&(b.pathname==='/'||a.pathname.replace(/\/$/,'')===b.pathname.replace(/\/$/,''));}catch{return false;}}
export function musicHomeContent(entity){if(!eligiblePerson(entity,'artist'))return null;const curated=ARTIST_SOURCES[entity.id],source=curated&&Object.hasOwn(entity.owner_content||{},'website')&&!sameSource(entity.website,curated.website)?null:curated;if(!source){const raw=entity.profile||{},q=raw._enrich||{},o=entity.owner_content||{},op=o.profile||{};
 const quarantine=!!(q.scope_review_required||q.blocked_reason==='source_scope_mismatch'||q.organization_identity_quarantine||q.member?.affiliation||q.source_affiliation||q.identity_scope==='organization'||['association_directory','association_member'].includes(q.source_kind));
 const p=quarantine?{...raw,photo_url:null,hero_url:null,photo_urls:null,photos:null,social_links:{},_enrich:{}}:raw;
 const safeEntity=quarantine?{...entity,website:null,photo_url:null,hero_url:null,photo:null,social_links:{},profile:p}:entity,d=personData(safeEntity);
 const sourceBound=!quarantine&&sameSource(q.source_url,entity.website)&&!q.scope_review_required&&q.blocked_reason!=='source_scope_mismatch'&&!q.organization_identity_quarantine&&!q.member?.affiliation&&!q.source_affiliation&&q.identity_scope!=='organization'&&q.source_kind!=='association_directory';
 const explicitDescription=Object.hasOwn(o,'description')||Object.hasOwn(op,'description')||Object.hasOwn(p,'description');
 const story=explicitDescription?d.description:(sourceBound&&typeof q.description==='string'&&q.description.trim()?q.description:d.description)||'Explore this artist’s published profile and contact options.';
 const labelSource=sourceBound&&['label_artist_profile','label_release_article'].includes(q.source_kind);
 const sourceLabel=labelSource&&!Object.hasOwn(o,'website')?(q.source_kind==='label_release_article'?'Record label release page':'Record label artist page'):'Artist website';
 const machine=sourceBound?q:{},media=profileMedia({...safeEntity,profile:{...p,_enrich:machine}},{...machine,...p});
 const social=resolveSocialLinks(safeEntity,sourceBound?{social:q.social}: {});
 const sourceListen={};if(sourceBound&&!hasSocialOverride(safeEntity))for(const key of ['spotify','youtube']){const media=publicMedia(machine.listen?.[key]);if(media?.platform===key)sourceListen[key]=media.url;}
 const spotify=Object.hasOwn(op,'spotify_url')?op.spotify_url:Object.hasOwn(p,'spotify_url')?p.spotify_url:social.spotify||(!hasSocialOverride(safeEntity)?p.listen?.spotify||sourceListen.spotify:'');
 const reviewed=!quarantine?reviewedArtistMedia(entity):null;
 const hasPortrait=Object.hasOwn(o,'photo_url')||Object.hasOwn(p,'photo_url')||Object.hasOwn(p,'hero_url')||Object.hasOwn(p,'portrait_url');
 const portrait=(!hasPortrait?reviewed?.portrait:'')||media.hero||(d.portrait&&!interfaceArtwork(d.portrait)&&(hasPortrait||!(Array.isArray(machine.photo_roles)&&machine.photo_roles.some(r=>r?.url===d.portrait&&r.role==='gallery_only')))?d.portrait:'')||'';
 const hasSpotify=Object.hasOwn(op,'spotify_url')||Object.hasOwn(p,'spotify_url')||hasSocialOverride(safeEntity);
 const hasYoutube=Object.hasOwn(op,'youtube_url')||Object.hasOwn(p,'youtube_url')||hasSocialOverride(safeEntity);
 const gallerySource=personURL(entity.website)||'https://www.zoi.city/artist/'+encodeURIComponent(d.slug);
 const images=[media.hero,...media.gallery].filter((v,i,a)=>v&&a.indexOf(v)===i);
 const content=ownerHomeContent({...d,...(labelSource?{email:'',phone:'',phoneLabel:''}:{}),portrait,story,description:story,...(explicitDescription?{owner_description:true}:{}),greek_name:'',portrait_credit:portrait===reviewed?.portrait?'Spotify artist photograph':media.hero?'Published artist profile image':'',portrait_sources:[],gallery:images.map(url=>({url,caption:d.name+' · profile photograph',credit:sourceBound?'Artist website / published profile':'Published profile',source:gallerySource})),releases:[],shows:[],spotify:personURL(spotify)||(!hasSpotify?reviewed?.spotify||'':''),youtube:personURL(social.youtube||p.youtube_url||sourceListen.youtube)||(!hasYoutube?reviewed?.video||'':''),instagram:personURL(social.instagram),facebook:personURL(social.facebook),video_playlist:personURL(p.video_playlist),contact:personURL(p.booking_url),programme:'',checked_at:sourceBound?q.checked_at||'':'',source_method:'Details from the public artist profile, source-matched website and authorized owner edits.',source_label:sourceLabel},entity,'music');return {...content,description:content.story};}
 if(entity.id==='a558f28d-6c8f-4079-9730-838f483867fc'&&!sameSource(entity.website,source.website))return null;
 // Petrelis is an existing sparse artist record. Label/Spotify sources were
 // independently reviewed; never invent an official website on the entity.
 if(entity.id==='78ee3fac-5a97-4e87-88af-57f1eb6a638d'){if(!['thanos petrelis','θάνος πετρέλης'].includes(String(entity.name||'').trim().toLowerCase()))return null;if(entity.website&&!sameSource(entity.website,source.website))return null;}
 return ownerHomeContent({...source,slug:entity.canonical_slug||entity.slug||source.slug},entity,'music');}
export function renderMusicHome(entity,publishedDesign=null){const artist=musicHomeContent(entity);if(!artist)return null;const design=publishedDesign&&typeof publishedDesign==='object'&&!Array.isArray(publishedDesign)?publishedDesign:{},template=TEMPLATES.includes(design.template)?design.template:'concierge',canonical='https://www.zoi.city/artist/'+encodeURIComponent(artist.slug),title=artist.name+' · Music, appearances & your plans | Zoi',description='Explore '+artist.name+' recordings, source-listed shows and personal plans.';return completeHomeMetadata('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(title)+'</title><meta name="description" content="'+esc(description)+'"><link rel="canonical" href="'+esc(canonical)+'"><meta property="og:title" content="'+esc(title)+'"><meta property="og:description" content="'+esc(description)+'">'+(safeHttps(artist.portrait)?'<meta property="og:image" content="'+esc(artist.portrait)+'">':'')+'<link rel="stylesheet" href="/assets/homes/templates/music/style.css?v=20260930-photo-fallback"><script src="/assets/zoi-core.js?v=20260930" defer></script></head><body data-template="'+template+'" class="'+template+'"><div id="music-home">'+renderMusic(artist,template,design,{preview:false})+'</div><script type="application/json" id="music-home-content">'+json({artist,design:{...design,template}})+'</script><script type="module" src="/assets/homes/templates/music/app.mjs?v=20261001-official-source"></script></body></html>',{name:artist.name,title,canonical,description:artist.description||artist.story||'',image:artist.portrait,type:artist.generic?'Thing':'Person',location:artist.city});}
export default renderMusicHome;

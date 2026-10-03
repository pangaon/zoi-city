import {SIGNATURE_EVENT} from '../../../events/signature/source-facts.mjs';
import {esc} from './model.mjs';
const performers=new Set(['98a3cc20-0369-469a-b885-9e1d6f070f92','6c125478-7978-4168-b405-625cfa29c22c']);
// Exact, source-reviewed identities. This is not an artist_shows confirmation,
// event inventory identifier, or evidence of ticket availability.
export function artistAnnouncements(artistId,{now=new Date(),today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).format(now)}={}){
 if(!performers.has(artistId)||today>SIGNATURE_EVENT.date)return [];
 return [{title:SIGNATURE_EVENT.title,date:SIGNATURE_EVENT.date,venue:SIGNATURE_EVENT.venue,timezone:SIGNATURE_EVENT.timezone,source:SIGNATURE_EVENT.source,eventPath:'/events/'+SIGNATURE_EVENT.id+'/',organizer:SIGNATURE_EVENT.organizer,organizerPath:'/business/signatureproductions-6aa61d',poster:SIGNATURE_EVENT.poster}];
}
export function announcementCards(artistId,options){return artistAnnouncements(artistId,options).map(a=>`<article class="show-row artist-announcement"><time datetime="${esc(a.date)}"><b>20</b><span>MAR 2027</span></time><div><p class="eyebrow">Announced by ${esc(a.organizer)}</p><h3>${esc(a.title)}</h3><p>${esc(a.venue)} · Toronto area</p><p><a href="${esc(a.organizerPath)}">${esc(a.organizer)}</a> · <span>20 March 2027</span></p><details><summary>About this date</summary><p>This date comes from the organiser’s announcement; artist/event workspaces have not confirmed it on Zoi.</p><a class="text-link" href="${esc(a.source)}" target="_blank" rel="noopener noreferrer">View organiser’s source ↗</a></details></div><div class="show-actions"><a class="outline" href="${esc(a.eventPath)}">Explore the concert on Zoi</a></div></article>`).join('');}

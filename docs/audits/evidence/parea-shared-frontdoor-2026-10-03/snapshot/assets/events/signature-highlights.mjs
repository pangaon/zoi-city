import {SIGNATURE_ARCHIVE} from './signature-archive.mjs';
import {highlightItems} from './highlight-player.mjs';
export function signatureHighlights(entity){
 const photos=(entity.signature_gallery||[]).map(p=>({type:'photo',src:p.url,caption:p.caption,context:entity.owner_gallery?'Selected by Signature Productions':'Signature archive · past events, separate from the 2027 concert',sourceUrl:entity.website}));
 const custom=(entity.publicity?.highlights||[]).map(h=>{const base={caption:h.title,context:h.context,poster:h.poster,sourceUrl:h.url};if(String(h.provider).toLowerCase()==='facebook')return{...base,type:'facebook',url:h.url};if(String(h.provider).toLowerCase()==='youtube'){try{const u=new URL(h.url),id=u.hostname==='youtu.be'?u.pathname.slice(1):u.searchParams.get('v')||u.pathname.split('/').pop();return{...base,type:'youtube',url:'https://www.youtube.com/watch?v='+id,embed:'https://www.youtube-nocookie.com/embed/'+id}}catch{}}return null}).filter(Boolean);
 const archive=entity.owner_gallery||entity.publicity?[]:SIGNATURE_ARCHIVE.filter(v=>v.playback_verified).map(v=>({type:'facebook',url:v.url,poster:v.poster,caption:v.title,context:'Official concert archive · not the upcoming 2027 event',sourceUrl:v.url}));
 return highlightItems([...photos,...custom,...archive]);
}

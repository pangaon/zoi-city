import {mediaMetadata} from './media-rules.mjs';
export function validMediaAsset(a){return !!a&&/^[0-9a-f-]{36}$/i.test(a.id)&&['image','video'].includes(a.type)&&a.url==='https://csebihpaychdkanjjsmz.supabase.co/functions/v1/community-media?asset='+a.id&&Number.isInteger(a.width)&&a.width>0&&Number.isInteger(a.height)&&a.height>0;}
export async function uploadCommunityMedia({base,apikey,token,file,requestId,purpose='post',fetcher=fetch}){
 mediaMetadata(file.type,file.size,purpose);if(!token||!requestId)throw Error('sign_in_required');
 const body=new FormData();body.append('file',file);body.append('request_id',requestId);body.append('purpose',purpose);
 const r=await fetcher(base+'/functions/v1/community-media?action=upload',{method:'POST',headers:{apikey,Authorization:'Bearer '+token},body});
 const d=await r.json();if(!r.ok||d?.ok!==true||!validMediaAsset(d.asset))throw Error(d?.error||'media_upload_unconfirmed');return d.asset;
}
export async function discardCommunityMedia({base,apikey,token,assetId,fetcher=fetch}){
 const r=await fetcher(base+'/functions/v1/community-media?action=discard',{method:'POST',headers:{apikey,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({asset_id:assetId})});const d=await r.json();if(!r.ok||d?.ok!==true||d.id!==assetId)throw Error(d?.error||'media_cleanup_unconfirmed');return d;
}

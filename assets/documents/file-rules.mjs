export const MAX_DOCUMENT_BYTES=10*1024*1024;
export const DOCUMENT_TYPES=Object.freeze({'application/pdf':'pdf','text/plain':'txt','image/png':'png','image/jpeg':'jpg'});
export function validateFileMetadata({name,type,size}){
 if(typeof name!=='string'||!name.trim()||name.length>180||/[\x00-\x1f/\\]/.test(name))throw Error('invalid_filename');
 if(!Object.hasOwn(DOCUMENT_TYPES,type))throw Error('unsupported_document_type');
 if(!Number.isInteger(size)||size<1||size>MAX_DOCUMENT_BYTES)throw Error('invalid_document_size');
 const suffix=name.split('.').pop().toLowerCase(),allowed=type==='image/jpeg'?['jpg','jpeg']:[DOCUMENT_TYPES[type]];
 if(!allowed.includes(suffix))throw Error('filename_type_mismatch');
 return {name:name.trim(),type,size};
}
export function validateFileBytes(metadata,bytes){
 const result=validateFileMetadata(metadata);
 if(!(bytes instanceof Uint8Array)||bytes.byteLength!==result.size)throw Error('document_size_mismatch');
 const starts=seq=>seq.every((n,i)=>bytes[i]===n);
 if(result.type==='application/pdf'&&!starts([37,80,68,70,45]))throw Error('document_signature_mismatch');
 if(result.type==='image/png'&&!starts([137,80,78,71,13,10,26,10]))throw Error('document_signature_mismatch');
 if(result.type==='image/jpeg'&&!starts([255,216,255]))throw Error('document_signature_mismatch');
 if(result.type==='text/plain'){try{const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);if(text.includes('\0'))throw Error();}catch{throw Error('invalid_text_document');}}
 return result;
}
export async function sha256(bytes){const hash=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(hash)].map(n=>n.toString(16).padStart(2,'0')).join('');}

export const IMAGE_MAX=8*1024*1024,VIDEO_MAX=32*1024*1024;
export const MEDIA_TYPES=['image/jpeg','image/png','image/webp','video/mp4'];
const ascii=(b,a,n)=>String.fromCharCode(...b.slice(a,a+n));
export function mediaMetadata(type,size,purpose='post'){
 if(!MEDIA_TYPES.includes(type)||!['post','avatar'].includes(purpose)||purpose==='avatar'&&type==='video/mp4')throw Error('unsupported_media_type');
 if(!Number.isInteger(size)||size<16||size>(type==='video/mp4'?VIDEO_MAX:IMAGE_MAX))throw Error('invalid_media_size');
 return {type,mime_type:type,size_bytes:size,purpose};
}
export function inspectMedia(bytes,type,purpose='post'){
 mediaMetadata(type,bytes.length,purpose);const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let width,height,duration_seconds=null;
 if(type==='image/png'){
  if(ascii(bytes,1,3)!=='PNG'||bytes[0]!==137||bytes[4]!==13||bytes[5]!==10||bytes[6]!==26||bytes[7]!==10||ascii(bytes,12,4)!=='IHDR'||v.getUint32(8)!==13)throw Error('invalid_media_content');width=v.getUint32(16);height=v.getUint32(20);let p=8,data=false,ended=false;while(p+12<=bytes.length){const n=v.getUint32(p),kind=ascii(bytes,p+4,4);if(p+n+12>bytes.length)throw Error('invalid_media_content');if(kind==='acTL')throw Error('animated_images_unsupported');if(kind==='IDAT')data=true;p+=n+12;if(kind==='IEND'){ended=n===0&&p===bytes.length;break;}}if(!data||!ended)throw Error('invalid_media_content');
 }else if(type==='image/jpeg'){
  if(bytes[0]!==255||bytes[1]!==216||bytes[bytes.length-2]!==255||bytes[bytes.length-1]!==217)throw Error('invalid_media_content');
  let p=2;while(p+4<bytes.length){if(bytes[p]!==255)break;let m=bytes[p+1];if(m===218)break;let n=v.getUint16(p+2);if(n<2||p+2+n>bytes.length)throw Error('invalid_media_content');if([192,193,194].includes(m)){height=v.getUint16(p+5);width=v.getUint16(p+7);break;}p+=2+n;}
 }else if(type==='image/webp'){
  if(ascii(bytes,0,4)!=='RIFF'||ascii(bytes,8,4)!=='WEBP'||v.getUint32(4,true)+8!==bytes.length)throw Error('invalid_media_content');
  const chunk=ascii(bytes,12,4);if(chunk==='VP8X'){if(bytes[20]&2)throw Error('animated_images_unsupported');width=1+bytes[24]+bytes[25]*256+bytes[26]*65536;height=1+bytes[27]+bytes[28]*256+bytes[29]*65536;}
  else if(chunk==='VP8 '&&bytes[23]===157&&bytes[24]===1&&bytes[25]===42){width=v.getUint16(26,true)&16383;height=v.getUint16(28,true)&16383;}
  else if(chunk==='VP8L'&&bytes[20]===47){const n=v.getUint32(21,true);width=1+(n&16383);height=1+((n>>>14)&16383);}
 }else{
  let tracks=0,video=0,hasData=false,hasMovie=false;const codecs=[];
  function boxes(start,end,depth=0){if(depth>8)throw Error('invalid_media_content');let out=[];for(let p=start;p<end;){if(p+8>end)throw Error('invalid_media_content');const size=v.getUint32(p),kind=ascii(bytes,p+4,4);if(size<8||p+size>end)throw Error('unsupported_mp4_structure');out.push({p:p+8,end:p+size,kind});p+=size;}return out;}
  const top=boxes(0,bytes.length);if(top[0]?.kind!=='ftyp'||!top.some(b=>b.kind==='mdat'))throw Error('invalid_media_content');hasData=true;
  const moov=top.find(b=>b.kind==='moov');if(!moov)throw Error('unsupported_mp4_structure');hasMovie=true;
  const movie=boxes(moov.p,moov.end),mvhd=movie.find(b=>b.kind==='mvhd');if(!mvhd||bytes[mvhd.p]!==0||mvhd.p+20>mvhd.end)throw Error('unsupported_mp4_structure');
  const scale=v.getUint32(mvhd.p+12);duration_seconds=v.getUint32(mvhd.p+16)/scale;
  for(const tr of movie.filter(b=>b.kind==='trak')){tracks++;const tb=boxes(tr.p,tr.end),mdia=tb.find(b=>b.kind==='mdia');if(!mdia)throw Error('invalid_media_content');const mb=boxes(mdia.p,mdia.end),hd=mb.find(b=>b.kind==='hdlr'),minf=mb.find(b=>b.kind==='minf');if(!hd||!minf)throw Error('invalid_media_content');const handler=ascii(bytes,hd.p+8,4);const stbl=boxes(minf.p,minf.end).find(b=>b.kind==='stbl');if(!stbl)throw Error('invalid_media_content');const stsd=boxes(stbl.p,stbl.end).find(b=>b.kind==='stsd');if(!stsd||stsd.p+8>stsd.end||v.getUint32(stsd.p+4)!==1)throw Error('unsupported_video_codec');const samples=boxes(stsd.p+8,stsd.end);if(samples.length!==1)throw Error('unsupported_video_codec');const sample=samples[0];codecs.push(sample.kind);
   if(handler==='vide'){if(!['avc1','avc3'].includes(sample.kind)||sample.p+78>sample.end)throw Error('unsupported_video_codec');video++;width=v.getUint16(sample.p+24);height=v.getUint16(sample.p+26);if(!boxes(sample.p+78,sample.end).some(b=>b.kind==='avcC'))throw Error('unsupported_video_codec');}
   else if(handler!=='soun'||sample.kind!=='mp4a')throw Error('unsupported_video_codec');
  }
  if(!hasMovie||!hasData||video!==1||tracks>2||!Number.isFinite(duration_seconds)||duration_seconds<=0||duration_seconds>120)throw Error('unsupported_video_duration');
 }
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>8192||height>8192||width*height>40000000)throw Error('invalid_media_dimensions');
 return {type:type==='video/mp4'?'video':'image',mime_type:type,width,height,duration_seconds};
}
export async function mediaDigest(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');}

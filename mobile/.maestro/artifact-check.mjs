// Genuine simulator screenshots only. Never resize, paint or substitute images.
import {readFileSync,readdirSync,lstatSync,writeFileSync,mkdirSync,openSync,closeSync,fstatSync,readSync,constants} from 'node:fs';
import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const MAX_PNG=32*1024*1024,MAX_RAW=24*1024*1024;
const crcTable=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(bytes){let crc=0xffffffff;for(const b of bytes)crc=crcTable[(crc^b)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
export function inspectScreenshotPNG(bytes,device){
 if(!Buffer.isBuffer(bytes)||bytes.length>MAX_PNG||bytes.length<45||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('Invalid or truncated screenshot PNG');
 let offset=8,count=0,header=null,ended=false,dataEnded=false,idatBytes=0,palette=false;const idat=[];
 while(offset<bytes.length){
  if(++count>4096||offset+12>bytes.length)throw Error('Invalid PNG chunk boundary');
  const length=bytes.readUInt32BE(offset),end=offset+12+length;
  if(end>bytes.length)throw Error('Truncated PNG chunk');
  const type=bytes.toString('latin1',offset+4,offset+8),data=bytes.subarray(offset+8,offset+8+length);
  if(!/^[A-Za-z]{4}$/.test(type)||!/[A-Z]/.test(type[2]))throw Error('Invalid PNG chunk type');
  if(crc32(bytes.subarray(offset+4,offset+8+length))!==bytes.readUInt32BE(offset+8+length))throw Error('PNG chunk CRC mismatch');
  if(!header&&type!=='IHDR')throw Error('PNG IHDR must be first');
  if(type==='IHDR'){
   if(header||count!==1||length!==13)throw Error('Invalid PNG IHDR');
   const width=data.readUInt32BE(0),height=data.readUInt32BE(4),depth=data[8],colorType=data[9];
   if(width!==device.width||height!==device.height)throw Error('Wrong actual device resolution: '+width+'x'+height);
   if(![0,2].includes(colorType))throw Error('PNG alpha/indexed channel requires separately reviewed Apple-ready export; original retained');
   if(depth!==8||data[10]!==0||data[11]!==0||data[12]!==0)throw Error('Unsupported PNG encoding; expected noninterlaced8-bit RGB or grayscale');
   header={width,height,colorType};
  }else if(type==='IDAT'){
   if(dataEnded)throw Error('Nonconsecutive PNG IDAT');idat.push(data);idatBytes+=length;
  }else if(type==='IEND'){
   if(length!==0||!idatBytes||end!==bytes.length)throw Error('Invalid PNG IEND or missing image data');ended=true;
  }else{
   if(idat.length)dataEnded=true;
   if(type==='tRNS')throw Error('PNG transparency is not Apple-ready');
   if(type==='PLTE'){if(palette||idat.length||header.colorType===0||!length||length%3||length>768)throw Error('Invalid PNG palette');palette=true;}
   else if(type[0]===type[0].toUpperCase())throw Error('Unknown critical PNG chunk');
  }
  offset=end;
 }
 if(!header||!ended||!idatBytes)throw Error('PNG needs complete IHDR, IDAT and IEND');
 const stride=header.width*(header.colorType===2?3:1)+1,expected=stride*header.height;
 if(!Number.isSafeInteger(expected)||expected<=0||expected>MAX_RAW)throw Error('PNG decoded image exceeds bound');
 let decoded;try{decoded=inflateSync(Buffer.concat(idat,idatBytes),{maxOutputLength:expected+1,info:true});}catch{throw Error('PNG image data is corrupt or exceeds decoded bound');}
 if(decoded.buffer.length!==expected||decoded.engine.bytesWritten!==idatBytes)throw Error('PNG decoded scanline length or compressed stream boundary mismatch');
 for(let y=0;y<header.height;y++)if(decoded.buffer[y*stride]>4)throw Error('Invalid PNG scanline filter');
 return {...header,decoded_bytes:expected,chunk_count:count};
}
function boundedPNG(file){const fd=openSync(file,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);try{const st=fstatSync(fd);if(!st.isFile()||st.size>MAX_PNG)throw Error('Screenshot is not a bounded regular file');const buffer=Buffer.alloc(MAX_PNG+1);let n=0;while(n<buffer.length){const read=readSync(fd,buffer,n,buffer.length-n,null);if(!read)break;n+=read;}if(n>MAX_PNG)throw Error('Screenshot exceeds bound');return buffer.subarray(0,n);}finally{closeSync(fd);}}
export function verifyScreenshotArtifacts(dir,device){
 const expected=['01-welcome','02-home','03-map','04-map-expanded','05-buygreek'],found=new Map();let entries=0;
 function walk(at,depth=0){if(depth>12)throw Error('Artifact directory depth exceeded');for(const name of readdirSync(at)){if(++entries>10000)throw Error('Artifact count exceeded');const file=path.join(at,name),s=lstatSync(file);if(s.isSymbolicLink())throw Error('Artifact symlink refused');if(s.isDirectory())walk(file,depth+1);else if(s.isFile()&&name.endsWith('.png')){const key=path.basename(name,'.png');if(!expected.includes(key))continue;if(found.has(key))throw Error('Duplicate screenshot '+key);if(s.size>MAX_PNG)throw Error('Screenshot exceeds bound');const bytes=boundedPNG(file),image=inspectScreenshotPNG(bytes,device);found.set(key,{file:path.relative(dir,file),...image,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}}}
 walk(dir);for(const key of expected)if(!found.has(key))throw Error('Missing actual screenshot '+key);return Object.fromEntries(found);
}
function main(){
 const manifest=JSON.parse(readFileSync(new URL('./restoration-source.json',import.meta.url),'utf8'));
 const device=manifest.devices[process.env.CAPTURE_DEVICE];if(!device)throw Error('Exact capture device required');
 const dir=process.argv[2];if(!dir)throw Error('Actual Maestro artifact directory required');
 const images=verifyScreenshotArtifacts(dir,device),out=path.resolve(process.env.CAPTURE_EVIDENCE_DIR||'restoration-evidence');mkdirSync(out,{recursive:true});
 writeFileSync(path.join(out,'screenshots.json'),JSON.stringify({device:device.name,build_id:process.env.CAPTURE_BUILD_ID,expected_source_commit:process.env.EXPECTED_CAPTURE_COMMIT,images,originals_unchanged:true,visual_review_required:true,apple_upload_performed:false},null,2)+'\n');console.log('Validated five complete '+device.name+' PNG files, scanlines, dimensions and digests; pixel review remains required');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main();

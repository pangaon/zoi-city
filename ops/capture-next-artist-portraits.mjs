// Bounded public-source image evidence only; no data writes or image alterations.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createSourceSession} from '../scripts/quality/source-fetch.mjs';
import {rasterHeader} from '../scripts/enrichment/source-html.mjs';
import {sha256} from '../scripts/quality/evidence.mjs';
import {chromium} from 'playwright-core';
const directory='docs/audits/evidence/artist-next-batch-2026-10-02';
const source=JSON.parse(await readFile(directory+'/source-batch-report.json','utf8'));
const retry=process.argv.includes('--remaining');
const prior=retry?JSON.parse(await readFile(directory+'/portrait-batch-report.json','utf8')):null;
const targets=retry?source.records.filter(a=>prior.records.some(p=>p.listing_id===a.listing_id&&p.reason==='source_byte_budget')):source.records;
await mkdir(directory+'/portraits',{recursive:true});
const session=createSourceSession({maxRequests:22,maxBytes:9000000,deadline:Date.now()+140000});
const browser=await chromium.launch({headless:true,executablePath:'/home/codespace/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',args:['--no-sandbox']});
const context=await browser.newContext();await context.route('**/*',route=>route.abort());
const page=await context.newPage(),results=[];
try{
 for(const artist of targets){
  const url=artist.primary_artist_photo_candidates[0];
  const evidence={listing_id:artist.listing_id,name:artist.name,checked_at:new Date().toISOString(),requested_url:url||null,source_sha256:artist.source_sha256,scope:'original_source_image_bytes_only_not_visual_acceptance',visual_inspection:'pending'};
  if(!url){evidence.accepted_raster=false;evidence.reason='No artist portrait in substantive primary photo block';results.push(evidence);continue;}
  try{
   const response=await session.sourceFetch(url),mime=String(response.headers['content-type']||'').split(';')[0],dimensions=rasterHeader(response.body,mime);
   if(response.status!==200||!dimensions)throw Error('source_raster_unavailable');
   const decoded=await page.evaluate(async({mime,data})=>{const img=new Image();img.src='data:'+mime+';base64,'+data;await img.decode();return{width:img.naturalWidth,height:img.naturalHeight};},{mime,data:response.body.toString('base64')});
   if(decoded.width!==dimensions.width||decoded.height!==dimensions.height)throw Error('source_raster_dimensions_mismatch');
   const artifact=directory+'/portraits/'+artist.listing_id+(mime==='image/png'?'.png':'.jpg');await writeFile(artifact,response.body);
   Object.assign(evidence,{accepted_raster:true,http_status:response.status,url:response.url,mime,bytes:response.bytes,sha256:sha256(response.body),dimensions,actual_browser_decode:decoded,artifact});
  }catch(error){evidence.accepted_raster=false;evidence.reason=error.message;}
  results.push(evidence);console.log(JSON.stringify({name:evidence.name,raster:evidence.accepted_raster,dimensions:evidence.dimensions,reason:evidence.reason}));
 }
}finally{await browser.close();}
await writeFile(directory+(retry?'/portrait-remaining-report.json':'/portrait-batch-report.json'),JSON.stringify({schema:1,production_writes:0,requests:session.stats,records:results},null,2)+'\n');

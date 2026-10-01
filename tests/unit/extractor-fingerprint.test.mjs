import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

test('capture fingerprint changes when an injected image helper changes, even with the same worker body',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'zoi-extractor-hash-'));
 try{
  const paths=['scripts/enrichment/extractor.mjs',...['index.ts','_menus.js','_images.js','_image-context.js','_social.js','_media.js','_hospitality.js'].map(x=>'supabase/functions/zoi-enrich/'+x)];
  for(const file of paths){await mkdir(path.dirname(path.join(root,file)),{recursive:true});await writeFile(path.join(root,file),await readFile(new URL('../../'+file,import.meta.url)));}
  await writeFile(path.join(root,'package.json'),' {"type":"module"}');
  const entry=pathToFileURL(path.join(root,paths[0])).href;
  const first=await import(entry+'?before');
  const helper=path.join(root,'supabase/functions/zoi-enrich/_image-context.js');
  await writeFile(helper,(await readFile(helper,'utf8'))+'\n// Reviewed helper revision.\n');
  const second=await import(entry+'?after');
  assert.match(first.extractorHash,/^[a-f0-9]{64}$/);
  assert.notEqual(first.extractorHash,second.extractorHash);
  // Non-behavioral code change still needs a distinct provenance fingerprint.
  const html='<title>Actual venue</title><img src="https://venue.example/room.jpg" width="1000" height="700">';
  assert.deepEqual(first.extractRenderedSource(html,'https://venue.example/'),second.extractRenderedSource(html,'https://venue.example/'));
 }finally{await rm(root,{recursive:true,force:true});}
});

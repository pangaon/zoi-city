import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {auditCoordinateSources} from '../../scripts/geography/source-coordinate-audit.mjs';
import {sha256} from '../../scripts/quality/evidence.mjs';
const row={id:'source-place',name:'Actual Place',website:'https://official.example.org/',address:'10 Main Street',city:'Melbourne',country:'Australia',public_eligible:true,source_kind:'official_website',source_fingerprint:'source1',owner_hash:'owner1',database_snapshot:'current-row-hash'};
const text='<html><p>Official source without structured coordinates</p></html>';
test('review evidence retains exact extractor text and bounded snapshot, and identical reruns are immutable',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'coordinate-retention-'));
 try{const options={directory,sourceFetch:async()=>({url:row.website,status:200,text})};
  const result=await auditCoordinateSources([{...row,private_notes:'must not be copied'}],options);
  const entry=JSON.parse(await readFile(path.join(directory,result.reports[0].evidence_file),'utf8'));
  for(const reference of [entry.report,entry.source,entry.snapshot]){const body=await readFile(path.join(directory,reference.file),'utf8');assert.equal(sha256(body),reference.sha256);}
  assert.equal(await readFile(path.join(directory,entry.source.file),'utf8'),text);
  const snapshot=JSON.parse(await readFile(path.join(directory,entry.snapshot.file),'utf8'));
  assert(!Object.hasOwn(snapshot,'private_notes'));assert.equal(snapshot.database_snapshot,row.database_snapshot);assert.equal(entry.ownership_gate,false);
  const again=await auditCoordinateSources([row],options);assert.equal(again.reports[0].evidence_file,result.reports[0].evidence_file);assert.equal(result.coordinate_writes,0);
  await writeFile(path.join(directory,entry.source.file),'corrupted retained source');
  await assert.rejects(auditCoordinateSources([row],options),/EEXIST/);
 }finally{await rm(directory,{recursive:true,force:true});}
});
test('owner-managed records retain a refusal snapshot without fetching source',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'coordinate-refusal-'));
 try{const result=await auditCoordinateSources([{...row,owner_managed:true}],{directory,sourceFetch:()=>assert.fail('must not fetch owner source')});const evidence=JSON.parse(await readFile(path.join(directory,result.reports[0].evidence_file),'utf8'));assert.equal(evidence.source,null);assert.equal(result.reports[0].reason,'owner_managed');}finally{await rm(directory,{recursive:true,force:true});}
});

test('workspace ownership refusal is retained without exposing owner identifiers',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'coordinate-owner-refusal-'));
 try{const result=await auditCoordinateSources([{...row,owner_workspace_id:'private-workspace'}],{directory,sourceFetch:()=>assert.fail('must not fetch owner source')});const evidence=JSON.parse(await readFile(path.join(directory,result.reports[0].evidence_file),'utf8'));const snapshot=JSON.parse(await readFile(path.join(directory,evidence.snapshot.file),'utf8'));assert.equal(evidence.ownership_gate,true);assert.equal(evidence.source,null);assert.equal(result.reports[0].reason,'owner_managed');assert(!Object.hasOwn(snapshot,'owner_workspace_id'));}finally{await rm(directory,{recursive:true,force:true});}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const script=fileURLToPath(new URL('../../scripts/vercel-ignore.mjs',import.meta.url));
function scenario(files,base){
 const dir=mkdtempSync(join(tmpdir(),'zoi-build-gate-'));
 const git=(...args)=>execFileSync('git',args,{cwd:dir,stdio:'ignore'});
 try {
  git('init','-q');git('config','user.email','test@example.invalid');git('config','user.name','Test');
  writeFileSync(join(dir,'index.html'),'initial');git('add','.');git('commit','-qm','initial');
  for(const file of files){mkdirSync(join(dir,file,'..'),{recursive:true});writeFileSync(join(dir,file),'changed');}
  git('add','.');git('commit','-qm','change');
  return spawnSync(process.execPath,[script],{cwd:dir,env:{...process.env,VERCEL_GIT_PREVIOUS_SHA:base||'HEAD^'}}).status;
 }finally{rmSync(dir,{recursive:true,force:true});}
}
test('operational, backend and mobile changes do not build web',()=>assert.equal(scenario(['ops/request.json','mobile/App.tsx','supabase/functions/example/index.ts','docs/status.json']),0));
test('web changes build even alongside operational changes',()=>assert.equal(scenario(['ops/request.json','api/entity.js']),1));
test('unknown previous deployment builds conservatively',()=>assert.equal(scenario(['docs/status.json'],'missing-sha'),1));

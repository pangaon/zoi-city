import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, symlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const script=fileURLToPath(new URL('../../scripts/vercel-ignore.mjs',import.meta.url));
function scenario(files,base,initial={}){
 const dir=mkdtempSync(join(tmpdir(),'zoi-build-gate-'));
 const git=(...args)=>execFileSync('git',args,{cwd:dir,stdio:'ignore'});
 try {
  git('init','-q');git('config','user.email','test@example.invalid');git('config','user.name','Test');
  writeFileSync(join(dir,'index.html'),'initial');
  for(const[file,value]of Object.entries(initial)){mkdirSync(join(dir,file,'..'),{recursive:true});if(value?.symlink)symlinkSync(value.symlink,join(dir,file));else writeFileSync(join(dir,file),value);}
  git('add','.');git('commit','-qm','initial');
  for(const file of files){const name=typeof file==='string'?file:file.path;mkdirSync(join(dir,name,'..'),{recursive:true});if(typeof file==='object'&&file.remove)rmSync(join(dir,name));else if(typeof file==='object'&&file.symlink){rmSync(join(dir,name),{force:true});symlinkSync(file.symlink,join(dir,name));}else writeFileSync(join(dir,name),'changed');}
  git('add','.');git('commit','-qm','change');
  return spawnSync(process.execPath,[script],{cwd:dir,env:{...process.env,VERCEL_GIT_PREVIOUS_SHA:base||'HEAD^'}}).status;
 }finally{rmSync(dir,{recursive:true,force:true});}
}
test('operational, backend and mobile changes do not build web',()=>assert.equal(scenario(['ops/request.json','mobile/App.tsx','supabase/functions/example/index.ts','docs/status.json']),0));
test('web changes build even alongside operational changes',()=>assert.equal(scenario(['ops/request.json','api/entity.js']),1));
test('unknown previous deployment builds conservatively',()=>assert.equal(scenario(['docs/status.json'],'missing-sha'),1));

test('actual shared-helper direct and transitive changes build, while unrelated worker code still skips',()=>{
 const initial={'api/entity.js':"import '../assets/public.mjs';",'assets/public.mjs':"export {phone} from '../supabase/functions/shared/_contact.js';",'supabase/functions/shared/_contact.js':"export {phone} from './nested/_phone.js';",'supabase/functions/shared/nested/_phone.js':'export const phone=1;','supabase/functions/worker/index.ts':'export const worker=1;'};
 assert.equal(scenario(['supabase/functions/shared/nested/_phone.js'],null,initial),1);
 assert.equal(scenario(['supabase/functions/worker/index.ts'],null,initial),0);
});

test('query-versioned absolute dynamic imports and extensionless helpers remain dependencies',()=>{
 assert.equal(scenario(['supabase/functions/shared/_phone.js'],null,{'assets/app.mjs':"import('/supabase/functions/shared/_phone.js?v=2');",'supabase/functions/shared/_phone.js':'export{};'}),1);
 assert.equal(scenario(['supabase/functions/shared/_phone.js'],null,{'api/entity.js':"const m=require('../supabase/functions/shared/_phone');",'supabase/functions/shared/_phone.js':'export{};'}),1);
});

test('deleted or renamed shared helper cannot hide behind a missing HEAD file',()=>{
 const initial={'api/entity.js':"import '../supabase/functions/shared/_phone.js';",'supabase/functions/shared/_phone.js':'export{};'};
 assert.equal(scenario([{path:'supabase/functions/shared/_phone.js',remove:true}],null,initial),1);
 assert.equal(scenario([{path:'supabase/functions/shared/_phone.js',remove:true},'supabase/functions/shared/new-name.js'],null,initial),1);
});

test('NUL path framing handles spaces/newlines; uncertain source symlink builds without following it',()=>{
 assert.equal(scenario(['docs/status\nother.json']),0);
 assert.equal(scenario(['supabase/functions/shared/my helper.js'],null,{'assets/app.mjs':"import '../supabase/functions/shared/my helper.js';",'supabase/functions/shared/my helper.js':'export{};'}),1);
 assert.equal(scenario(['supabase/functions/worker/index.ts'],null,{'assets/app.mjs':{symlink:'/not-a-file'}}),1);
});

test('CI tools and research skip web; changing the deployed gate itself still builds',()=>{
 assert.equal(scenario(['scripts/analysis.mjs','research/notes.json']),0);
 assert.equal(scenario(['scripts/vercel-ignore.mjs']),1);
});

function ignoredPaths(filename,paths){
 const dir=mkdtempSync(join(tmpdir(),'zoi-ignore-contract-'));
 try{
  execFileSync('git',['init','-q'],{cwd:dir});
  writeFileSync(join(dir,'.gitignore'),readFileSync(new URL('../../'+filename,import.meta.url)));
  return paths.filter(path=>spawnSync('git',['check-ignore','--no-index','--',path],{cwd:dir}).status===0);
 }finally{rmSync(dir,{recursive:true,force:true});}
}

test('deployment exclusion keeps runtime entrypoints/shared helpers but removes private/review/build material',()=>{
 const excluded=['docs/audits/evidence/private.json','tests/unit/x.mjs','ops/request.json','research/capture.html','mobile/App.tsx','.github/workflows/ci.yml','.recovery/a','nested/.recovery/a','.cache/a','artifacts/export.png','pillow.whl','scripts/release-backend.mjs','supabase/migrations/20260101000000_x.sql','supabase/functions/worker/index.ts'];
 assert.deepEqual(ignoredPaths('.vercelignore',excluded),excluded);
 const kept=['index.html','api/entity.js','api/audit-evidence.js','assets/zoi-core.js','explore/map/index.html','scripts/vercel-ignore.mjs','supabase/functions/zoi-enrich/_phone.js','supabase/functions/zoi-enrich/_social.js','supabase/functions/zoi-enrich/_media.js','supabase/functions/zoi-enrich/_image-context.js'];
 assert.deepEqual(ignoredPaths('.vercelignore',kept),[]);
});

test('local housekeeping ignores downloads/caches/secrets without hiding evidence, requests or source',()=>{
 const excluded=['node_modules/a','mobile/node_modules/a','.recovery/a','nested/.recovery/a','mobile/.expo/a','.cache/a','.vercel/a','x/__pycache__/a.pyc','dist/a','artifacts/a','pillow.whl','preview.apk','.env','.env.production'];
 assert.deepEqual(ignoredPaths('.gitignore',excluded),excluded);
 assert.deepEqual(ignoredPaths('.gitignore',['docs/audits/evidence/proof.log','ops/request.json','.env.example','.env.sample','mobile/scripts/patch-native-text-font-cache.cjs','supabase/functions/zoi-enrich/_phone.js']),[]);
});

test('audit route remains an uncached no-index denial, not a public archive reader',async()=>{
 const {default:handler}=await import('../../api/audit-evidence.js');const headers={};let status,body;
 handler({url:'/docs/audits/proof.json'},{setHeader:(k,v)=>headers[k]=v,status:n=>{status=n;return{json:v=>body=v};}});
 assert.equal(status,404);assert.deepEqual(body,{error:'Not found'});assert.equal(headers['Cache-Control'],'no-store');assert.equal(headers['X-Robots-Tag'],'noindex, nofollow');
 const config=JSON.parse(readFileSync(new URL('../../vercel.json',import.meta.url)));
 assert.ok(config.rewrites.some(r=>r.source==='/docs/audits/:path*'&&r.destination==='/api/audit-evidence'));
});

test('all actual public shared-helper dependencies remain included by deployment exclusions',async()=>{
 const {webDependencies}=await import('../../scripts/vercel-ignore.mjs');
 const root=fileURLToPath(new URL('../../',import.meta.url));
 const paths=[...webDependencies(root)].filter(path=>path.startsWith('supabase/')&&existsSync(join(root,path)));
 for(const file of ['_phone.js','_social.js','_media.js','_image-context.js'])assert.ok(paths.some(path=>path.endsWith('/'+file)),file);
 assert.deepEqual(ignoredPaths('.vercelignore',paths),[]);
});

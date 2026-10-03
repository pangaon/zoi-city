#!/usr/bin/env node
import{readFile,writeFile,mkdir,readdir,stat}from'node:fs/promises';
import{resolve,dirname,join,relative}from'node:path';
import{createHash}from'node:crypto';
import{credentialFindings}from'./check-source-credentials.mjs';
const root=resolve(process.argv[2]||'.'),folder='docs/audits/evidence/official-source-consumer-2026-10-03';
const runtime=['assets/enrichment/official-source-policy.mjs','api/entity.js','api/home-preview.js','assets/homes/official-url.mjs','assets/homes/person-data.mjs','assets/discovery/profile-preview.mjs','mobile/src/profile.ts'];
const starts=[...runtime,'tests/unit/official-source-policy.test.mjs','tests/unit/entity-request.test.mjs','mobile/tests/officialSourcePolicy.test.mjs','mobile/tests/profile.test.mjs','tests/browser/discovery-public-media/official-source-policy.cjs','explore/index.html','scripts/check-source-credentials.mjs','scripts/official-source-consumer-freeze.mjs','scripts/run-tests.mjs','scripts/check-inline-js.mjs','scripts/lint-html.mjs','package.json','package-lock.json','mobile/package.json','docs/audits/official-source-consumer-2026-10-03.md','docs/audits/evidence/source-conflict-host-review-2026-10-03/quarantine-targets.json','docs/audits/evidence/source-conflict-host-review-2026-10-03/full-listing-preflight.json'];
const seen=new Set(),entries=[],sha=b=>createHash('sha256').update(b).digest('hex');
async function exists(p){try{return(await stat(resolve(root,p))).isFile();}catch{return false;}}
async function add(path,scan=true){
 if(seen.has(path))return;seen.add(path);
 const bytes=await readFile(resolve(root,path)),text=bytes.toString('utf8');
 const textual=/\.(?:mjs|js|cjs|ts|json|md|html|css|log|svg)$/.test(path);
 if(textual&&credentialFindings(text).length)throw Error('credential_before_freeze:'+path);
 const snapshot=folder+'/snapshot/'+path;
 await mkdir(dirname(resolve(root,snapshot)),{recursive:true});await writeFile(resolve(root,snapshot),bytes);
 entries.push({path,snapshot,sha256:sha(bytes),bytes:bytes.length});
 if(!scan||!textual)return;
 const refs=[];
 for(const m of text.matchAll(/(?:from\s*|import\s*\(|require\s*\()(['"])([^'"]+)\1/g))refs.push(m[2]);
 for(const m of text.matchAll(/(['"])(\/assets\/[^'"\s<>]+)\1/g))refs.push(m[2]);
 for(const m of text.matchAll(/url\(\s*['"]?([^'"\s)]+)['"]?\s*\)/g))refs.push(m[1]);
 for(let ref of refs){ref=ref.split(/[?#]/)[0];if(!ref||ref.includes('${')||/^https?:|^data:/.test(ref))continue;
  const dest=ref.startsWith('/assets/')?ref.slice(1):ref.startsWith('.')?relative(root,resolve(root,dirname(path),ref)):path.endsWith('.css')?relative(root,resolve(root,dirname(path),ref)):null;
  if(dest&&!dest.startsWith('..')&&await exists(dest))await add(dest);
 }
}
for(const path of starts)if(await exists(path))await add(path);else throw Error('missing_required_dependency:'+path);
async function evidence(dir){for(const item of await readdir(resolve(root,dir),{withFileTypes:true})){if(['snapshot','manifest.json'].includes(item.name))continue;const path=dir+'/'+item.name;if(item.isDirectory())await evidence(path);else await add(path,false);}}
await evidence(folder);
entries.sort((a,b)=>a.path.localeCompare(b.path));
const packet={version:1,created_at:new Date().toISOString(),base_commit:'f55489f834c7c2fe6ae1f0192eea99f519583163',runtime_paths:runtime,no_production_writes:true,no_schema_changes:true,controlled_browser_not_production:true,credential_findings:0,entries};
const bytes=JSON.stringify(packet,null,2)+'\n';await writeFile(resolve(root,folder,'manifest.json'),bytes);console.log(JSON.stringify({entries:entries.length,manifest_sha256:sha(bytes),credential_findings:0}));

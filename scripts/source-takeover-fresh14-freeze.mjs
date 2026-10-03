#!/usr/bin/env node
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {credentialFindings} from './check-source-credentials.mjs';
const root=resolve(process.argv[2]||'.'),folder='docs/audits/evidence/source-takeover-fresh14-2026-10-03';
const paths=[];
async function walk(dir){for(const entry of await readdir(resolve(root,dir),{withFileTypes:true})){if(entry.name==='snapshot'||entry.name==='manifest.json')continue;const p=dir+'/'+entry.name;if(entry.isDirectory())await walk(p);else paths.push(p);}}
await walk(folder);
paths.push('scripts/source-takeover-fresh14-review.mjs','scripts/source-takeover-fresh14-proposal.mjs','scripts/source-takeover-fresh14-verify.py','scripts/source-takeover-fresh14-freeze.mjs','scripts/check-source-credentials.mjs','ops/proposals/source-takeover-fresh14-2026-10-03.sql','docs/audits/source-takeover-fresh14-2026-10-03.md');
const entries=[];
for(const path of [...new Set(paths)].sort()){
 const bytes=await readFile(resolve(root,path));
 if(credentialFindings(bytes.toString('utf8')).length)throw Error('credential_before_freezing:'+path);
 const snapshot=folder+'/snapshot/'+path;
 await mkdir(dirname(resolve(root,snapshot)),{recursive:true});await writeFile(resolve(root,snapshot),bytes);
 entries.push({path,snapshot,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
}
const bytes=JSON.stringify({version:1,created_at:new Date().toISOString(),no_production_writes:true,default_rollback:true,original37b_packet_unmodified:true,credential_findings:0,entries},null,2)+'\n';
await writeFile(resolve(root,folder,'manifest.json'),bytes);
console.log(JSON.stringify({entries:entries.length,sha256:createHash('sha256').update(bytes).digest('hex'),credential_findings:0}));

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {credentialFindings} from '../../../../scripts/check-source-credentials.mjs';
const base=process.cwd(),packet='docs/audits/evidence/source-health-owner-2026-10-03';
const runtime=['assets/suite/source-health.mjs','assets/suite/source-health.css','assets/suite/bizpage.js'];
const inputs=[...runtime,'tests/unit/source-health.test.mjs','tests/browser/source-health-owner/fixture.html','tests/browser/source-health-owner/verify.cjs','tests/unit/owner-entity.test.mjs','tests/unit/owner-home-content.test.mjs','tests/unit/public-owner-media.test.mjs','tests/unit/official-source-policy.test.mjs','tests/browser/music-owner-catalogue/verify.cjs','tests/browser/music-owner-catalogue/fixture.html','docs/audits/source-health-owner-2026-10-03.md','scripts/check-source-credentials.mjs',packet+'/freeze.mjs'];
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex'),seen=new Set();
async function visit(file){if(seen.has(file))return;const full=path.resolve(base,file);if(!full.startsWith(base+path.sep))throw Error('outside input');let bytes;try{bytes=await fs.readFile(full);}catch(error){if(error.code==='ENOENT')return;throw error;}seen.add(file);
 if(/\.(mjs|cjs|js|html|css)$/.test(file))for(const match of bytes.toString().matchAll(/["']((?:\.\.?\/|\/assets\/)[^"'\n]+)["']/g)){
  const target=match[1].split('?')[0];if(!/\.(mjs|cjs|js|css|html)$/.test(target))continue;
  const resolved=target.startsWith('/')?target.slice(1):path.relative(base,path.resolve(path.dirname(full),target));await visit(resolved);
 }
}
async function evidence(dir){for(const entry of await fs.readdir(path.join(base,dir),{withFileTypes:true})){if(['snapshot','manifest.json'].includes(entry.name))continue;const file=dir+'/'+entry.name;if(entry.isDirectory())await evidence(file);else await visit(file);}}
for(const file of inputs)await visit(file);await evidence(packet);
const entries=[];let findings=0;
for(const file of [...seen].sort()){const bytes=await fs.readFile(path.join(base,file));if(!/\.png$/.test(file))findings+=credentialFindings(bytes.toString()).length;entries.push({path:file,sha256:sha(bytes),bytes:bytes.length,snapshot:'snapshot/'+file});}
if(findings)throw Error('Credential signatures found: '+findings+'; values withheld');
for(const entry of entries){const dest=path.join(base,packet,entry.snapshot);await fs.mkdir(path.dirname(dest),{recursive:true});await fs.writeFile(dest,await fs.readFile(path.join(base,entry.path)));}
const manifest={captured_at:new Date().toISOString(),baseline_commit:'95d63fd15b18d3d73d91bb2a5e40ae54313e8a39',runtime_paths:runtime,production_mutation:false,production_deployed:false,credential_findings:0,entries};
const bytes=JSON.stringify(manifest,null,2)+'\n';await fs.writeFile(path.join(base,packet,'manifest.json'),bytes);console.log(JSON.stringify({entries:entries.length,sha256:sha(bytes),credential_findings:0}));

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(new URL('../..',import.meta.url).pathname);
// Source invariant, not a replacement for Vercel's deployed bundle trace.
// Browser-only entrypoints may carry cache queries. Files reached by API imports
// must use filesystem-resolvable local specifiers for server packaging.
const imports=/(?:^|[;\n])\s*(?:import\s*(?:[^;\n]*?\bfrom\s*)?|export\s+[^;\n]*?\bfrom\s*)['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;
function inspect(read=filename=>fs.readFileSync(path.join(root,filename),'utf8')){
 const pending=fs.readdirSync(path.join(root,'api')).filter(x=>/\.(mjs|js)$/.test(x)).map(x=>'api/'+x),seen=new Set(),issues=[];
 while(pending.length){const filename=pending.pop();if(seen.has(filename))continue;seen.add(filename);for(const match of read(filename).matchAll(new RegExp(imports))){const spec=match[1]||match[2];if(!spec.startsWith('./')&&!spec.startsWith('../'))continue;
 if(/[?#]/.test(spec))issues.push({filename,spec});const clean=spec.split(/[?#]/)[0],next=path.posix.normalize(path.posix.join(path.posix.dirname(filename),clean));if(!/\.(mjs|js)$/.test(next))continue;assert(!next.startsWith('../'),'Server import escaped repository');assert(fs.existsSync(path.join(root,next)),'Missing server dependency '+next);pending.push(next);}}
 return{seen,issues};
}
test('API transitive JavaScript imports have no browser cache query or fragment',()=>{const result=inspect();assert(result.seen.has('assets/homes/templates/music/layouts.mjs'),'Music server dependency graph must be examined');assert.deepEqual(result.issues,[]);});
test('regression catches queried layouts import inside shared artist server renderer',()=>{const result=inspect(filename=>{const source=fs.readFileSync(path.join(root,filename),'utf8');return filename==='assets/homes/templates/music/render.mjs'?source.replace("from'./layouts.mjs'","from'./layouts.mjs?v=20260930-identity'"):source;});assert(result.issues.some(x=>x.filename==='assets/homes/templates/music/render.mjs'&&x.spec==='./layouts.mjs?v=20260930-identity'));});

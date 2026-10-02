import test from 'node:test';import assert from 'node:assert/strict';import{readdirSync,readFileSync,statSync}from'node:fs';import{join,dirname,resolve}from'node:path';import{fileURLToPath}from'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
// Source captures retain the publisher's HTML and paths; they are audit evidence,
// not application pages whose assets belong to this deployment.
const sourceEvidence=join(root,'docs','audits','evidence');
function pages(dir){if(resolve(dir)===resolve(sourceEvidence))return[];return readdirSync(dir,{withFileTypes:true}).flatMap(e=>{if(['node_modules','.git','mobile'].includes(e.name)||e.name.startsWith('.'))return[];const p=join(dir,e.name);return e.isDirectory()?pages(p):e.name.endsWith('.html')?[p]:[];});}
test('every local stylesheet and script referenced by a web page exists in the deployed source',()=>{
 const missing=[];for(const page of pages(root))for(const tag of readFileSync(page,'utf8').matchAll(/<(script|link)\b[^>]*>/gi)){
  if(tag[1].toLowerCase()==='link'&&!/\brel=["']stylesheet["']/i.test(tag[0]))continue;
  const ref=/\b(?:src|href)=["']([^"']+)["']/i.exec(tag[0])?.[1];if(!ref||/^(?:[a-z]+:|\/\/)/i.test(ref))continue;
  const path=decodeURIComponent(ref.split(/[?#]/)[0]);if(!path)continue;const local=resolve(path.startsWith('/')?root:dirname(page),path.replace(/^\//,''));
  try{if(!statSync(local).isFile())throw Error();}catch{missing.push(page.slice(root.length)+' → '+ref);}
 }assert.deepEqual(missing,[],'Missing deployed assets:\n'+missing.join('\n'));
});

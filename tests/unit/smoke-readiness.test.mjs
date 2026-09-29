import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

async function run(html, redirect = false) {
  const login = createServer((req,res)=>{res.setHeader('content-type','text/html');res.end(html)});
  const site = createServer((req,res)=>{
    if(redirect) {res.writeHead(302,{location:`http://127.0.0.1:${login.address().port}/login`});res.end();}
    else {res.setHeader('content-type','text/html');res.end(html);}
  });
  login.listen(0,'127.0.0.1');await once(login,'listening');
  site.listen(0,'127.0.0.1');await once(site,'listening');
  try {
    const child=spawn(process.execPath,['scripts/smoke-live.mjs'],{env:{...process.env,SITE:`http://127.0.0.1:${site.address().port}`}});
    let output='';child.stdout.on('data',data=>output+=data);child.stderr.on('data',data=>output+=data);
    const [code]=await once(child,'close');return {code,output};
  } finally {site.closeAllConnections();login.closeAllConnections();site.close();login.close();}
}
const shell='<html><head><title>Zoi</title><meta name="viewport" content="width=device-width"><link href="/assets/zoi-theme.css" rel="stylesheet"></head><body>Zoi</body></html>';
test('readiness rejects generic login HTML',async()=>{const r=await run(shell.replace('/assets/zoi-theme.css','/login.css'));assert.equal(r.code,1);assert.match(r.output,/missing Zoi application shell/)});
test('readiness rejects cross-origin redirects even if shell matches',async()=>{const r=await run(shell,true);assert.equal(r.code,1);assert.match(r.output,/redirected outside/)});
test('readiness accepts same-origin Zoi shell',async()=>{const r=await run(shell);assert.equal(r.code,0);assert.match(r.output,/8\/8/)});

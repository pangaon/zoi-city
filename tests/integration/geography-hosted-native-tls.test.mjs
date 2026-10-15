import test from 'node:test';import assert from 'node:assert/strict';import https from 'node:https';import{mkdtemp,readFile,writeFile,rm}from'node:fs/promises';import{tmpdir}from'node:os';import{join,resolve}from'node:path';import{execFile}from'node:child_process';import{promisify}from'node:util';
const run=promisify(execFile);
const deno=(args,options,install=false)=>run(process.env.ZOI_DENO_BIN||'npx',process.env.ZOI_DENO_BIN?args:[...(install?['--yes']:['--offline','--yes']),'deno@2.9.6',...args],options);
// Installing the runtime may need registry/download time on a fresh runner.
// Keep that separate from the strict deadline for the actual socket/TLS probe.
test.before(async()=>{
 const version=await deno(['--version'],{timeout:60000,maxBuffer:10000},true);
 assert.match(version.stdout,/^deno 2\.9\.6\b/);
});
test('actual native TCP→TLS verifies hostname/SNI and rejects wrong certificate; local fixture only',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'zoi-native-tls-fixture-'));let server;try{
  await run('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',join(dir,'key.pem'),'-out',join(dir,'cert.pem'),'-days','1','-subj','/CN=fixture.example.org','-addext','subjectAltName=DNS:fixture.example.org','-addext','basicConstraints=critical,CA:FALSE'],{maxBuffer:10000});
  const cert=await readFile(join(dir,'cert.pem'),'utf8'),key=await readFile(join(dir,'key.pem'),'utf8');let sni;
  server=https.createServer({cert,key},(req,res)=>{sni=req.socket.servername;assert.equal(req.headers.host,'fixture.example.org');res.setHeader('Content-Length','15');res.end('actual TLS body');});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
  // Fixture substitutes ONLY the TCP destination/CA for loopback. Production
  // uses validated public IPv4, fixed443, normal trust roots, no override options.
  const script=`import{requestPinnedTLSPage}from ${JSON.stringify(new URL('../../scripts/geography/hosted-pinned-source-request.mjs',import.meta.url).href)};import{sourceURL}from ${JSON.stringify(new URL('../../scripts/quality/source-fetch.mjs',import.meta.url).href)};
const ca=await Deno.readTextFile(${JSON.stringify(join(dir,'cert.pem'))});let sockets=0,closed=0;
const runtime={async connect(options){if(options.hostname!=='127.0.0.1'||options.port!==443)throw Error('fixture_pin_missing');const c=await Deno.connect({hostname:'127.0.0.1',port:${port}});sockets++;return new Proxy(c,{get(target,key){if(key==='remoteAddr')return{hostname:'127.0.0.1',port:443};if(key==='close')return()=>{closed++;try{target.close()}catch{}};const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value}});},async startTls(c,options){if(options.alpnProtocols[0]!=='http/1.1'||'unsafelyDisableHostnameVerification'in options)throw Error('fixture_tls_contract_missing');return Deno.startTls(c,{...options,caCerts:[ca]});}};
const deps={sourceURL,publicIPv4:ip=>ip==='127.0.0.1',resolveIPv4:async()=>['127.0.0.1'],runtime};const r=await requestPinnedTLSPage('https://fixture.example.org/proof',{},deps);let mismatch=false;try{await requestPinnedTLSPage('https://wrong.example.org/proof',{},deps)}catch{mismatch=true}if(!mismatch)throw Error('certificate_hostname_not_verified');console.log(JSON.stringify({text:r.text,status:r.status,mismatch,sockets,closed}));`;
  await writeFile(join(dir,'probe.mjs'),script,{mode:0o600});const out=await deno(['run','--allow-net=127.0.0.1','--allow-read='+dir+','+resolve('.'),join(dir,'probe.mjs')],{cwd:resolve('.'),timeout:20000,maxBuffer:10000});const result=JSON.parse(out.stdout.trim());assert.equal(result.text,'actual TLS body');assert.equal(result.status,200);assert.equal(result.mismatch,true);assert.equal(result.sockets,2);assert.ok(result.closed>=2);assert.equal(sni,'fixture.example.org');
 }finally{if(server)await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});}
});

import test from 'node:test';import assert from 'node:assert/strict';
import{SITE_IDENTITY,identityAssets,identityHead,isZoiHomeLink,applySiteIdentity}from'../../assets/brand/site-identity.mjs';
const config={approved:true,source:'/assets/brand/approved.png',sha256:'a'.repeat(64),kind:'wordmark',favicon:'/assets/brand/favicon.png'};
const anchor=(text,href='/',label='')=>({textContent:text,getAttribute:k=>k==='href'?href:k==='aria-label'?label:null});
test('only explicit source-bound approval enables identity assets; unsafe paths rejected',()=>{
 assert.equal(identityAssets({...config,approved:false}),null);assert.equal(identityAssets({...config,sha256:''}),null);
 for(const source of ['https://external.example/logo.png','/assets/../secret.png','/assets/brand/x.png?token=private','javascript:alert(1)','/assets/x.png" onerror="x'])assert.equal(identityAssets({...config,source}),null);
 assert.equal(identityAssets(config).source,config.source);assert.match(identityHead(config),/rel="icon"/);
});
test('root-bound Zoi links qualify; client logos, workspace links and external same-name links remain untouched',()=>{
 for(const text of ['Ζ Zoi','Z Zoi','Zoi','zoi GREEK LIFE, EVERYWHERE.','zoiGREEK LIFE, EVERYWHERE.'])assert.equal(isZoiHomeLink(anchor(text),'https://www.zoi.city'),true);
 for(const item of [anchor('Yamas'),anchor('Zoi','/business/zoi'),anchor('Zoi','https://evil.example/'),anchor('Zoi','/?campaign=x')])assert.equal(isZoiHomeLink(item,'https://www.zoi.city'),false);
});
test('unapproved or failed image never removes working fallback or installs a broken favicon',async()=>{
 let calls=0;const document={head:{appendChild(){calls++}},querySelectorAll(){calls++;return[]}};
 assert.deepEqual(await applySiteIdentity({document,config:{...config,approved:false},load:async()=>{calls++}}),{applied:0,configured:false});assert.equal(calls,0);
 assert.deepEqual(await applySiteIdentity({document,config,load:async()=>{throw Error('image unavailable')}}),{applied:0,configured:true,imageFailed:true});assert.equal(calls,0);
});
test('approved source updates only Zoi navigation, preserves client artwork and applies once',async()=>{
 const home={...anchor('Ζ Zoi'),dataset:{},style:{},replaceChildren(...n){this.children=n},setAttribute(){}};
 const business={...anchor('Yamas'),dataset:{},replaceChildren(){throw Error('client logo replaced')}};
 const head=[];const document={head:{appendChild:n=>head.push(n)},querySelectorAll:s=>s==='a[href]'?[home,business]:[],createElement:tag=>({tag,style:{}})};
 const first=await applySiteIdentity({document,origin:'https://www.zoi.city',config,load:async()=>{}});
 assert.equal(first.applied,1);assert.equal(home.children[0].src,config.source);assert.equal(home.children[0].alt,'Zoi');assert.equal(head[0].href,config.favicon);
 assert.equal((await applySiteIdentity({document,origin:'https://www.zoi.city',config,load:async()=>{}})).applied,0);
});
test('server identity renders first paint while preserving script bytes and customer logos',async()=>{
 const{identityHtml}=await import('../../assets/brand/site-identity.mjs');const script='<script>const example=\'<a href="/">Zoi</a>\';</script>';
 const source='<header><a class="zoi-brand" href="/">Ζ<b>Zoi</b></a><a href="/">Yamas<img src="/client.png"></a></header>'+script;
 const result=identityHtml(source,config);assert.match(result,/data-zoi-identity/);assert.ok(result.includes(script));assert.ok(result.includes('Yamas<img src="/client.png">'));assert.equal(identityHtml(result,config),result);
});

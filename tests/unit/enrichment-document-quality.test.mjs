import {test} from 'node:test';import assert from 'node:assert/strict';
import {inspectSourceDocument,sourceRepairIssue} from '../../supabase/functions/zoi-enrich/_document-quality.js';
const shell='<html><head><meta name="description" content="Authentic dining experience"><script defer src="/static/main.js"></script></head><body><noscript>You need to enable JavaScript to run this app.</noscript><div id="root"></div></body></html>';
test('metadata-only React source is routed to rendered-source repair, not successful empty enrichment',()=>{assert.equal(inspectSourceDocument(shell).requires_rendering,true);assert.equal(sourceRepairIssue(shell).reason,'javascript_render_required');});
test('same gate applies to restaurant, church, school and creator shells',()=>{for(const id of ['root','app','__next','__nuxt'])assert.equal(inspectSourceDocument(shell.replace('id="root"',`id="${id}"`)).requires_rendering,true);});
test('SSR pages with source content and hydration are not shells',()=>{assert.equal(inspectSourceDocument(shell.replace('<div id="root"></div>','<div id="root"><h1>Our community</h1><p>'+('Verified source content. '.repeat(10))+'</p></div>')).requires_rendering,false);});
test('sparse server rendered contact and photo pages retain useful source evidence',()=>{for(const content of ['<a href="tel:+123456789">Call</a>','<img src="/real.jpg">','<video src="/tour.mp4"></video>'])assert.equal(inspectSourceDocument(shell.replace('<div id="root"></div>',content)).requires_rendering,false);});
test('empty static document is not misrepresented as a renderable app',()=>assert.equal(inspectSourceDocument('<html><body></body></html>').requires_rendering,false));
test('Nostos title plus short verification body is challenge evidence, not available business content',()=>{
 const challenge='<html><head><title>One moment, please...</title></head><body><svg><title>Loader</title></svg><p>Please wait while your request is being verified...</p></body></html>';
 assert.equal(inspectSourceDocument(challenge).source_state,'source_challenge');assert.equal(inspectSourceDocument(challenge).requires_rendering,false);assert.equal(sourceRepairIssue(challenge).reason,'source_challenge');
 for(const html of [challenge.replace('One moment, please...','Just a moment…'),challenge.replace('<p>','<script src="/check.js"></script><p>')])assert.equal(inspectSourceDocument(html).source_state,'source_challenge');
});
test('marketing wording or an ordinary business page discussing verification is not a challenge',()=>{
 for(const html of ['<title>One moment, please...</title><body>A moment to savour Greek food with your friends.</body>','<title>Our booking help</title><body>Please wait while your request is being verified...</body>','<title>One Moment Restaurant</title><body>Check your browser for our menu.</body>','<title>One moment, please...</title><body>'+('Our restaurant guide. '.repeat(30))+'Please wait while your request is being verified...</body>']){assert.equal(inspectSourceDocument(html).source_state,'html_available');assert.equal(sourceRepairIssue(html),null);}
});

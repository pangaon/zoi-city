import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { memberLeaseGuard } from './_member.js';
import { inspectSourceDocument } from './_document-quality.js';
import { confirmedEnrichmentReceipts, enrichmentSample } from './_receipts.js';
const website='https://www.hellenicmedical.ca/profile/atzakis/';
const row={slug:'ageliki-tzakis',name:'Ageliki Tzakis',entity_type:'professional',website,lease_id:'fixture-lease',existing_enrich:{member:{name:'Ageliki Tzakis',profession:'Reviewed nursing fact'},photo_url:'reviewed-portrait.jpg'}};
const profile='<h1>Ageliki (Angie) Tzakis, RN</h1><p>Associate</p><p>Profession: Registered Nurse</p>';

test('medical member challenge with embedded valid profile preserves prior facts',()=>{
  for(const marker of ['Verify you are human','Request being verified.','<script src="/cf-chl-platform/challenge.js"></script>']){
    const result=memberLeaseGuard(row,marker+profile);
    assert.equal(result.profile.crawl_status,'error');
    assert.equal(result.profile.last_error,'member_source_challenged');
    assert(!('member' in result.profile));
    assert(!('photo_url' in result.profile));
    assert.equal({...row.existing_enrich,...result.profile}.member.profession,'Reviewed nursing fact');
  }
  assert.equal(memberLeaseGuard(row,profile).profile.crawl_status,'member_identity_matched');
});

test('actual HTTP handler routes embedded medical challenge into durable error apply',async()=>{
  let handler,batch;
  const source=readFileSync(new URL('./index.ts',import.meta.url),'utf8');
  const failGeneric=()=>assert.fail('Challenged member must not run generic extraction');
  const deps={Deno:{serve:fn=>{handler=fn;}},authorised:()=>true,ENABLED:true,BATCH:1,INVOCATION_MS:110000,RPC_MS:15000,TIMEOUT_MS:8000,
    boundedIO:async(_deadline,_maximum,work)=>work(new AbortController().signal),enrichmentSample,memberLeaseGuard,confirmedEnrichmentReceipts,inspectSourceDocument,
    Date,URL,Response,dnsState:()=>true,vet:async value=>({url:new URL(value)}),robotsAllows:async()=>true,
    fetchDoc:async()=>({doc:'Verify you are human'+profile,finalUrl:website}),extract:failGeneric,supplementaryPages:failGeneric,
    sbRpc:async(fn,args)=>{if(fn.endsWith('_lease'))return[row];batch=args.p_batch;return batch.map(item=>({slug:item.slug,applied:true}));}};
  new Function(...Object.keys(deps),stripTypeScriptTypes(source.slice(source.indexOf('Deno.serve('))))(...Object.values(deps));
  const response=await handler(new Request('https://fixture.test/enrich',{method:'POST',body:'{}'}));
  assert.equal(response.status,200);
  assert.equal(batch[0].profile.crawl_status,'error');
  assert.equal(batch[0].profile.last_error,'member_source_challenged');
  assert(!('member' in batch[0].profile));
  const receipt=await response.json();
  assert.equal(receipt.stats['member-review-required'],1);
  assert.equal(receipt.stats['member-identity-matched'],undefined);
});

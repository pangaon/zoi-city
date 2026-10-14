import test from 'node:test';
import assert from 'node:assert/strict';
import { buildClientBrief,briefHomeDesign } from './client-brief.mjs';
import { prepareClientBrief,sourceClientIdentity } from '../../supabase/functions/zoi-enrich/_brief.js';
import { publishedHomeDesign } from '../../api/_home-design.js';
import { renderRestaurantHome } from '../../api/_restaurant-home.js';
import { renderProfessionalHome } from '../../api/_professional-home.js';
import { renderMusicHome } from '../../api/_music-home.js';
const base={listing_id:'10000000-0000-4000-8000-000000000001',slug:'fixture',name:'Fixture Client',entity_type:'business',website:'https://fixture.example/'};
const at='2026-10-14T12:00:00.000Z';
const make=(listing=base,profile={},provenance={},sources=[])=>buildClientBrief({listing,profile,provenance,sourceURL:listing.website,checkedAt:at,sources});
function entity(listing,profile,provenance,verified=true){if(verified){profile={...profile,source_identity:sourceClientIdentity(listing,'<script type="application/ld+json">'+JSON.stringify({'@type':['professional','artist'].includes(listing.entity_type)?'Person':'LocalBusiness',name:listing.name,url:listing.website})+'</script>',listing.website)};provenance={...provenance,source_identity:'exact_name_typed_jsonld'};}return {...listing,id:listing.listing_id,profile:{_enrich:{...profile,provenance,source_url:listing.website,client_brief:make(listing,profile,provenance)}},publish_status:'published',moderation_status:'clean'};}

test('populated restaurant brief keeps sourced offering, exact actions, uncertainty and evidence',()=>{
 const p={menu:[{section:'Dinner',items:[{name:'Grilled octopus',note:'With lemon'}]}],booking_url:'https://provider.example/client',phone:'+14165551234',hero_url:'https://fixture.example/room.jpg',hours:[{day:'mon',open:'09:00',close:'17:00'}]};
 const proof={menu:'jsonld-menu:https://fixture.example/menu',booking_url:'page-link',phone:'tel-link',hero_url:'og',hours:'jsonld'};
 const brief=make(base,p,proof,[{url:base.website,state:'fetched',purpose:'registered_source'},{url:'https://fixture.example/menu',state:'fetched',purpose:'menu'}]);
 assert.equal(brief.offering[0].name,'Grilled octopus');
 assert.equal(brief.offering[0].evidence.source_url,'https://fixture.example/menu');
 assert.equal(brief.primary_actions.find(a=>a.kind==='booking').state,'external_handoff');
 assert.equal(brief.visual_assets[0].visual_identity_verified,false);
 assert.equal(brief.source.identity_match,false);
 assert.equal(brief.status,'draft_requires_review');
 assert.deepEqual(brief.audience,[]);
 assert(brief.unknowns.includes('customer_journey_acceptance'));
 assert.equal(brief.progress.acceptance,'not_reviewed');
});

test('sparse, contact and media records produce different evidence priorities without invented facts',()=>{
 const sparse=make(),contact=make(base,{email:'hello@fixture.example'},{email:'mailto-link'}),media=make({...base,entity_type:'artist'},{listen:[{url:'https://music.example/track'}]},{listen:'page-media-link'});
 assert.deepEqual(sparse.offering,[]);assert.deepEqual(sparse.visual_assets,[]);
 assert.deepEqual(sparse.primary_actions.map(a=>a.kind),['website']);
 assert(sparse.unknowns.includes('offering_details'));
 assert.equal(contact.composition.section_order[1],'contact');
 assert.equal(media.composition.section_order[1],'media');
 assert.deepEqual(contact.composition.hidden_sections,[]);
 const unsupported=make(base,{menu:[{items:[{name:'Invented'}]}],phone:'+14165551234',hero_url:'https://unreviewed.example/photo.jpg'},{});
 assert.deepEqual(unsupported.offering,[]);assert.deepEqual(unsupported.visual_assets,[]);
 assert.equal(unsupported.primary_actions.length,1);
});

test('member identities remain individual and hotels never acquire appointment inventory',()=>{
 const member=make({...base,entity_type:'professional'},{member:{name:base.name,source_url:base.website,profession:'Registered Nurse',specialties:['Community nursing'],provenance:{identity_match:true}}},{member:'identity_matched_member_body'});
 assert.equal(member.source.identity_match,true);assert.equal(member.offering[0].kind,'specialty');
 const hotel=make(base,{rooms:[{name:'Garden Suite',detail:'Published room description'}],booking_url:'https://provider.example/hotel'},{rooms:'source-hospitality',booking_url:'page-link'});
 assert.equal(hotel.tools_needed.find(t=>t.tool==='accommodation_inventory').state,'not_connected_by_source_extraction');
 assert(!JSON.stringify(hotel).includes('confirmed_booking'));
});

test('malicious URLs, blocked sources, unrelated redirects and email conflicts cannot become brief actions',()=>{
 for(const patch of [{crawl_status:'error'},{blocked:'true'},{blocked:true},{status:'blocked'},{crawl_status:'blocked'}])assert.equal(make(base,patch),null);
 assert.equal(buildClientBrief({listing:base,sourceURL:'https://other.example/'}),null);
 const brief=make(base,{booking_url:'javascript:alert(1)',hero_url:'https://user:secret@fixture.example/img.jpg',email:'old@fixture.example',email_conflict:{linked:'other@fixture.example'}},{booking_url:'page-link',hero_url:'og',email:'jsonld'});
 assert.deepEqual(brief.visual_assets,[]);assert.deepEqual(brief.primary_actions.map(a=>a.kind),['website']);
});

test('existing leased apply batch stores draft brief and skips errors without touching owner fields',()=>{
 const owner={menu:[],description:null};const row={...base,owner_content:owner};
 const ok={slug:base.slug,website:base.website,profile:{phone:'+14165551234'},provenance:{phone:'tel-link'}};
 const error={slug:'failed',website:base.website,profile:{crawl_status:'error'},provenance:{}};
 prepareClientBrief([ok,error],[row,{...row,slug:'failed'}],at);
 assert.equal(ok.profile.client_brief.progress.brief,'draft_requires_review');
 assert.equal(ok.provenance.client_brief,'deterministic_source_brief_v1');
 assert(!('client_brief' in error.profile));assert.deepEqual(row.owner_content,owner);
});

test('canonical restaurant and professional rendering consumes evidence arrangement and owner published design wins',()=>{
 for(const type of ['business','professional']){
  const listing={...base,entity_type:type,category_name:type==='business'?'Restaurant':'Professional',category_slug:type==='business'?'restaurants':'professional'};
  const e=entity(listing,{phone:'+14165551234'},{phone:'tel-link'});
  const design=publishedHomeDesign(e);assert.equal(design.section_order[1],'contact');
  assert(!('template' in design));
  const html=type==='business'?renderRestaurantHome(e,design):renderProfessionalHome(e,design);
  assert(html, 'Canonical family renderer accepts the record');
  assert(html.indexOf('id="contact"')<html.indexOf('id="offerings"'));
  const owner={schema_version:1,template:'atelier',section_order:['offerings','contact'],hidden_sections:['gallery'],copy:{headline:'Owner headline'},item_order:{offerings:[]}};
  assert.deepEqual(publishedHomeDesign({...e,published_design:{ok:true,listing:e.id,version:1,design:owner}}),owner);
  assert.equal(briefHomeDesign({...e,website:null}),null);
  assert.equal(briefHomeDesign({...e,name:'A different identity'}),null);
  const stale=structuredClone(e);stale.profile._enrich.crawl_status='error';assert.equal(briefHomeDesign(stale),null);
  for(const patch of [{blocked:true},{blocked:'true'},{status:'blocked'},{crawl_status:'blocked'}]){const blocked=structuredClone(e);Object.assign(blocked.profile._enrich,patch);assert.equal(briefHomeDesign(blocked),null);}
  const forged=structuredClone(e);forged.profile._enrich.client_brief.composition.section_order.reverse();assert.equal(briefHomeDesign(forged),null);
  assert.equal(publishedHomeDesign(entity(listing,{phone:'+14165551234'},{phone:'tel-link'},false)),null);
  for(const cleared of [{phone:null},{profile:{menu:[]}},{profile:{photos:[]}}])assert.equal(publishedHomeDesign({...e,owner_content:cleared}),null);
 }
});

test('exact typed identity rejects another organization, author, duplicate and unrelated source nodes',()=>{
 const node={'@type':'Restaurant',name:base.name,url:base.website};const doc=v=>'<script type="application/ld+json">'+JSON.stringify(v)+'</script>';
 assert.equal(sourceClientIdentity(base,doc(node),base.website).verification,'exact_name_typed_jsonld');
 for(const value of [{...node,name:'Different Client'},{...node,'@type':'WebPage'},[node,node],{...node,url:'https://other.example/'},{'@type':'WebPage',author:node}])assert.equal(sourceClientIdentity(base,doc(value),base.website),null);
 assert.equal(sourceClientIdentity(base,'<meta property="og:site_name" content="Fixture Client">',base.website),null);
});

test('bounded identity inspection never accepts a truncated graph with a hidden conflict',()=>{
 const node={'@type':'Restaurant',name:base.name,url:base.website};const page={'@type':'WebPage'};
 const doc=v=>'<script type="application/ld+json">'+JSON.stringify(v)+'</script>';
 assert.equal(sourceClientIdentity(base,doc([node,...Array.from({length:99},()=>page),node]),base.website),null);
 const deep={...page};let tail=deep;for(let i=0;i<1001;i++){tail.mainEntity={...page};tail=tail.mainEntity;}tail.mainEntity=node;
 assert.equal(sourceClientIdentity(base,doc({'@graph':[node,deep]}),base.website),null);
});

test('explicit challenge body with embedded exact JSONLD never verifies a client identity',()=>{
 const jsonld='<script type="application/ld+json">'+JSON.stringify({'@type':'Restaurant',name:base.name,url:base.website})+'</script>';
 for(const body of ['Verify you are human','Checking your browser','Request being verified.','<script src="/cdn-cgi/challenge-platform/check.js"></script>'])assert.equal(sourceClientIdentity(base,body+jsonld,base.website),null);
 const ordinary='<h1>Fixture Client</h1><p>Our security workshop explains why services ask you to verify you are human.</p>'+jsonld;
 assert.equal(sourceClientIdentity(base,ordinary,base.website).verification,'exact_name_typed_jsonld');
});

test('artist evidence arrangement preserves the existing family template and leaves unknown identity unchanged',()=>{
 const listing={...base,entity_type:'artist'};const e=entity(listing,{phone:'+14165551234'},{phone:'tel-link'});
 const design=publishedHomeDesign(e);assert(!('template' in design));
 const original=renderMusicHome(e,null),arranged=renderMusicHome(e,design);
 assert.equal(original.match(/data-template="([^"]+)"/)[1],arranged.match(/data-template="([^"]+)"/)[1]);
 assert.equal(publishedHomeDesign(entity(listing,{phone:'+14165551234'},{phone:'tel-link'},false)),null);
});

test('exact-name agency organization on artist record queues family review without relabelling',()=>{
 const listing={...base,entity_type:'artist',name:'Fixture Booking Agency'};
 const source=sourceClientIdentity(listing,'<script type="application/ld+json">'+JSON.stringify({'@type':'Organization',name:listing.name,url:listing.website})+'</script>',listing.website);
 assert.equal(source.verification,'entity_family_review_required');
 const profile={source_identity:source},provenance={source_identity:source.verification};
 const brief=make(listing,profile,provenance);
 assert.equal(brief.progress.classification,'review_required');
 assert.equal(brief.identity_conflicts[0].source_schema_type,'Organization');
 assert.equal(brief.listing.entity_type,'artist');
 assert.equal(publishedHomeDesign(entity(listing,profile,provenance,false)),null);
});

test('large Greek catalogue summary stays bounded with omissions explicit and full source collection intact',()=>{
 const items=Array.from({length:100},(_,i)=>({name:'Δοκιμαστικό πιάτο '+i,note:'α'.repeat(500),price:'€20'}));
 const profile={menu:[{items}]};const brief=make(base,profile,{menu:'jsonld-menu'});
 assert(new TextEncoder().encode(JSON.stringify(brief)).byteLength<24576);
 assert.equal(brief.summary_coverage.offering_count,100);
 assert(brief.summary_coverage.offering_retained<100);
 assert(brief.unknowns.includes('additional_offerings_outside_bounded_summary'));
 assert.equal(profile.menu[0].items.length,100);
});

test('shared RPC payload budget defers a brief explicitly rather than rejecting source facts',()=>{
 const row={slug:base.slug,website:base.website,profile:{large_existing_source:'x'.repeat(1949000),phone:'+14165551234'},provenance:{phone:'tel-link'}};
 prepareClientBrief([row],[base],at);
 assert.equal(row.profile.client_brief.status,'deferred_payload_limit');
 assert.equal(row.profile.client_brief.progress.acceptance,'not_reviewed');
 assert(row.profile.client_brief.next_action.includes('smaller bounded batch'));
 assert(new TextEncoder().encode(JSON.stringify([row])).byteLength<2000000);
});

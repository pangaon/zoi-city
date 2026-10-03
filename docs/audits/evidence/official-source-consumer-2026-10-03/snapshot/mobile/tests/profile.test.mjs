import test from 'node:test';import assert from 'node:assert/strict';import { normalizeProfile, publicURL, profileImageMode } from '../src/profile.ts';
test('profile gives owner fields priority, merges actual socials and labels enrichment',()=>{const p=normalizeProfile({name:'Business',profile:{about:'Owner description',social:{instagram:'https://instagram.com/owner'},_enrich:{about:'Scraped',phone:'+301234567',social:{instagram:'https://instagram.com/scraped'}}},social_links:{facebook:'https://facebook.com/owner'}});assert.equal(p.description,'Owner description');assert.equal(p.phone,'+301234567');assert.deepEqual(p.socials.map(x=>x.url),['https://instagram.com/owner','https://facebook.com/owner']);assert.ok(p.enrichmentNote);});
test('profile never fabricates verification or ratings from owner data',()=>{const p=normalizeProfile({name:'Business',profile:{verified:true,rating:5,reviews:['fake']},verification_status:'unverified'});assert.equal(p.verified,false);assert.equal(p.profile.rating,undefined);assert.equal(p.profile.reviews,undefined);assert.equal(p.socials.length,0);});
test('profile rejects unsafe external schemes and credentials',()=>{for(const url of ['javascript:alert(1)','file:///etc/passwd','https://user:pass@example.com','https://127.0.0.1/a','//example.com'])assert.equal(publicURL(url),'');assert.equal(publicURL('https://example.com/a'),'https://example.com/a');});
test('missing entity is absent, not invented profile',()=>{assert.equal(normalizeProfile(null),null);assert.equal(normalizeProfile([]),null);assert.equal(normalizeProfile({error:'timeout'}),null);});

test('profile actions require exact server routes and matching booking listing',()=>{const id='053a5656-b19b-48a4-8721-65c4674f647c';const p=normalizeProfile({id,name:'Place',booking_url:'/book/?listing='+id,volunteer_url:'/volunteer/?workspace='+id});assert.equal(p.bookingListing,id);assert.equal(p.volunteerWorkspace,id);for(const url of ['https://evil.test/book/?listing='+id,'//evil.test/book/?listing='+id,'/book/?listing='+id+'&other=yes','/book/?listing=invalid'])assert.equal(normalizeProfile({id,name:'Place',booking_url:url}).bookingListing,'');assert.equal(normalizeProfile({id:'different',name:'Place',booking_url:'/book/?listing='+id}).bookingListing,'');assert.equal(normalizeProfile({id,name:'Place'}).bookingListing,'');});

test('private enquiry entry requires server invitation for this same listing',()=>{const id='053a5656-b19b-48a4-8721-65c4674f647c';assert.equal(normalizeProfile({id,name:'Place',inquiry_url:'/inquiries/?listing='+id}).inquiryListing,id);assert.equal(normalizeProfile({id:'other',name:'Place',inquiry_url:'/inquiries/?listing='+id}).inquiryListing,'');assert.equal(normalizeProfile({id,name:'Place',inquiry_url:'https://evil.test/inquiries/?listing='+id}).inquiryListing,'');});

test('profile photos preserve wide logos, portraits and small artwork',()=>{assert.equal(profileImageMode(1200,800),'cover');for(const [width,height] of [[1600,300],[500,1000],[120,120],[0,0]])assert.equal(profileImageMode(width,height),'center');});
import {profileImageEventMode} from '../src/profile.ts';
test('image loading supports native source dimensions and web natural dimensions',()=>{assert.equal(profileImageEventMode({nativeEvent:{source:{width:1200,height:800}}}),'cover');assert.equal(profileImageEventMode({nativeEvent:{target:{naturalWidth:1200,naturalHeight:800}}}),'cover');assert.equal(profileImageEventMode({nativeEvent:{target:{naturalWidth:150,naturalHeight:150}}}),'center');assert.equal(profileImageEventMode({nativeEvent:{}}),'center');});

test('native uses shared phone validity and authoritative owner clear',()=>{
 const e={name:'Aphrodite',profile:{_enrich:{phone:'+0221 493331'}}};const p=normalizeProfile(e);assert.equal(p.phone,'+0221 493331');assert.equal(p.phoneHref,null);
 assert.equal(normalizeProfile({...e,owner_content:{phone:'+49 221 493331 ext. 42'}}).phoneHref,'tel:+49221493331;ext=42');
 assert.equal(normalizeProfile({...e,owner_content:{phone:null}}).phone,'');
});
test('native machine social syntax and exact publisher identity match web while owner links survive',()=>{
 const social={linkedin:'https://www.linkedin.com/shareArticle',facebook:'https://www.facebook.com/ausgoodfoodguide',instagram:'https://www.instagram.com/litanis'};
 const e={name:'Litani',profile:{_enrich:{source_url:'https://www.agfg.com.au/restaurant/litanis-greek-mediterranean-restaurant-55968',social}}};
 assert.deepEqual(normalizeProfile(e).socials.map(x=>x.url),['https://www.instagram.com/litanis']);
 assert.equal(normalizeProfile({...e,owner_content:{social_links:{facebook:social.facebook}}}).socials[0].url,social.facebook);
 assert.deepEqual(normalizeProfile({...e,owner_content:{social_links:null}}).socials,[]);
});
test('native Fournos chain root contacts cannot replace branch base or explicit owner values',()=>{
 const e={name:'Fournos Bakery Benmore',entity_type:'business',phone:'+27 11 883 7194',profile:{_enrich:{source_url:'https://www.fournos.co.za/',phone:'+27100277363',hours:'Other branch hours',menu_url:'https://www.fournos.co.za/menu.pdf'}}};
 assert.equal(normalizeProfile(e).phone,e.phone);assert.equal(normalizeProfile({...e,phone:null}).phone,'');assert.equal(normalizeProfile(e).profile.hours,undefined);assert.equal(normalizeProfile(e).profile.menu_url,e.profile._enrich.menu_url);
 assert.equal(normalizeProfile({...e,owner_content:{phone:null}}).phone,'');assert.equal(normalizeProfile({...e,profile:{...e.profile,phone:'+27 99 1234567'},phone:null}).phone,'+27 99 1234567');
});

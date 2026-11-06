import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {artistPresentation} from '../src/artistMusic.ts';

const view=readFileSync(new URL('../src/ArtistHome.tsx',import.meta.url),'utf8');
const known='78ee3fac-5a97-4e87-88af-57f1eb6a638d';
const unknown='10000000-0000-4000-8000-000000000091';

test('artist home presents only catalog and profile evidence as portfolio content',()=>{
 const actual=artistPresentation({id:known,type:'artist',name:'Thanos Petrelis',slug:'thanos-petrelis',profile:{},website:'',socials:[]});
 assert.ok(actual.releases.length>0);
 assert.ok(actual.images.length>0);
 assert.ok(actual.links.every(link=>/^https:\/\//.test(link.url)));
 assert.match(view,/model\.releases\.map/);
 assert.match(view,/model\.images\.map/);
 assert.match(view,/model\.story/);
 assert.match(view,/sourceUrl\?\<Button label="Visit source/);
 assert.doesNotMatch(view,/Media kit|View media kit|Follow artist|Follow creator/);
});

test('artist portfolio tabs exist only for available content and use client language',()=>{
 assert.match(view,/hasMusic=!!\(model\.releases\.length\|\|model\.links\.some/);
 assert.match(view,/model\.images\.length\?\['photos'/);
 assert.match(view,/hasAbout\?\['about'/);
 assert.match(view,/label=\{key==='music'\?'Music':key==='photos'\?'Photos':'About'\}/);
 assert.match(view,/accessibilityRole="tablist"/);
 assert.match(view,/accessibilityState=\{\{selected\}\}/);
});

test('external listening, shows and contact remain explicit real handoffs',()=>{
 assert.match(view,/accessibilityLabel=\{link\.label\+' \(opens externally\)'\}/);
 assert.match(view,/label="Shows" onPress=\{\(\)=>shows\(model\.showsArtist\)\}/);
 assert.match(view,/label="Contact" onPress=\{\(\)=>enquiry\(model\.inquiryListing\)\}/);
});

test('city interest is optional and clearly distinct from booking and following',()=>{
 assert.match(view,/showDemand\?\<DemandPanel/);
 assert.match(view,/Private request · no booking/);
 assert.match(view,/This does not contact the artist/);
 assert.doesNotMatch(view,/Your profile has \d+ followers|Followed successfully|Booking confirmed/);
 const empty=artistPresentation({id:unknown,type:'artist',name:'Independent creator',slug:'independent-creator',profile:{},website:'',socials:[]});
 assert.equal(empty.images.length,0);
 assert.equal(empty.releases.length,0);
 assert.equal(empty.links.length,0);
 assert.equal(empty.story,'');
});

test('gallery and external links expose accessible controls and recoverable errors',()=>{
 assert.match(view,/accessibilityLabel=\{'Open photos of '\+model\.name\}/);
 assert.match(view,/label="Done" onPress=\{\(\)=>setGallery\(null\)\}/);
 assert.match(view,/label="Previous" accessibilityLabel="Previous photo"/);
 assert.match(view,/label="Next" accessibilityLabel="Next photo"/);
 assert.match(view,/onError=\{\(\)=>setFailed\(true\)\}/);
 assert.match(view,/Could not open that link\. Try again\./);
 assert.match(view,/Sharing is unavailable\./);
 assert.match(view,/SafeAreaView style=\{s\.modal\}/);
 assert.match(view,/useWindowDimensions\(\)/);
 assert.match(view,/fontScale-1/);
 assert.doesNotMatch(view,/maxFontSizeMultiplier|allowFontScaling=\{false\}/);
 assert.match(view,/minHeight:48/);
});

test('city interest retains durable request, retry, withdrawal and Greek-capable inputs',()=>{
 for(const pattern of [/artistDemandRequests\.save/,/artistDemandRequests\.clear/,/Retry request/,/Withdraw/,/Refresh/])assert.match(view,pattern);
 assert.match(view,/maxLength=\{100\}/);
 assert.match(view,/demandPayload\(artist,c,k,active/);
});

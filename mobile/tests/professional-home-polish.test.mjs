import test from'node:test';
import assert from'node:assert/strict';
import {readFileSync} from'node:fs';

const view=readFileSync(new URL('../src/ProfessionalHome.tsx',import.meta.url),'utf8');

test('professional portfolio uses the verified profile image and recovers when it fails',()=>{
 assert.match(view,/profile\.photo/);
 assert.match(view,/onError=\{\(\)=>setHeroFailed\(true\)\}/);
 assert.match(view,/identityFallback/);
 assert.match(view,/profile\.gallery\.filter\(url=>!failed\[url\]\)/);
 assert.match(view,/onError=\{\(\)=>setFailed\(previous=>\(\{\.\.\.previous,\[url\]:true\}\)\)\}/);
});

test('professional portfolio renders published services, gallery and only approved copy',()=>{
 assert.match(view,/<ServiceOfferings offerings=\{profile\.serviceOfferings\} appearance=\{appearance\}\/>/);
 assert.match(view,/copy\.offerings_title\?\.trim\(\)\|\|'Services'/);
 assert.match(view,/copy\.gallery_title\?\.trim\(\)\|\|'Selected work'/);
 assert.match(view,/copy\.headline\?\.trim\(\)/);
 assert.match(view,/copy\.intro\?\.trim\(\)\|\|profile\.description\?\.trim\(\)/);
 assert.doesNotMatch(view,/client names|case studies|successful projects|top rated/i);
});

test('primary action is bound to the listing inquiry and does not claim a booking',()=>{
 assert.match(view,/if\(profile\.inquiryListing\)enquiry\(profile\.inquiryListing\)/);
 assert.match(view,/Send an enquiry/);
 assert.match(view,/Enquiry only\. No appointment or booking is confirmed here\./);
 assert.doesNotMatch(view,/Book now|Booking confirmed|appointment slots/i);
});

test('profile retains scalable text, accessible image controls and real contact fallbacks',()=>{
 assert.match(view,/ScaleText as Text/);
 assert.match(view,/useWindowDimensions\(\)/);
 assert.match(view,/accessibilityRole="header"/);
 assert.match(view,/accessibilityLabel=\{'Open image /);
 assert.match(view,/accessibilityLabel="Previous image"/);
 assert.match(view,/accessibilityLabel="Next image"/);
 assert.match(view,/profile\.phoneHref/);
 assert.match(view,/profile\.email/);
 assert.match(view,/profile\.website/);
 assert.match(view,/Could not open that link\. Try another contact option\./);
});

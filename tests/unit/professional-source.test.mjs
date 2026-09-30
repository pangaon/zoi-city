import test from 'node:test';
import assert from 'node:assert/strict';
import {professionalSource,professionalText} from '../../assets/homes/professional-source.mjs';
import {personData} from '../../assets/homes/person-data.mjs';
import {auxiliaryImage} from '../../supabase/functions/zoi-enrich/_image-context.js';
import {quickLookDetails} from '../../assets/discovery/profile-preview.mjs';
const base=()=>({id:'02c9cb48-999a-4646-be05-24f0433ab680',entity_type:'professional',name:'Sample Practice',website:'https://practice.example/',profile:{_enrich:{source_url:'https://practice.example/',tagline:'Law firm | Sample Practice',hero_url:'https://practice.example/office.jpg',description:'Meet our <b>legal</b> team &amp; get in touch.',provenance:{tagline:'og',hero_url:'og'}}}});
test('same-identity practice metadata supplies an official image, never a person portrait',()=>{
 const e=base(),before=JSON.stringify(e),d=personData(e);assert.equal(d.image,'https://practice.example/office.jpg');assert.equal(d.portrait,'');assert.equal(d.identity_kind,'practice');assert.equal(d.description,'Meet our legal team & get in touch.');assert.equal(JSON.stringify(e),before);
});
test('sparse practices never promote staff galleries or manufacture missing details',()=>{
 const e=base();delete e.profile._enrich.hero_url;delete e.profile._enrich.description;e.profile._enrich.photo_urls=['https://practice.example/staff/jane.jpg'];const d=personData(e);assert.equal(d.image,'');assert.equal(d.portrait,'');assert.equal(d.description,'');
});
test('unverified, different-site, directory and quarantined identity cannot supply a practice image',()=>{
 for(const patch of [{source_url:'https://other.example/'},{source_url:'https://practice.example/staff'},{tagline:'Sample Practice | Jane Smith'},{tagline:'Law firm | Other Practice'},{provenance:{}},{member_source:'directory'},{identity_scope:'organization'},{organization_identity_quarantine:true},{member:{affiliation:'Association'}}]){const e=base();Object.assign(e.profile._enrich,patch);assert.equal(professionalSource(e).image,'',JSON.stringify(patch));}
});
test('owner clears override source media and description',()=>{
 for(const owner_content of [{photo_url:null,description:''},{profile:{photo_url:'',description:''}},{profile:{photos:[]},description:''}]){const d=personData({...base(),owner_content});assert.equal(d.image,'');assert.equal(d.description,'');}
 const e=base();e.owner_content={photo_url:'https://owner.example/approved.jpg',description:'Owner wording'};assert.equal(personData(e).image,e.owner_content.photo_url);assert.equal(personData(e).description,'Owner wording');
});
test('unfinished HTML is removed; ordinary text survives',()=>{
 assert.equal(professionalText('<span class='),'');assert.equal(professionalText('Rates < $100'),'Rates < $100');assert.equal(professionalText('Licensed &amp; independent'),'Licensed & independent');assert.equal(professionalText('Support <strong>your team</strong>'),'Support your team');
});
test('visually confirmed Alexiou website screenshot is excluded across source and quick look',()=>{
 const image='https://alexiourealtyny.com/wp-content/uploads/2024/10/fb.jpg';assert.equal(auxiliaryImage(image),true);assert.equal(auxiliaryImage('https://other.example/wp-content/uploads/2024/10/fb.jpg'),false);assert.equal(auxiliaryImage('https://alexiourealtyny.com/office.jpg'),false);
 const e=base();e.name='Alexiou Realty';e.website='https://alexiourealtyny.com/';e.profile._enrich={source_url:e.website,tagline:'Brokerage | Alexiou Realty',hero_url:image,description:'<span class=',provenance:{tagline:'og',hero_url:'og'}};
 assert.equal(personData(e).image,'');assert.equal(personData(e).description,'');assert.equal(quickLookDetails(e).photo,null);
});

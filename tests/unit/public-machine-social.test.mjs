import test from 'node:test';
import assert from 'node:assert/strict';
import {profileOf} from '../../api/_verticals.js';
import {socialLinks} from '../../assets/homes/templates/restaurant/model.mjs';
const share='https://www.linkedin.com/shareArticle';
test('Vancouver legacy machine share action is not a profile; genuine provider IDs survive',()=>{
 const entity={id:'e044257b-076c-4cd5-b286-e309d653ae1d',profile:{_enrich:{social:{linkedin:share,facebook:'https://www.facebook.com/profile.php?id=123456',youtube:'https://www.youtube.com/channel/UC123',instagram:'https://www.instagram.com/greekcommunity/?utm_source=x'},social_links:{linkedin:share},provenance:{social:'links'}}}};
 const p=profileOf(entity);
 assert.equal(p.social.linkedin,undefined);assert.deepEqual(p.social_links,{});
 assert.equal(p.social.facebook,'https://www.facebook.com/profile.php?id=123456');
 assert.equal(p.social.youtube,'https://www.youtube.com/channel/UC123');
 assert.equal(p.social.instagram,'https://www.instagram.com/greekcommunity/');
 assert.equal(entity.profile._enrich.social.linkedin,share,'no mutation to stored evidence');
 assert.equal(socialLinks(entity,p).some(x=>x.url===share),false,'restaurant must not reintroduce raw enrichment');
});
test('explicit owner social values and clears win unchanged',()=>{
 const e={profile:{_enrich:{social:{linkedin:share,facebook:'https://facebook.com/source'}},social:{linkedin:share}}};
 assert.equal(profileOf(e).social.linkedin,share);
 e.profile.social=null;assert.equal(profileOf(e).social,null);
 const cleared={...e,owner_content:{social_links:null}};assert.deepEqual(socialLinks(cleared,profileOf(cleared)),[]);
 const ownerLink='https://facebook.com/sharer.php';const own={...e,owner_content:{social_links:{facebook:ownerLink}}};assert.equal(socialLinks(own,profileOf(own))[0].url,ownerLink);
});
test('malformed machine social containers are empty and valid source profiles keep provenance',()=>{
 for(const value of [null,[],42,'not an object'])assert.deepEqual(profileOf({profile:{_enrich:{social:value}}}).social,{});
 const p=profileOf({profile:{_enrich:{social:{linkedin:'https://linkedin.com/company/actual'},provenance:{social:'links'}}}});
 assert.equal(p._from.social,'links');assert.equal(p.social.linkedin,'https://linkedin.com/company/actual');
});

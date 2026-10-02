import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {musicHomeContent} from '../../api/_music-home.js';
const base=new URL('../../docs/audits/evidence/kakosaios/',import.meta.url);
const records=JSON.parse(await readFile(new URL('ready-artist-records-refresh-2026-10-02.json',base),'utf8')).rows;
for(const key of ['kakosaios','sabanis']){
 const packet=JSON.parse(await readFile(new URL('ready-packets-2026-10-02/'+key+'.json',base),'utf8'));
 const retained=records.find(r=>r.row.id===packet.listing.id).row;
 const projected=()=>structuredClone({...retained,website:packet.source_url,source_url:packet.source_url,profile:{...retained.profile,_enrich:{...packet.proposed_machine_fields,source_url:packet.source_url,checked_at:'2026-10-02'}}});
 test(key+': qualified exact publisher media reaches actual shared model',()=>{
  const content=musicHomeContent(projected());
  assert.equal(content.spotify,packet.proposed_machine_fields.listen.spotify);
  assert.equal(content.source_label,'Record label artist page');
  assert.equal(content.story,packet.proposed_machine_fields.description);
  assert.equal(content.portrait,packet.images[0]?.url||'');
  assert.deepEqual(content.shows,[]);assert.equal(content.email,'');assert.equal(content.phone,'');
 });
 test(key+': explicit authorized listening edit and clear remain authoritative',()=>{
  const entity=projected(),owner='https://open.spotify.com/artist/1Xyo4u8uXC1ZmMpatF05PJ';
  entity.owner_content={profile:{spotify_url:owner}};
  assert.equal(musicHomeContent(entity).spotify,owner);
  entity.owner_content={profile:{spotify_url:null}};
  assert.equal(musicHomeContent(entity).spotify,'');
  entity.owner_content={profile:{social_links:{}}};
  assert.equal(musicHomeContent(entity).spotify,'');
 });
 test(key+': mismatched source cannot promote approved machine biography or Spotify',()=>{
  const entity=projected();entity.profile._enrich.source_url='https://unrelated.example.invalid/artist';
  const content=musicHomeContent(entity);
  assert.notEqual(content.story,packet.proposed_machine_fields.description);
  assert.notEqual(content.spotify,packet.proposed_machine_fields.listen.spotify);
  assert.notEqual(content.source_label,'Record label artist page');
 });
 test(key+': association identity quarantine suppresses publisher imports',()=>{
  const entity=projected();entity.profile._enrich.scope_review_required=true;
  const content=musicHomeContent(entity);
  assert.notEqual(content.spotify,packet.proposed_machine_fields.listen.spotify);
  assert.notEqual(content.story,packet.proposed_machine_fields.description);
  assert.equal(content.portrait,'');
 });
}

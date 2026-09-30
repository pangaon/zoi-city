import{test}from'node:test';import assert from'node:assert/strict';
import{readFileSync}from'node:fs';
import{dailyRitual,todayISO,WOTD,dayIndex}from'../../assets/community/ritual.mjs';
import{mediaItems,friendlyError}from'../../assets/community/view-model.mjs';
const g={};new Function('window','globalThis',readFileSync(new URL('../../assets/suite/_orthocal.js',import.meta.url),'utf8'))(g,g);const O=g.ZoiOrthocal;
test('ritual preserves actual no-nameday and next-feast behavior',()=>{const r=dailyRitual(O,'2026-09-13');assert.deepEqual(r.namedays,[]);assert.deepEqual(r.feasts,[]);assert.equal(r.next.date,'2026-09-14');assert.match(r.next.name,/Exaltation/);assert.ok(dailyRitual(O,'2026-09-08').namedays.includes('Maria'));});
test('daily rotation uses Athens day and wraps deterministically',()=>{assert.equal(todayISO(new Date('2026-09-13T22:00:00Z')),'2026-09-14');assert.notDeepEqual(dailyRitual(O,'2026-09-13').word,dailyRitual(O,'2026-09-14').word);const a='2026-09-13',b=new Date(Date.parse(a)+WOTD.length*86400000).toISOString().slice(0,10);assert.equal(dayIndex(b)-dayIndex(a),WOTD.length);assert.deepEqual(dailyRitual(O,a).word,dailyRitual(O,b).word);});
test('post media never upgrades a poster-only image into a video',()=>{assert.deepEqual(mediaItems([{type:'video',poster_url:'https://site.test/poster.jpg'},{type:'image',url:'javascript:alert(1)'}]),[]);assert.equal(mediaItems([{type:'video',url:'https://site.test/movie.mp4'}])[0].type,'video');});
test('backend failures cannot expose raw server text in the interface',()=>{assert.equal(friendlyError(Error('secret_database_detail')), 'We could not confirm that action. Refresh to check its status before trying again.');});

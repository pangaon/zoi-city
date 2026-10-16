import test from 'node:test';
import assert from 'node:assert/strict';
import {estimatePhotoHeroHeight} from '../src/profileHeroLayout.ts';

test('photo headers expand for long Greek names and system text without arbitrary caps', () => {
  const title = 'Δοκιμαστική επωνυμία με μεγάλη ελληνική περιγραφή που πρέπει να παραμένει ολόκληρη';
  const base = estimatePhotoHeroHeight({width:390,baseHeight:242,fontScale:1,title:'Northline Plumbing',titleFontSize:25,titleLineHeight:30});
  const large = estimatePhotoHeroHeight({width:390,baseHeight:242,fontScale:2,title,titleFontSize:25,titleLineHeight:30,supportingText:[{text:'Toronto · Ontario',fontSize:12,lineHeight:16},{text:'Source-informed description',fontSize:13,lineHeight:18,maxLines:2}]});
  assert.ok(base >= 242);
  assert.ok(large > base + 180, `long Greek title should get room to wrap: ${large} vs ${base}`);
});

test('photo header retains its editorial base for a short name at default text size', () => {
  assert.equal(estimatePhotoHeroHeight({width:390,baseHeight:242,fontScale:1,title:'ELIA',titleFontSize:25,titleLineHeight:30}),242);
});

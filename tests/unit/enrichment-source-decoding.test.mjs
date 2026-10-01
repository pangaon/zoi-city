import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeSource} from '../../supabase/functions/zoi-enrich/_decode.js';
const latin = s => Uint8Array.from([...s].map(c => c.charCodeAt(0)));
test('legacy HTML declaration preserves accented source text without a transport charset', () => {
 const s='<meta http-equiv="Content-Type" content="text/html; charset=iso-8859-1"><title>MORÉAS — Soirées</title>'.replace('—','-');
 assert.equal(decodeSource(latin(s),'text/html'),s);
});
test('transport and BOM take priority over conflicting HTML declarations',()=>{
 const s='<meta charset=windows-1252>Ελλάδα';const b=new TextEncoder().encode(s);
 assert.equal(decodeSource(b,'text/html; charset = "UTF-8"'),s);
 assert.equal(decodeSource(new Uint8Array([239,187,191,...b]),'text/html; charset=windows-1252'),s);
});
test('charset text inside a quoted MIME parameter is not a declaration',()=>{
 const s='Ελλάδα';assert.equal(decodeSource(new TextEncoder().encode(s),'text/html; note=";charset=windows-1252"; charset=utf-8'),s);
 assert.equal(decodeSource(new TextEncoder().encode(s),'text/html; note="escaped\\";charset=windows-1252"; charset=utf-8'),s);
 assert.equal(decodeSource(latin('é'),'text/html; charset="windows\\-1252"'),'é');
});
test('comments, quoted attribute text and script strings are not declarations',()=>{
 for(const prefix of ['<!-- <meta charset=windows-1252> -->','<div title="<meta charset=windows-1252>">','<script>"<meta charset=windows-1252>"</script>','<textarea><meta charset=windows-1252></textarea>','<title><meta charset=windows-1252></title>']) {
  const s=prefix+'<meta charset=utf-8>Ελλάδα';assert.equal(decodeSource(new TextEncoder().encode(s),'text/html'),s);
 }
});
test('slash separated legacy meta attributes retain declared source characters',()=>{
 const s='<meta/charset=windows-1252>MORÉAS';assert.equal(decodeSource(latin(s),'text/html'),s);
});
test('HTML-only prescan is bounded, ignores unsupported labels and requires legacy pragma',()=>{
 for(const prefix of ['<meta charset=imaginary>','<meta content="text/html; charset=windows-1252">',' '.repeat(1024)+'<meta charset=windows-1252>']) {
  const s=prefix+'Ελλάδα';assert.equal(decodeSource(new TextEncoder().encode(s),'text/html'),s);
 }
 const s='<meta charset=windows-1252>Ελλάδα';assert.equal(decodeSource(new TextEncoder().encode(s),'text/plain'),s);
});

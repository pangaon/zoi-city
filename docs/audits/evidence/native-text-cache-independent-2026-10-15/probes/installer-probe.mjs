import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url), patch=require('../../scripts/patch-native-text-font-cache.cjs');
const original=fs.readFileSync(new URL('../fixtures/react-native-0.86.3-font-cache/Libraries/Text/TextNativeComponent.js.txt',import.meta.url));
const cases=[];
for(const kind of ['package-link','ancestor-link','file-link','directory','unsupported-package','project-alias','hardlink']) {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'zoi-cache-independent-')),project=path.join(dir,'project'),rn=path.join(project,'node_modules/react-native'),file=path.join(rn,patch.FILE),outside=path.join(dir,'outside');
 try {
  fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(path.join(rn,'package.json'),JSON.stringify({version:'0.86.3'}));fs.writeFileSync(file,original);fs.mkdirSync(outside);
  let root=project,expected='refuse';
  if(kind==='package-link'){fs.renameSync(rn,path.join(outside,'react-native'));fs.symlinkSync(path.join(outside,'react-native'),rn);}
  if(kind==='ancestor-link'){fs.renameSync(path.join(rn,'Libraries'),path.join(outside,'Libraries'));fs.symlinkSync(path.join(outside,'Libraries'),path.join(rn,'Libraries'));}
  if(kind==='file-link'){fs.writeFileSync(path.join(outside,'text.js'),original);fs.unlinkSync(file);fs.symlinkSync(path.join(outside,'text.js'),file);}
  if(kind==='directory'){fs.unlinkSync(file);fs.mkdirSync(file);}
  if(kind==='unsupported-package')fs.writeFileSync(path.join(rn,'package.json'),'{"version":"0.86.2"}');
  if(kind==='project-alias'){root=path.join(dir,'alias');fs.symlinkSync(project,root);expected='patched';}
  if(kind==='hardlink'){fs.linkSync(file,path.join(outside,'text.js'));expected='patched';}
  if(expected==='refuse')assert.throws(()=>patch.patchNativeTextFontCache(root),/native_text_patch_(shared_dependencies|invalid_file|unsupported_version)/);
  else assert.equal(patch.patchNativeTextFontCache(root),'patched');
  if(['file-link','hardlink'].includes(kind))assert.deepEqual(fs.readFileSync(path.join(outside,'text.js')),original);
  if(kind==='ancestor-link')assert.deepEqual(fs.readFileSync(path.join(outside,'Libraries/Text/TextNativeComponent.js')),original);
  if(kind==='package-link')assert.deepEqual(fs.readFileSync(path.join(outside,'react-native',patch.FILE)),original);
  cases.push({kind,expected,passed:true});
 } finally {fs.rmSync(dir,{recursive:true,force:true});}
}
fs.writeFileSync(new URL('../../../docs/audits/evidence/native-text-cache-independent-2026-10-15/installer-edgecases.json',import.meta.url),JSON.stringify({cases,limits:'Private synthetic install files only; no shared dependency writes.'},null,2)+'\n');
console.log('PASS '+cases.length+' independent private installer boundaries');

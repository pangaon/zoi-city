import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const canonical=JSON.parse(readFileSync(new URL('../app.json',import.meta.url))).expo;
const source=readFileSync(new URL('../app.config.js',import.meta.url),'utf8');
function evaluate(env={},config=structuredClone(canonical)){
 const module={exports:{}};
 vm.runInNewContext(source,{module,process:{env}});
 return module.exports({config});
}
test('ordinary and production releases preserve the complete canonical app configuration',()=>{
 for(const env of [{},{ZOI_IOS_FOUNDER_RELEASE:'0'},{EAS_BUILD_PROFILE:'testflight'},{EAS_BUILD_PROFILE:'production',EAS_BUILD_PLATFORM:'ios'}]){
  const input=structuredClone(canonical);assert.equal(evaluate(env,input),input);
 }
});
test('explicit founder iOS build changes only the bundle identifier and preserves the Zoi name and capabilities',()=>{
 const input=structuredClone(canonical),result=evaluate({ZOI_IOS_FOUNDER_RELEASE:'1',EAS_BUILD_PROFILE:'founder-testflight',EAS_BUILD_PLATFORM:'ios'},input);
 assert.equal(result.name,'Zoi');assert.equal(result.ios.bundleIdentifier,'city.zoi.app');
 assert.equal(input.ios.bundleIdentifier,'com.usgreekscan.zoi');
 assert.deepEqual({...result,ios:{...result.ios,bundleIdentifier:input.ios.bundleIdentifier}},input);
});
test('mismatched profiles, Android, missing opt-in, malformed flags and canonical identity drift refuse',()=>{
 for(const env of [{ZOI_IOS_FOUNDER_RELEASE:'true'},{ZOI_IOS_FOUNDER_RELEASE:'1',EAS_BUILD_PLATFORM:'android'},{ZOI_IOS_FOUNDER_RELEASE:'1',EAS_BUILD_PROFILE:'production'},{EAS_BUILD_PROFILE:'founder-testflight'},{EAS_BUILD_PROFILE:'founder-testflight',ZOI_IOS_FOUNDER_RELEASE:'0'}])assert.throws(()=>evaluate(env));
 assert.throws(()=>evaluate({ZOI_IOS_FOUNDER_RELEASE:'1'},{...canonical,name:'Another app'}));
});

test('fresh TestFlight submissions target the independently verified new app record',()=>{
 const profiles=JSON.parse(readFileSync(new URL('../eas.json',import.meta.url))).submit;
 assert.equal(profiles['founder-testflight'].ios.ascAppId,'6823485650');
 assert.equal(profiles.testflight.ios.ascAppId,'1464901778');
 assert.equal(profiles.production.ios.ascAppId,'1464901778');
});

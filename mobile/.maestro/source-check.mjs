// Source-only preflight, never reads credentials or invokes Expo/Apple APIs.
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
const manifestPath=new URL('./restoration-source.json',import.meta.url);
export function verifyRestorationSource({root,expectedCommit,outputDirectory,buildId=null,device=null}){
 const manifest=JSON.parse(readFileSync(manifestPath,'utf8'));
 if(!/^[a-f0-9]{40}$/.test(expectedCommit||''))throw Error('An exact expected workflow source commit is required');
 const actual=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
 if(actual!==expectedCommit)throw Error('Workflow checkout does not match expected commit');
 const digest=b=>createHash('sha256').update(b).digest('hex');
 for(const [file,sha] of Object.entries({...manifest.captured_runtime_sha256,...manifest.eager_dependency_sha256,...manifest.eager_bundle_sha256}))if(digest(readFileSync(path.join(root,file)))!==sha)throw Error('Pinned runtime source changed: '+file);
 const config=JSON.parse(readFileSync(path.join(root,'mobile/eas.json'),'utf8'));
 if(config.build.preview.ios.simulator!==true||config.build.preview.developmentClient===true||config.build.preview.autoIncrement===true)throw Error('Preview must remain a release simulator profile without automatic version increment');
 const receipt={actual_commit:actual,baseline_commit:manifest.baseline_commit,captured_files:Object.keys(manifest.captured_runtime_sha256).length,eager_bundle_files:Object.keys(manifest.eager_bundle_sha256).length,shared_dependency_files:Object.keys(manifest.eager_dependency_sha256).length,manifest_sha256:digest(readFileSync(manifestPath)),eager_bundle_sha256:manifest.eager_bundle_sha256,build_id:buildId,device,store_build_identity_claim:false};
 if(outputDirectory){mkdirSync(outputDirectory,{recursive:true});writeFileSync(path.join(outputDirectory,'source.json'),JSON.stringify(receipt,null,2)+'\n');}return receipt;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){const receipt=verifyRestorationSource({root:fileURLToPath(new URL('../../',import.meta.url)),expectedCommit:process.env.EXPECTED_CAPTURE_COMMIT,outputDirectory:path.resolve(process.env.CAPTURE_EVIDENCE_DIR||'restoration-evidence'),buildId:process.env.CAPTURE_BUILD_ID||null,device:process.env.CAPTURE_DEVICE||null});console.log('Captured/eager runtime pins verified: '+receipt.captured_files+'/'+receipt.eager_bundle_files);}

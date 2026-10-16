// Source-only preflight, never reads credentials or invokes Expo/Apple APIs.
import {readFileSync,mkdirSync,writeFileSync,lstatSync,realpathSync,openSync,closeSync,fstatSync,fsyncSync,linkSync,unlinkSync,constants} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
const PACKET=['mobile/.eas/workflows/app-store-restoration.yml',...['restoration.yaml','restoration-source.json','source-check.mjs','artifact-check.mjs','README.md'].map(name=>'mobile/.maestro/'+name)];
const digest=b=>createHash('sha256').update(b).digest('hex');
// Keep the established capture graph immutable. New accepted work joins only
// the finite scopes below; refreshing baseline hashes cannot bypass review.
const canonical=value=>Array.isArray(value)?'['+value.map(canonical).join(',')+']':value&&typeof value==='object'?'{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}':JSON.stringify(value);
const BASELINE_GRAPH_SHA='6eef60f514463aead3ebf8c7e0cb963244f93fb0cf88fd063ebe29b23378e374';
const OVERLAY_SCOPE={"welcome_v3":["mobile/src/WelcomeLanding.tsx","mobile/src/Welcome.tsx","mobile/src/AegeanArt.tsx","mobile/src/Presentation.tsx","mobile/src/ScaleText.tsx","mobile/src/Icon.tsx","mobile/assets/aegean-world-opening-v3.png","mobile/assets/zoi-logo.png","mobile/assets/aegean-world-opening-v3.provenance.json"],"home_editorial":["mobile/src/HomeExperience.tsx","mobile/src/AppChrome.tsx","mobile/tests/editorial-home-chrome.test.mjs"],"account_core_v2":["mobile/src/AccountDeletion.tsx","mobile/src/accountDeletion.ts","mobile/src/Account.tsx","mobile/src/Auth.tsx","mobile/src/session.ts"],"app_header":["mobile/App.tsx","mobile/assets/aegean-opening-v2.png","mobile/assets/aegean-opening-v2.provenance.json"],"identity_config":["mobile/app.config.js","mobile/eas.json","mobile/tests/release-identity.test.mjs"],"map_address_v2":["assets/map-data/loader.mjs"],"commerce_current":["mobile/src/Shop.tsx","mobile/src/commerce.ts","mobile/src/ShopifyStore.native.tsx","mobile/src/ShopifyNavigation.ts","api/_commerce.js","api/commerce.js","mobile/tests/commerce.test.mjs","mobile/tests/shopify-store.test.mjs","tests/unit/commerce.test.mjs","mobile/tests/browser/shopify-native-catalogue.mjs"]};
function reviewedSourcePins(manifest){
 const baseline=Object.fromEntries(['baseline_commit','bundle_identifier','project_id','devices','captured_runtime_sha256','eager_dependency_sha256','eager_bundle_sha256'].map(key=>[key,manifest[key]]));
 if(digest(Buffer.from(canonical(baseline)))!==BASELINE_GRAPH_SHA)throw Error('Frozen baseline capture graph changed; use an explicitly reviewed overlay');
 const overlays=manifest.accepted_source_overlays;
 if(!overlays||Array.isArray(overlays)||canonical(Object.keys(overlays).sort())!==canonical(Object.keys(OVERLAY_SCOPE).sort()))throw Error('Only explicitly accepted capture overlays are allowed');
 const pins={...manifest.captured_runtime_sha256,...manifest.eager_dependency_sha256,...manifest.eager_bundle_sha256},accepted={};
 for(const [name,scope]of Object.entries(OVERLAY_SCOPE)){
  const group=overlays[name];
  if(!group||typeof group!=='object'||!group.files_sha256||canonical(Object.keys(group.files_sha256).sort())!==canonical([...scope].sort()))throw Error('Accepted overlay scope changed: '+name);
  for(const key of ['source_manifest','independent_review'])if(!group[key]||typeof group[key].path!=='string'||!group[key].path||!(/^[a-f0-9]{64}$/).test(group[key].sha256||''))throw Error('Accepted overlay review binding missing: '+name);
  for(const [file,sha]of Object.entries(group.files_sha256)){
   if(!(/^[a-f0-9]{64}$/).test(sha)||Object.hasOwn(accepted,file)&&accepted[file]!==sha)throw Error('Accepted overlay hash conflict: '+file);
   accepted[file]=sha;pins[file]=sha;
  }
 }
 return{pins,accepted};
}

// Resolve existing ancestry without following symlinks; missing descendants
// inherit the canonical nearest-existing directory. Never validate only text.
function receiptDirectory(root,requested,outside){
 const absolute=path.resolve(requested),parts=absolute.slice(path.parse(absolute).root.length).split(path.sep).filter(Boolean);let at=path.parse(absolute).root;
 for(let i=0;i<parts.length;i++){
  const next=path.join(at,parts[i]);let st;try{st=lstatSync(next);}catch(error){if(error.code!=='ENOENT')throw error;at=path.join(realpathSync(at),...parts.slice(i));break;}
  if(st.isSymbolicLink())throw Error('Receipt destination symlink component refused');
  if(!st.isDirectory())throw Error('Receipt destination component is not a directory');at=realpathSync(next);
 }
 const canonical=at,canonicalRoot=realpathSync(root),relative=path.relative(canonicalRoot,canonical);
 if(outside&&(relative===''||!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative)))throw Error('Local operator receipt must stay outside the upload repository');
 return canonical;
}
function writeReceipt(root,requested,outside,receipt){
 const directory=receiptDirectory(root,requested,outside);mkdirSync(directory,{recursive:true,mode:0o700});
 if(receiptDirectory(root,directory,outside)!==directory)throw Error('Receipt destination changed');
 const identity=lstatSync(directory,{bigint:true}),target=path.join(directory,'source.json');
 try{const st=lstatSync(target);throw Error(st.isSymbolicLink()?'Final receipt symlink refused':'Receipt already exists; use a fresh private directory');}catch(error){if(error.code!=='ENOENT')throw error;}
 const unchanged=()=>{if(receiptDirectory(root,directory,outside)!==directory)throw Error('Receipt destination changed');const st=lstatSync(directory,{bigint:true});if(st.dev!==identity.dev||st.ino!==identity.ino)throw Error('Receipt directory identity changed');};
 if(typeof constants.O_NOFOLLOW!=='number')throw Error('Receipt platform lacks no-follow file creation');
 const temporary=path.join(directory,'.source-'+randomUUID()+'.tmp');let fd,created=false;
 try{
  unchanged();fd=openSync(temporary,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);created=true;
  const file=fstatSync(fd,{bigint:true});if(!file.isFile())throw Error('Receipt temporary file is not regular');
  writeFileSync(fd,JSON.stringify(receipt,null,2)+'\n');fsyncSync(fd);unchanged();
  const st=lstatSync(temporary,{bigint:true});if(!st.isFile()||st.dev!==file.dev||st.ino!==file.ino)throw Error('Receipt temporary identity changed');
  // link is an atomic exclusive publication: an existing regular file or
  // symlink produces EEXIST and is never followed or overwritten.
  linkSync(temporary,target);const published=lstatSync(target,{bigint:true});if(!published.isFile()||published.dev!==file.dev||published.ino!==file.ino)throw Error('Published receipt identity changed');
 }finally{if(fd!==undefined)closeSync(fd);if(created)try{unlinkSync(temporary);}catch(error){if(error.code!=='ENOENT')throw error;}}
}
export function verifyRestorationSource({mode,root,expectedCommit,expectedManifestSHA,providerCommit=null,outputDirectory,buildId=null,device=null}){
 if(!['local-preflight','worker-hash'].includes(mode))throw Error('An explicit local-preflight or worker-hash mode is required');
 if(!/^[a-f0-9]{40}$/.test(expectedCommit||''))throw Error('An exact sender-asserted protected source commit is required');
 if(!/^[a-f0-9]{64}$/.test(expectedManifestSHA||''))throw Error('An exact expected source manifest digest is required');
 const manifestBytes=readFileSync(path.join(root,'mobile/.maestro/restoration-source.json'));
 if(digest(manifestBytes)!==expectedManifestSHA)throw Error('Source manifest digest changed');
 const manifest=JSON.parse(manifestBytes);let localCommit=null,localTree=null;
 if(mode==='local-preflight'){
  localCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
  if(localCommit!==expectedCommit)throw Error('Local checkout does not match protected commit');
  // No blanket untracked exception. Operator receipts must be outside the repo;
  // Git-ignored generated files are governed by the existing ignore policies.
  if(execFileSync('git',['status','--porcelain=v1','--untracked-files=all','-z'],{cwd:root}).length)throw Error('Local upload requires clean tracked and untracked files');
  localTree=execFileSync('git',['rev-parse','HEAD^{tree}'],{cwd:root,encoding:'utf8'}).trim();
  if(outputDirectory)receiptDirectory(root,outputDirectory,true);
 }
 // GCS upload jobs may have no provider commit and no .git. Never replace a
 // missing provider value with the caller's assertion or create fake metadata.
 if(providerCommit!==null&&providerCommit!==''){
  if(!/^[a-f0-9]{40}$/.test(providerCommit)||providerCommit!==expectedCommit)throw Error('Provider commit metadata differs or is malformed');
 }else providerCommit=null;
 const {pins,accepted}=reviewedSourcePins(manifest);
 for(const [file,sha]of Object.entries(pins))if(digest(readFileSync(path.join(root,file)))!==sha)throw Error('Pinned runtime source changed: '+file);
 if(manifest.pending_acceptance?.commerce?.length)throw Error('Capture awaits independent commerce overlay acceptance');
 const config=JSON.parse(readFileSync(path.join(root,'mobile/eas.json'),'utf8'));
 const app=JSON.parse(readFileSync(path.join(root,'mobile/app.json'),'utf8')).expo;
 if(manifest.bundle_identifier!=='com.usgreekscan.zoi'||app.ios?.bundleIdentifier!==manifest.bundle_identifier||app.extra?.eas?.projectId!==manifest.project_id||process.env.ZOI_IOS_FOUNDER_RELEASE!==undefined&&process.env.ZOI_IOS_FOUNDER_RELEASE!=='0'||process.env.EAS_BUILD_PROFILE&&process.env.EAS_BUILD_PROFILE!=='preview')throw Error('Capture requires the canonical old-bundle preview profile; founder identity is separate');
 if(config.build.preview.ios.simulator!==true||config.build.preview.developmentClient===true||config.build.preview.autoIncrement===true)throw Error('Preview must remain a release simulator profile without automatic version increment');
 const packetSHA=Object.fromEntries(PACKET.map(file=>[file,digest(readFileSync(path.join(root,file)))]));
 const receipt={mode,source_transport:mode==='worker-hash'?'GCS-local-upload':'local-git-preflight',sender_asserted_commit:expectedCommit,locally_verified_commit:localCommit,locally_verified_tree:localTree,provider_commit:providerCommit,provider_commit_matches_sender_assertion:providerCommit!==null,baseline_commit:manifest.baseline_commit,captured_files:Object.keys(manifest.captured_runtime_sha256).length,eager_bundle_files:Object.keys(manifest.eager_bundle_sha256).length,shared_dependency_files:Object.keys(manifest.eager_dependency_sha256).length,manifest_sha256:expectedManifestSHA,workflow_packet_sha256:packetSHA,eager_bundle_sha256:manifest.eager_bundle_sha256,accepted_overlay_files:Object.keys(accepted).length,accepted_source_overlays:manifest.accepted_source_overlays,pending_acceptance:manifest.pending_acceptance||null,build_id:buildId,device,store_build_identity_claim:false};
 if(outputDirectory)writeReceipt(root,outputDirectory,mode==='local-preflight',receipt);return receipt;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const mode=process.argv[2]?.replace(/^--/,'');
 if(mode==='local-preflight'&&!process.env.CAPTURE_EVIDENCE_DIR)throw Error('Local preflight requires a private external operator receipt directory');
 const receipt=verifyRestorationSource({mode,root:fileURLToPath(new URL('../../',import.meta.url)),expectedCommit:process.env.EXPECTED_CAPTURE_COMMIT,expectedManifestSHA:process.env.EXPECTED_SOURCE_MANIFEST_SHA,providerCommit:process.env.EAS_BUILD_GIT_COMMIT_HASH||null,outputDirectory:path.resolve(process.env.CAPTURE_EVIDENCE_DIR||'restoration-evidence'),buildId:process.env.CAPTURE_BUILD_ID||null,device:process.env.CAPTURE_DEVICE||null});console.log('Captured/eager runtime pins verified in '+mode+': '+receipt.captured_files+'/'+receipt.shared_dependency_files+'/'+receipt.eager_bundle_files+'; accepted overlays '+receipt.accepted_overlay_files);
}

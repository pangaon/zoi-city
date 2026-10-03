from pathlib import Path
import hashlib,json,shutil
root=Path(__file__).resolve().parents[4]
snapshot=root.parent/'owned-freezes'/'native-discovery-media-2026-10-03'
assert not snapshot.exists(), snapshot
runtime=['mobile/src/discoveryMedia.ts','mobile/src/Discovery.tsx']
tests=['mobile/tests/discoveryMedia.test.mjs','tests/browser/native-discovery-media/verify.cjs']
paths=set(runtime+tests+['tests/browser/native-discovery-media/README.md','docs/audits/native-discovery-media-readiness-2026-10-03.md','docs/audits/native-backend-dependencies-2026-09-30.json','package.json','package-lock.json'])
# Include the consumed pure shared media chain, native application, existing
# journey harnesses and full native unit dependencies, not a copied ID table.
for folder in ['mobile','assets','api','supabase/migrations','supabase/functions/zoi-enrich','tests/browser/native-discovery','docs/audits/evidence/native-discovery-media-producer-2026-10-03']:
 for p in (root/folder).rglob('*'):
  if not p.is_file() or p.is_symlink() or any(x in p.parts for x in ['node_modules','.expo','dist','.git']):continue
  if any(x.startswith('.qa-') for x in p.parts):continue
  if p.name=='frozen-manifest.json':continue
  rel=str(p.relative_to(root))
  if folder.startswith('docs/') or folder.startswith('mobile') or p.suffix in ['.mjs','.cjs','.js','.ts','.tsx','.json','.css','.svg','.sql','.md','.html']:
   paths.add(rel)
snapshot.mkdir(parents=True)
files=[]
for rel in sorted(paths):
 p=root/rel;dest=snapshot/rel;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dest)
 files.append({'path':rel,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size,'ownership':'media-runtime' if rel in runtime else 'media-test' if rel in tests else 'baseline/evidence'})
manifest={'snapshot':str(snapshot),'runtime':runtime,'tests':tests,'shared_dependencies':['assets/discovery/public-listing-media.mjs','supabase/functions/zoi-enrich/_image-context.js','mobile/src/session.ts','mobile/src/discoveryRead.ts','mobile/metro.config.js','mobile/package.json','mobile/package-lock.json','docs/audits/native-backend-dependencies-2026-09-30.json'],'files':files,'new_native_curated_ids':0,'live_changes':False,'physical_device_verified':False,'parea_authority_scope':'Separate frozen candidate; not modified or approved by this packet'}
s=json.dumps(manifest,indent=2)+'\n'
(root/'docs/audits/evidence/native-discovery-media-producer-2026-10-03/frozen-manifest.json').write_text(s)
(snapshot/'frozen-manifest.json').write_text(s)
for folder in ['node_modules','mobile/node_modules']:
 if (root/folder).exists():(snapshot/folder).symlink_to(root/folder,target_is_directory=True)
print('snapshot',snapshot,'files',len(files),'manifestSHA',hashlib.sha256(s.encode()).hexdigest())

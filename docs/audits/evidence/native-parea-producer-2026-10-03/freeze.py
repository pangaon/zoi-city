from pathlib import Path
import hashlib,json,shutil,os,re
root=Path(__file__).resolve().parents[4]
snapshot=root.parent/'owned-freezes'/'native-parea-2026-10-03'
assert not snapshot.exists(),snapshot
snapshot.mkdir(parents=True)
owned_runtime=['mobile/src/NativeParea.tsx','mobile/src/nativeParea.ts','mobile/src/nativePareaClient.ts','mobile/src/nativePareaRecovery.ts','mobile/src/NativePareaHandoff.tsx','mobile/src/Tickets.tsx']
owned_tests=['mobile/tests/nativeParea.test.mjs','mobile/tests/nativePareaClient.test.mjs','mobile/tests/nativePareaRecovery.test.mjs','tests/browser/native-parea-journey/verify.cjs','tests/browser/native-parea-journey/privacy.cjs','tests/database/native-parea-journey.integration.mjs']
schema=['supabase/migrations/20261003094500_event_table_current_session.sql','tests/database/event-table-current-session.integration.mjs','docs/audits/event-table-current-session-proposal-2026-10-03.md']
paths=set(owned_runtime+owned_tests+schema+['docs/audits/native-parea-readiness-2026-10-03.md','tests/browser/native-parea-journey/README.md','docs/audits/native-backend-dependencies-2026-09-30.json'])
for folder in ['mobile','assets','api','supabase/migrations','supabase/functions/zoi-enrich']:
 for p in root.joinpath(folder).rglob('*'):
  if not p.is_file() or p.is_symlink() or any(x in p.parts for x in ['node_modules','.expo','dist','.git']):continue
  rel=str(p.relative_to(root))
  if folder=='mobile' or p.suffix in ['.mjs','.cjs','.js','.ts','.tsx','.json','.css','.svg','.sql']:
   paths.add(rel)
for folder in ['docs/audits/evidence/native-parea-producer-2026-10-03','docs/audits/evidence/event-table-current-session-producer-2026-10-03','docs/audits/evidence/event-suite-inventory-2026-10-03']:
 for p in root.joinpath(folder).rglob('*'):
  if p.is_file():paths.add(str(p.relative_to(root)))
for name in ['package.json','package-lock.json']:paths.add(name)
# Test harness artifacts contain generated synthetic capabilities. Retain only
# hashes in the repository; assertions still exercise the actual memory values.
for p in root.joinpath('docs/audits/evidence/native-parea-producer-2026-10-03').glob('*.json'):
 s=p.read_text();s=re.sub(r'(?<![a-f0-9])[a-f0-9]{64}(?![a-f0-9])',lambda m:'fixture-capability-sha256:'+hashlib.sha256(m[0].encode()).hexdigest(),s);p.write_text(s)
files=[]
for rel in sorted(paths):
 p=root/rel;dest=snapshot/rel;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dest)
 files.append({'path':rel,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size,'ownership':'native-runtime' if rel in owned_runtime else 'native-test' if rel in owned_tests else 'authority' if rel in schema else 'baseline/evidence'})
manifest={'snapshot':str(snapshot),'native_runtime':owned_runtime,'native_tests':owned_tests,'authority_paths':schema,'shared_dependencies':['assets/tickets/host-allocation-client.mjs','assets/tickets/event-payment-policy-client.mjs','mobile/src/eventHostLink.ts','mobile/src/Auth.tsx','mobile/metro.config.js','mobile/package.json','mobile/package-lock.json','docs/audits/native-backend-dependencies-2026-09-30.json'],'files':files,'live_changes':False,'physical_device_verified':False}
text=json.dumps(manifest,indent=2)+'\n'
root.joinpath('docs/audits/evidence/native-parea-producer-2026-10-03/frozen-manifest.json').write_text(text)
snapshot.joinpath('frozen-manifest.json').write_text(text)
for folder in ['node_modules','mobile/node_modules']:
 if root.joinpath(folder).exists():snapshot.joinpath(folder).symlink_to(root.joinpath(folder),target_is_directory=True)
print('snapshot',snapshot,'files',len(files),'manifestSHA',hashlib.sha256(text.encode()).hexdigest())

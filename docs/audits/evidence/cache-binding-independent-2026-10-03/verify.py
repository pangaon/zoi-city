from pathlib import Path
import json,hashlib,re,subprocess
root=Path('/workspaces/zoi-city/.recovery/today-command-centre-20261003');out=Path(__file__).parent
sha=lambda b:hashlib.sha256(b).hexdigest()
mp=root/'.recovery/cache-binding-derivative.json';assert sha(mp.read_bytes())=='4661c357e4dbb5cd038187015a5639bf2078ed65d3122ba7aeb56c1a3e165691';manifest=json.loads(mp.read_text())
company=Path('/workspaces/zoi-city/.recovery/community-release/.recovery/owned-freezes/company-action-plan-discard-2026-10-03')
guest=Path('/workspaces/zoi-city/.recovery/event-guest-finish-freeze-20261003');follow=Path('/workspaces/zoi-city/.recovery/event-guest-lifecycle-followup-freeze-20261003')
gm=root/'docs/audits/evidence/event-guest-finish-2026-10-03/manifest.json';fm=root/'docs/audits/evidence/event-guest-lifecycle-followup-2026-10-03/manifest.json';assert sha(gm.read_bytes())=='0fe824426b9dd66e4519a2d073715e277a8fc81a8f0c37c8321d396496bc06c0';assert sha(fm.read_bytes())=='69cf95e7155048489784772a4da2e24ec43a5f286a2c22244dd5e18a6a979fd5'
gs=json.loads(gm.read_text());fs=json.loads(fm.read_text());gpaths={r['path']:r['sha256'] for r in gs['entries']};fpaths={r['path']:r['sha256'] for r in fs['entries']}
results=[]
for row in manifest:
 p=row['path'];after=(root/p).read_bytes();assert sha(after)==row['after_sha256'],p+' current after SHA'
 reconstructed=after
 for old,new in reversed(row['replacements']):
  assert old.split('?')[0].split("'")[0]==new.split('?')[0].split("'")[0],p+' path changed'
  assert new.encode() in reconstructed,p+' missing new version'
  reconstructed=reconstructed.replace(new.encode(),old.encode())
 assert sha(reconstructed)==row['before_sha256'],p+' exact reverse SHA'
 if p=='assets/suite/operations.js':trusted=(company/p).read_bytes();assert sha(trusted)=='3fd668a8c022ee73ceafa00250cc5ce729e4a20d4cd7e12d5f24f0db825e9f06';basis='accepted Company discard derivative'
 elif p in fpaths and p in [r['path'] for r in fs['entries'] if r.get('kind')=='runtime']:
  trusted=(follow/p).read_bytes();assert sha(trusted)==fpaths[p];basis='accepted Guest lifecycle derivative'
 elif p in gs['runtime_paths']:
  trusted=(guest/p).read_bytes();assert sha(trusted)==gpaths[p];basis='accepted original Guest runtime'
 else:trusted=subprocess.check_output(['git','show','1d928466552a5de8496f0467c6852f8ae31ce73c:'+p],cwd=root);basis='exact reviewed release baseline1d928466'
 assert reconstructed==trusted,p+' trusted producer body mismatch'
 results.append({'path':p,'after_sha256':sha(after),'before_sha256':sha(reconstructed),'trusted_body':basis,'reverse_exact':True,'replacements':len(row['replacements'])})
# All existing downstream modules must carry new identities, not only entry scripts.
required={
'social/index.html':['operations.js?v=20261003-action-plans','priorities.js?v=20261003-today-workspace'],
'assets/suite/operations.js':['company-workspace.mjs?v=20261003-action-plans','company-action-plan.mjs?v=20261003-action-plans'],
'assets/operations/company-workspace.mjs':['company-dashboard.mjs?v=20261003-action-plans'],
'assets/suite/priorities.js':['view.mjs?v=20261003-today-workspace'],
'assets/priorities/view.mjs':['style.css?v=20261003-today-workspace'],
'events/giannis-ploutarchos-andromache-toronto-2027/index.html':['experience.mjs?v=20261003-guest-plans','customer-a.css?v=20261003-guest-plans'],
'assets/events/signature/experience.mjs':['customer-a.mjs?v=20261003-guest-plans','guest-planning.mjs?v=20261003-guest-plans'],
'assets/events/signature/customer-a.mjs':['guest-planning.mjs?v=20261003-guest-plans'],
'assets/events/guest-planning.mjs':['private-plan.mjs?v=20261003-guest-plans'],
'api/_event-home.js':['canonical.mjs?v=20261003-guest-plans'],
'assets/homes/templates/events/canonical.mjs':['client.mjs?v=20261003-guest-plans'],
'assets/homes/templates/events/client.mjs':['customer-a.mjs?v=20261003-guest-plans','guest-planning.mjs?v=20261003-guest-plans']}
for p,values in required.items():
 text=(root/p).read_text()
 for v in values:assert v in text,p+' missing '+v
# Unchanged reviewed Company runtime and Guest private plan/CSS must still match original/derivative snapshots.
cm=json.loads((company/'docs/audits/evidence/company-action-plan-producer-2026-10-03/frozen-manifest.json').read_text());matched=[]
for p in cm['runtime_paths']:
 if p=='assets/suite/operations.js':continue
 assert (root/p).read_bytes()==(company/p).read_bytes();matched.append(p)
for p in ['assets/events/signature/private-plan.mjs','assets/events/signature/customer-a.css']:
 source=follow if p in fpaths else guest;assert (root/p).read_bytes()==(source/p).read_bytes();matched.append(p)
# Accepted Today correction/producer bytes are unchanged by this query-only integration.
tm=json.loads((root/'docs/audits/evidence/today-workspace-producer-2026-10-03/producer-manifest.json').read_text());tc=json.loads((root/'docs/audits/evidence/today-workspace-correction-2026-10-03/manifest.json').read_text());today={r['path']:r['sha256'] for r in tm['owned'] if r['path'].startswith(('assets/','mobile/'))};today.update({r['path']:r['sha256'] for r in tc['entries'] if r.get('kind')=='runtime'})
for p,h in today.items():assert sha((root/p).read_bytes())==h,p+' Today mismatch';matched.append(p)
report={'status':'passed','manifest_sha256':sha(mp.read_bytes()),'exact_reverse_paths':results,'chain_edges':sum(map(len,required.values())),'chain_files':len(required),'unchanged_reviewed_runtime':matched,'production':False,'actual_browser_replay':'Not run by this static derivative verifier; independent original/derivative journey evidence remains separate','writes':'Own new review evidence only; no candidate changes'}
(out/'report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'status':'passed','paths':len(results),'chain_edges':report['chain_edges'],'unchanged_runtime':len(matched)},indent=2))

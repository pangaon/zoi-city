import pathlib,re,json,hashlib,subprocess,posixpath
r=pathlib.Path('.').resolve();src=pathlib.Path('/workspaces/zoi-map-studio-ops-release');e=r/'docs/audits/evidence/enrichment-v4-integration-independent-2026-10-15';start='supabase/functions/geography-repair-source-consumer/index.ts';seen=set();queue=[start]
# Match declaration imports at the beginning of a line; exclude template/string contents.
regex=re.compile(r'''(?:^|;)\s*(?:import|export)\s*(?:\{[^\n}]*\}|[^\n;]*?)?\s*from\s*['"]([^'"\n]+)['"]''',re.M)
while queue:
 p=queue.pop(0)
 if p in seen:continue
 seen.add(p);data=(r/p).read_text()
 for m in regex.finditer(data):
  spec=m.group(1)
  if spec.startswith('.'):
   queue.append(posixpath.normpath(posixpath.join(posixpath.dirname(p),spec)))
allfiles={str(x.relative_to(r))for x in (r/'supabase/functions/geography-repair-source-consumer').iterdir()if x.is_file()};assert seen==allfiles,(seen,allfiles-seen);assert len(seen)==18
out=[];changed=[]
for p in sorted(seen):
 data=(r/p).read_bytes();assert data==(src/p).read_bytes(),p;out.append({'path':p,'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data)});old=subprocess.check_output(['git','show','53b3554b735ff012958ac51e27d0e6c3120aa490:'+p])
 if old!=data:changed.append(p)
assert changed==['supabase/functions/geography-repair-source-consumer/_client-brief.js'],changed
(e/'generated-graph.json').write_text(json.dumps({'count':len(out),'all18_equal_root_generated_bytes':True,'changed_vs_main':changed,'files':out},indent=2));print('18 reachable files = full directory, exact root bytes; only generated _client-brief changed')

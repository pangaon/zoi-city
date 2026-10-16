from pathlib import Path
import subprocess,json,re,hashlib,collections
r=Path('/workspaces/zoi-map-studio-ops-release');out=Path('/home/codespace/.cache/zoi/repository-hygiene-owner-20261016');raw=subprocess.check_output(['git','ls-tree','-r','-l','-z','HEAD'],cwd=r);meta={}
for row in raw.split(b'\0'):
 if not row:continue
 head,name=row.split(b'\t',1);a=head.split();meta[name.decode()]={'git_blob':a[2].decode(),'bytes':int(a[-1]) if a[-1]!=b'-' else 0}
evidence={k:v for k,v in meta.items()if k.startswith('docs/audits/evidence/')};blobs=collections.defaultdict(list)
for k,v in evidence.items():blobs[v['git_blob']].append(k)
dup=[v for v in blobs.values()if len(v)>1]
codepaths=[x for x in meta if x.startswith(('tests/','scripts/','mobile/','api/','assets/','.github/')) and x.endswith(('.js','.mjs','.cjs','.ts','.tsx','.py','.yml','.yaml','.json','.html')) and not x.startswith('mobile/tests/fixtures/react-native-')]
keep={};unresolved=[];seeds=[];portable=[];dynamic=[]
# Conservative source inputs plus JSON dependency closure, not a deletion list.
def retain(path,why):
 if path in evidence:keep.setdefault(path,set()).add(why)
 if path in meta and path.endswith('.json') and path not in visited_json:pending_json.append(path)
def reference(value,why):
 at=value.find('docs/')
 if at<0:return
 tail=value[at:].split('#',1)[0].split('?',1)[0]
 if tail in meta:retain(tail,why);return
 # A literal dynamic prefix can identify a bounded whole evidence directory.
 prefix=re.split(r'\$\{|\+|\{|\*',tail,maxsplit=1)[0]
 if prefix.startswith('docs/audits/evidence/'):
  if prefix.endswith('/'):
   matches=[x for x in evidence if x.startswith(prefix)]
   for x in matches:retain(x,why+' [directory/dynamic conservatively retained]')
   dynamic.append({'prefix':prefix,'reader':why,'files':len(matches)})
  else:unresolved.append({'reference':tail[:300],'reader':why})
visited_json=set();pending_json=[]
for file in codepaths:
 p=r/file
 if not p.is_file() or p.stat().st_size>8*1024*1024:continue
 text=p.read_text(errors='replace')
 if '/workspaces/zoi-city-release/node_modules/playwright-core' in text or '/home/codespace/.cache/ms-playwright/' in text:
  portable.append({'path':file,'playwright_old_checkout':'/workspaces/zoi-city-release/node_modules/playwright-core' in text,'chromium_absolute_cache':'/home/codespace/.cache/ms-playwright/' in text,'has_module_override':'ZOI_PLAYWRIGHT_MODULE' in text,'has_executable_override':'CHROMIUM_EXECUTABLE_PATH' in text})
 for m in re.finditer(r'docs/[^\s\x22\x27`<>\)]+',text):
  ref=m.group(0).rstrip(',;');seeds.append({'reader':file,'reference':ref});reference(ref,file)
while pending_json:
 file=pending_json.pop()
 if file in visited_json:continue
 visited_json.add(file);p=r/file
 if not p.is_file() or p.stat().st_size>8*1024*1024:continue
 try:value=json.loads(p.read_text())
 except (ValueError,UnicodeError):continue
 def visit(v):
  if isinstance(v,dict):
   for x in v.values():visit(x)
  elif isinstance(v,list):
   for x in v:visit(x)
  elif isinstance(v,str) and len(v)<4096:reference(v,file+' [JSON closure]')
 visit(value)
rows=[]
for file,why in sorted(keep.items()):
 p=r/file;rows.append({'path':file,**meta[file],'sha256':hashlib.sha256(p.read_bytes()).hexdigest() if p.is_file() else None,'reasons':sorted(why)})
proposal={'state':'CONSERVATIVE_PROPOSAL_ONLY_NO_EVIDENCE_REMOVAL_AUTHORIZED','commit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=r,text=True).strip(),'method':'Current tracked code literal doc inputs + bounded whole dynamic-prefix directories + recursiveJSON-reference closure. Unresolved paths and computed readers require independent review before this can authorize any removal. Keep canonical requirements, release/current summaries and all existing test fixtures in addition.','known_evidence_keep_set':rows,'known_keep_bytes':sum(x['bytes']for x in rows),'known_keep_files':len(rows),'dynamic_prefixes':dynamic,'unresolved':unresolved,'source_doc_seeds':seeds,'not_in_known_keep_set':{'files':len(evidence)-len(keep),'bytes':sum(v['bytes']for k,v in evidence.items()if k not in keep),'status':'NOT APPROVED FOR DELETION; candidate historical archive after computed-reader/link/CI review'},'archive_strategy':'One immutable historicalcommit+manifest of originalpath/blobOID/SHA256/size/source/reviewer; currentrequirements/currentaudit summaries+functionalfixture closure stayHEAD. Retired report references require pinnedhistoricalcommitlinks/index before removal. No historyrewrite/fullcheckoutcopy/newpublicreader.'}
(out/'fixture-keep-proposal.json').write_text(json.dumps(proposal,indent=2)+'\n')
(out/'portable-browser-callers.json').write_text(json.dumps({'state':'INVENTORY_ONLY_NOT_EDITED','callers':portable,'proposal':'Use root npmci pinned playwright-core via normal import; optional explicit ZOI_PLAYWRIGHT_MODULE/CHROMIUM_EXECUTABLE_PATH. Do not retire any current dependency target until all callers have been tested with replacement/overrides.','absolute_old_checkout_callers':sum(x['playwright_old_checkout']for x in portable),'cache_executable_callers':sum(x['chromium_absolute_cache']for x in portable)},indent=2)+'\n')
summary={'commit':proposal['commit'],'tracked_evidence_files':len(evidence),'tracked_evidence_bytes':sum(v['bytes']for v in evidence.values()),'duplicate_blob_groups':len(dup),'extra_same_blob_checkout_paths':sum(len(v)-1for v in dup),'extra_same_blob_checkout_bytes':sum(meta[v[0]]['bytes']*(len(v)-1)for v in dup),'known_keep_files':len(rows),'known_keep_bytes':proposal['known_keep_bytes'],'archive_candidates':proposal['not_in_known_keep_set'],'unresolved_references':len(unresolved),'hardcoded_old_browser_checkout_callers':sum(x['playwright_old_checkout']for x in portable),'tracked_wheels':[{'path':k,**v}for k,v in meta.items()if k.endswith('.whl')],'no_runtime_wheel_reference':'bounded gitgrep scripts/api/assets/.github/mobile/package*.json had none; wheel removal not performed','api_audit_evidence':'unchanged explicit404/no-store/noindex; Vercelrewrite preserved','capacity':'No load/runtime capacity test or claim; this is source/deploy/checkout hygiene only'}
(out/'inventory-summary.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary,indent=2))

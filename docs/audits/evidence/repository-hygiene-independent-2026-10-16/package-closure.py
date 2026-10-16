from pathlib import Path
import subprocess,tempfile,json,re,posixpath,hashlib,os
R=Path('/workspaces/zoi-map-studio-ops-release');E=Path('/home/codespace/.cache/zoi/repository-hygiene-independent-20261016');env={**os.environ,'GIT_OPTIONAL_LOCKS':'0'};tracked=[x.decode()for x in subprocess.check_output(['git','ls-files','-z'],cwd=R,env=env).split(b'\0')if x]
def excluded(paths):
 with tempfile.TemporaryDirectory(prefix='zoi-hygiene-package-')as d:
  p=Path(d);subprocess.run(['git','init','-q'],cwd=p,env=env,check=True);(p/'.gitignore').write_bytes((R/'.vercelignore').read_bytes());q=subprocess.run(['git','check-ignore','--no-index','-z','--stdin'],cwd=p,env=env,input=b'\0'.join(x.encode()for x in paths)+b'\0',stdout=subprocess.PIPE);assert q.returncode in[0,1];return{x.decode()for x in q.stdout.split(b'\0')if x}
ignored=excluded(tracked);source_suffix={'.html','.htm','.js','.mjs','.cjs','.ts','.css'};roots=[p for p in tracked if p not in ignored and Path(p).suffix in source_suffix and not p.startswith(('supabase/','scripts/'))];pending=list(roots);visited=set();references=set();edges=[]
patterns=[re.compile(r'''['"`]((?:\.{1,2}/|/)[^'"`\r\n]*)['"`]'''),re.compile(r'''\b(?:src|href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))''',re.I),re.compile(r'''url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s)'";]+))\s*\)''',re.I)]
while pending:
 p=pending.pop()
 if p in visited:continue
 visited.add(p);f=R/p
 if not f.is_file()or f.is_symlink()or f.suffix not in source_suffix:continue
 s=f.read_text(errors='strict');values=[]
 for regex in patterns:
  for m in regex.finditer(s):values.append(next((g for g in m.groups()if g is not None),''))
 for raw in values:
  if not raw.startswith(('/','./','../'))or raw.startswith('//'):continue
  raw=re.split('[?#]',raw,1)[0].split('${',1)[0]
  path=posixpath.normpath(raw.lstrip('/')if raw.startswith('/')else posixpath.join(posixpath.dirname(p),raw))
  if path.startswith('../')or path in ['.','..','']:continue
  candidates=[path]if Path(path).suffix else[path,*[path+x for x in ['.js','.mjs','.ts','.json','/index.js','/index.mjs','/index.ts','/index.html']]]
  for q in candidates:
   target=R/q
   if not target.is_file():continue
   references.add(q);edges.append({'from':p,'to':q})
   if target.suffix in source_suffix and q not in visited:pending.append(q)
lost=sorted(excluded(sorted(references)));result={'method':'Independent all-public-root transitive literal local references + HTML quoted/unquoted src/href + CSS quoted/unquoted url; follows all existing targets even scripts/ops/docs/supabase. No category filtering of referenced dependency targets.','roots':len(roots),'visited_source_files':len(visited),'existing_dependencies':len(references),'excluded_existing_dependencies':lost,'excluded_scripts_runtime_dependencies':[x for x in lost if x.startswith('scripts/')],'files':[{'path':p,'sha256':hashlib.sha256((R/p).read_bytes()).hexdigest()}for p in sorted(references)],'edges':edges};(E/'independent-web-package-closure.json').write_text(json.dumps(result,indent=2));print(json.dumps({k:v for k,v in result.items()if k not in['files','edges']},indent=2));assert not lost,'Excluded current runtime dependency'

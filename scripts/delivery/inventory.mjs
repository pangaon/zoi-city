import {readFileSync, readdirSync, existsSync, writeFileSync} from 'node:fs';
import {resolve, relative} from 'node:path';
import {fileURLToPath} from 'node:url';

// Reconcile source coverage without converting source presence into acceptance.
export function reconcileInventory(previous, {modules=[], surfaces=[], routes=[], workers=[], areas=[]}={}) {
 const merge=(old, current, key)=>{
  const rows=new Map((old||[]).map(row=>[row[key],{...row,source_present:false}]));
  for(const row of current)rows.set(row[key],{web:'unverified',ios:'unverified',android:'unverified',evidence:[],...rows.get(row[key]),...row,source_present:true});
  return [...rows.values()].sort((a,b)=>String(a[key]).localeCompare(String(b[key])));
 };
 return {...previous,
  modules:merge(previous.modules,modules,'id'),
  static_surfaces:merge(previous.static_surfaces,surfaces,'route'),
  dynamic_routes:merge(previous.dynamic_routes,routes,'route'),
  edge_functions:merge(previous.edge_functions,workers,'id'),
  requested_capability_areas:merge(previous.requested_capability_areas,areas,'area'),
  inventory_rule:'Source presence is inventory only. Historical status and evidence are retained; current production, rendered and exercised acceptance must be recorded separately.'};
}
export function discoverInventory(root) {
 const read=path=>readFileSync(resolve(root,path),'utf8');
 const modules=[];
 // Read only modules actually loaded by the canonical workspace.
 for(const match of read('social/index.html').matchAll(/<script\b[^>]*\bsrc=["']\/(assets\/suite\/[^"'?]+\.js)(?:\?[^"']*)?["']/g)){
  const source=match[1];
  for(const registration of read(source).matchAll(/(?:modules\s*\.\s*push\s*\(\s*\{|\bvar\s+mod\s*=\s*\{)[\s\S]*?\bid\s*:\s*['"]([^'"]+)['"]/g)){
   const id=registration[1];modules.push({id,source,route:'/social/'+id});
  }
 }
 const surfaces=[];
 const excluded=new Set(['.git','.recovery','node_modules','docs','tests','artifacts','mobile','supabase','scripts','ops']);
 const walk=dir=>{for(const entry of readdirSync(dir,{withFileTypes:true})){
  if(entry.isSymbolicLink()||entry.name.startsWith('.')||excluded.has(entry.name))continue;
  const path=resolve(dir,entry.name);
  if(entry.isDirectory())walk(path);
  else if(entry.name==='index.html'){const source=relative(root,path);surfaces.push({route:'/'+source.replace(/index\.html$/,''),source});}
 }};walk(root);
 const config=JSON.parse(read('vercel.json'));
 const routes=(config.rewrites||[]).map(row=>({route:row.source,destination:row.destination,status:'review required'}));
 const workers=readdirSync(resolve(root,'supabase/functions'),{withFileTypes:true}).filter(e=>e.isDirectory()&&existsSync(resolve(root,'supabase/functions',e.name,'index.ts'))).map(e=>({id:e.name,source:'supabase/functions/'+e.name+'/index.ts'}));
 const scope=JSON.parse(read('docs/recovery-scope.json'));
 return {modules,surfaces,routes,workers,areas:scope.scope.map(row=>({area:row.area,requirements:row.requirements}))};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const root=process.cwd(),path=resolve(root,'docs/feature-delivery-matrix.json');
 const result=reconcileInventory(JSON.parse(readFileSync(path,'utf8')),discoverInventory(root));
 result.inventory_updated_at=new Date().toISOString();
 writeFileSync(path,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({modules:result.modules.length,surfaces:result.static_surfaces.length,workers:result.edge_functions.length,areas:result.requested_capability_areas.length}));
}

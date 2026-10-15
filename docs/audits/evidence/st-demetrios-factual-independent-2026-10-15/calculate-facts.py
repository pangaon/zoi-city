from pathlib import Path
import json, hashlib, math, datetime, re
from html.parser import HTMLParser
from urllib.parse import urlsplit, parse_qs
b=Path('/home/codespace/.cache/zoi'); out=b/'st-demetrios-factual-independent-20261015'; factual=b/'st-demetrios-place-factual-20261015'; typed=b/'typed-wix-business-location-contract-20261015'
def sha(raw): return hashlib.sha256(raw).hexdigest()
def load(p): return json.loads(p.read_text())
checks=[]
for item in load(factual/'factual-preparation-manifest.json')['files']:
 p=Path(item['path']); raw=p.read_bytes(); assert len(raw)==item['bytes'] and sha(raw)==item['sha256']; checks.append({'path':str(p),'bytes':len(raw),'sha256':sha(raw)})
receipts=[]
for file,receipt in [(typed/'nj-official-721-rahway-parcel.json',typed/'nj-official-721-rahway-parcel.receipt.json'),(factual/'nj-union-municipality.json',factual/'nj-union-municipality.receipt.json'),(factual/'usps-new-jersey.html',factual/'usps-new-jersey.html.receipt.json')]:
 r=load(receipt); raw=file.read_bytes(); assert sha(raw)==r['sha256'] and len(raw)==r['bytes'] and r['status']==200 and r['url']==r['final_url']; receipts.append({'path':str(file),'sha256':sha(raw),'bytes':len(raw),'receipt_sha256':sha(receipt.read_bytes()),'retained_receipt':r})
parcel=load(typed/'nj-official-721-rahway-parcel.json'); mun=load(factual/'nj-union-municipality.json'); context=load(factual/'current-context-actual.json')[0]['jsonb_build_object']; records=load(out/'full-retained-inspection.json')['records']
assert parcel['spatialReference']['wkid']==mun['spatialReference']['wkid']==4326
assert len(parcel['features'])==len(mun['features'])==1 and not parcel.get('exceededTransferLimit') and not mun.get('exceededTransferLimit')
p=parcel['features'][0]; m=mun['features'][0]; assert p['attributes']['PCL_MUN']==m['attributes']['MUN_CODE']=='2019'
query=parse_qs(urlsplit(receipts[0]['retained_receipt']['url']).query); assert not any(k in query for k in ['geometry','spatialRel','distance']) and query['where']==["PCL_MUN='2019' AND PROP_LOC LIKE '721 RAHWAY%'"]
# Independent signed winding-number algorithm (not the source consumer's polygon helper).
def ring_winding(pt,ring):
 x,y=pt; n=0
 for (x1,y1),(x2,y2) in zip(ring,ring[1:]):
  cross=(x2-x1)*(y-y1)-(x-x1)*(y2-y1)
  if abs(cross)<1e-14 and min(x1,x2)<=x<=max(x1,x2) and min(y1,y2)<=y<=max(y1,y2): return {'boundary':True,'winding':n}
  if y1<=y<y2 and cross>0: n+=1
  elif y2<=y<y1 and cross<0: n-=1
 return {'boundary':False,'winding':n}
def contains(pt,rings):
 v=[ring_winding(pt,r) for r in rings]; return {'inside': any(r['boundary'] for r in v) or sum(r['winding'] for r in v)!=0,'rings':v}
def distance(a,c):
 lat1,lat2=math.radians(a[1]),math.radians(c[1]); dl=math.radians(c[1]-a[1]); dn=math.radians(c[0]-a[0]); z=math.sin(dl/2)**2+math.cos(lat1)*math.cos(lat2)*math.sin(dn/2)**2; return 6371008.8*2*math.atan2(math.sqrt(z),math.sqrt(1-z))
points={'typed_business_location':[records[0]['point']['longitude'],records[0]['point']['latitude']], 'published_google_destination':[records[1]['published_map_anchor']['longitude'],records[1]['published_map_anchor']['latitude']], 'cached_prior_pin':[context['snapshot']['longitude'],context['snapshot']['latitude']], 'google_viewport_only':[records[1]['published_map_anchor']['viewport_only']['longitude'],records[1]['published_map_anchor']['viewport_only']['latitude']]}
calcs={k:{'longitude':v[0],'latitude':v[1],'parcel':contains(v,p['geometry']['rings']),'municipality':contains(v,m['geometry']['rings'])} for k,v in points.items()}
assert calcs['typed_business_location']['parcel']['inside'] and calcs['published_google_destination']['parcel']['inside'] and not calcs['cached_prior_pin']['parcel']['inside']
# Control points validate winding behavior independent of actual parcel.
assert contains((.5,.5),[[(0,0),(1,0),(1,1),(0,1),(0,0)]])['inside']; assert not contains((2,.5),[[(0,0),(1,0),(1,1),(0,1),(0,0)]])['inside']
class USPS(HTMLParser):
 def __init__(self): super().__init__(convert_charrefs=True); self.rows=[]; self.row=None; self.stack=[]
 def handle_starttag(self,t,a):
  if t=='tr': self.row=[]
 def handle_data(self,d):
  if self.row is not None: self.row.append(d)
 def handle_endtag(self,t):
  if t=='tr' and self.row is not None: self.rows.append(' '.join(' '.join(self.row).split())); self.row=None
u=USPS(); u.feed((factual/'usps-new-jersey.html').read_text()); rows=[r for r in u.rows if re.search(r'\bUNION\b',r) and re.search(r'\b07083\b',r)]; assert rows==['UNION 1130 W CHESTNUT ST UNION NJ 07083'],rows
cards=[]
rawdir=Path('/home/codespace/.codex/private-evidence/zoi-global-geography/2026-10-14/durable-jobs/batch-0002')
for entry in load(out/'visible-cards.json'):
 card=next(c for c in entry['natural_bounded_cards'] if c.get('id')=='comp-lebnryg7'); raw=(rawdir/(entry['source_sha256']+'.source.html')).read_bytes(); fragment=raw[card['start_byte']:card['end_byte']]; assert len(fragment)==card['bytes']==1648 and sha(fragment)==card['sha256']; cards.append({k:v for k,v in card.items() if k not in ['raw','visible']}|{'text':card['visible'],'source_sha256':entry['source_sha256']})
res={'reviewer':'/root/owner_next','mode':'retained bytes only; zero external requests or SQL actions','manifest_files_rehashed':checks,'receipt_files_rehashed':receipts,'parcel':{'attributes':p['attributes'],'parcel_publication_UTC':datetime.datetime.fromtimestamp(p['attributes']['PCL_PBDATE']/1000,datetime.timezone.utc).isoformat(),'rings':p['geometry']['rings'],'selection_query':query,'independent_of_point_selection':True},'municipality':{'attributes':m['attributes'],'ring_count':len(m['geometry']['rings']),'vertices':sum(map(len,m['geometry']['rings']))},'containment_method':'Independent Python signed winding number on exact WGS84 longitude/latitude rings; boundary separately detected, none of reviewed points on edge. Not geodetic survey precision.','points':calcs,'distances_metres':{'typed_to_google_destination':distance(points['typed_business_location'],points['published_google_destination']),'cached_prior_to_typed':distance(points['cached_prior_pin'],points['typed_business_location'])},'usps_visible_row':rows[0],'usps_scope':'Union/NJ/baseZIP07083 contextual corroboration only; row concerns 1130 W CHESTNUT ST, not church721 and not ZIP+4 extension6689. Historical2022 news page.','natural_identity_cards':cards,'cached_context':{'captured_at':context['captured_at'],'listing_id':context['snapshot']['id'],'snapshot_sha256':sha((factual/'current-context-actual.json').read_bytes()),'cached_database_snapshot':context['snapshot']['database_snapshot'],'cached_listing_source_fingerprint':context['snapshot']['source_fingerprint'],'cached_job_input':context['job']['input_fingerprint'],'cached_job_source_json_sha256':context['job']['source_json_sha256'],'cached_capture_result_hash':context['job']['capture_result_hash'],'job_captured_at':context['job']['captured_at'],'archive_count':len(context['archive']),'private_archive_present':bool(context['job']['source'].get('private_archive')),'fresh_authority':False}}
(out/'calculated-facts.json').write_text(json.dumps(res,ensure_ascii=False,indent=2)+'\n'); print(json.dumps({'distance':res['distances_metres'],'points':calcs,'usps':rows,'cards':cards},ensure_ascii=False,indent=2))

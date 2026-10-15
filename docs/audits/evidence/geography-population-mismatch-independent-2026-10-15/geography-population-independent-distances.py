from pathlib import Path
import json,math,unicodedata,hashlib
p=Path('/home/codespace/.cache/zoi/geography-population-mismatch-private-20261015');snap=json.load(open(p/'population-snapshot.json'));report=json.load(open('/home/codespace/.cache/zoi/geography-population-independent-report.json'));exact=lambda s:' '.join(unicodedata.normalize('NFKC',s.strip()).lower().split())
needed={r['reference_city']['geonames_id'] for r in report['private_records'] if 'reference_city'in r};places={}
for line in open(p/'cities1000.txt'):
 f=line.rstrip('\n').split('\t')
 if int(f[0])in needed:places[int(f[0])]=(float(f[4]),float(f[5]),f[8])
assert set(places)==needed
rows={r['id']:r for r in snap['rows']};verified=0;far=0
for r in report['private_records']:
 if 'reference_city'not in r:continue
 anchor=r['reference_city'];row=rows[r['listing_id']];lat,lng,code=places[anchor['geonames_id']];a,b=map(math.radians,[float(row['latitude']),lat]);dl=math.radians(lng-float(row['longitude']));dlat=b-a;v=math.sin(dlat/2)**2+math.cos(a)*math.cos(b)*math.sin(dl/2)**2;km=6371.0088*2*math.asin(math.sqrt(max(0,min(1,v))));assert abs(km-anchor['distance_km'])<=.000501;assert code==anchor['country'];assert (km>=100)==('point_far_from_unique_declared_city_reference'in r['flags']);verified+=1;far+=km>=100
assert verified==9484 and far==159
for b in report['buckets'].values():assert b['assessable']+b['unassessed']==37903 and b['flagged']+b['unflagged']==b['assessable'] and sum(b['unassessed_reasons'].values())==b['unassessed']
union=sum(bool(r['flags'])for r in report['private_records']);assert union==1291
out={'independent_Python_spherical_distances_checked':verified,'unique_far_city_suspicions':far,'unique_suspect_union':union,'all_bucket_denominators':37903,'authoritative_address_or_boundary_verifications':0,'actual_corrections':0,'writes':0};Path('/home/codespace/.cache/zoi/geography-population-independent-distances.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out))

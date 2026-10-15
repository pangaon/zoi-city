import sys,json,time
from pathlib import Path
sys.path.insert(0,'/home/codespace/.cache/zoi/native-recovery-20261015');import control as c
c.out=Path('/home/codespace/.cache/zoi/native-seventh-root-20261015');results=[]
def target(r,label):
 ns=[n for n in r.iter('node')if n.get('text')==label or n.get('content-desc')==label]
 for n in sorted(ns,key=lambda n:n.get('clickable')!='true'):
  try:
   a=c.bounds(n)
   if 0<=a[0]<a[2]<=1080 and 100<=a[1]<a[3]<=2350:return n
  except RuntimeError:pass
 raise RuntimeError('No visible positive target: '+label)
c.run('shell','am','start','-W','-a','android.intent.action.VIEW','-d','zoi://explore/map?place=hellenic-bakery-grocery-livonia','com.usgreekscan.zoi');time.sleep(2)
r=c.dump('before-hot-font',True);assert c.find(r,'Hellenic Bakery & Grocery') is not None
try:
 for scale in ['2.0','1.0']:
  c.run('shell','settings','put','system','font_scale',scale);r=c.dump('hot-font-'+scale,True);assert c.run('shell','settings','get','system','font_scale').strip()==scale
  assert c.find(r,'Hellenic Bakery & Grocery') is not None,'Selected place lost after font '+scale
  for name in ['Expand map','All sections']:target(r,name)
  c.tap(target(r,'Expand map'));r=c.dump('hot-expanded-'+scale,True);target(r,'Close full-screen map');texts=[n.get('text')or n.get('content-desc')for n in r.iter('node')if(n.get('text')or n.get('content-desc'))];assert 'Main navigation'not in texts
  c.tap(target(r,'Close full-screen map'));r=c.dump('hot-restored-'+scale,True);assert c.find(r,'Hellenic Bakery & Grocery') is not None,'Selected place lost after Close';target(r,'All sections');c.tap(target(r,'All sections'));r=c.dump('hot-more-'+scale,True);texts=[n.get('text')or n.get('content-desc')for n in r.iter('node')if(n.get('text')or n.get('content-desc'))];assert any('All sections'in t for t in texts);c.run('shell','input','keyevent','4');r=c.dump('hot-more-closed-'+scale)
  results.append({'scale':scale,'expand_close_more_back':True,'selected_context':'Hellenic retained; full long content scroll atfont2, not allactions inoneviewport'})
finally:
 c.run('shell','settings','put','system','font_scale','1.0');(c.out/'hot-font-result.json').write_text(json.dumps({'results':results,'restored_font':c.run('shell','settings','get','system','font_scale').strip()},indent=2)+'\n')
print(json.dumps(results))

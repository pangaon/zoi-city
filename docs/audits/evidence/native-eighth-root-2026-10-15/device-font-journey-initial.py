import sys,time,json
from pathlib import Path
sys.path.insert(0,'/home/codespace/.cache/zoi/native-recovery-20261015')
import control as c
c.out=Path('/home/codespace/.cache/zoi/native-eighth-root-20261015')
RESULT=[]
def shot(name):
 r=c.dump(name,True)
 (c.out/(name+'-texts.json')).write_text(json.dumps([n.attrib for n in r.iter('node') if n.get('text') or n.get('content-desc')],indent=2)+'\n')
 return r
def visible(r,label):
 nodes=[n for n in r.iter('node') if n.get('text')==label or n.get('content-desc')==label]
 for n in sorted(nodes,key=lambda n:n.get('clickable')!='true'):
  try:
   a=c.bounds(n)
   if 0<=a[0]<a[2]<=1080 and 95<=a[1]<a[3]<=2350:return n
  except RuntimeError:pass
 raise RuntimeError('No visible positive target: '+label)
def wait(label,name,tries=8):
 for i in range(tries):
  r=c.dump(name+'-wait-'+str(i))
  try:visible(r,label);return r
  except RuntimeError:
   if i==tries-1:raise
   time.sleep(1)
def tap(label,name):
 r=c.dump(name+'-target');c.tap(visible(r,label));time.sleep(.7);return shot(name)
def settings_font_max(name):
 c.run('shell','am','start','-W','-a','android.settings.TEXT_READING_SETTINGS');r=shot(name+'-settings')
 n=next((n for n in r.iter('node')if n.get('class')=='android.widget.SeekBar' and n.get('content-desc')=='Font size'),None)
 if n is None:raise RuntimeError('Normal Settings Font size slider absent')
 a=c.bounds(n);c.run('shell','input','tap',a[2]-20,(a[1]+a[3])//2);time.sleep(.6)
 assert c.run('shell','settings','get','system','font_scale').strip()=='2.0'
 shot(name+'-settings-max');c.run('shell','input','keyevent','4');time.sleep(.8)
 return shot(name+'-returned')
def open_map():
 c.run('shell','am','start','-W','-a','android.intent.action.VIEW','-d','zoi://explore/map?place=hellenic-bakery-grocery-livonia','com.usgreekscan.zoi')
 wait('Hellenic Bakery & Grocery','selected');return shot('selected-font1')
def more(name):
 r=tap('All sections',name)
 for label in ['Home','Discover','Community','Events','Grow']:visible(r,label)
 return r
try:
 assert c.run('shell','settings','get','system','font_scale').strip()=='1.0'
 r=open_map();r=tap('Expand map','expanded-font1');visible(r,'Close expanded map')
 r=settings_font_max('map-hot-font2');visible(r,'Close expanded map')
 r=tap('Close expanded map','normal-font2-after-close');visible(r,'Expand map');assert c.find(r,'Hellenic Bakery & Grocery')is not None
 r=tap('Expand map','expanded-again-font2');visible(r,'Close expanded map')
 r=tap('Close expanded map','normal-again-font2');assert c.find(r,'Hellenic Bakery & Grocery')is not None
 r=more('all-sections-font2');r=tap('Home','home-font2');r=more('home-more-font2');r=tap('Discover','discover-restored-font2');assert c.find(r,'Hellenic Bakery & Grocery')is not None
 RESULT.append({'map_hot_settings_font2':'selected place retained through close/reexpand/Home/Discover; visual clipping review required'})
 c.run('shell','settings','put','system','font_scale','1.0');time.sleep(.5)
 more('form-more-font1');tap('Grow','grow-font1')
 for i in range(8):
  r=c.dump('form-find-'+str(i))
  try:n=visible(r,'Email address');break
  except RuntimeError:
   if i==7:raise
   c.run('shell','input','swipe',800,1920,800,670,450);time.sleep(.4)
 c.tap(n);c.run('shell','input','text','zoi-layout-only@example.invalid');c.run('shell','input','keyevent','4');shot('form-entered-font1')
 r=settings_font_max('form-hot-font2')
 for i in range(8):
  if any(n.get('text')=='zoi-layout-only@example.invalid' for n in r.iter('node')):break
  if i==7:raise RuntimeError('Typed form value missing after normal Settings font2')
  c.run('shell','input','swipe',800,1920,800,670,450);time.sleep(.4);r=shot('form-font2-scroll-'+str(i))
 shot('form-preserved-font2');RESULT.append({'form_hot_settings_font2':'Unsubmitted email input preserved; labels/clipping require visual review; no submit or code-send control pressed'})
finally:
 c.run('shell','settings','put','system','font_scale','1.0')
 (c.out/'device-journey-result.json').write_text(json.dumps({'completed_steps':RESULT,'restored_font':c.run('shell','settings','get','system','font_scale').strip(),'visual_acceptance':'pending root inspection'},indent=2)+'\n')
print(json.dumps(RESULT))

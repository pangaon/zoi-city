from pathlib import Path
import sys,json,time
sys.path.insert(0,'/home/codespace/.cache/zoi/native-recovery-20261015');import control as c
c.out=Path('/home/codespace/.cache/zoi/native-sixth-independent-20261015')
print(c.run('shell','am','start','-W','-a','android.intent.action.VIEW','-d','zoi://explore/map?place=hellenic-bakery-grocery-livonia'))
time.sleep(3)
r=c.dump('hellenic-map-first',True);print('FIRST',[(n.get('text'),n.get('content-desc'),n.get('bounds'))for n in r.iter('node')if n.get('text')or n.get('content-desc')][:85])
for label in ['Zoom in','Expand map']:
 n=c.find(r,label);c.tap(n);r=c.dump('hellenic-'+('zoomed'if label=='Zoom in'else'expanded'),True)
 print(label,[(n.get('text'),n.get('content-desc'),n.get('bounds'))for n in r.iter('node')if n.get('text')or n.get('content-desc')][:70])
c.run('shell','input','keyevent','4');r=c.dump('hellenic-hardware-back-restored',True);print('RESTORED',[(n.get('text'),n.get('content-desc'),n.get('bounds'))for n in r.iter('node')if n.get('text')or n.get('content-desc')][:70])

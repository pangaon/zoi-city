import sys,time,json
from pathlib import Path
sys.path.insert(0,'/home/codespace/.cache/zoi/native-recovery-20261015');import control as c
c.out=Path('/home/codespace/.cache/zoi/native-seventh-independent-20261015')
results=[]
def texts(r):return [n.get('text')or n.get('content-desc')for n in r.iter('node')if n.get('text')or n.get('content-desc')]
def snap(name):
 r=c.dump(name,True);(c.out/(name+'-dumpsys.txt')).write_text(c.run('shell','dumpsys','location'));return r
def begin(name):
 r=c.dump(name+'-before');c.tap(c.find(r,'Use my location once'));time.sleep(.6)
 (c.out/(name+'-registered-dumpsys.txt')).write_text(c.run('shell','dumpsys','location'))
 r=snap(name+'-locating');assert 'Finding your device location…'in texts(r),texts(r);return r
r=c.dump('gps-ready-before-hide');assert c.find(r,'Hide location') is not None;c.tap(c.find(r,'Hide location'));r=snap('gps-hidden');assert not any('one-time snapshot'in t for t in texts(r));results.append('Hide location clears existing snapshot')
r=begin('gps-cancel');c.tap(c.find(r,'Cancel'));c.run('emu','geo','fix','-83.374111','42.426111');time.sleep(.5);r=snap('gps-cancel-late-fix');assert 'Optional · used on this map only'in texts(r);assert not any('one-time snapshot'in t for t in texts(r));results.append('Explicit cancel unregisters and ignores later emulator fix')
time.sleep(1.2)
r=begin('gps-background');c.run('shell','input','keyevent','3');time.sleep(.3);(c.out/'gps-background-away-dumpsys.txt').write_text(c.run('shell','dumpsys','location'));c.run('emu','geo','fix','-83.375111','42.427111');c.run('shell','am','start','-W','-n','com.usgreekscan.zoi/.MainActivity');r=snap('gps-background-return');assert 'Optional · used on this map only'in texts(r);assert not any('one-time snapshot'in t for t in texts(r));assert 'Hellenic Bakery & Grocery'in texts(r);results.append('Background cancels watch; resume ignores later emulator fix and keeps selected place')
(c.out/'gps-lifecycle-result.json').write_text(json.dumps({'passed':results},indent=2)+'\n');print(json.dumps(results))

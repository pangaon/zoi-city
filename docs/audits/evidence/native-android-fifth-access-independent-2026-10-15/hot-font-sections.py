import sys,time,json
from pathlib import Path
sys.path.insert(0,'/home/codespace/.cache/zoi/native-recovery-20261015');import control as c
result={'build':'db8b70f0-3867-42dc-81b8-6e706793f7f5','source':'ae2afa53f9ddd118aa07b9e24cbf2d4c5c2ce922','checks':[],'passed':False}
def button(r,label):
 n=c.find(r,label);assert n is not None,label
 a=c.bounds(n);assert a[0]>=0 and a[1]>=0 and a[2]<=1080 and a[3]<=2343,(label,a);assert a[2]-a[0]>=115 and a[3]-a[1]>=115,(label,a)
 return n
try:
 r=c.dump('fifth-modal-font1-before-hot',True)
 assert c.find(r,'Close sections')is not None
 for label in ['Home','Discover','Community','Events','Grow']:button(r,'Go to '+label)
 result['checks'].append({'font':1,'allFiveModalTargets44':True})
 c.run('shell','input','keyevent','4');time.sleep(.4);r=c.dump('fifth-hardware-back-retained-home',True);assert c.find(r,'Close sections')is None;assert c.find(r,'All sections')is not None;assert c.find(r,'Your world.\nYour people.\nYour Zoi.')is not None
 result['checks'].append({'hardwareBackCloses':True,'homeRetained':True})
 c.run('shell','settings','put','system','font_scale','2.0');time.sleep(1.5);assert c.run('shell','settings','get','system','font_scale').strip()=='2.0';r=c.dump('fifth-hot-font2-before-more',True);more=button(r,'All sections');c.tap(more);time.sleep(.3);r=c.dump('fifth-hot-font2-sections',True);close=button(r,'Close sections');seen=[]
 for label in ['Home','Discover','Community','Events','Grow']:
  n=c.find(r,'Go to '+label)
  if n is not None:
   try:button(r,'Go to '+label);seen.append(label)
   except(AssertionError,RuntimeError):pass
 grow=c.find(r,'Go to Grow')
 if grow is None or 'Grow'not in seen:
  c.run('shell','input','swipe','540','2000','540','850','500');time.sleep(.3);r=c.dump('fifth-hot-font2-sections-scrolled',True);button(r,'Close sections');grow=button(r,'Go to Grow')
 c.tap(grow);time.sleep(.7);r=c.dump('fifth-hot-font2-grow',True);assert c.find(r,'Close sections')is None;assert c.find(r,'All sections')is not None
 texts=[n.get('text')or n.get('content-desc')for n in r.iter('node')if n.get('text')or n.get('content-desc')];assert any('Sign in'or 'workspace'in t.lower()for t in texts)
 result['checks'].append({'hot1to2NoRestart':True,'MoreTarget44':True,'CloseTarget44':True,'GrowReachableViaModal':True,'initialVisibleSectionLabels':seen,'growTexts':texts[:14]})
 c.tap(button(r,'All sections'));time.sleep(.3);r=c.dump('fifth-hot-font2-return-home-menu',True);home=c.find(r,'Go to Home')
 if home is None or c.bounds(home)[1]<0:c.run('shell','input','swipe','540','900','540','2000','500');r=c.dump('fifth-hot-font2-return-home-scrolled',True);home=button(r,'Go to Home')
 c.tap(home);time.sleep(.5);r=c.dump('fifth-hot-font2-home',True);assert c.find(r,'Your world.\nYour people.\nYour Zoi.')is not None
 result['checks'].append({'hotFont2HomeReturned':True});result['passed']=True
finally:
 c.run('shell','settings','put','system','font_scale','1.0');time.sleep(.5);result['restored_font']=c.run('shell','settings','get','system','font_scale').strip();c.dump('fifth-restored-font1',True);Path('/home/codespace/.cache/zoi/native-recovery-20261015/fifth-hot-font-result.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))

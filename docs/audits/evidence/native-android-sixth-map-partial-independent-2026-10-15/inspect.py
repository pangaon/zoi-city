from pathlib import Path
import sys,json
sys.path.insert(0,'/home/codespace/.cache/zoi/native-recovery-20261015')
import control as c
c.out=Path('/home/codespace/.cache/zoi/native-sixth-independent-20261015')
r=c.dump('map-before',True)
state={k:c.run('shell','settings','get',*v).strip() for k,v in {'font':['system','font_scale'],'location_mode':['secure','location_mode'],'rotation':['system','user_rotation'],'accelerometer':['system','accelerometer_rotation']}.items()};state['size']=c.run('shell','wm','size').strip();state['density']=c.run('shell','wm','density').strip();(c.out/'initial-settings.json').write_text(json.dumps(state,indent=2))
print(json.dumps(state));print([(n.get('text'),n.get('content-desc'),n.get('bounds')) for n in r.iter('node')if n.get('text')or n.get('content-desc')][:70])
n=c.find(r,'Map');c.tap(n)
r=c.dump('map-first',True)
print([(n.get('text'),n.get('content-desc'),n.get('bounds')) for n in r.iter('node')if n.get('text')or n.get('content-desc')][:100])

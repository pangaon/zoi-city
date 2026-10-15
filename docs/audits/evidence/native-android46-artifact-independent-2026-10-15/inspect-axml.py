from pathlib import Path
import struct,json
p=Path('/home/codespace/.cache/zoi/android46-independent/AndroidManifest.xml');b=p.read_bytes();u16=lambda a:struct.unpack_from('<H',b,a)[0];u32=lambda a:struct.unpack_from('<I',b,a)[0];strings=[];els=[];off=8
while off<len(b):
 typ=u16(off);head=u16(off+2);size=u32(off+4);assert size>=head and size>0 and off+size<=len(b)
 if typ==1:
  n=u32(off+8);flags=u32(off+16);start=off+u32(off+20)
  def l8(a):
   v=b[a];return (((v&127)<<8)|b[a+1],a+2)if v&128 else(v,a+1)
  def l16(a):
   v=u16(a);return (((v&32767)<<16)|u16(a+2),a+4)if v&32768 else(v,a+2)
  for i in range(n):
   a=start+u32(off+head+i*4)
   if flags&256:
    _,a=l8(a);length,a=l8(a);strings.append(b[a:a+length].decode())
   else:
    length,a=l16(a);strings.append(b[a:a+length*2].decode('utf-16le'))
 if typ==0x102:
  ext=off+16;name=strings[u32(ext+4)];start=u16(ext+8);stride=u16(ext+10);count=u16(ext+12);attrs={}
  for i in range(count):
   a=ext+start+i*stride;k=strings[u32(a+4)];raw=u32(a+8);t=b[a+15];v=u32(a+16)
   value=strings[raw]if raw!=0xffffffff else strings[v]if t==3 else bool(v)if t==18 else v
   attrs[k]=value
  els.append({'element':name,'attributes':attrs})
 off+=size
assert off==len(b)
selected=[e for e in els if e['element']in ['manifest','uses-sdk','uses-permission','application','meta-data']];Path('/home/codespace/.cache/zoi/android46-independent/manifest-summary.json').write_text(json.dumps(selected,indent=2)+'\n')
for e in selected:
 if e['element']!='meta-data' or any(s in str(e['attributes'].get('name'))for s in ['expo.modules.updates','expo.modules.ReactActivityDelegate']):print(json.dumps(e))

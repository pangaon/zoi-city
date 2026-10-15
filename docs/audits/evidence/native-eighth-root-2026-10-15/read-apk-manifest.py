from pathlib import Path
import struct,zipfile,json
b=zipfile.ZipFile('/home/codespace/.cache/zoi/android-scale-text-eighth-4ef20e5f.apk').read('AndroidManifest.xml');u16=lambda o:struct.unpack_from('<H',b,o)[0];u32=lambda o:struct.unpack_from('<I',b,o)[0];strings=[];at=8;activities=[]
def length(o,wide=False):
 v=u16(o)if wide else b[o];o+=2 if wide else 1
 if v&(0x8000 if wide else 0x80):v=((v&(0x7fff if wide else 0x7f))<<(16 if wide else 8))|(u16(o)if wide else b[o]);o+=2 if wide else 1
 return v,o
while at<len(b):
 typ=u16(at);hs=u16(at+2);size=u32(at+4);assert size>=hs and at+size<=len(b)
 if typ==1:
  count=u32(at+8);utf8=bool(u32(at+16)&0x100);start=u32(at+20)
  for i in range(count):
   o=at+start+u32(at+hs+i*4)
   if utf8:_,o=length(o);n,o=length(o);strings.append(b[o:o+n].decode('utf8'))
   else:n,o=length(o,True);strings.append(b[o:o+n*2].decode('utf-16-le'))
 elif typ==0x102:
  name=strings[u32(at+20)];astart=u16(at+24);asz=u16(at+26);cnt=u16(at+28);attrs={}
  for i in range(cnt):
   p=at+16+astart+i*asz;key=strings[u32(p+4)];raw=u32(p+8);dt=b[p+15];value=u32(p+16);attrs[key]=strings[raw]if raw!=0xffffffff else strings[value]if dt==3 else value
  if name=='activity':activities.append(attrs)
 at+=size
out={'activities':activities};Path('/home/codespace/.cache/zoi/native-eighth-root-20261015/packaged-manifest-activities.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps([a for a in activities if a.get('name','').endswith('MainActivity')],indent=2))

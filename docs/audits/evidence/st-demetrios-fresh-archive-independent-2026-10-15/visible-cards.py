from pathlib import Path
from html.parser import HTMLParser
import json,re,hashlib
root=Path('/home/codespace/.cache/zoi/st-demetrios-fresh-independent-20261015');out=root
class Inspect(HTMLParser):
 def __init__(self,text):super().__init__(convert_charrefs=True);self.text=text;self.lines=text.splitlines(keepends=True);self.starts=[0];self.stack=[];self.nodes=[];self.data=[];self.start=0
 def pos(self):l,c=self.getpos();return sum(map(len,self.lines[:l-1]))+c
 def handle_starttag(self,t,attrs):
  d=dict(attrs);hidden=any(x['hidden']for x in self.stack)or t in ['script','style','template','noscript','svg']or 'hidden'in d or d.get('aria-hidden')=='true'or bool(re.search(r'display\s*:\s*none|visibility\s*:\s*hidden',d.get('style',''),re.I));n={'tag':t,'id':d.get('id'),'start':self.pos(),'texts':[],'hidden':hidden}
  if t not in ['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']:self.stack.append(n)
 def handle_endtag(self,t):
  at=next((i for i in range(len(self.stack)-1,-1,-1)if self.stack[i]['tag']==t),None)
  if at is None:return
  end=self.text.find('>',self.pos())+1
  for n in self.stack[at:]:n['end']=end;self.nodes.append(n)
  self.stack=self.stack[:at]
 def handle_data(self,data):
  if not self.stack or self.stack[-1]['hidden']:return
  for n in self.stack:n['texts'].append(data)
  if re.search(r'Demetrios|721|Rahway|07083',data,re.I):self.data.append({'start':self.pos(),'text':data.strip()})
res=[]
for sha in ['c3085c5ff71bb04e68fdb84e26e62cfc2d9cc4aa773d2334e9387c5e83437524','6d8270fa50559adcfa0af2ab1637d76d0cb4ff98de1cbd5bdd003f6ea6993667']:
 b=(root/(sha+'.source.html')).read_bytes();assert hashlib.sha256(b).hexdigest()==sha;text=b.decode('utf-8');p=Inspect(text);p.feed(text);cards=[]
 for n in p.nodes:
  visible=' '.join(' '.join(n['texts']).split());raw=text[n['start']:n['end']];size=len(raw.encode());
  if size<=8192 and re.search(r'St[.]?\s+Demetrios\s+Greek\s+Orthodox\s+Church',visible,re.I)and'721'in visible and'rahway'in visible.lower()and'union'in visible.lower():cards.append({'tag':n['tag'],'id':n['id'],'start_byte':len(text[:n['start']].encode()),'end_byte':len(text[:n['end']].encode()),'bytes':size,'sha256':hashlib.sha256(raw.encode()).hexdigest(),'visible':visible,'raw':raw})
 cards.sort(key=lambda x:x['bytes']);r={'source_sha256':sha,'visible_identity_text_fragments':p.data,'natural_bounded_cards':cards};res.append(r);print(sha,'fragments',p.data[:20],'cards',[(x['tag'],x['id'],x['bytes'],x['visible'][:250])for x in cards[:3]])
(out/'visible-cards.json').write_text(json.dumps(res,indent=2)+'\n')

from html.parser import HTMLParser
from pathlib import Path
import json,re,hashlib
base=Path('/home/codespace/.cache/zoi/food-visible-branch-private-20261015'); menus=Path('/home/codespace/.cache/zoi/food-three-client-proposals-private-20261015/targeted-menus');tree=Path('/tmp/zoi-reviewed-visible-food');audit=json.loads((tree/'docs/audits/food-visible-branch-owner-2026-10-15.json').read_text());sha=lambda b:hashlib.sha256(b).hexdigest()
assert sha((tree/'docs/audits/food-visible-branch-owner-2026-10-15.json').read_bytes())=='1a7b92afd3d852df158d4365a8a305d62c9feb1c0627f08e9d668b2774c11a07'
for p,h in audit['owned_files'].items():assert sha((tree/p).read_bytes())==h,p
assert sha((tree/'supabase/migrations/20261015143259_reviewed_food_public_context.sql').read_bytes())=='25328681ac6b3ae3921474945a602d2156c600e192373e8f10722e7f3433d240'
manifest=base/'v3/manifest.json';assert sha(manifest.read_bytes())==audit['private_evidence']['manifest_sha256']
for p,h in json.loads(manifest.read_text()).items():assert sha((base/p).read_bytes())==h,p
checked=[]
for s in audit['source_documents']:
 for d in s['documents']:
  p=(base if d['kind']=='raw_branch_homepage' else menus)/(d['sha256']+'.source.html');b=p.read_bytes();assert len(b)==d['bytes'];assert sha(b)==d['sha256'];checked.append({'url':d['url'],'sha256':sha(b),'bytes':len(b)})
class Parse(HTMLParser):
 def __init__(self):super().__init__(convert_charrefs=True);self.stack=[];self.nodes=[];self.body=[];self.links=[]
 def handle_starttag(self,tag,attrs):
  a=dict(attrs);hide=(self.stack[-1]['hidden']if self.stack else False)or tag in ['head','script','style','noscript','template']or 'hidden'in a or a.get('aria-hidden','').lower()=='true'or bool(re.search(r'display\s*:\s*none|visibility\s*:\s*hidden',a.get('style',''),re.I));n={'tag':tag,'attrs':a,'hidden':hide,'parts':[]};self.nodes.append(n)
  if tag=='a'and not hide:self.links.append(a.get('href'))
  if tag not in ['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']:self.stack.append(n)
 def handle_endtag(self,tag):
  for i in range(len(self.stack)-1,-1,-1):
   if self.stack[i]['tag']==tag:self.stack=self.stack[:i];break
 def handle_data(self,data):
  if self.stack and not self.stack[-1]['hidden']:
   self.body.append(data)
   for node in self.stack:
    if not node['hidden']:node['parts'].append(data)
 def text(self,node):return ' '.join(''.join(node['parts']).split())
report=json.loads((base/'v3/three-kretans-candidate.json').read_text());review=json.loads((base/'v3/three-kretans-source-review.json').read_text());home=Parse();home.feed((base/(review['branch_document_sha256']+'.source.html')).read_text());menu=Parse();menu.feed((menus/(review['menu_document_sha256']+'.source.html')).read_text());body=' '.join(' '.join(home.body).split())
for field,quote in review['quotes'].items():assert quote in body,(field,quote)
from urllib.parse import urljoin
assert review['menu_document_url']in[urljoin(review['branch_document_url'],x)for x in home.links if x]
fields={}
for node in menu.nodes:
 key=node['attrs'].get('data-aid','')
 if key and not node['hidden']:
  fields.setdefault(key,[]).append(menu.text(node))
assert any(n['tag']in['h1','h2','h3','h4','h5','h6']and menu.text(n).lower()=='lunch menu'for n in menu.nodes)
raw=[];sections={}
for node in menu.nodes:
 key=node['attrs'].get('data-aid','');m=re.fullmatch(r'MENU_SECTION(\d+)_ITEM(\d+)_TITLE',key)
 if not m or node['hidden']:continue
 si,ii=m.groups();basekey=f'MENU_SECTION{si}_ITEM{ii}'
 vals={}
 for name,suffix in [('name','TITLE'),('price','PRICE'),('note','DESC')]:
  values=fields[basekey+'_'+suffix];assert len(values)==1;vals[name]=values[0]
 if si not in sections:
  assert len(fields['MENU_SECTION_TITLE_'+si])==1;sections[si]={'section':fields['MENU_SECTION_TITLE_'+si][0],'items':[]};raw.append(sections[si])
 sections[si]['items'].append(vals)
assert raw==report['profile']['menu'];assert len(raw)==1 and sum(len(s['items'])for s in raw)==17
assert all(re.fullmatch(r'\d+(?:[.,]\d{1,2})?',x['price'])for s in raw for x in s['items'])
result={'owner_sources_verified':len(audit['owned_files']),'v3_private_evidence_verified':len(json.loads(manifest.read_text())),'six_raw_documents':checked,'three_kretans_literal_branch_quotes_and_menu_link':True,'sections':1,'items':17,'all_name_price_note_fields_and_order_equal':True,'source_currency_inferred':False,'scope':'Published Lunch menu only; no dinner/catering/hours/media/provider/whole-home acceptance. Pascal and Pyrgos remain held.','menu':raw}
p=Path('/home/codespace/.cache/zoi/food-visible-independent/raw-result.json');p.write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n');print(json.dumps({k:v for k,v in result.items()if k not in['menu','six_raw_documents']}))

"""Bounded HTTP/XML evidence; does not claim Google's indexing has recovered."""
import concurrent.futures, datetime, html, json, pathlib, re, subprocess, sys, tempfile
import urllib.parse, xml.etree.ElementTree as ET

origin = 'https://www.zoi.city'
def probe(url):
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != 'https' or parsed.hostname != 'www.zoi.city':
        raise ValueError('Only the authorized public production origin is allowed')
    encoded = urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, urllib.parse.quote(parsed.path, safe='/%-._~'), parsed.query, ''))
    with tempfile.TemporaryDirectory() as folder:
        headers, body = pathlib.Path(folder)/'headers', pathlib.Path(folder)/'body'
        p = subprocess.run(['curl','-sS','-L','--max-redirs','4','--max-time','25','-D',str(headers),'-o',str(body),'-w','%{http_code} %{time_total} %{url_effective}',encoded], capture_output=True, text=True)
        fields = p.stdout.split(' ',2)
        result = {'url':url,'checked_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':int(fields[0]) if fields and fields[0].isdigit() else 0,'elapsed_s':float(fields[1]) if len(fields)>1 else None,'final_url':fields[2] if len(fields)>2 else None,'curl_exit':p.returncode}
        raw_headers = headers.read_text() if headers.exists() else ''
        result['response_chain'] = [int(s) for s in re.findall(r'^HTTP/\S+ (\d+)',raw_headers,re.M)]
        result['headers'] = {k.lower():v.strip() for k,v in re.findall(r'^([\w-]+):([^\r\n]+)',raw_headers,re.M) if k.lower() in ['content-type','x-robots-tag','x-vercel-id','x-vercel-cache','location','age']}
        text = body.read_text(errors='replace') if body.exists() else ''
        result['bytes'] = len(text.encode())
        result['title'] = html.unescape(m.group(1)) if (m:=re.search(r'<title>(.*?)</title>',text,re.S|re.I)) else None
        result['canonical'] = html.unescape(m.group(1)) if (m:=re.search(r'<link\b[^>]*rel=[\"\']canonical[\"\'][^>]*href=[\"\']([^\"\']+)',text,re.I)) else None
        result['noindex'] = bool(re.search(r'<meta[^>]*name=[\"\']robots[\"\'][^>]*content=[\"\'][^\"\']*noindex',text,re.I)) or 'noindex' in result['headers'].get('x-robots-tag','')
        if '.xml' in parsed.path and result['status']==200:
            try:
                root=ET.fromstring(text)
                result['xml_root']=root.tag
                result['locations']=[e.text for e in root.findall('.//{http://www.sitemaps.org/schemas/sitemap/0.9}loc')]
                result['duplicates']=len(result['locations'])-len(set(result['locations']))
                result['foreign_urls']=[u for u in result['locations'] if urllib.parse.urlsplit(u).netloc!='www.zoi.city']
            except ET.ParseError as e: result['xml_error']=str(e)
        if p.returncode: result['error']=p.stderr.strip()
        return result

if __name__=='__main__':
    input_path=pathlib.Path(sys.argv[1])
    output_path=pathlib.Path(sys.argv[2])
    urls=[u.strip() for u in input_path.read_text().splitlines() if u.strip()]
    records=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        for result in pool.map(probe,urls):
            records.append(result)
            output_path.write_text(json.dumps(records,ensure_ascii=False,indent=2))
            print(json.dumps({k:result.get(k) for k in ['url','status','curl_exit','canonical','xml_error']},ensure_ascii=False),flush=True)

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const guidance={
'Title':['Give this page a clear title','Ask your website editor to describe this business and page in the page title.'],
'Meta description':['Write a useful search description','Summarize what this page offers and who it helps in its meta description. Search engines may choose different snippets.'],
'Canonical URL':['Review the preferred page address','Ask your website editor to check duplicate URLs and set the correct canonical address where appropriate.'],
'Open Graph title':['Improve how this page appears when shared','Add a descriptive social sharing title in this page’s Open Graph settings.'],
'Structured data':['Check whether structured data would help','Ask your website editor whether an appropriate schema describes this page. Its absence alone is not a ranking failure.'],
'Primary heading':['Make this page’s purpose clear','Review the main heading and add a clear H1 where appropriate.'],
'Internal links':['Review this page’s navigation','This check counts link elements, not verified internal destinations. Review whether visitors can find the next useful page.'],
'Response time':['Repeat this page-speed check','One response-time measurement can vary. Repeat it before deciding whether performance work is needed.']};
export function recommendations({workspace,owned,reports,now=Date.now()}){
 if(!UUID.test(workspace)||!Array.isArray(owned)||!Array.isArray(reports))return[];
 const businesses=new Map(owned.filter(x=>UUID.test(x.id)).map(x=>[x.id,x]));const latest=new Map();
 for(const row of reports){const time=Date.parse(row?.report?.checked_at);if(row?.workspace_id!==workspace||!UUID.test(row.id)||!businesses.has(row.listing_id)||!Number.isFinite(time)||time>now+60000||row.report?.ok!==true||row.report.mode!=='free_test'||!Array.isArray(row.report.checks))continue;
 let source;try{source=new URL(row.report.url);if(!['https:','http:'].includes(source.protocol)||source.username||source.password)continue;}catch{continue;}
 if(!latest.has(row.listing_id)||time>Date.parse(latest.get(row.listing_id).report.checked_at))latest.set(row.listing_id,row);
 }
 return [...latest.values()].flatMap(row=>{const age=now-Date.parse(row.report.checked_at);return row.report.checks.filter(c=>c.ok===false&&guidance[c.label]).map(c=>({key:row.id+':'+c.label,listingId:row.listing_id,business:businesses.get(row.listing_id).name||'Your business',reportId:row.id,checkedAt:row.report.checked_at,source:row.report.url,stale:age>7*86400000,title:guidance[c.label][0],guidance:guidance[c.label][1],evidence:String(c.detail||''),href:'/social?intelligence=reports&workspace='+encodeURIComponent(workspace)}));}).slice(0,12);
}

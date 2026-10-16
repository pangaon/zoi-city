from pathlib import Path
import re
from urllib.parse import urljoin
r=Path('/workspaces/zoi-business-presentation-v3-independent');p=Path('/home/codespace/.cache/zoi/business-presentation-v3-independent-20261016');previous=Path('/home/codespace/.cache/zoi/business-presentation-v2-independent-20261015/presentation-browser-probe.mjs')
b=previous.read_text();start=b.index(' // Another current authorized client prepares');end=b.index(' const imageDraft=makeDestination(id(1900)',start);cross=b[start:end];b=b[:start]+b[end:]
extra=r'''
 const missingDraft=makeDestination(id(1882));
 await page.goto(origin+'/?post='+missingDraft.post.id);await page.waitForFunction(()=>window.ready);
 await page.locator('[data-view=list]').click();
 await page.getByText(missingDraft.post.body,{exact:true}).evaluate(node=>{window.staleCalendarRow=node.closest('.zk-lrow');if(!window.staleCalendarRow)throw Error('Actual Calendar row missing');});
 // Fixture-only source removal, not canonical deletion acceptance. Reload the
 // actual reader so state.posts is empty, retaining only the detached DOM node.
 q(`delete from zoi.social_posts where id='${missingDraft.post.id}'`);
 await page.locator('[data-role=today]').click();
 await page.getByText(missingDraft.post.body,{exact:true}).waitFor({state:'detached'});
 assert.equal(await page.evaluate(()=>window.staleCalendarRow.isConnected),false);
 const callsBeforeMissing=await page.evaluate(()=>fixture.calls.length);
 await page.evaluate(()=>window.staleCalendarRow.dispatchEvent(new MouseEvent('click',{bubbles:true})));
 await page.getByText('This post is no longer in Calendar. Refresh the list before opening it.',{exact:true}).waitFor();
 assert.equal(await page.locator('[role=dialog]').count(),0);
 assert.equal(await page.evaluate(()=>fixture.calls.length),callsBeforeMissing);
 assert.equal(q(`select count(*)from zoi.social_posts where id='${missingDraft.post.id}'`),'0');
 await page.screenshot({path:join(dest,'390-missing-current-row.png'),fullPage:true});
 results.push({width:390,passed:true,scenario:'detached captured Calendar row after actual reader reload refuses absent current ID; no stale modal/no RPC/no recreation; isolated fixture deletion is not canonical deletion acceptance'});
'''
needle='await negative.close();';assert b.count(needle)==1;b=b.replace(needle,cross+extra+needle)
(p/'presentation-browser-probe.mjs').write_text(b)
s=(r/'tests/database/business-destination-review.integration.mjs').read_text();base=(r/'tests/database').as_uri()+'/'
s=re.sub(r"new URL\('([^']+)',import.meta.url\)",lambda m:"new URL('"+urljoin(base,m.group(1))+"')",s)
s=s.replace((r/'tests/database/business-destination-review.browser.mjs').as_uri(),(p/'presentation-browser-probe.mjs').as_uri())
(p/'presentation-runner.mjs').write_text(s)
print('Unchanged F1/F2 asserts + original negatives + cache-missing captured handler probe')

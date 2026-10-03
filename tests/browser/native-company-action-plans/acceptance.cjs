const {chromium}=require('playwright-core');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const ws=id(1),company=id(3),member=id(21),contact=id(22),actor=id(90);
const origin=process.env.EXPO_ORIGIN||'http://127.0.0.1:8263';
const out=process.env.PLAN_OUTPUT||path.resolve('docs/audits/evidence/native-company-action-plans-2026-10-03');
(async()=>{
 await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({executablePath:'/home/codespace/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',args:['--no-sandbox']});
 const results=[];
 try{
  for(const width of [390,1440])for(const mode of ['success','lost-project','lost-task','cancel-missing','discard','partial-open','role','invalid-date','setup-retry','open-retry','removed-assignee','reloaded-pending']){
   const page=await browser.newPage({viewport:{width,height:1000},isMobile:width===390,hasTouch:width===390,timezoneId:'America/Toronto'});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   let role='owner',failSetup=false,membersPresent=true,attempts=0,writes=0,interrupted=false;
   const receipts={},calls=[],records=[{id:company,workspace_id:ws,kind:'company',title:'Olive Studios',status:'open',version:1,data:{}},{id:contact,workspace_id:ws,kind:'contact',company_id:company,title:'Client contact',status:'open',version:1,data:{}}];
   await page.addInitScript(()=>sessionStorage.setItem('zoi.mobile.refresh.v1',JSON.stringify({refresh_token:'controlled-fixture'})));
   await page.route('https://csebihpaychdkanjjsmz.supabase.co/**',async route=>{
    const url=route.request().url(),name=url.split('/').pop(),args=route.request().postDataJSON()||{};calls.push({name,args});
    let body=[];
    if(url.includes('/auth/v1/token'))body={access_token:'controlled-fixture',refresh_token:'controlled-fixture',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:actor,email:'qa@example.invalid'}};
    if(name==='zoi_me')body={authenticated:true,profile:{id:member},workspaces:[{id:ws,name:'QA workspace',role:'owner'}]};
    if(name==='ops_records_list'){
     if(failSetup)return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'controlled setup unavailable'})});
     body={ok:true,role,records,members:membersPresent?[{profile_id:member,display_name:'Eleni',role:'owner'}]:[]};
    }
    if(name==='ops_mutation_execute'){
     attempts++;
     if(receipts[args.p_request])body=receipts[args.p_request];
     else if(mode==='cancel-missing'&&attempts===2&&!interrupted){interrupted=true;return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'controlled request not dispatched'})});}
     else{
      const p=args.p_args,record={id:id(100+(++writes)),workspace_id:ws,kind:p.p_kind,...p.p_data,version:1,data:{notes:p.p_data.notes}};
      records.push(record);body={ok:true,state:'saved',workspace_id:ws,request_id:args.p_request,action:'save',record_id:record.id,kind:record.kind,version:1};receipts[args.p_request]=body;
      if(!interrupted&&((['lost-project','partial-open','reloaded-pending'].includes(mode)&&writes===1)||(mode==='lost-task'&&writes===3))){interrupted=true;return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'controlled lost committed response'})});}
     }
    }
    if(name==='ops_request_status')body=receipts[args.p_request]||{ok:true,state:args.p_cancel_if_missing?'cancelled':'missing',workspace_id:ws,request_id:args.p_request};
    await route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
   });
   const b=name=>page.getByRole('button',{name,exact:true});
   await page.goto(origin);
   await page.getByRole('tab',{name:/Grow/}).click();
   await page.getByRole('radio',{name:/QA workspace/}).click();
   await b('Open Business operations').click();
   await page.getByRole('button',{name:/Olive Studios.*version 1/}).click();
   await b('Build a company action plan').waitFor();
   if(mode==='setup-retry')failSetup=true;
   await b('Build a company action plan').click();
   if(mode==='setup-retry'){await b('Retry company plan setup').waitFor();assert.equal(writes,0);failSetup=false;await b('Retry company plan setup').click();}
   await b('Welcome a team member').waitFor();if(mode==='success')await page.screenshot({path:path.join(out,'choose-'+width+'.png')});
   await b('Welcome a team member').click();
   await page.getByLabel('Plan title',{exact:true}).fill('Agreed team start');
   await b('Action 1 · Eleni').click();
   await page.getByLabel('Action 1 date',{exact:true}).fill(mode==='invalid-date'?'2026-02-30':'2026-10-10');
   await page.getByLabel('Action 1 time',{exact:true}).fill('09:30');
   await b('Client contact').click();
   if(mode==='success'){await page.getByText('Make this plan yours.',{exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'edit-'+width+'.png')});}
   if(mode==='discard'){
    await b('Back to company').click();await b('Keep working on this plan').click();
    assert.equal(await page.getByLabel('Plan title',{exact:true}).inputValue(),'Agreed team start');
    await b('Back to company').click();await b('Discard unsaved draft and continue').click();
    await b('Build a company action plan').waitFor();assert.equal(writes,0);
   }else{
    await b('Review this plan').click();
    if(mode==='invalid-date'){
     await page.getByRole('alert').filter({hasText:'Action 1:'}).waitFor();assert.equal(writes,0);
     assert.equal(await page.getByLabel('Plan title',{exact:true}).inputValue(),'Agreed team start');
    }else{
     await b('Save project & actions').waitFor();assert.equal(writes,0);
     if(mode==='role')role='viewer';if(mode==='removed-assignee')membersPresent=false;
     await b('Save project & actions').click();
     if(mode==='removed-assignee'){await page.getByRole('alert').filter({hasText:'Choose a current workspace member'}).waitFor();assert.equal(writes,0);}
     else if(mode==='reloaded-pending'){
      await b('Check pending save').waitFor();assert.equal(writes,1);await page.reload();
      await page.getByRole('tab',{name:/Grow/}).click();await page.getByRole('radio',{name:/QA workspace/}).click();await b('Open Business operations').click();
      await b('Check saved Operations receipt').click();await page.getByText(/Change saved. Reference/).waitFor();assert.equal(writes,1);assert.equal(await b('Continue saving remaining actions').count(),0);
     }
     else if(mode==='role'){
      await page.getByText('Company plan access could not be confirmed. Reload your workspace or sign in again.',{exact:true}).waitFor();assert.equal(writes,0);assert.equal(await b('Save project & actions').count(),0);
     }else{
      if(['lost-project','lost-task','partial-open','cancel-missing'].includes(mode)){
       await b('Check pending save').waitFor();assert(await b('Back to company').isDisabled());
       const before=writes;
       await b('Check pending save').click();
       if(mode==='cancel-missing'){await page.getByRole('alert').filter({hasText:'No saved receipt yet'}).waitFor();assert.equal(writes,before);await b('Cancel plan step if unsaved').click();}
       if(mode==='partial-open'){
        await b('Open saved work').click();await b('Keep working on this plan').click();assert.equal(writes,1);
        await b('Open saved work').click();await b('Discard unsaved draft and continue').click();
        await page.getByLabel('Title',{exact:true}).waitFor();assert.equal(await page.getByLabel('Title',{exact:true}).inputValue(),'Agreed team start');assert.equal(writes,1);
       }else await b('Continue saving remaining actions').click();
      }
      if(mode!=='partial-open'){
       await page.getByText('Project and all actions confirmed saved',{exact:true}).waitFor();assert.equal(writes,5);
       assert.equal(records.filter(r=>r.kind==='task').length,4);
       const first=records.find(r=>r.kind==='task'&&r.title==='Confirm the role and agreed start date');assert.equal(first.assignee_profile_id,member);assert.equal(first.due_at,'2026-10-10T13:30:00.000Z');assert.equal(first.contact_id,contact);
       if(mode==='open-retry'){failSetup=true;await b('Open your saved project').click();await page.getByRole('alert').filter({hasText:'The service is unavailable'}).waitFor();assert.equal(writes,5);failSetup=false;}
       await b('Open your saved project').click();await page.getByLabel('Title',{exact:true}).waitFor();assert.equal(await page.getByLabel('Title',{exact:true}).inputValue(),'Agreed team start');
      }
     }
    }
   }
   assert.deepEqual(errors,[]);
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(overflow,false);
   await page.screenshot({path:path.join(out,mode+'-'+width+'.png'),fullPage:true});
   const row={width,mode,writes,attempts,records:records.filter(r=>['project','task'].includes(r.kind)).length,pageErrors:errors,overflow,passed:true};results.push(row);
   console.log(JSON.stringify(row));await page.close();
  }
  await fs.writeFile(path.join(out,'report.json'),JSON.stringify({actual_compiled_app:true,controlled_transport:true,production_customer_writes:false,physical_device_acceptance:false,rows:results},null,2)+'\n');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

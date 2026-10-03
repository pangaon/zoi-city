const {chromium}=require('playwright-core'),assert=require('node:assert/strict');
const actor='11111111-1111-4111-8111-111111111111',ws='22222222-2222-4222-8222-222222222222',company='33333333-3333-4333-8333-333333333333',project='44444444-4444-4444-8444-444444444444',other='55555555-5555-4555-8555-555555555555',document='66666666-6666-4666-8666-666666666666';
const modes=['account','workspace','unmount','role','removed-project','foreign-document','removed-after-read','foreign-after-read','download-denied'];
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/home/codespace/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',args:['--no-sandbox']});try{for(const width of[390,1440])for(const mode of modes){
 let release,documentRead=0;const errors=[],calls=[],page=await browser.newPage({viewport:{width,height:1000}}),button=name=>page.getByRole('button',{name,exact:true});
 page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>sessionStorage.setItem('zoi.mobile.refresh.v1',JSON.stringify({refresh_token:'fixture'})));
 const records=[{id:company,workspace_id:ws,kind:'company',title:'Society',status:'open',version:1,data:{}},{id:project,workspace_id:ws,kind:'project',company_id:company,title:'Private programme',status:'open',version:1,data:{}}];
 const doc={id:document,workspace_id:ws,project_id:project,current_version:1,title:'Private payroll',filename:'payroll.txt'};
 await page.route('https://csebihpaychdkanjjsmz.supabase.co/**',async route=>{
  const url=route.request().url(),name=url.split('/').pop(),args=route.request().postDataJSON();calls.push({name,args});let body=[];
  if(url.includes('/auth/v1/token'))body={access_token:'fixture',refresh_token:'fixture',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:actor,email:'qa@example.invalid'}};
  if(name==='zoi_me')body={authenticated:true,profile:{id:other},workspaces:[{id:ws,name:'Society',role:'owner'},{id:other,name:'Other workspace',role:'owner'}]};
  if(name==='ops_records_list')body={ok:true,role:'owner',records,members:[]};
  if(name==='documents_list'){assert.equal(args.p_workspace,ws);assert.equal(args.p_project,project);documentRead++;if(['account','workspace','unmount'].includes(mode))await new Promise(r=>release=r);body={ok:true,role:mode==='role'?'viewer':'owner',projects:mode==='removed-project'||mode==='removed-after-read'&&documentRead>1?[]:[{id:project,title:'Private programme'}],documents:mode==='foreign-document'||mode==='foreign-after-read'&&documentRead>1?[{...doc,project_id:other}]:[doc]};}
  if(name==='document_history')body={ok:true,document:doc,versions:[{id:other,version:1,state:'ready',filename:'payroll.txt',mime_type:'text/plain',size_bytes:5}],audit:[]};
  if(url.includes('action=file'))return route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({ok:false,error:'document_permission_denied'})});
  await route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
 });
 await page.goto(process.env.EXPO_ORIGIN||'http://localhost:8197');await page.getByRole('tab',{name:/Grow/}).click();await page.getByRole('radio',{name:/Society/}).click();await button('Open Business operations').click();await page.getByRole('button',{name:/Society.*version 1/}).click();await button('Project files · Private programme').click();
 if(['account','workspace','unmount'].includes(mode)){
  for(let n=0;!release&&n<100;n++)await new Promise(r=>setTimeout(r,10));assert(release);
  await button('← All workspace tools').click();if(mode==='account'){await button('Sign out').click();await button('Sign out').waitFor({state:'hidden'});}else if(mode==='workspace')await page.getByRole('radio',{name:/Other workspace/}).click();else await page.getByRole('tab',{name:/Home/}).click();release();await page.waitForTimeout(150);
  assert.equal(await page.getByText('Private payroll · version 1',{exact:true}).count(),0);assert.equal(await button('Upload privately').count(),0);
 }else if(['removed-after-read','foreign-after-read'].includes(mode)){await page.getByText('Private payroll · version 1',{exact:true}).waitFor();await button('Refresh private documents').click();await page.getByRole('alert').waitFor();assert.equal(await button('Upload privately').count(),0);assert.equal(await page.getByText('Private payroll · version 1',{exact:true}).count(),0);
 }else if(mode==='download-denied'){
  await button('View document Private payroll').click();await button('Open private version 1').click();await button('Reload records').waitFor();await page.getByText('Private document access could not be confirmed. Reload your workspace or sign in again.',{exact:true}).waitFor();assert.equal(await button('Upload privately').count(),0);assert.equal(await page.getByText('Private payroll · version 1',{exact:true}).count(),0);assert.equal(await button('Start company project').count(),0);
 }else if(mode==='role'){await button('Reload records').waitFor();await page.getByText('Private document access could not be confirmed. Reload your workspace or sign in again.',{exact:true}).waitFor();assert.equal(await button('Start company project').count(),0);assert.equal(await button('Upload privately').count(),0);assert.equal(await page.getByText('Private payroll · version 1',{exact:true}).count(),0);
 }else{
  await page.getByRole('alert').waitFor();assert.equal(await button('Upload privately').count(),0);assert.equal(await page.getByText('Private payroll · version 1',{exact:true}).count(),0);
 }
 assert.equal(documentRead,mode.endsWith('after-read')?2:1);assert.equal(calls.filter(c=>c.name==='ops_mutation_execute'||c.name==='document_archive'||c.name.includes('action=upload')).length,0);assert.deepEqual(errors,[]);console.log('PASS native project documents',width,mode);await page.close();
 }}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

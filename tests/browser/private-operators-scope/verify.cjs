const {chromium}=require('playwright-core');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../..');
const actor='11111111-1111-4111-8111-111111111111',ws='22222222-2222-4222-8222-222222222222',sid='33333333-3333-4333-8333-333333333333';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/home/codespace/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',args:['--no-sandbox']});const report=[];
 try{for(const width of [390,1440])for(const family of ['properties','timekeeping'])for(const transition of ['workspace','detached','unchanged']){
  const context=await browser.newContext({viewport:{width,height:900}});let release;const posts=[];
  const token='e30.'+Buffer.from(JSON.stringify({sub:actor,session_id:sid})).toString('base64url')+'.fixture';
  await context.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.pathname==='/auth/v1/token'){release=()=>route.fulfill({contentType:'application/json',body:JSON.stringify({access_token:token,refresh_token:'fixture',expires_in:3600,user:{id:actor}})});return;}
   if(url.pathname.includes('/rest/v1/rpc/')){posts.push({name:url.pathname.split('/').at(-1),args:route.request().postDataJSON()});return route.fulfill({contentType:'application/json',body:JSON.stringify(family==='properties'?{ok:true,offers:[],owned:[],requests:[],audit:[]}:{ok:true,actor_id:actor,role:'owner',entries:[],projects:[],tasks:[],totals:[],active_timer:null,server_now:new Date().toISOString()})});}
   if(url.origin!=='https://fixture.invalid')return route.abort();
   if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:'<main id="root"></main><script src="/assets/zoi-core.js"></script>'});
   const file=path.resolve(root,'.'+url.pathname);if(!file.startsWith(root+'/'))return route.abort();
   try{return route.fulfill({contentType:file.endsWith('.css')?'text/css':'text/javascript',body:await fs.readFile(file)});}catch{return route.abort();}
  });
  const page=await context.newPage();await page.goto('https://fixture.invalid/');
  await page.evaluate(async({actor,ws,token,family})=>{
   ZoiCore.auth.save({user_id:actor,access_token:token,refresh_token:'fixture',expires_at:Date.now()/1000+20});window.ctx={C:ZoiCore,ws,role:'owner'};
   window.ZoiSuite={modules:[]};await import('/assets/suite/'+family+'.js');window.mounted=ZoiSuite.modules.find(m=>m.id===family).mount(document.querySelector('#root'),ctx);
  },{actor,ws,token,family});
  for(let n=0;!release&&n<100;n++)await new Promise(resolve=>setTimeout(resolve,10));assert(release,'Expected actual Core refresh');
  await page.evaluate(transition=>{if(transition==='workspace')ctx.ws='44444444-4444-4444-8444-444444444444';if(transition==='detached')document.querySelector('#root').remove();},transition);
  await release();await page.waitForTimeout(150);
  const expected=transition==='unchanged'||process.env.EXPECT_FIXED!=='1'?1:0;assert.equal(posts.length,expected,JSON.stringify({family,transition,posts}));
  report.push({width,family,transition,privatePosts:posts.length,oldWorkspaceSent:posts.some(p=>p.args.p_workspace===ws)});await context.close();
 }
 await fs.writeFile(process.env.QA_REPORT||'/tmp/private-operators-scope.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

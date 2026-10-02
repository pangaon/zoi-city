/* Business Operations: persisted workspace records, projects and task history. */
(function (global) {
  'use strict';
  var SECTORS = {business:'Business',lawyer:'Legal practice',church:'Church / parish',restaurant:'Restaurant',stylist:'Salon / stylist',creator:'Creator'};
  var PROJECT_LABELS = {business:'Projects',lawyer:'Matters',church:'Parish projects',restaurant:'Restaurant projects',stylist:'Client projects',creator:'Campaigns'};
  function esc(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function errorText(error) {
    var message = String(error && error.message || error || 'Could not complete the request.');
    if (message.indexOf('version_conflict') !== -1) return 'Someone changed this record. Your form is preserved. Reload the latest record before applying your changes.';
    if (message.indexOf('insufficient_permission') !== -1) return 'Your workspace role does not allow this change.';
    if (message.indexOf('record_has_active_dependents') !== -1) return 'Archive or unlink the related active records first.';
    if (message.indexOf('project_has_tasks') !== -1) return 'This project has active tasks. Keep it in its current company or archive the tasks first.';
    if (message.indexOf('cross_workspace_link') !== -1) return 'A linked record is unavailable in this workspace. Refresh and choose another.';
    return message;
  }
  function payload(record) {
    var r = record || {};
    return Object.assign({}, r.data || {}, {title:r.title || '',company_id:r.company_id || null,project_id:r.project_id || null,contact_id:r.contact_id || null,status:r.status || 'open',due_at:r.due_at || null,assignee_profile_id:r.assignee_profile_id || null});
  }
  function receipt(result, workspace, id, expectedVersion, kind) {
    var r = result && result.record;
    if (!result || result.ok !== true || !r || !/^[0-9a-f-]{36}$/i.test(r.id || '') || (kind && r.kind !== kind) || r.workspace_id !== workspace || (id && r.id !== id) || r.version !== expectedVersion + 1) throw new Error('The server did not confirm this change. Your form is preserved.');
    return r;
  }
  function styles(doc) {
    if (doc.getElementById('zops-style')) return;
    var style = doc.createElement('style'); style.id = 'zops-style';
    style.textContent = '.zops{color:var(--tx);font:14px/1.5 system-ui;max-width:1200px}.zops h2,.zops h3{margin:0 0 8px}.zops p{margin:0 0 14px}.zops-muted{color:var(--mut)}.zops-toolbar,.zops-tabs,.zops-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:14px 0}.zops button{background:var(--bg3);border:1px solid var(--line);color:var(--tx);padding:10px 14px;border-radius:9px;cursor:pointer;font:inherit}.zops button.primary,.zops button[aria-selected=true]{background:var(--acc);color:white}.zops button:disabled{opacity:.5;cursor:not-allowed}.zops-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,1fr);gap:18px;align-items:start}.zops-card{background:var(--bg2);border:1px solid var(--line);border-radius:14px;padding:18px;margin-bottom:12px;overflow-wrap:anywhere}.zops-record{width:100%;text-align:left;display:block;margin-bottom:8px}.zops-record strong,.zops-record span{display:block}.zops label{display:block;font-weight:600;margin-bottom:12px}.zops input,.zops select,.zops textarea{display:block;width:100%;box-sizing:border-box;border:1px solid var(--line);background:var(--bg);color:var(--tx);padding:10px;border-radius:8px;font:inherit;margin-top:5px}.zops textarea{min-height:100px;resize:vertical}.zops-status{padding:12px;border-radius:9px;background:var(--bg3);margin:12px 0}.zops-status:empty{display:none}.zops-overdue{color:#c4483e}.zops .zops-two{display:grid;grid-template-columns:1fr 1fr;gap:12px}.zops details{margin:8px 0}.zops pre{white-space:pre-wrap;font-size:12px;max-height:260px;overflow:auto}.zops button:focus-visible,.zops input:focus-visible,.zops select:focus-visible,.zops textarea:focus-visible{outline:2px solid var(--acc);outline-offset:2px}@media(max-width:760px){.zops-grid,.zops .zops-two{grid-template-columns:1fr}}';
    doc.head.appendChild(style);
  }
  async function mount(root, ctx) {
    var doc = root.ownerDocument; styles(doc);
    var C = ctx.C || {}, transport = C.api && C.api.rpc && C.api.rpc.bind(C.api), actor=C.auth&&C.auth.load()?.user_id, workspace=ctx.ws;
    root.__zoiOpsDestroy?.();var mountToken={};root.__zoiOpsMount=mountToken;
    var alive=true,abort=new AbortController(),recovery,observer;
    var wrap=doc.createElement('section');wrap.className='zops';root.replaceChildren(wrap);
    function removed(records){return records.some(function(record){return Array.from(record.removedNodes).some(function(node){return node===root||node===wrap||node.contains?.(root)||node.contains?.(wrap);});});}
    observer=new MutationObserver(function(records){if(removed(records)||!root.isConnected||!root.contains(wrap))destroy();});
    observer.observe(doc.documentElement,{childList:true,subtree:true});
    var helpers,identity;
    try{helpers=await import('/assets/operations/recovery.mjs?v=20261001-ops-recovery');identity=await import('/assets/community/session-state.mjs?v=20261001-uuid-scope');}catch(error){destroy();throw error;}
    if(!alive||removed(observer.takeRecords())||root.__zoiOpsMount!==mountToken||!root.isConnected||!root.contains(wrap)||C.auth.load()?.user_id!==actor||ctx.ws!==workspace){destroy();return {destroy:destroy};}
    var uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if(!uuid.test(actor||'')||!uuid.test(workspace||'')||identity.sessionIdentity(C)!==actor.toLowerCase()){destroy();root.textContent='Sign in again to verify your account and workspace before opening Operations.';return {destroy:destroy};}
    actor=actor.toLowerCase();
    function active(){if(alive&&(!root.isConnected||!root.contains(wrap)||identity.sessionIdentity(C)!==actor||ctx.ws!==workspace||removed(observer?.takeRecords()||[])))destroy();return alive;}
    function assert(){if(!active())throw new Error('Operations account or workspace changed.');}
    async function rpc(name,args,options){assert();try{var fresh=await C.auth.ensureFresh();assert();if(!fresh){var error=new Error('Please sign in again.');error.status=401;throw error;}var result=await transport(name,args,Object.assign({},options,{auth:'prefer'}));assert();return result;}catch(error){if(active()&&helpers.operationsDenied(error)){clearPrivate();render();}throw error;}}

    var state = {records:[],members:[],role:null,kind:'company',sector:'business',selected:null,busy:false,ready:false,dirty:false,events:[],archived:false};
    wrap.innerHTML = '<h2>Business Operations</h2><p class="zops-muted">Company records, relationships, projects and deadlines in your workspace.</p><div class="zops-status" role="status" aria-live="polite" data-o="status"></div><div data-o="recovery"></div><div data-o="content"></div>';
    var key='zoi:ops-pending:v1:'+actor+':'+workspace;
    recovery=helpers.createOperationsRecovery({actor,workspace,current:active,call:(name,args)=>rpc(name,args,{auth:'require'}),nonce:()=>crypto.randomUUID(),changed:()=>{if(active())renderRecovery();},storage:{load:async()=>JSON.parse(global.sessionStorage.getItem(key)||'null'),save:async value=>global.sessionStorage.setItem(key,JSON.stringify(value)),clear:async()=>global.sessionStorage.removeItem(key)}});
    function clearPrivate(){if(state){state.records=[];state.members=[];state.role=null;state.selected=null;state.events=[];state.dirty=false;}recovery?.dropPayload();}
    function destroy(){alive=false;abort.abort();observer?.disconnect();clearPrivate();wrap.replaceChildren();}
    function account(){if(active())return;destroy();if(root.contains(wrap))root.innerHTML='<p>Your account changed. Reload Operations to access the current workspace.</p>';}
    root.__zoiOpsDestroy=destroy;
    ['zoi:auth-change','zoi:authchange','storage','focus'].forEach(name=>global.addEventListener(name,account,{signal:abort.signal}));
    function renderRecovery(){var host=q('recovery');if(!host)return;var p=recovery.state();host.innerHTML=(!p.ready?'<p>Load your recovery reference before making changes.</p><button type="button" data-ops-recovery="load">Load recovery reference</button>':'')+(p.marker?'<section class="zops-card"><h3>Check your previous change</h3><p>Private record content is not stored on this device.</p><button type="button" data-ops-recovery="check">Check saved receipt</button>'+(p.payload?'<button type="button" data-ops-recovery="retry">Retry exact change</button>':'')+'<button type="button" data-ops-recovery="cancel">Cancel if not saved</button><p>Cancellation preserves any change that already saved.</p></section>':'');
      wrap.querySelectorAll('[data-o="form"] input,[data-o="form"] select,[data-o="form"] textarea,[data-o="form"] button,[data-o="new"]').forEach(function(node){if(p.blocked){if(!node.hasAttribute('data-ops-disabled'))node.dataset.opsDisabled=String(node.disabled);node.disabled=true;}else if(node.hasAttribute('data-ops-disabled')){node.disabled=node.dataset.opsDisabled==='true';delete node.dataset.opsDisabled;}});
      host.querySelectorAll('button').forEach(button=>{button.disabled=state.busy||p.busy;button.addEventListener('click',()=>busy(async()=>{if(button.dataset.opsRecovery==='load'){await recovery.load();return;}var value=await recovery.recover(button.dataset.opsRecovery);if(value.state==='missing'){status('No saved receipt yet. Retry the exact change or cancel if unsaved before starting another.');return;}await refreshSaved(value);}));});
    }
    async function refreshSaved(value){state.selected=null;state.dirty=false;render();var message=value.state==='saved'?'Change saved. Reference '+value.record_id+'.':'Unsaved request cancelled. A delayed request cannot save it.';status(message);try{await load();state.selected=state.records.find(row=>row.id===value.record_id)||null;if(state.selected)state.kind=state.selected.kind;render();status(message);}catch(error){if(active())status(message+' Refresh to load current records.');}}
    function q(name) { return wrap.querySelector('[data-o="' + name + '"]'); }
    function status(text) { if(active()&&q('status'))q('status').textContent = text || ''; }
    function canWrite(kind) { return ['owner','admin'].indexOf(state.role) !== -1 || (state.role === 'editor' && kind !== 'company'); }
    function isAdmin() { return state.role === 'owner' || state.role === 'admin'; }
    function labels() { return {company:'Company records',contact:'Contacts',project:PROJECT_LABELS[state.sector] || 'Projects',task:'Tasks',audit:'Activity history'}; }
    function singular(kind) { return kind === 'project' ? ({lawyer:'matter',creator:'campaign',church:'parish project',restaurant:'restaurant project',stylist:'client project'}[state.sector] || 'project') : kind; }
    function recordName(id) { var found = state.records.find(function (r) { return r.id === id; }); return found ? found.title : ''; }
    function confirmDiscard() { return !state.dirty || !global.confirm || global.confirm('Discard the unsaved changes in this form?'); }
    async function busy(fn) {
      if (state.busy||!active()) return;
      state.busy = true;
      var controls = Array.from(wrap.querySelectorAll('button,input,select,textarea')).map(function (node) { var previous = node.disabled; node.disabled = true; return [node,previous]; });
      wrap.setAttribute('aria-busy','true');
      try { await fn(); } catch (error) { status(errorText(error)); }
      finally { state.busy = false; wrap.removeAttribute('aria-busy'); controls.forEach(function (item) { item[0].disabled = item[1]; });if(active())renderRecovery(); }
    }
    async function load() {
      if (!rpc || !ctx.ws) throw new Error('Sign in and choose a workspace to use Business Operations.');
      var result = await rpc('ops_records_list',{p_workspace:ctx.ws,p_kind:null,p_include_archived:state.archived},{auth:'require'});
      if (!result || result.ok !== true || !Array.isArray(result.records)) throw new Error('Business Operations is unavailable in this workspace. No records were changed.');
      if (result.records.some(function (r) { return r.workspace_id !== ctx.ws; })) throw new Error('The workspace response could not be verified.');
      state.records = result.records; state.members = Array.isArray(result.members) ? result.members : []; state.role = result.role; state.ready = true;
      var company = state.records.find(function (r) { return r.kind === 'company' && !r.archived_at; });
      if (company && company.data && company.data.sector) state.sector = company.data.sector;
    }
    async function loadAudit(id) {
      var result = await rpc('ops_audit_list',{p_workspace:ctx.ws,p_record:id || null,p_limit:50},{auth:'require'});
      if (!result || result.ok !== true || !Array.isArray(result.events)) throw new Error('Activity history could not be loaded.');
      if (result.events.some(function (event) { return event.workspace_id !== ctx.ws; })) throw new Error('Activity history did not match this workspace.');
      state.events = result.events;
    }
    function render() {
      var titles = labels();
      q('content').innerHTML = '<div class="zops-toolbar"><span class="zops-muted">Role: ' + esc(state.role === 'editor' ? 'staff (editor)' : state.role) + '</span><button type="button" data-o="refresh">Refresh</button><button type="button" data-o="archives">' + (state.archived ? 'Hide archived' : 'Show archived') + '</button></div>' +
        '<div class="zops-tabs" role="tablist" aria-label="Operations">' + Object.keys(titles).map(function (kind) { return '<button type="button" role="tab" aria-selected="' + (state.kind === kind) + '" data-kind="' + kind + '">' + esc(titles[kind]) + '</button>'; }).join('') + '</div><div class="zops-grid"><div data-o="list"></div><div data-o="editor"></div></div>';
      q('refresh').addEventListener('click',function () { if (!confirmDiscard()) return; busy(async function () { await load(); state.selected=null;state.dirty=false;render();status('Workspace records refreshed.'); }); });
      q('archives').addEventListener('click',function () { if (!confirmDiscard()) return; busy(async function () { state.archived=!state.archived;await load();state.selected=null;state.dirty=false;render(); }); });
      wrap.querySelectorAll('[data-kind]').forEach(function (button) { button.addEventListener('click',function () { if (!confirmDiscard()) return; busy(async function () {state.kind=button.dataset.kind;state.selected=null;state.dirty=false;if(state.kind==='audit')await loadAudit();render();status('');}); }); });
      renderList(); renderEditor();renderRecovery();
    }
    function renderList() {
      var host = q('list');
      if (state.kind === 'audit') {
        host.innerHTML = '<div class="zops-card"><h3>Recent changes</h3><p class="zops-muted">Latest 50 persisted changes. Times use your device timezone.</p>' + (state.events.length ? state.events.map(function (event) {return '<details><summary>' + esc(event.action) + ' · ' + esc(event.after_data && event.after_data.title || recordName(event.record_id)) + ' · v' + event.version + '<br><small>' + esc(new Date(event.created_at).toLocaleString()) + '</small></summary><p>Actor profile: ' + esc(event.actor_profile_id) + '</p><pre>' + esc(JSON.stringify({before:event.before_data,after:event.after_data},null,2)) + '</pre></details>';}).join('') : '<p>No changes have been recorded yet.</p>') + '</div>';
        return;
      }
      var records = state.records.filter(function (r) { return r.kind === state.kind; });
      host.innerHTML = '<div class="zops-card"><h3>' + esc(labels()[state.kind]) + '</h3>' + (canWrite(state.kind) ? '<button type="button" data-o="new" class="primary">+ Add ' + esc(singular(state.kind)) + '</button>' : '<p class="zops-muted">You have read-only access to these records.</p>') + '</div>' +
        (records.length ? records.map(function (r) { var overdue=r.due_at && new Date(r.due_at)<new Date() && r.status!=='completed' && !r.archived_at;return '<button type="button" class="zops-record zops-card" data-record="' + esc(r.id) + '"><strong>' + esc(r.title) + '</strong><span class="zops-muted">' + esc(r.archived_at?'Archived':r.status.replace(/_/g,' ')) + ' · v' + r.version + (r.company_id?' · '+esc(recordName(r.company_id)):'') + '</span>' + (r.due_at?'<span class="'+(overdue?'zops-overdue':'zops-muted')+'">'+(overdue?'Overdue · ':'Due · ')+esc(new Date(r.due_at).toLocaleString())+'</span>':'')+'</button>';}).join('') : '<div class="zops-card"><p>No ' + esc(labels()[state.kind].toLowerCase()) + ' yet.</p><p class="zops-muted">Start with a company record, add a project and contact, then create a task with a deadline.</p></div>');
      if (q('new')) q('new').addEventListener('click',function () {if(!confirmDiscard())return;state.selected=null;state.dirty=false;renderEditor(true);renderRecovery();});
      host.querySelectorAll('[data-record]').forEach(function (button) {button.addEventListener('click',function () {if(!confirmDiscard())return;state.selected=state.records.find(function(r){return r.id===button.dataset.record;});state.dirty=false;renderEditor();renderRecovery();});});
    }
    function field(key,label,value,type) {return '<label>'+esc(label)+'<input data-field="'+key+'" type="'+(type||'text')+'" value="'+esc(value||'')+'" '+(key==='title'?'required maxlength="200"':'maxlength="2000"')+'></label>';}
    function select(key,label,options,value) {return '<label>'+esc(label)+'<select data-field="'+key+'">'+options.map(function(option){return '<option value="'+esc(option[0])+'"'+(String(value||'')===String(option[0])?' selected':'')+'>'+esc(option[1])+'</option>';}).join('')+'</select></label>';}
    function linkOptions(kind) {return [['','Choose '+singular(kind)]].concat(state.records.filter(function(r){return r.kind===kind&&!r.archived_at;}).map(function(r){return [r.id,r.title];}));}
    function renderEditor(create) {
      var host=q('editor');
      if(state.kind==='audit'){host.innerHTML='<div class="zops-card"><h3>Changes you can trace</h3><p>Every saved edit records the actor, timestamp, previous version and resulting version. Workspace permissions control access.</p></div>';return;}
      var record=state.selected;
      if(!record&&!create){host.innerHTML='<div class="zops-card"><h3>Your operations workspace</h3><p>Select a record to view its details or add a new one.</p><p class="zops-muted">Company registration information is maintained by your team. This workspace does not submit legal filings.</p></div>';return;}
      var data=payload(record), editable=canWrite(state.kind)&&!(record&&record.archived_at);
      var html='<form class="zops-card" data-o="form"><h3>'+esc(record?'Record details':'New '+singular(state.kind))+'</h3>'+field('title',state.kind==='company'?'Trading / display name':'Title / name',data.title);
      if(state.kind==='company')html+=select('sector','Profession',Object.keys(SECTORS).map(function(key){return[key,SECTORS[key]];}),data.sector||state.sector)+field('legal_name','Legal name',data.legal_name)+field('jurisdiction','Country / jurisdiction',data.jurisdiction)+field('registration_number','Registration number',data.registration_number)+field('website','Website',data.website,'url');
      if(state.kind==='contact')html+='<div class="zops-two">'+field('email','Email',data.email,'email')+field('phone','Phone',data.phone,'tel')+'</div>'+select('company_id','Company (optional)',linkOptions('company'),data.company_id);
      if(state.kind==='project')html+=select('company_id','Company',linkOptions('company'),data.company_id)+select('contact_id','Contact (optional)',linkOptions('contact'),data.contact_id);
      if(state.kind==='task')html+=select('project_id',singular('project').replace(/^./,function(c){return c.toUpperCase();}),linkOptions('project'),data.project_id)+select('contact_id','Contact (optional)',linkOptions('contact'),data.contact_id);
      if(state.kind==='task'||state.kind==='project'){
        var local='';if(data.due_at){var date=new Date(data.due_at);local=new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);}
        html+='<div class="zops-two">'+select('status','Status',[['open','Open'],['in_progress','In progress'],['blocked','Blocked'],['completed','Completed']],data.status)+field('due_at','Deadline (your timezone)',local,'datetime-local')+'</div>'+select('assignee_profile_id','Assigned team member',[['','Unassigned']].concat(state.members.map(function(member){return [member.profile_id,member.display_name];})),data.assignee_profile_id);
      }
      html+='<label>Notes<textarea data-field="notes" maxlength="20000">'+esc(data.notes||'')+'</textarea></label><div class="zops-actions">'+(editable?'<button class="primary" type="submit">Save record</button>':'')+(record?'<button type="button" data-o="history">View history</button>':'')+(record&&!record.archived_at&&isAdmin()?'<button type="button" data-o="archive">Archive</button>':'')+'</div></form>';
      host.innerHTML=html;
      if(!editable)host.querySelectorAll('input,select,textarea').forEach(function(node){node.disabled=true;});
      q('form').addEventListener('input',function(){state.dirty=true;});
      q('form').addEventListener('change',function(){state.dirty=true;});
      q('form').addEventListener('submit',function(event){event.preventDefault();if(!editable)return;var form=q('form');if(!form.reportValidity())return;
        var values=payload(record);form.querySelectorAll('[data-field]').forEach(function(node){values[node.dataset.field]=node.value;});
        values.company_id=values.company_id||null;values.project_id=values.project_id||null;values.contact_id=values.contact_id||null;values.assignee_profile_id=values.assignee_profile_id||null;
        values.due_at=values.due_at?new Date(values.due_at).toISOString():null;
        busy(async function(){var value=await recovery.send('save',{p_kind:state.kind,p_data:values,p_id:record?record.id:null,p_expected_version:record?record.version:0});await refreshSaved(value);});
      });
      if(q('archive'))q('archive').addEventListener('click',function(){if(!global.confirm('Archive this record? Its history will be retained.'))return;busy(async function(){await refreshSaved(await recovery.send('archive',{p_id:record.id,p_expected_version:record.version}));});});
      if(q('history'))q('history').addEventListener('click',function(){if(!confirmDiscard())return;busy(async function(){await loadAudit(record.id);state.kind='audit';state.dirty=false;render();});});
    }
    status('Loading workspace records…');
    try {await recovery.load();await load();render();status('');}catch(error){status(errorText(error));q('content').innerHTML='<div class="zops-card"><p>Operations records are unavailable. No local sample records are substituted.</p><button type="button" data-o="retry">Try again</button></div>';q('retry').addEventListener('click',function(){busy(async function(){if(!recovery.state().ready)await recovery.load();await load();render();status('');});});}
    return {destroy:destroy};
  }
  global.ZoiSuite=global.ZoiSuite||{modules:[]};
  global.ZoiSuite.modules.push({id:'operations',label:'Operations',order:65,icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 5V3h8v2M8 10h8M8 14h8M8 18h5"/></svg>',mount:mount});
})(typeof window!=='undefined'?window:globalThis);

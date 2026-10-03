import {companyConsole,WORK_FILTERS} from './company-console-model.mjs?v=20261003-company-console';

export function companyStyles(doc) {
 if(doc.getElementById('zcompany-console-css'))return;
 const link=doc.createElement('link');link.id='zcompany-console-css';link.rel='stylesheet';link.href='/assets/operations/company-console.css?v=20261003-company-console';doc.head.append(link);
}

export function mountCompanyConsole(root,{records,workspace,role,members=[],current,openCompany,openTask,startCompany}) {
 if(!['owner','admin','editor','viewer'].includes(role))throw Error('Current workspace access could not be verified.');
 const doc=root.ownerDocument;companyStyles(doc);
 const surface=doc.createElement('section');surface.className='zconsole';root.replaceChildren(surface);let dead=false;
 const model=companyConsole(records,workspace);
 const observer=new MutationObserver(()=>{if(!current()||!root.isConnected||!root.contains(surface))destroy();});observer.observe(doc.documentElement,{childList:true,subtree:true});
 function destroy(){if(dead)return;dead=true;observer.disconnect();surface.replaceChildren();}
 function active(){if(!dead&&(!current()||!root.isConnected||!root.contains(surface)))destroy();return !dead;}
 const text=(tag,value)=>{const node=doc.createElement(tag);node.textContent=value;return node;};
 function button(label,run){const b=text('button',label);b.type='button';b.onclick=()=>{if(active())run();};return b;}
 const hero=doc.createElement('div');hero.className='zconsole-hero';const intro=doc.createElement('div'),kicker=text('p','Company administration');kicker.className='zconsole-kicker';intro.append(kicker,text('h3','Run the business behind your business.'),text('p','Company records, people, deadlines and private files. One place to see what needs your attention and move it forward.'));hero.append(intro);if(['owner','admin'].includes(role))hero.append(button('+ Add company',startCompany));surface.append(hero);
 const metrics=doc.createElement('div');metrics.className='zcompany-metrics';for(const [value,label]of[[model.counts.companies,'Company records'],[model.counts.open,'Open tasks'],[model.counts.overdue,'Overdue'],[model.counts.unassigned,'Needs an assignee']]){const box=doc.createElement('div');box.className='zcompany-metric';box.append(text('strong',String(value)),text('span',label));metrics.append(box);}surface.append(metrics);
 surface.append(text('h3','Your companies'));const cards=doc.createElement('div');cards.className='zconsole-companies';
 for(const company of model.companies){const card=button('',()=>openCompany(company));card.className='zconsole-company';card.dataset.record=company.id;card.append(text('strong',company.title),text('span',company.data?.jurisdiction||'Jurisdiction not recorded'),text('span',company.journey.projects.length+' projects · '+company.journey.counts.overdue+' overdue tasks'),text('b','Open company →'));cards.append(card);}surface.append(cards);
 if(!model.companies.length){const empty=text('p',['owner','admin'].includes(role)?'Start with your company name. Add registration details when you have them, then organize people and work.':'No company records have been added. An owner or administrator can add the first company.');empty.className='zconsole-empty';surface.append(empty);}
 if(model.total){const heading=text('h3','Across your companies');surface.append(heading);const filter=doc.createElement('select');filter.setAttribute('aria-label','Workspace work filter');for(const [value,label]of Object.entries(WORK_FILTERS)){const o=text('option',label);o.value=value;filter.append(o);}const list=doc.createElement('div');surface.append(filter,list);
  function work(){if(!active())return;list.replaceChildren();const selected=companyConsole(records,workspace,{filter:filter.value});for(const task of selected.visible){const row=doc.createElement('article');row.className='zcompany-work-row';const body=doc.createElement('div');body.append(text('strong',task.title),text('p',task.company.title+' · '+task.project.title),text('p',(members.find(m=>m.profile_id===task.assignee_profile_id)?.display_name||'Unassigned')+' · '+(task.due_at?'Due '+new Date(task.due_at).toLocaleString():'No deadline')));row.append(body,button('Open task · '+task.title,()=>openTask(task)));list.append(row);}if(!selected.visible.length)list.append(text('p','No saved work matches this view.'));}filter.onchange=work;work();}
 return {destroy};
}

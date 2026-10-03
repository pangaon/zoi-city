import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {nativeActionPlanDraft,nativeActionDeadline,nativeActionPlanPayload} from '../src/companyActionPlan.ts';

test('native guided draft converts a real device-local deadline without mutating editable input',()=>{
  const previous=process.env.TZ;process.env.TZ='America/Toronto';
  try {
    const draft=nativeActionPlanDraft('employee');
    draft.tasks[0].localDate='2026-10-10';draft.tasks[0].localTime='09:30';
    const payload=nativeActionPlanPayload(draft);
    assert.equal(payload.tasks[0].due_at,'2026-10-10T13:30:00.000Z');
    assert.equal(draft.tasks[0].due_at,null);
    assert(!('localDate' in payload.tasks[0]));
    assert.equal(payload.tasks[1].due_at,null);
    draft.tasks[0].localDate='';draft.tasks[0].localTime='';
    assert.equal(nativeActionPlanPayload(draft).tasks[0].due_at,null);
  } finally {if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}
});
for(const [date,time] of [['2026-02-30','10:00'],['2026-13-01','10:00'],['2026-10-01','24:00'],['2026-10-01','09:60'],['2026-10-01',''],['','09:30'],['2026-1-01','09:30'],['2026-10-01','9:30']])test('invalid or incomplete native deadline refuses '+date+' '+time,()=>{
  assert.throws(()=>nativeActionDeadline(date,time),/deadline/);
});
test('nonexistent daylight-saving local time is rejected rather than moved one hour',()=>{
  const previous=process.env.TZ;process.env.TZ='America/Toronto';
  try {assert.throws(()=>nativeActionDeadline('2027-03-14','02:30'),/valid deadline/);}
  finally {if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}
});
test('deadline validation identifies the action needing correction',()=>{
  const draft=nativeActionPlanDraft('contractor');draft.tasks[2].localDate='wrong';
  assert.throws(()=>nativeActionPlanPayload(draft),/Action 3:/);
});
test('all four guided templates are available to the native editor',()=>{
  for(const id of ['records','employee','contractor','custom'])assert(nativeActionPlanDraft(id).tasks.length>0);
  assert.throws(()=>nativeActionPlanDraft('foreign-template'));
});
test('Metro normalizes only the exact accepted action-plan recovery import',()=>{
  const require=createRequire(import.meta.url),config=require('../metro.config.js');
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
  const origin=path.join(root,'assets/operations/company-action-plan-controller.mjs'),seen=[];
  const context={originModulePath:origin,resolveRequest:(_,name,platform)=>{seen.push({name,platform});return{type:'sourceFile',filePath:name};}};
  const exact='./recovery.mjs?v=20261003-current-suite-authority';
  config.resolver.resolveRequest(context,exact,'ios');assert.equal(seen.pop().name,'./recovery.mjs');
  for(const name of ['./recovery.mjs?v=unreviewed','../recovery.mjs?v=20261003-current-suite-authority','./recovery.mjs?v=20261003-current-suite-authority&extra=1','expo?v=20261003-current-suite-authority']){
    config.resolver.resolveRequest(context,name,'android');assert.equal(seen.pop().name,name);
  }
  config.resolver.resolveRequest({...context,originModulePath:path.join(root,'mobile/src/Operations.tsx')},exact,'web');assert.equal(seen.pop().name,exact);
});

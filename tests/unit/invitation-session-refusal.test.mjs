import test from'node:test';import assert from'node:assert/strict';
import{denied}from'../../assets/workspace/invitation-shared.mjs';
import{operationsDenied}from'../../assets/operations/recovery.mjs';
const matrix=[
 ['suite raw400',{status:400,message:'suite_session_unavailable'},true,true],
 ['suite typed400',{status:400,code:'suite_session_unavailable',message:'Sign in again.'},true,true],
 ['explicit401',{status:401,message:'Sign in'},true,true],
 ['explicit403',{status:403,message:'Access refused'},true,true],
 ['SQLpermission',{status:400,code:'42501',message:'Permission'},true,true],
 ['role raw400',{status:400,message:'not_authorized'},true,true],
 ['invitation raw400',{status:400,message:'invitation_unavailable'},true,true],
 ['generic400',{status:400,message:'Check the request details and try again.'},false,false],
 ['network',{status:0,message:'Connection interrupted'},false,false],
 ['CAS conflict',{status:400,message:'version_conflict'},false,false],
];
test('twenty actual refusal conditions distinguish authority from mutation uncertainty across Company/invitations',()=>{for(const[label,error,invite,company]of matrix){assert.equal(denied(error),invite,label+' invitation');assert.equal(operationsDenied(error),company,label+' Company');}});

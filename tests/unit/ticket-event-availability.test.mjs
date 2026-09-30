import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../../tickets/index.html',import.meta.url),'utf8');
const source=html.slice(html.indexOf('function ticketEventAvailability('),html.indexOf('/* A guest reopening'));
function fixture(result){
 const requests=[];const context={gaHistoryEpoch:0,gaHistory:[],gaHistoryError:'',gaReady:Promise.resolve(),GA:{read:()=>null},gaClearConfirmation(){context.confirmationCleared=true;},gaLoadHistory:async()=>{},PUB:{},app:{innerHTML:''},window:{dispatchEvent(){}},CustomEvent:class{},document:{title:''},qs:()=>null,PUBKEY:'public',PUBLIC_BASE:'/tickets/',rpc:async(name)=>{requests.push(name);return result;},errBlock:()=>'<p>Connection error</p>',paintHead(){},paintPublic(){},paintTicketView(){}};
 vm.createContext(context);vm.runInContext(source,context);return {context,requests};
}
test('malformed event ID is rejected before any network call',async()=>{const {context,requests}=fixture(null);await context.renderPublic('------------------------------------');assert.equal(requests.length,0);assert.equal(context.confirmationCleared,true);assert.match(context.app.innerHTML,/Event unavailable/);assert.equal(context.window.zoiTicketEventAvailable,false);});
test('unknown event does not fetch tiers or render reservation controls',async()=>{const {context,requests}=fixture(null);await context.renderPublic('00000000-0000-4000-8000-000000000001');assert.deepEqual(requests,['tickets_event_public']);assert.match(context.app.innerHTML,/Event unavailable/);assert.doesNotMatch(context.app.innerHTML,/Share this event|Show QR/);assert.equal(context.window.zoiTicketEventAvailable,false);});

import test from 'node:test';
import assert from 'node:assert/strict';
import {communityIntentLabel,communityResume,communityActorChanged} from '../src/communityIntent.ts';
test('sign-in retains question composer intent but cannot resume without an actor',()=>{
 const intent={route:{kind:'feed',mode:'questions'},compose:'question'};
 assert.equal(communityResume(intent,null),null);
 assert.equal(communityIntentLabel(intent),'ask the diaspora');
 assert.deepEqual(communityResume(intent,'new-member'),intent);
});
test('discussion return retains navigation and does not replay a reaction',()=>{
 const intent={route:{kind:'discussion',id:'public-post'}};
 const resumed=communityResume(intent,'member');
 assert.deepEqual(resumed,{route:{kind:'discussion',id:'public-post'}});
 assert.notEqual(resumed.route,intent.route);
 assert.equal(communityIntentLabel(intent),'return to the conversation');
 assert.equal(Object.hasOwn(resumed,'action'),false);
});

test('sign-in may retain public navigation but sign-out or account switch invalidates it',()=>{
 assert.equal(communityActorChanged('', 'member-a'),false);
 assert.equal(communityActorChanged('member-a','member-a'),false);
 assert.equal(communityActorChanged('member-a',''),true);
 assert.equal(communityActorChanged('member-a','member-b'),true);
});

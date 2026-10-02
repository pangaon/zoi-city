// Independent deterministic schedule over the retained full integration fixture.
import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const input=new URL('./event-service-lifecycle.integration.mjs',import.meta.url);
const output=new URL('./.event-service-control-independent-run.mjs',import.meta.url);
let source=readFileSync(input,'utf8');
const before="const controlRace=await Promise.allSettled([";
if(!source.includes(before))throw Error('Control fixture changed; review overlay');
source=source.replace(before,`const controlBlock=q(\`set application_name='independent-control-barrier';begin;select pg_advisory_xact_lock(hashtextextended('event-service-actor:'||'\${actor}',0));select pg_advisory_xact_lock(hashtextextended('event-service-actor:'||'\${adminActor}',0));select pg_sleep(2);commit;\`,false);for(let n=0;n<100;n++){if(await q("select exists(select 1 from pg_stat_activity where application_name='independent-control-barrier'and wait_event='PgSleep')",false)==='t')break;await new Promise(r=>setTimeout(r,10));}const controlPending=Promise.allSettled([`);
// Keep the replacement anchored to the concrete fixture's query ending.
const actual=").then(JSON.parse)]);assert.equal(controlRace.filter";
if(!source.includes(actual))throw Error('Control result fixture changed; review overlay');
source=source.replace(actual,`).then(JSON.parse)]);let queued=0;for(let n=0;n<100;n++){queued=Number(await q("select count(*)from pg_stat_activity where datname=current_database()and wait_event_type='Lock'and query like '%select public.event_service_control(%'",false));if(queued===2)break;await new Promise(r=>setTimeout(r,10));}assert.equal(queued,2,'both controls must be blocked before receipt locks release');const controlRace=await controlPending;await controlBlock;console.log('PASS independent deterministic two-control receipt barrier');assert.equal(controlRace.filter`);
try{writeFileSync(output,source);execFileSync(process.execPath,[output.pathname],{stdio:'inherit'});}finally{try{unlinkSync(output);}catch{}}

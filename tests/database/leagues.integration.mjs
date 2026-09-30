#!/usr/bin/env node
// Real isolated PostgreSQL transactions; no Supabase/network calls.
// Requires PostgreSQL16 server binaries installed. Run explicitly with node.
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import assert from 'node:assert/strict';
import {createLayout,seatRows} from '../../assets/tickets/venue-model.mjs';
const run=promisify(execFile),dir=mkdtempSync(join(tmpdir(),'zoi-seats-pg-')),bin=process.env.PG_BIN||'/usr/lib/postgresql/16/bin';
const port=15491;const env={...process.env,PGHOST:dir,PGPORT:String(port),PGDATABASE:'postgres'};
const actor='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002',member='00000000-0000-4000-8000-000000000003',ws='10000000-0000-4000-8000-000000000001',event='20000000-0000-4000-8000-000000000001';
const literal=x=>"'"+String(x).replace(/'/g,"''")+"'";
const sql=(query,user)=>`${user?`set role authenticated;select set_config('request.jwt.claim.sub','${user}',false);`:''}${query}`;
async function query(q,user){const r=await run(join(bin,'psql'),['-X','-qAt','-v','ON_ERROR_STOP=1','-c',sql(q,user)],{env});return r.stdout.trim().split('\n').filter(Boolean).at(-1);}
async function rejects(q,user,pattern){try{await query(q,user);assert.fail('Expected SQL rejection');}catch(e){assert.match(e.stderr||e.message,pattern);}}
let started=false,checks=0;
const pass=name=>{checks++;console.log('PASS '+name);};
try{
 execFileSync(join(bin,'initdb'),['-D',join(dir,'data'),'-A','trust','--no-locale'],{stdio:'ignore'});
 execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-l',join(dir,'server.log'),'-o',`-k ${dir} -p ${port} -c listen_addresses=''`,'-w','start'],{stdio:'ignore'});started=true;
 await query(readFileSync(new URL('./venue-fixture.sql',import.meta.url),'utf8'));
 await query(`alter table zoi.user_profiles add column display_name text;alter table zoi.listings add column name text default 'QA host',add column slug text default 'qa-host',add column city text default 'Athens',add column country text default 'Greece';update zoi.workspace_members set role='viewer' where profile_id='${member}';`);
 for(const file of ['20260930001738_business_operations_foundation.sql','20260930043127_artist_appearances_and_private_trips.sql','20260930043129_adult_football_league_operations.sql'])await query(readFileSync(new URL('../../supabase/migrations/'+file,import.meta.url),'utf8'));
 const call=(fn,args,user=actor)=>query(`select public.${fn}(${args});`,user).then(JSON.parse),j=x=>literal(JSON.stringify(x))+'::jsonb',req=n=>`80000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 const ws2='10000000-0000-4000-8000-000000000002',club=req(100),season=req(1),home=req(2),away=req(3),fixture=req(4);
 await query(`update zoi.listings set entity_type='sports' where id='${event}';insert into zoi.workspace_members values('${ws2}','${other}','owner');insert into zoi.listings(id,owner_workspace_id,entity_type,publish_status,marketplace_status,name,slug) values('${club}','${ws2}','sports','published','','Actual opponent club','actual-opponent');`);
 const form={host_id:event,host_kind:'league',name:'Synthetic adult competition',timezone:'Europe/Athens',starts_on:'2020-01-01',ends_on:'2020-12-31',published:false};
 await rejects(`select public.football_season_save('${ws}','${season}',0,${j(form)});`,member,/football_permission_denied/);pass('viewer cannot configure a competition');
 const copies=await Promise.all([call('football_season_save',`'${ws}','${season}',0,${j(form)}`),call('football_season_save',`'${ws}','${season}',0,${j(form)}`)]);assert.equal(copies[0].season.id,copies[1].season.id);assert.equal((await call('football_public',`null,'${season}'`)).season,null);pass('concurrent season creation is idempotent and drafts stay private');
 await call('football_season_save',`'${ws}','${season}',1,${j({...form,published:true})}`);assert.equal((await call('football_public',`null,'${season}'`)).season.host_kind,'league');pass('only explicit organizer publication exposes configured season identity');
 const ownTeam={club_id:event,name:'Senior team',contact_notes:'Private organizer contact',adult_confirmed:true},otherTeam={club_id:club,name:'Opponent adults',contact_notes:'Private opponent contact',adult_confirmed:true};
 await rejects(`select public.football_team_submit('${ws}','${season}','${req(9)}',${j(otherTeam)},false);`,actor,/football_adult_club_authorization_required/);pass('organizer cannot impersonate another club application');
 await call('football_team_submit',`'${ws}','${season}','${home}',${j(ownTeam)},false`);await call('football_team_decide',`'${ws}','${home}',1,'approve'`);
 let team=(await call('football_team_submit',`'${ws}','${season}','${away}',${j(otherTeam)},true`)).team;assert.equal(team.status,'invited');await rejects(`select public.football_team_decide('${ws}','${away}',1,'approve');`,actor,/football_transition_denied/);await call('football_team_decide',`'${ws2}','${away}',1,'accept_adult_invitation'`,other);await call('football_team_decide',`'${ws}','${away}',2,'approve'`);pass('invitation requires adult club acceptance then organizer approval');
 const publicTeams=(await call('football_public',`null,'${season}'`)).teams;assert.equal(publicTeams.length,2);assert.equal(JSON.stringify(publicTeams).includes('contact_notes'),false);const view=await call('football_operator',`'${ws2}','${season}'`,other);assert.equal(view.teams.find(t=>t.id===home).contact_notes,undefined);assert.equal(view.audit.length,0);pass('public and opposing club views exclude private contact and audit data');
 const match={home_id:home,away_id:away,starts_at:'2020-06-01T15:00:00Z',ends_at:'2020-06-01T17:00:00Z',timezone:'Europe/Athens',venue:'Organizer-entered ground',published:true};
 const races=await Promise.allSettled([call('football_fixture_save',`'${ws}','${season}','${fixture}',0,${j(match)}`),call('football_fixture_save',`'${ws}','${season}','${req(5)}',0,${j(match)}`)]);assert.equal(races.filter(r=>r.status==='fulfilled').length,1);let f=races.find(r=>r.status==='fulfilled').value.fixture;pass('concurrent overlapping fixtures for one team cannot both be scheduled');
 f=(await call('football_score_submit',`'${ws}','${f.id}',1,2,1`)).fixture;let pub=await call('football_public',`null,'${season}'`);assert.equal(pub.fixtures[0].home_score,null);await rejects(`select public.football_score_decide('${ws}','${f.id}',2,'confirm','');`,actor,/football_independent_confirmation_required/);pass('proposed scores remain unconfirmed and cannot self-confirm');
 f=(await call('football_score_decide',`'${ws2}','${f.id}',2,'dispute','Score needs correction'`,other)).fixture;assert.equal(f.status,'disputed');await call('football_score_submit',`'${ws}','${f.id}',3,1,1`);f=(await call('football_score_decide',`'${ws2}','${f.id}',4,'confirm',''`,other)).fixture;assert.equal(f.status,'confirmed');pub=await call('football_public',`null,'${season}'`);assert.equal(pub.fixtures[0].home_score,1);pass('opponent dispute excludes result until corrected proposal is independently confirmed');
 await rejects(`select public.football_fixture_save('${ws}','${season}','${f.id}',5,${j(match)});`,actor,/football_fixture_locked/);await call('football_fixture_save',`'${ws}','${season}','${f.id}',5,${j({...match,cancelled:true,reason:'Synthetic result voided'})}`);assert.equal((await call('football_public',`null,'${season}'`)).fixtures[0].status,'cancelled');pass('confirmed result cannot be silently edited and explicit cancellation preserves audit');
 await query(`update zoi.listings set owner_workspace_id=null where id='${event}';`);assert.equal((await call('football_public',`null,'${season}'`)).season,null);pass('host ownership transfer removes obsolete public competition authority');
 await rejects('select * from zoi.football_teams;',other,/permission denied/);pass('team applications remain inaccessible through direct database grants');
 console.log(`${checks} adult football database checks passed`);
}finally{if(started)execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-m','immediate','-w','stop'],{stdio:'ignore'});rmSync(dir,{recursive:true,force:true});}

import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=new URL('../../',import.meta.url),read=p=>readFileSync(new URL(p,root),'utf8');

const migrationPath='supabase/migrations/20261002234013_explore_public_card_source_projection.sql',migration=read(migrationPath);
const preflight=JSON.parse(read('docs/audits/evidence/discovery-media-readers-preflight-2026-10-02.json'));
const liveDiagnosis=JSON.parse(read('docs/audits/evidence/explore-global-parent-timeout-diagnosis-2026-10-02.json'));
const dir=mkdtempSync(join(tmpdir(),'zoi-explore-card-')),bin='/usr/lib/postgresql/16/bin',env={...process.env,PGHOST:dir,PGPORT:process.env.QA_EXPLORE_CARD_PGPORT||'15716',PGDATABASE:'postgres'};
const q=s=>execFileSync(join(bin,'psql'),['-X','-qAt','-v','ON_ERROR_STOP=1','-c',s],{env,encoding:'utf8',maxBuffer:30*1024*1024,stdio:['pipe','pipe','pipe']}).trim();
const json=s=>JSON.parse(q(s)),lit=v=>v===null?'NULL':Array.isArray(v)?'ARRAY['+v.map(lit).join(',')+']::text[]':typeof v==='number'?String(v):"'"+v.replaceAll("'","''")+"'";
const functions=preflight.functions.filter(f=>f.signature.startsWith('explore_search'));
const rows=(a,array=false)=>json(`SELECT public.${array?'explore_search_types':'explore_search'}(${a.map(lit).join(',')})`);
const meta=()=>json(`SELECT jsonb_agg(jsonb_build_object('definition',pg_get_functiondef(p.oid),'owner',p.proowner::regrole::text,'acl',p.proacl::text,'config',p.proconfig,'stable',p.provolatile,'definer',p.prosecdef,'args',pg_get_function_arguments(p.oid),'returns',pg_get_function_result(p.oid)) ORDER BY p.proname) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN('explore_search','explore_search_types')`);
const digest=()=>q("SELECT md5(string_agg(to_jsonb(l)::text,'' ORDER BY id)) FROM zoi.listings l");
const plan=()=>json('EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) '+liveDiagnosis.query);
const flatten=p=>[p,...(p.Plans||[]).flatMap(flatten)];
let started=false,passed=0;const pass=s=>{passed++;console.log('PASS '+s)};
const start=()=>{execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-l',join(dir,'log'),'-o',`-k ${dir} -p ${env.PGPORT} -c listen_addresses='' -c shared_buffers=32MB -c max_parallel_workers_per_gather=0`,'-w','start'],{stdio:'ignore'});started=true;};
const restart=()=>{execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-m','fast','-w','stop'],{stdio:'ignore'});started=false;start();};
try{
 execFileSync(join(bin,'initdb'),['-D',join(dir,'data'),'-A','trust','--locale=en_US.UTF-8','--encoding=UTF8'],{stdio:'ignore'});start();
 q(`CREATE ROLE postgres SUPERUSER;CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA zoi;CREATE EXTENSION pg_trgm;
 CREATE TABLE zoi.categories(id bigint PRIMARY KEY,label_en text);
 CREATE TABLE zoi.listings(id uuid PRIMARY KEY,slug text,name text,description text,profile jsonb DEFAULT '{}'::jsonb,primary_category_id bigint,entity_type text,city text,country text,region text,region_native text,region_code text,verification_status text,trust_score numeric,rating numeric,photo_url text,owner_workspace_id uuid,claim_status text,publish_status text,moderation_status text,marketplace_status text,search_tsv tsvector,padding text,website text,phone text,email text,updated_by text,social_links jsonb);
 ALTER TABLE zoi.listings ALTER COLUMN padding SET STORAGE PLAIN;ALTER TABLE zoi.listings ALTER COLUMN profile SET STORAGE PLAIN;
 ALTER TABLE zoi.listings ENABLE ROW LEVEL SECURITY;ALTER TABLE zoi.categories ENABLE ROW LEVEL SECURITY;
 CREATE INDEX listings_public_discovery_counts_idx ON zoi.listings(country,region,city) INCLUDE(region_code,region_native) WHERE publish_status='published' AND moderation_status IN ('clean','cleared') AND coalesce(marketplace_status,'')<>'hidden';
 CREATE INDEX fixture_name ON zoi.listings USING gin(lower(name)gin_trgm_ops);CREATE INDEX fixture_fts ON zoi.listings USING gin(search_tsv);
 INSERT INTO zoi.categories VALUES(1,'Events'),(2,'Restaurants');`);
 const geo=read('supabase/migrations/0039_canonical_geography_contract.sql');q(geo.slice(geo.indexOf('create or replace function zoi.geo_country_canon'),geo.indexOf('$function$;',geo.indexOf('as $function$'))+12));
 for(const f of functions){q(f.definition);q(`ALTER FUNCTION public.${f.signature} OWNER TO postgres;GRANT EXECUTE ON FUNCTION public.${f.signature} TO anon,authenticated,service_role;REVOKE EXECUTE ON FUNCTION public.${f.signature} FROM PUBLIC;`);assert.equal(q(`SELECT md5(pg_get_functiondef('public.${f.signature}'::regprocedure))`),f.definition_md5);}
 assert.equal(q("SELECT md5(pg_get_functiondef('zoi.geo_country_canon(text)'::regprocedure))"),'a4610e0eee4af255cbc37d228b248be9');
 pass('exact installed scalar/types source and canonicalizer reconstructed, with owner/ACL');
 q(`INSERT INTO zoi.listings(id,slug,name,description,profile,primary_category_id,entity_type,city,country,region,region_native,region_code,verification_status,trust_score,rating,photo_url,owner_workspace_id,claim_status,publish_status,moderation_status,marketplace_status,search_tsv,padding) SELECT md5(i::text)::uuid,'fixture-'||i,
 CASE WHEN i%4=0 THEN '  Shared '||i/4||'  ' WHEN i%4=1 THEN 'shared '||(i-1)/4 ELSE 'Fixture '||lpad(i::text,6,'0') END,
 'Base description '||i,jsonb_build_object('fixture_payload',repeat(md5(i::text),64))||CASE WHEN i%5=0 THEN '{"hero_kind":"event_poster","hero_url":"https://fixture.example/poster.jpg","photo_url":"https://fixture.example/poster.jpg"}'::jsonb ELSE jsonb_build_object('_enrich',jsonb_build_object('description','Source description '||i,'photo_url','https://fixture.example/'||i||'.jpg')) END,
 CASE WHEN i%8=0 THEN NULL ELSE 1+i%2 END,(ARRAY['business','event','church','creator','travel_place','artist'])[1+i%6],
 CASE WHEN i%4 IN(0,1) THEN 'Toronto' ELSE (ARRAY['Toronto','Montréal','Αθήνα','',NULL,'Old Toronto'])[1+i%6] END,
 CASE WHEN i%4=0 THEN 'Canada' WHEN i%4=1 THEN 'ca' ELSE (ARRAY['Canada','ca','USA','United States','',NULL,'Ελλάδα'])[1+i%7] END,
 'Ontario','Οντάριο','CA-ON',CASE WHEN i%11=0 THEN NULL WHEN i%3=0 THEN 'verified' ELSE 'unverified' END,
 CASE WHEN i%13=0 THEN NULL ELSE (i%100)::numeric/100 END,CASE WHEN i%10=0 THEN NULL ELSE (i%50)::numeric/10 END,
 CASE WHEN i%8=0 THEN NULL ELSE 'https://fixture.example/'||i||'.jpg' END,CASE WHEN i%14=0 THEN md5('owner-'||i)::uuid END,
 CASE WHEN i%14=0 THEN 'claimed' ELSE 'unclaimed' END,CASE WHEN i%29=0 THEN 'draft' ELSE 'published' END,
 CASE WHEN i%31=0 THEN NULL WHEN i%17=0 THEN 'pending' WHEN i%5=0 THEN 'cleared' ELSE 'clean' END,
 CASE WHEN i%37=0 THEN 'hidden' WHEN i%41=0 THEN NULL ELSE '' END,to_tsvector('simple','Greek signature fixture spa'),repeat(md5(i::text),110) FROM generate_series(1,6000) i;
 INSERT INTO zoi.listings(id,slug,name,entity_type,city,country,profile,publish_status,moderation_status,marketplace_status,trust_score) VALUES
 ('90000000-0000-4000-8000-000000000001','sparse','Sparse cleared parish','church','Sparse','Canada','{}','published','cleared',NULL,NULL),
 ('90000000-0000-4000-8000-000000000002','hidden','Hidden perfect event','event','Sparse','Canada','{}','published','clean','hidden',100),
 ('90000000-0000-4000-8000-000000000003','pending','Pending perfect business','business','Sparse','Canada','{}','published','pending','',100);
 INSERT INTO zoi.listings(id,slug,name,entity_type,city,country,publish_status,moderation_status) SELECT md5('edge-'||i)::uuid,'edge-'||i,'Amara', 'business',c,'CY','published','clean' FROM unnest(ARRAY['Λεμεσός','ΛΕΜΕΣΌΣ','100% City','Under_score','Back\\slash','İstanbul','istanbul','Québec','QUÉBEC',' A town ','']) WITH ORDINALITY AS x(c,i);`);
 q('VACUUM (ANALYZE,PARALLEL 0) zoi.listings;');

 const ownerPreflight=JSON.parse(read('docs/audits/evidence/discovery-card-owner-prerequisite-2026-10-02.json'));q(ownerPreflight.definition);q(`ALTER FUNCTION zoi.public_owner_content(uuid) OWNER TO postgres;REVOKE ALL ON FUNCTION zoi.public_owner_content(uuid) FROM PUBLIC,anon,authenticated,service_role;`);
 assert.equal(q("SELECT md5(pg_get_functiondef('zoi.public_owner_content(uuid)'::regprocedure))"),ownerPreflight.definition_md5);
 q(read('supabase/migrations/20261002232848_explore_public_global_covering_rank_index.sql'));
 const corpus=digest(),beforeMeta=meta(),cases=[];
 for(const query of[null,'','SIGNAT','%','_', 'Amar'])for(const city of[null,'Toronto','Tor%','Sparse','ΛΕΜΕΣΌΣ','100\\% City','no-match'])cases.push([query,null,city,null,24,0,null]);
 for(const limit of[null,0,1,48,1000])cases.push([null,null,null,null,limit,2,null]);for(const offset of[null,-2,24,48,90000])cases.push([null,null,null,null,24,offset,null]);
 const arrayCases=[[null,null,null,null,24,0,null],[null,[],null,null,24,0,null],[null,['artist','business'],null,null,24,0,null],['SIGNAT',['event','church'],'Tor%',null,48,24,null],['Amar',['business'],'ΛΕΜΕΣΌΣ','CY',24,0,null]];
 const withoutProjection=result=>result.map(({media_input,description,photo_url,image_kind,...rest})=>rest),expected=cases.map(a=>withoutProjection(rows(a))),arrayExpected=arrayCases.map(a=>withoutProjection(rows(a,true)));pass(cases.length+' scalar / '+arrayCases.length+' array unchanged ranking/ID/filter/projection oracle snapshots');
 q(`GRANT EXECUTE ON FUNCTION public.${functions[0].signature} TO PUBLIC`);assert.throws(()=>q(migration),/explore_card_projection_prerequisite_changed/);q(`REVOKE EXECUTE ON FUNCTION public.${functions[0].signature} FROM PUBLIC`);
 q(functions[0].definition.replace("CASE l.entity_type WHEN 'creator' THEN 0", "CASE l.entity_type WHEN 'creator' THEN 9"));assert.throws(()=>q(migration),/explore_card_projection_prerequisite_changed/);q(functions[0].definition);pass('installed reader body/ACL guards refuse drift');
 q('GRANT EXECUTE ON FUNCTION zoi.public_owner_content(uuid) TO PUBLIC');assert.throws(()=>q(migration),/explore_card_projection_prerequisite_changed/);q('REVOKE EXECUTE ON FUNCTION zoi.public_owner_content(uuid) FROM PUBLIC');pass('existing owner projection authority guard rejects public ACL drift');
 q('CREATE ROLE qa_projection_drift');
 for(const signature of ['public.'+functions[0].signature,'zoi.public_owner_content(uuid)']){
  q(`ALTER FUNCTION ${signature} OWNER TO qa_projection_drift`);
  assert.throws(()=>q(migration),/explore_card_projection_prerequisite_changed/);
  q(`ALTER FUNCTION ${signature} OWNER TO postgres`);
 }
 pass('independent actual reader and owner-helper ownership drift refusal');
 q("CREATE FUNCTION zoi.public_listing_card_image(text,boolean) RETURNS text LANGUAGE SQL AS $$SELECT $1$$");
 assert.throws(()=>q(migration),/explore_card_projection_prerequisite_changed/);
 q('DROP FUNCTION zoi.public_listing_card_image(text,boolean)');
 pass('independent preexisting helper blocks installation');
 const beforePlan=plan();q(migration);assert.equal(digest(),corpus);assert.deepEqual(meta().map(({definition,...rest})=>rest),beforeMeta.map(({definition,...rest})=>rest));
 for(let i=0;i<cases.length;i++)assert.deepEqual(withoutProjection(rows(cases[i])),expected[i]);for(let i=0;i<arrayCases.length;i++)assert.deepEqual(withoutProjection(rows(arrayCases[i],true)),arrayExpected[i]);pass('scalar/types rank/ID/category/claim/canonical/pagination invariant; only bounded media, photo and description projection changed');
 for(const role of['anon','authenticated','service_role']){assert.equal(q(`SET ROLE ${role};SELECT jsonb_array_length(public.explore_search(NULL,'church','Sparse',NULL,24,0,NULL))`),'1');for(const helper of ["zoi.public_listing_card_input(NULL,NULL,NULL,NULL,'{}')","zoi.public_listing_card_description('artist','{}')","zoi.public_listing_card_source_bound('{}')","zoi.public_listing_card_image('https://cdn.example/image.jpg',false)","zoi.public_listing_card_photo('{}')"])assert.throws(()=>q(`SET ROLE ${role};SELECT ${helper}`),/permission denied/);assert.throws(()=>q(`SET ROLE ${role};SELECT * FROM zoi.listings`),/permission denied/);}pass('private helpers uncallable by existing public/service roles; public definer read works');
 const id='90000000-0000-4000-8000-000000000001',single=()=>rows([null,null,'Sparse',null,24,0,null])[0];
 q(`UPDATE zoi.listings SET entity_type='artist',website='https://source.example/artist/',description='Old base biography',profile='{"_enrich":{"source_url":"https://www.source.example/artist/","description":"New trusted artist biography","hero_url":"https://cdn.example/portrait.jpg","logo_url":"https://cdn.example/logo.png","photo_urls":["https://cdn.example/portrait.jpg"]}}' WHERE id='${id}'`);
 let r=single();assert.equal(r.description,'New trusted artist biography');assert.equal(r.photo_url,'https://cdn.example/portrait.jpg');assert.equal(r.image_kind,null);assert.equal(r.media_input.profile._enrich.hero_url,'https://cdn.example/portrait.jpg');pass('source-bound current artist biography and image provenance projected');
 for(const profile of[{website:null,_enrich:{source_url:'https://source.example/artist/',description:'Must suppress'}},{website:'https://other.example/',_enrich:{source_url:'https://source.example/artist/',description:'Must suppress'}}]){q(`UPDATE zoi.listings SET profile=${lit(JSON.stringify(profile))}::jsonb WHERE id='${id}'`);assert.equal(single().description,'Old base biography');assert.equal(single().photo_url,null);}
 q(`UPDATE zoi.listings SET profile='\"invalid raw profile\"'::jsonb WHERE id='${id}'`);assert.equal(single().description,'Old base biography');
 q(`UPDATE zoi.listings SET profile=${lit(JSON.stringify(r.media_input.profile))}::jsonb WHERE id='${id}'`);pass('raw authored website clear/change and malformed profile do not restore imported biography');
 for(const [field,value]of[['source_kind','association_directory'],['source_kind','association_member'],['identity_scope','organization'],['blocked_reason','source_scope_mismatch'],['organization_identity_quarantine',true],['scope_review_required',true],['source_affiliation','Other organization'],['association_member',{id:'unrelated'}]]){
  q(`UPDATE zoi.listings SET profile=jsonb_set(profile,ARRAY['_enrich',${lit(field)}],${lit(JSON.stringify(value))}::jsonb) WHERE id='${id}'`);assert.equal(single().description,'Old base biography');assert.equal(single().photo_url,null);q(`UPDATE zoi.listings SET profile=profile#-ARRAY['_enrich',${lit(field)}] WHERE id='${id}'`);
 }
 q(`UPDATE zoi.listings SET profile=jsonb_set(profile,'{_enrich,member}','{"affiliation":"Other"}') WHERE id='${id}'`);assert.equal(single().description,'Old base biography');assert.equal(single().photo_url,null);q(`UPDATE zoi.listings SET profile=profile#-'{_enrich,member}' WHERE id='${id}'`);
 for(const website of['https://other.example/artist/','https://source.example/other/','https://user:pw@source.example/artist/','https://source.example:444/artist/']){q(`UPDATE zoi.listings SET website=${lit(website)} WHERE id='${id}'`);assert.equal(single().description,'Old base biography');}
 q(`UPDATE zoi.listings SET website='https://source.example/artist/' WHERE id='${id}'`);pass('mismatched host/path/port/protocol/credentials and all scope quarantine flags suppress machine biography');
 q(`UPDATE zoi.listings SET website='http://source.example/artist/',profile=jsonb_set(profile,'{_enrich,source_url}','\"http://source.example/artist/\"') WHERE id='${id}'`);assert.equal(single().description,'New trusted artist biography');
 q(`UPDATE zoi.listings SET profile=jsonb_set(profile,'{_enrich,photo_url}','\"https://source.example/wp-content/plugins/qtranslate-x/flags/gr.png\"')#-'{_enrich,hero_url}'#-'{_enrich,photo_urls}' WHERE id='${id}'`);assert.equal(single().photo_url,null);pass('legacy search consumers do not receive a translation flag as a portrait');
 q(`UPDATE zoi.listings SET entity_type='church',description='Reviewed church summary' WHERE id='${id}'`);assert.equal(single().description,'Reviewed church summary');
 q(`UPDATE zoi.listings SET description=NULL WHERE id='${id}'`);assert.equal(single().description,'New trusted artist biography');pass('nonartist reviewed base summary retained; trusted source fills only missing base');
 q(`UPDATE zoi.listings SET updated_by='suite-bizpage',description=NULL,photo_url=NULL,website='https://source.example/artist/',profile=profile||'{"private_owner_token":"never expose","_meta":{"updated_by":"owner","audit":"never expose"},"photos":[]}' WHERE id='${id}'`);
 r=single();assert.equal(r.description,'');assert.equal(Object.hasOwn(r.media_input.owner_content,'description'),true);assert.equal(r.media_input.owner_content.description,null);assert.equal(r.media_input.owner_content.photo_url,null);assert.equal(r.photo_url,null);assert.deepEqual(r.media_input.owner_content.profile.photos,[]);assert.ok(!JSON.stringify(r).includes('never expose'));pass('owner base clears and empty gallery remain explicit, source/private audit data excluded');
 q(`UPDATE zoi.listings SET description='Owner new summary',photo_url='https://owner.example/image.jpg' WHERE id='${id}'`);r=single();assert.equal(r.photo_url,'https://owner.example/image.jpg');assert.equal(r.description,'Owner new summary');assert.equal(r.media_input.owner_content.photo_url,'https://owner.example/image.jpg');
 q(`UPDATE zoi.listings SET updated_by=NULL,description='Base summary',profile=profile||'{"description":"","hero_url":null,"brand":{"logo":null}}' WHERE id='${id}'`);r=single();assert.equal(r.description,'');assert.equal(r.media_input.profile.hero_url,null);assert.equal(r.photo_url,null);assert.deepEqual(r.media_input.profile.brand,{logo:null});pass('owner edit then raw explicit description/hero/logo clear preserve presence');
 q('ALTER TABLE zoi.listings ALTER COLUMN profile SET STORAGE EXTENDED');
 q(`UPDATE zoi.listings SET profile=jsonb_build_object('_enrich',jsonb_build_object('source_url','https://source.example/artist/','description',repeat('Long ',1000),'photos',(SELECT jsonb_agg('https://cdn.example/'||i||'.jpg') FROM generate_series(1,100)i),'private_payload',repeat('PRIVATE',1000)),'description',repeat('Owner ',1000),'photos',false) WHERE id='${id}'`);r=single();assert.equal(r.description.length,170);assert.equal(r.media_input.profile.description.length,2000);assert.equal(r.media_input.profile._enrich.description.length,2000);assert.equal(r.media_input.profile._enrich.photos.length,12);assert.deepEqual(r.media_input.profile.photos,[]);assert.ok(!JSON.stringify(r).includes('PRIVATE'));pass('machine/owner excerpts and galleries bounded; malformed explicit gallery means empty and no private payload');
 q(`UPDATE zoi.listings SET profile=jsonb_build_object('hero_url','https://owner.example/'||repeat('x',3001),'brand',jsonb_build_object('logo','https://owner.example/'||repeat('x',3001))) WHERE id='${id}'`);r=single();assert.equal(r.media_input.profile.hero_url,null);assert.equal(r.photo_url,null);assert.equal(r.media_input.profile.brand.logo,null);pass('oversized URLs rejected intact rather than truncating into different image identity');
 const photoCase=(profile,expected,kind=null)=>{q(`UPDATE zoi.listings SET updated_by=NULL,website='https://source.example/',description='Base',photo_url=NULL,profile=${lit(JSON.stringify(profile))}::jsonb WHERE id='${id}'`);for(const array of[false,true]){const out=rows([null,array?['church']:null,'Sparse',null,24,0,null],array)[0];assert.equal(out.photo_url,expected);assert.equal(out.image_kind,kind);}};
 photoCase({_enrich:{source_url:'https://source.example/',hero_url:'https://cdn.example/festival.jpg',photo_urls:['https://cdn.example/festival.jpg','https://cdn.example/room.jpg'],photo_roles:[{url:'https://cdn.example/festival.jpg',role:'gallery_only'}]}},'https://cdn.example/room.jpg');pass('gallery-only source image cannot become scalar or types card hero');
 q(`UPDATE zoi.listings SET photo_url='https://cdn.example/festival.jpg' WHERE id='${id}'`);assert.equal(single().photo_url,'https://cdn.example/room.jpg');q(`UPDATE zoi.listings SET profile=profile||'{"photos":[]}' WHERE id='${id}'`);assert.equal(single().photo_url,'https://cdn.example/festival.jpg');pass('base source photo obeys exact gallery-only roles; explicit owner gallery overrides imported roles');
 photoCase({photos:['https://owner.example/chosen.jpg'],_enrich:{source_url:'https://other.example/',hero_url:'https://other.example/import.jpg'}},'https://owner.example/chosen.jpg');pass('explicit owner gallery remains usable after imported source identity changes');
 photoCase({hero_url:'https://source.example/poster.jpg',hero_kind:'event_poster',_enrich:{source_url:'https://source.example/'}},'https://source.example/poster.jpg','event_poster');
 photoCase({photo_url:'https://owner.example/photo.jpg',hero_url:'https://source.example/poster.jpg',hero_kind:'event_poster'},'https://owner.example/photo.jpg');
 photoCase({photo_url:null,hero_url:'https://source.example/poster.jpg',hero_kind:'event_poster'},null);pass('scalar/types event poster, owner alternate photo and explicit clear preserve kind/authority');
 photoCase({_enrich:{source_url:'https://other.example/',hero_url:'https://other.example/import.jpg'}},null);photoCase({_enrich:{source_url:'https://source.example/',scope_review_required:true,hero_url:'https://cdn.example/import.jpg'}},null);pass('legacy scalar/types photos also suppress changed-source or quarantined imagery');
 const helpers=json("SELECT jsonb_agg(jsonb_build_object('name',proname,'definer',prosecdef,'owner',proowner::regrole::text,'acl',proacl::text,'config',proconfig) ORDER BY proname) FROM pg_proc WHERE pronamespace='zoi'::regnamespace AND proname LIKE 'public_listing_card_%'");assert.equal(helpers.length,5);for(const helper of helpers){assert.equal(helper.definer,false);assert.equal(helper.owner,'postgres');assert.equal(helper.acl,'{postgres=X/postgres}');assert.deepEqual(helper.config,['search_path=""']);}pass('all five helpers private security invoker with empty search path and exact ACL');
 // Extract the exact new global branch with neutral parameters, preserving the
 // page/materialization and private projection placement in its actual plan.
 const def=q("SELECT pg_get_functiondef('public.explore_search(text,text,text,text,integer,integer,text)'::regprocedure)");
 let inner=def.slice(def.indexOf('RETURN (WITH ranked')+8,def.lastIndexOf(');')).trim();
 const vals={v_q:"''",v_pattern:"'%%'",p_city:'NULL',p_country:'NULL',p_type:'NULL',p_region:'NULL',p_limit:'24',p_offset:'0'};inner=inner.replace(/\b(v_q|v_pattern|p_city|p_country|p_type|p_region|p_limit|p_offset)\b/g,k=>vals[k]);
 const afterPlan=json('EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) '+inner);assert.ok(flatten(afterPlan[0].Plan).some(p=>p['Node Type']==='Index Only Scan'&&p['Index Name']==='listings_public_global_rank_idx'));pass('new helper remains after bounded page; unforced global dedupe stays covering index-only');
 assert.throws(()=>q(migration),/explore_card_projection_prerequisite_changed/);pass('projection replay refuses changed source');
 q('DELETE FROM zoi.listings');assert.deepEqual(rows([null,null,null,null,24,0,null]),[]);assert.deepEqual(rows([null,[],null,null,24,0,null],true),[]);pass('empty output shape preserved');
 const evidence={controlled_isolated_database:true,production_applied:false,rows:6014,scalar_oracle_cases:cases.length,types_oracle_cases:arrayCases.length,helper_metadata:helpers,metadata_before:beforeMeta,metadata_after:meta(),plans:{before:beforePlan,after:afterPlan},migration:migrationPath,migration_sha256:createHash('sha256').update(migration).digest('hex'),groups_passed:passed};
 writeFileSync(process.env.QA_EXPLORE_CARD_EVIDENCE||'/tmp/zoi-explore-card.json',JSON.stringify(evidence,null,2));console.log(passed+' card projection database groups passed');
}finally{if(started)execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-m','immediate','stop'],{stdio:'ignore'});rmSync(dir,{recursive:true,force:true});}

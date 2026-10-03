// Builds an unapplied, guarded candidate from exact retained installed definitions.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const evidence=new URL('../docs/audits/evidence/company-document-current-session-producer-2026-10-03/',import.meta.url);
const rows=JSON.parse(readFileSync(new URL('baseline-functions.json',evidence),'utf8'));
const policies=JSON.parse(readFileSync(new URL('baseline-policies.json',evidence),'utf8'));
const target=new URL('../supabase/migrations/20261003032635_company_document_current_session.sql',import.meta.url);
const lit=s=>"'"+String(s).replaceAll("'","''")+"'";
const helper=`CREATE FUNCTION zoi.company_document_authority(p_workspace uuid,p_permission text,p_expected_actor uuid DEFAULT NULL,p_lock boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE actor uuid;role_name text;
BEGIN
 IF p_permission IS NULL OR p_permission NOT IN('ops_read','ops_write','ops_manage','document_read','document_manage') THEN RAISE EXCEPTION 'invalid_company_authority';END IF;
 IF p_lock THEN PERFORM zoi.suite_lock_session();ELSE PERFORM zoi.suite_current_session();END IF;
 IF p_lock THEN
  SELECT up.id,wm.role INTO actor,role_name FROM zoi.user_profiles up JOIN zoi.workspace_members wm ON wm.profile_id=up.id WHERE up.auth_user_id=auth.uid() AND wm.workspace_id=p_workspace FOR SHARE OF up,wm;
 ELSE
  SELECT up.id,wm.role INTO actor,role_name FROM zoi.user_profiles up JOIN zoi.workspace_members wm ON wm.profile_id=up.id WHERE up.auth_user_id=auth.uid() AND wm.workspace_id=p_workspace;
 END IF;
 IF actor IS NULL OR role_name IS NULL OR (p_expected_actor IS NOT NULL AND actor IS DISTINCT FROM p_expected_actor)
 OR (p_permission IN('ops_write','document_read') AND role_name NOT IN('owner','admin','editor'))
 OR (p_permission IN('ops_manage','document_manage') AND role_name NOT IN('owner','admin')) THEN RAISE EXCEPTION 'company_permission_denied' USING ERRCODE='42501';END IF;
 -- Membership/profile locks may themselves wait past a not_after deadline.
 PERFORM zoi.suite_current_session();
 RETURN actor;
END $function$;
ALTER FUNCTION zoi.company_document_authority(uuid,text,uuid,boolean) OWNER TO postgres;
REVOKE ALL ON FUNCTION zoi.company_document_authority(uuid,text,uuid,boolean) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION zoi.company_session_readable() RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $function$
BEGIN PERFORM zoi.suite_current_session();RETURN true;EXCEPTION WHEN insufficient_privilege THEN RETURN false;END $function$;
ALTER FUNCTION zoi.company_session_readable() OWNER TO postgres;
REVOKE ALL ON FUNCTION zoi.company_session_readable() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION zoi.company_session_readable() TO authenticated;
`;
const permissions={ops_records_list:"'ops_read'",ops_audit_list:"'ops_read'",ops_record_save:"CASE WHEN p_kind='company' THEN 'ops_manage' ELSE 'ops_write' END",ops_record_archive:"'ops_manage'",ops_mutation_execute:"CASE WHEN p_action='archive' OR (p_action='save' AND p_args->>'p_kind'='company') THEN 'ops_manage' ELSE 'ops_write' END",ops_request_status:"'ops_write'",documents_list:"'document_read'",document_history:"'document_read'",document_download_authorize:"'document_read'",document_upload_begin:"'document_read'",document_archive:"'document_manage'",document_cleanup_prepare:"'document_manage'"};
const replacements=[];
for(const [name,permission]of Object.entries(permissions)){
 const row=rows.find(r=>r.schema==='public'&&r.proname===name);assert(row,name);
 let source=row.definition;assert.equal((source.match(/\bdeclare\b/gi)||[]).length,1,name+' declaration');source=source.replace(/\bdeclare\b/i,'DECLARE authority_actor uuid;');assert.equal((source.match(/\bbegin\b/gi)||[]).length,name==='ops_record_save'?2:1,name+' begin anchors');source=source.replace(/\bbegin\b/i,`BEGIN\n authority_actor:=zoi.company_document_authority(p_workspace,${permission},NULL,false);`);
 const beforeReturn=`PERFORM zoi.company_document_authority(p_workspace,${permission},authority_actor,true); `;
 const returnCount=(source.match(/\breturn\b/gi)||[]).length;assert(returnCount>=1&&returnCount<=3,name+' return count');
 source=source.replace(/\breturn\b/gi, beforeReturn+'RETURN');
 if(name==='ops_records_list')source=source.replace(beforeReturn+'RETURN',beforeReturn+'role_name:=zoi.ops_role(p_workspace); RETURN');
 if(name==='documents_list')source=source.replace(beforeReturn+'RETURN',beforeReturn+'select m.role into role from zoi.workspace_members m where workspace_id=p_workspace and profile_id=authority_actor; RETURN');
 if(name==='ops_record_save')source=source.replace(beforeReturn+'RETURN',`IF assignee IS NOT NULL THEN PERFORM 1 FROM zoi.workspace_members WHERE workspace_id=p_workspace AND profile_id=assignee FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'invalid_assignee';END IF;END IF; `+beforeReturn+'RETURN');
 replacements.push({...row,replacement:source,returns:returnCount});
}
const actor=rows.find(r=>r.schema==='zoi'&&r.proname==='document_actor');assert(actor);replacements.push({...actor,replacement:`CREATE OR REPLACE FUNCTION zoi.document_actor(p_workspace uuid,p_manage boolean DEFAULT false) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$ BEGIN RETURN zoi.company_document_authority(p_workspace,CASE WHEN p_manage THEN 'document_manage' ELSE 'document_read' END,NULL,false);END $function$;`,returns:1});
let sql=`-- Draft Company/Operations and private-document session authority candidate. No live writes applied.\nBEGIN;\nSET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='30s';\nCREATE TEMP TABLE company_authority_expected(signature text PRIMARY KEY,definition_hash text NOT NULL,acl text NOT NULL) ON COMMIT DROP;\nINSERT INTO company_authority_expected VALUES\n`+rows.map(r=>`(${lit((r.schema==='public'?'public.':'')+r.signature)},${lit(r.definition_hash)},${lit(r.acl)})`).join(',\n')+`;\nDO $guard$ DECLARE x record;p pg_proc;BEGIN
 IF to_regprocedure('zoi.company_document_authority(uuid,text,uuid,boolean)') IS NOT NULL OR to_regprocedure('zoi.company_session_readable()') IS NOT NULL THEN RAISE EXCEPTION 'company_authority_candidate_already_exists';END IF;
 FOR x IN SELECT * FROM company_authority_expected LOOP SELECT * INTO p FROM pg_proc WHERE oid=to_regprocedure(x.signature);
 IF p.oid IS NULL OR md5(pg_get_functiondef(p.oid)) IS DISTINCT FROM x.definition_hash OR pg_get_userbyid(p.proowner) IS DISTINCT FROM 'postgres' OR NOT p.prosecdef OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[] OR p.proacl::text IS DISTINCT FROM x.acl THEN RAISE EXCEPTION 'company_authority_preflight_changed: %',x.signature;END IF;END LOOP;
`;
assert.equal(policies.length,2);for(const p of policies){assert.equal(p.schemaname,'zoi');assert.equal(p.roles,'{authenticated}');assert.equal(p.permissive,'PERMISSIVE');assert.equal(p.cmd,'SELECT');assert.equal(p.qual,'(zoi.ops_role(workspace_id) IS NOT NULL)');assert.equal(p.with_check,null);sql+=` IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname=${lit(p.schemaname)} AND tablename=${lit(p.tablename)} AND policyname=${lit(p.policyname)} AND roles::text=${lit(p.roles)} AND permissive=${lit(p.permissive)} AND cmd=${lit(p.cmd)} AND qual=${lit(p.qual)} AND with_check IS NULL) THEN RAISE EXCEPTION 'company_authority_policy_changed: ${p.policyname}';END IF;\n`;}
sql+=` IF (SELECT count(*)=6 AND bool_and(c.relrowsecurity) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='zoi' AND c.relname IN('ops_records','ops_audit','ops_mutation_receipts','workspace_documents','document_versions','document_audit')) IS DISTINCT FROM true THEN RAISE EXCEPTION 'company_authority_rls_changed';END IF;
END $guard$;\n`+helper+replacements.map(r=>r.replacement+';').join('\n\n')+'\n';
for(const p of policies)sql+=`ALTER POLICY ${p.policyname} ON zoi.${p.tablename} USING (zoi.ops_role(workspace_id) IS NOT NULL AND zoi.company_session_readable());\n`;
sql+=`DO $check$ DECLARE x record;p pg_proc;BEGIN
 FOR x IN SELECT * FROM company_authority_expected LOOP SELECT * INTO p FROM pg_proc WHERE oid=to_regprocedure(x.signature);
 IF pg_get_userbyid(p.proowner) IS DISTINCT FROM 'postgres' OR NOT p.prosecdef OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[] OR p.proacl::text IS DISTINCT FROM x.acl THEN RAISE EXCEPTION 'company_authority_contract_changed: %',x.signature;END IF;END LOOP;
END $check$;\nCOMMIT;\n`;
writeFileSync(target,sql);
writeFileSync(new URL('replacement-manifest.json',evidence),JSON.stringify({migration_path:'supabase/migrations/20261003032635_company_document_current_session.sql',migration_sha256:createHash('sha256').update(sql).digest('hex'),retained_functions:rows.length,replacements:replacements.map(r=>({signature:(r.schema==='public'?'public.':'')+r.signature,baseline_md5:r.definition_hash,replacement_sha256:createHash('sha256').update(r.replacement).digest('hex'),return_paths:r.returns})),unchanged_worker_paths:['public.document_upload_finish(uuid)','public.document_cleanup_finish(uuid)'],unchanged_broad_helper:'zoi.ops_role(uuid)',direct_read_policies:policies.map(p=>p.policyname)},null,2));
console.log('Generated guarded candidate',target.pathname,createHash('sha256').update(sql).digest('hex'));

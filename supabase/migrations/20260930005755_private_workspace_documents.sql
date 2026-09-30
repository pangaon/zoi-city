begin;
set local lock_timeout='5s';
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('workspace-documents','workspace-documents',false,10485760,array['application/pdf','text/plain','image/png','image/jpeg']);
-- No storage.objects policy grants direct client reads, writes, signing or deletion.
-- Byte operations are handled by the authenticated Edge function after RPC permission checks.
-- Restrictive fence also defeats any future broad permissive client policy.
create policy workspace_documents_server_only on storage.objects as restrictive for all to anon,authenticated using(bucket_id<>'workspace-documents') with check(bucket_id<>'workspace-documents');
create table zoi.workspace_documents(id uuid primary key default gen_random_uuid(),workspace_id uuid not null references zoi.workspaces(id),project_id uuid not null references zoi.ops_records(id),title text not null check(length(title) between 1 and 160),current_version integer not null default 0,created_by uuid not null references zoi.user_profiles(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),archived_at timestamptz);
create index workspace_documents_project on zoi.workspace_documents(workspace_id,project_id,updated_at desc);
create table zoi.document_versions(id uuid primary key default gen_random_uuid(),document_id uuid not null references zoi.workspace_documents(id),workspace_id uuid not null references zoi.workspaces(id),version integer not null,expected_current_version integer not null,request_id uuid not null,requested_document_id uuid,request_title text not null,uploaded_by uuid not null references zoi.user_profiles(id),filename text not null,mime_type text not null check(mime_type in ('application/pdf','text/plain','image/png','image/jpeg')),size_bytes integer not null check(size_bytes between 1 and 10485760),sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),object_path text not null unique,state text not null default 'pending' check(state in ('pending','ready','cleanup','failed')),created_at timestamptz not null default clock_timestamp(),finished_at timestamptz,cleanup_by uuid references zoi.user_profiles(id),unique(document_id,version),unique(uploaded_by,request_id));
create unique index document_one_pending on zoi.document_versions(document_id) where state in ('pending','cleanup');
create table zoi.document_audit(id uuid primary key default gen_random_uuid(),workspace_id uuid not null references zoi.workspaces(id),document_id uuid not null references zoi.workspace_documents(id),version_id uuid references zoi.document_versions(id),actor_profile_id uuid not null references zoi.user_profiles(id),action text not null check(action in ('upload_reserved','uploaded','download_requested','archived','cleanup_started','cleanup_finished')),created_at timestamptz not null default clock_timestamp());
create index document_audit_workspace on zoi.document_audit(workspace_id,created_at desc);
alter table zoi.workspace_documents enable row level security;
alter table zoi.document_versions enable row level security;
alter table zoi.document_audit enable row level security;
revoke all on zoi.workspace_documents,zoi.document_versions,zoi.document_audit from public,anon,authenticated;

create function zoi.document_actor(p_workspace uuid,p_manage boolean default false) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid;role text;
begin
 if auth.uid() is null then raise exception 'sign_in_required' using errcode='42501';end if;
 select p.id,m.role into actor,role from zoi.user_profiles p join zoi.workspace_members m on m.profile_id=p.id where p.auth_user_id=auth.uid() and m.workspace_id=p_workspace;
 if actor is null or role not in ('owner','admin','editor') or (p_manage and role not in ('owner','admin')) then raise exception 'document_permission_denied' using errcode='42501';end if;
 return actor;
end $$;
revoke all on function zoi.document_actor(uuid,boolean) from public,anon,authenticated;

create function public.documents_list(p_workspace uuid,p_project uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;docs jsonb;projects jsonb;role text;
begin
 actor:=zoi.document_actor(p_workspace);select m.role into role from zoi.workspace_members m where workspace_id=p_workspace and profile_id=actor;
 select coalesce(jsonb_agg(to_jsonb(d) order by d.updated_at desc),'[]') into docs from(select d.*,v.id as current_version_id,v.filename,v.mime_type,v.size_bytes from zoi.workspace_documents d left join zoi.document_versions v on v.document_id=d.id and v.version=d.current_version and v.state='ready' where d.workspace_id=p_workspace and (p_project is null or d.project_id=p_project) order by d.updated_at desc limit 300)d;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title) order by title),'[]') into projects from zoi.ops_records where workspace_id=p_workspace and kind='project' and archived_at is null;
 return jsonb_build_object('ok',true,'role',role,'documents',docs,'projects',projects);
end $$;
create function public.document_history(p_workspace uuid,p_document uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare doc zoi.workspace_documents;versions jsonb;audit jsonb;
begin
 perform zoi.document_actor(p_workspace);
 select * into doc from zoi.workspace_documents where id=p_document and workspace_id=p_workspace;
 if doc.id is null then raise exception 'document_unavailable';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'version',version,'filename',filename,'mime_type',mime_type,'size_bytes',size_bytes,'state',state,'uploaded_by',uploaded_by,'created_at',created_at,'finished_at',finished_at) order by version desc),'[]') into versions from (select * from zoi.document_versions where document_id=doc.id order by version desc limit 100) recent_versions;
 select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at desc),'[]') into audit from(select id,version_id,actor_profile_id,action,created_at from zoi.document_audit where document_id=doc.id order by created_at desc limit 100)a;
 return jsonb_build_object('ok',true,'document',to_jsonb(doc),'versions',versions,'audit',audit);
end $$;

create function public.document_upload_begin(p_workspace uuid,p_project uuid,p_document uuid,p_expected_version integer,p_title text,p_request uuid,p_filename text,p_mime text,p_size integer,p_sha256 text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;doc zoi.workspace_documents;v zoi.document_versions;suffix text;next_version integer;
begin
 actor:=zoi.document_actor(p_workspace);
 if p_request is null or p_size is null or p_size not between 1 and 10485760 or p_sha256 is null or p_sha256 !~ '^[a-f0-9]{64}$' or p_mime is null or p_mime not in ('application/pdf','text/plain','image/png','image/jpeg') or p_filename is null or length(p_filename) not between 1 and 180 or p_filename ~ '[[:cntrl:]/\\]' or p_title is null or length(btrim(p_title)) not between 1 and 160 then raise exception 'invalid_document_metadata';end if;
 suffix:=case p_mime when 'application/pdf' then 'pdf' when 'text/plain' then 'txt' when 'image/png' then 'png' else 'jpg' end;
 if lower(p_filename) !~ (case when p_mime='image/jpeg' then '\.(jpg|jpeg)$' else '\.'||suffix||'$' end) then raise exception 'filename_type_mismatch';end if;
 -- Actor lock serializes a repeated request ID even when a caller changes document IDs.
 perform 1 from zoi.user_profiles where id=actor for update;
 select * into v from zoi.document_versions where uploaded_by=actor and request_id=p_request;
 if v.id is not null then
  select * into doc from zoi.workspace_documents where id=v.document_id;
  if v.workspace_id is distinct from p_workspace or v.sha256 is distinct from p_sha256 or v.size_bytes is distinct from p_size or v.mime_type is distinct from p_mime or doc.project_id is distinct from p_project or v.requested_document_id is distinct from p_document or v.expected_current_version is distinct from p_expected_version or v.filename is distinct from p_filename or v.request_title is distinct from btrim(p_title) then raise exception 'document_request_conflict';end if;
  if doc.archived_at is not null then raise exception 'document_archived';end if;
  if v.state not in ('pending','ready') then raise exception 'upload_request_closed';end if;
  return jsonb_build_object('ok',true,'document',to_jsonb(doc),'upload',to_jsonb(v));
 end if;
 perform 1 from zoi.ops_records where id=p_project and workspace_id=p_workspace and kind='project' and archived_at is null for share;
 if not found then raise exception 'active_project_required';end if;
 if p_document is null then
  if p_expected_version is distinct from 0 then raise exception 'version_conflict';end if;
  insert into zoi.workspace_documents(workspace_id,project_id,title,created_by) values(p_workspace,p_project,btrim(p_title),actor) returning * into doc;
 else
  select * into doc from zoi.workspace_documents where id=p_document and workspace_id=p_workspace for update;
  if doc.id is null or doc.project_id<>p_project then raise exception 'document_unavailable';end if;
  if doc.archived_at is not null then raise exception 'document_archived';end if;
  if doc.current_version is distinct from p_expected_version then raise exception 'version_conflict';end if;
 end if;
 if exists(select 1 from zoi.document_versions where document_id=doc.id and state in ('pending','cleanup')) then raise exception 'document_upload_in_progress';end if;
 select coalesce(max(version),0)+1 into next_version from zoi.document_versions where document_id=doc.id;
 v.id:=gen_random_uuid();
 insert into zoi.document_versions(id,document_id,workspace_id,version,expected_current_version,request_id,requested_document_id,request_title,uploaded_by,filename,mime_type,size_bytes,sha256,object_path)
 values(v.id,doc.id,p_workspace,next_version,doc.current_version,p_request,p_document,btrim(p_title),actor,p_filename,p_mime,p_size,p_sha256,p_workspace::text||'/'||doc.id::text||'/'||v.id::text||'.'||suffix) returning * into v;
 insert into zoi.document_audit(workspace_id,document_id,version_id,actor_profile_id,action) values(p_workspace,doc.id,v.id,actor,'upload_reserved');
 return jsonb_build_object('ok',true,'document',to_jsonb(doc),'upload',to_jsonb(v));
end $$;

-- Service-only finalization checks the actual stored object before declaring a version ready.
create function public.document_upload_finish(p_version uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v zoi.document_versions;doc zoi.workspace_documents;meta jsonb;
begin
 select * into v from zoi.document_versions where id=p_version;
 select * into doc from zoi.workspace_documents where id=v.document_id for update;
 select * into v from zoi.document_versions where id=p_version for update;
 if v.id is null then raise exception 'document_unavailable';end if;
 if v.state='ready' then return jsonb_build_object('ok',true,'document',to_jsonb(doc),'version',to_jsonb(v));end if;
 if v.state<>'pending' or doc.archived_at is not null or doc.current_version<>v.expected_current_version then raise exception 'upload_state_conflict';end if;
 if not exists(select 1 from zoi.workspace_members where workspace_id=v.workspace_id and profile_id=v.uploaded_by and role in ('owner','admin','editor')) or not exists(select 1 from zoi.ops_records where id=doc.project_id and workspace_id=doc.workspace_id and kind='project' and archived_at is null) then raise exception 'upload_permission_changed';end if;
 select metadata into meta from storage.objects where bucket_id='workspace-documents' and name=v.object_path;
 if meta is null or (meta->>'size')::bigint is distinct from v.size_bytes::bigint or meta->>'mimetype' is distinct from v.mime_type then raise exception 'uploaded_object_mismatch';end if;
 update zoi.document_versions set state='ready',finished_at=clock_timestamp() where id=v.id returning * into v;
 update zoi.workspace_documents set current_version=v.version,updated_at=clock_timestamp() where id=doc.id returning * into doc;
 insert into zoi.document_audit(workspace_id,document_id,version_id,actor_profile_id,action) values(v.workspace_id,doc.id,v.id,v.uploaded_by,'uploaded');
 return jsonb_build_object('ok',true,'document',to_jsonb(doc),'version',to_jsonb(v));
end $$;

create function public.document_download_authorize(p_workspace uuid,p_version uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;v zoi.document_versions;doc zoi.workspace_documents;
begin
 actor:=zoi.document_actor(p_workspace);
 select * into v from zoi.document_versions where id=p_version and workspace_id=p_workspace and state='ready';
 select * into doc from zoi.workspace_documents where id=v.document_id and archived_at is null;
 if v.id is null or doc.id is null then raise exception 'document_unavailable';end if;
 insert into zoi.document_audit(workspace_id,document_id,version_id,actor_profile_id,action) values(p_workspace,doc.id,v.id,actor,'download_requested');
 return jsonb_build_object('ok',true,'object_path',v.object_path,'filename',v.filename,'expires_in',60);
end $$;
create function public.document_archive(p_workspace uuid,p_document uuid,p_expected_version integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;doc zoi.workspace_documents;
begin
 actor:=zoi.document_actor(p_workspace,true);
 select * into doc from zoi.workspace_documents where id=p_document and workspace_id=p_workspace for update;
 if doc.id is null then raise exception 'document_unavailable';end if;
 if doc.archived_at is not null then return jsonb_build_object('ok',true,'document',to_jsonb(doc));end if;
 if doc.current_version is distinct from p_expected_version then raise exception 'version_conflict';end if;
 if exists(select 1 from zoi.document_versions where document_id=doc.id and state in ('pending','cleanup')) then raise exception 'document_upload_in_progress';end if;
 update zoi.workspace_documents set archived_at=clock_timestamp(),updated_at=clock_timestamp() where id=doc.id returning * into doc;
 insert into zoi.document_audit(workspace_id,document_id,actor_profile_id,action) values(p_workspace,doc.id,actor,'archived');
 return jsonb_build_object('ok',true,'document',to_jsonb(doc));
end $$;

-- Cleanup fencing: only failed/incomplete reservations older than 15 minutes, never ready files.
create function public.document_cleanup_prepare(p_workspace uuid,p_version uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;v zoi.document_versions;doc zoi.workspace_documents;
begin
 actor:=zoi.document_actor(p_workspace,true);
 select * into v from zoi.document_versions where id=p_version and workspace_id=p_workspace;
 select * into doc from zoi.workspace_documents where id=v.document_id for update;
 select * into v from zoi.document_versions where id=p_version and workspace_id=p_workspace for update;
 if v.id is null or v.state='ready' or v.created_at>clock_timestamp()-interval '15 minutes' then raise exception 'cleanup_not_allowed';end if;
 if v.state<>'cleanup' then
 update zoi.document_versions set state='cleanup',cleanup_by=actor where id=v.id returning * into v;
 insert into zoi.document_audit(workspace_id,document_id,version_id,actor_profile_id,action) values(p_workspace,doc.id,v.id,actor,'cleanup_started');
 end if;
 return jsonb_build_object('ok',true,'object_path',v.object_path,'version_id',v.id);
end $$;
create function public.document_cleanup_finish(p_version uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v zoi.document_versions;doc zoi.workspace_documents;
begin
 select * into v from zoi.document_versions where id=p_version;
 select * into doc from zoi.workspace_documents where id=v.document_id for update;
 select * into v from zoi.document_versions where id=p_version for update;
 if v.id is null or v.state not in ('cleanup','failed') then raise exception 'cleanup_not_allowed';end if;
 if exists(select 1 from storage.objects where bucket_id='workspace-documents' and name=v.object_path) then raise exception 'cleanup_object_still_exists';end if;
 if v.state='cleanup' then
 update zoi.document_versions set state='failed',finished_at=clock_timestamp() where id=v.id returning * into v;
 insert into zoi.document_audit(workspace_id,document_id,version_id,actor_profile_id,action) values(v.workspace_id,v.document_id,v.id,v.cleanup_by,'cleanup_finished');
 end if;
 return jsonb_build_object('ok',true,'version_id',v.id,'state',v.state);
end $$;
revoke all on function public.documents_list(uuid,uuid),public.document_history(uuid,uuid),public.document_upload_begin(uuid,uuid,uuid,integer,text,uuid,text,text,integer,text),public.document_upload_finish(uuid),public.document_download_authorize(uuid,uuid),public.document_archive(uuid,uuid,integer),public.document_cleanup_prepare(uuid,uuid),public.document_cleanup_finish(uuid) from public,anon,authenticated;
grant execute on function public.documents_list(uuid,uuid),public.document_history(uuid,uuid),public.document_upload_begin(uuid,uuid,uuid,integer,text,uuid,text,text,integer,text),public.document_download_authorize(uuid,uuid),public.document_archive(uuid,uuid,integer),public.document_cleanup_prepare(uuid,uuid) to authenticated;
grant execute on function public.document_upload_finish(uuid),public.document_cleanup_finish(uuid) to service_role;
commit;

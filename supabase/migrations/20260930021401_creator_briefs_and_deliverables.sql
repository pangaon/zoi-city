begin;
set local lock_timeout='5s';
create table zoi.creator_campaigns(id uuid primary key default gen_random_uuid(),workspace_id uuid not null references zoi.workspaces(id),inquiry_id uuid not null unique references zoi.inquiry_threads(id),customer_id uuid not null references zoi.user_profiles(id),project_id uuid not null unique references zoi.ops_records(id),company_id uuid not null references zoi.ops_records(id),kind text not null check(kind in('sponsorship','performance')),request_id uuid not null,created_by uuid not null references zoi.user_profiles(id),draft jsonb not null,version integer not null default 1,shared_version integer not null default 0,created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),unique(created_by,request_id));
create table zoi.creator_deliverables(id uuid primary key default gen_random_uuid(),campaign_id uuid not null references zoi.creator_campaigns(id),task_id uuid not null unique references zoi.ops_records(id),initial_data jsonb not null,title text not null,description text not null,channel text not null,due_at timestamptz,version integer not null default 1,created_at timestamptz not null default clock_timestamp());
create table zoi.creator_briefs(id uuid primary key default gen_random_uuid(),campaign_id uuid not null references zoi.creator_campaigns(id),version integer not null,source_version integer not null,payload jsonb not null,request_id uuid not null,shared_by uuid not null references zoi.user_profiles(id),status text not null default 'shared' check(status in('shared','accepted','changes_requested')),decision_note text,decision_request uuid,decided_by uuid references zoi.user_profiles(id),created_at timestamptz not null default clock_timestamp(),decided_at timestamptz,unique(campaign_id,version),unique(shared_by,request_id));
create table zoi.creator_submissions(id uuid primary key default gen_random_uuid(),campaign_id uuid not null references zoi.creator_campaigns(id),brief_id uuid not null references zoi.creator_briefs(id),deliverable_id uuid not null references zoi.creator_deliverables(id),url text not null,note text not null,request_id uuid not null,submitted_by uuid not null references zoi.user_profiles(id),status text not null default 'submitted' check(status in('submitted','accepted','changes_requested')),decision_note text,decision_request uuid,decided_by uuid references zoi.user_profiles(id),created_at timestamptz not null default clock_timestamp(),decided_at timestamptz,unique(submitted_by,request_id));
create unique index creator_submission_open on zoi.creator_submissions(brief_id,deliverable_id) where status in('submitted','accepted');
create table zoi.creator_audit(id bigint generated always as identity primary key,campaign_id uuid not null references zoi.creator_campaigns(id),actor_id uuid not null references zoi.user_profiles(id),action text not null,details jsonb not null,created_at timestamptz not null default clock_timestamp());
create index creator_campaign_workspace on zoi.creator_campaigns(workspace_id,updated_at desc);
create index creator_campaign_customer on zoi.creator_campaigns(customer_id,updated_at desc);
create index creator_deliverable_campaign on zoi.creator_deliverables(campaign_id);
create index creator_brief_campaign on zoi.creator_briefs(campaign_id,version desc);
create index creator_submission_campaign on zoi.creator_submissions(campaign_id,created_at desc);
create index creator_audit_campaign on zoi.creator_audit(campaign_id,id desc);
alter table zoi.creator_campaigns enable row level security;alter table zoi.creator_deliverables enable row level security;alter table zoi.creator_briefs enable row level security;alter table zoi.creator_submissions enable row level security;alter table zoi.creator_audit enable row level security;
revoke all on zoi.creator_campaigns,zoi.creator_deliverables,zoi.creator_briefs,zoi.creator_submissions,zoi.creator_audit from public,anon,authenticated;

create function zoi.creator_write(p_campaign uuid,p_operator boolean) returns zoi.creator_campaigns language plpgsql security definer set search_path='' as $$
declare c zoi.creator_campaigns;actor uuid;listing uuid;
begin
 actor:=(select id from zoi.user_profiles where auth_user_id=auth.uid());select * into c from zoi.creator_campaigns where id=p_campaign for update;
 if auth.uid() is null or c.id is null or (p_operator and coalesce(zoi.ops_role(c.workspace_id),'') not in('owner','admin','editor')) or (not p_operator and actor is distinct from c.customer_id) then raise exception 'creator_permission_denied' using errcode='42501';end if;
 select listing_id into listing from zoi.inquiry_threads where id=c.inquiry_id;
 perform 1 from zoi.listings where id=listing and owner_workspace_id=c.workspace_id and publish_status='published' and coalesce(marketplace_status,'')<>'hidden' for share;
 if not found then raise exception 'creator_business_changed';end if;
 perform 1 from zoi.ops_records where id=c.project_id and workspace_id=c.workspace_id and kind='project' and archived_at is null for share;
 if not found then raise exception 'creator_project_archived';end if;
 return c;
end $$;
create function zoi.creator_draft(p_kind text,p_data jsonb,p_publish boolean) returns jsonb language plpgsql stable set search_path='' as $$
declare out jsonb;fee integer;minutes integer;event_at timestamptz;
begin
 if jsonb_typeof(p_data) is distinct from 'object' or octet_length(p_data::text)>20000 or length(btrim(coalesce(p_data->>'title',''))) not between 1 and 200 or length(coalesce(p_data->>'summary',''))>4000 then raise exception 'invalid_creator_brief';end if;
 if nullif(p_data->>'event_at','') is not null and p_data->>'event_at' !~ '(Z|[+-][0-9]{2}:[0-9]{2})$' then raise exception 'creator_timezone_required';end if;
 begin fee:=coalesce((p_data->>'planned_fee_cents')::integer,0);minutes:=coalesce((p_data->>'duration_minutes')::integer,0);event_at:=nullif(p_data->>'event_at','')::timestamptz;exception when others then raise exception 'invalid_creator_brief';end;
 if event_at is not null and not isfinite(event_at) then raise exception 'invalid_creator_brief';end if;
 if fee not between 0 and 100000000 or coalesce(p_data->>'currency','EUR') !~ '^[A-Z]{3}$' or minutes not between 0 and 1440 then raise exception 'invalid_creator_brief';end if;
 out:=jsonb_build_object('title',btrim(p_data->>'title'),'summary',coalesce(p_data->>'summary',''),'planned_fee_cents',fee,'currency',coalesce(p_data->>'currency','EUR'));
 if p_kind='sponsorship' then
  if jsonb_typeof(coalesce(p_data->'channels','[]'))<>'array' or jsonb_array_length(coalesce(p_data->'channels','[]'))>10 or length(coalesce(p_data->>'usage_terms',''))>2000 or length(coalesce(p_data->>'disclosure_notes',''))>1000 then raise exception 'invalid_creator_brief';end if;
  if exists(select 1 from jsonb_array_elements_text(coalesce(p_data->'channels','[]')) x where x not in('instagram','tiktok','youtube','podcast','blog','other')) then raise exception 'invalid_creator_channel';end if;
  out:=out||jsonb_build_object('channels',coalesce(p_data->'channels','[]'),'usage_terms',coalesce(p_data->>'usage_terms',''),'disclosure_notes',coalesce(p_data->>'disclosure_notes',''));
  if p_publish and jsonb_array_length(out->'channels')=0 then raise exception 'creator_channels_required';end if;
  if p_publish and btrim(out->>'disclosure_notes')='' then raise exception 'creator_disclosure_required';end if;
 else
  if length(coalesce(p_data->>'venue',''))>300 or length(coalesce(p_data->>'technical_requirements',''))>3000 then raise exception 'invalid_creator_brief';end if;
  out:=out||jsonb_build_object('venue',coalesce(p_data->>'venue',''),'event_at',event_at,'duration_minutes',minutes,'technical_requirements',coalesce(p_data->>'technical_requirements',''));
  if p_publish and (btrim(out->>'venue')='' or event_at is null or minutes<1) then raise exception 'creator_performance_details_required';end if;
 end if;
 if p_publish and length(btrim(out->>'summary'))=0 then raise exception 'creator_summary_required';end if;
 return out;
end $$;
revoke all on function zoi.creator_write(uuid,boolean),zoi.creator_draft(text,jsonb,boolean) from public,anon,authenticated;

create function public.creator_convert(p_workspace uuid,p_inquiry uuid,p_company uuid,p_kind text,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare c zoi.creator_campaigns;t zoi.inquiry_threads;actor uuid;project jsonb;
begin
 if auth.uid() is null or coalesce(zoi.ops_role(p_workspace),'') not in('owner','admin','editor') then raise exception 'creator_permission_denied' using errcode='42501';end if;
 actor:=(select id from zoi.user_profiles where auth_user_id=auth.uid());perform 1 from zoi.user_profiles where id=actor for update;
 if p_request is null or p_kind is null or p_kind not in('sponsorship','performance') then raise exception 'invalid_creator_request';end if;
 select * into c from zoi.creator_campaigns where created_by=actor and request_id=p_request;
 if c.id is not null then
  if c.workspace_id is distinct from p_workspace or c.inquiry_id is distinct from p_inquiry or c.company_id is distinct from p_company or c.kind is distinct from p_kind then raise exception 'creator_request_conflict';end if;
  return jsonb_build_object('ok',true,'campaign',to_jsonb(c));
 end if;
 select * into t from zoi.inquiry_threads where id=p_inquiry and workspace_id=p_workspace for update;if t.id is null then raise exception 'creator_inquiry_unavailable';end if;
 perform 1 from zoi.listings where id=t.listing_id and owner_workspace_id=p_workspace and publish_status='published' and coalesce(marketplace_status,'')<>'hidden' for share;if not found then raise exception 'creator_business_changed';end if;
 if exists(select 1 from zoi.creator_campaigns where inquiry_id=p_inquiry) then raise exception 'creator_inquiry_already_converted';end if;
 project:=public.ops_record_save(p_workspace,'project',jsonb_build_object('title',t.subject,'sector','creator','company_id',p_company,'notes','Created from customer enquiry '||p_inquiry,'status','open'),null,0)->'record';
 insert into zoi.creator_campaigns(workspace_id,inquiry_id,customer_id,project_id,company_id,kind,request_id,created_by,draft) values(p_workspace,p_inquiry,t.customer_id,(project->>'id')::uuid,p_company,p_kind,p_request,actor,zoi.creator_draft(p_kind,jsonb_build_object('title',t.subject,'summary',t.initial_body),false)) returning * into c;
 insert into zoi.creator_audit(campaign_id,actor_id,action,details) values(c.id,actor,'converted',jsonb_build_object('inquiry_id',p_inquiry,'project_id',c.project_id));
 return jsonb_build_object('ok',true,'campaign',to_jsonb(c));
end $$;
create function public.creator_draft_save(p_campaign uuid,p_expected_version integer,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare c zoi.creator_campaigns;actor uuid;v_draft jsonb;
begin
 c:=zoi.creator_write(p_campaign,true);if c.version is distinct from p_expected_version then raise exception 'creator_version_conflict';end if;
 actor:=(select id from zoi.user_profiles where auth_user_id=auth.uid());v_draft:=zoi.creator_draft(c.kind,p_data,false);
 insert into zoi.creator_audit(campaign_id,actor_id,action,details) values(c.id,actor,'draft_saved',jsonb_build_object('before',c.draft,'after',v_draft,'version',c.version+1));
 update zoi.creator_campaigns set draft=v_draft,version=version+1,updated_at=clock_timestamp() where id=c.id returning * into c;
 return jsonb_build_object('ok',true,'campaign',to_jsonb(c));
end $$;
create function public.creator_deliverable_save(p_campaign uuid,p_id uuid,p_expected_version integer,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare c zoi.creator_campaigns;d zoi.creator_deliverables;task zoi.ops_records;r jsonb;actor uuid;deadline timestamptz;
begin
 c:=zoi.creator_write(p_campaign,true);actor:=(select id from zoi.user_profiles where auth_user_id=auth.uid());
 if jsonb_typeof(p_data) is distinct from 'object' or octet_length(p_data::text)>12000 or length(btrim(coalesce(p_data->>'title',''))) not between 1 and 200 or length(coalesce(p_data->>'description',''))>2000 or coalesce(p_data->>'channel','') not in('instagram','tiktok','youtube','podcast','blog','live','other') then raise exception 'invalid_creator_deliverable';end if;
 if nullif(p_data->>'due_at','') is not null and p_data->>'due_at' !~ '(Z|[+-][0-9]{2}:[0-9]{2})$' then raise exception 'creator_timezone_required';end if;
 begin deadline:=nullif(p_data->>'due_at','')::timestamptz;exception when others then raise exception 'invalid_creator_deadline';end;
 if deadline is not null and not isfinite(deadline) then raise exception 'invalid_creator_deadline';end if;
 if p_id is null then raise exception 'creator_deliverable_id_required';end if;
 if p_expected_version=0 then
  select * into d from zoi.creator_deliverables where id=p_id;
  if d.id is not null then if d.campaign_id is distinct from c.id or d.initial_data is distinct from p_data then raise exception 'creator_request_conflict';end if;return jsonb_build_object('ok',true,'deliverable',to_jsonb(d),'campaign',to_jsonb(c));end if;
  if (select count(*) from zoi.creator_deliverables where campaign_id=c.id)>=30 then raise exception 'creator_deliverable_limit';end if;
 else
  select * into d from zoi.creator_deliverables where id=p_id and campaign_id=c.id for update;
  if d.id is null or d.version is distinct from p_expected_version then raise exception 'creator_version_conflict';end if;
  select * into task from zoi.ops_records where id=d.task_id and project_id=c.project_id and workspace_id=c.workspace_id and archived_at is null;
  if task.id is null then raise exception 'creator_delivery_task_unavailable';end if;
 end if;
 r:=public.ops_record_save(c.workspace_id,'task',jsonb_build_object('title',p_data->>'title','notes',coalesce(p_data->>'description',''),'sector','creator','project_id',c.project_id,'due_at',deadline,'status',coalesce(task.status,'open')),d.task_id,coalesce(task.version,0))->'record';
 if p_expected_version=0 then
  insert into zoi.creator_deliverables(id,campaign_id,task_id,initial_data,title,description,channel,due_at) values(p_id,c.id,(r->>'id')::uuid,p_data,btrim(p_data->>'title'),coalesce(p_data->>'description',''),p_data->>'channel',deadline) returning * into d;
 else
  update zoi.creator_deliverables set title=btrim(p_data->>'title'),description=coalesce(p_data->>'description',''),channel=p_data->>'channel',due_at=deadline,version=version+1 where id=d.id returning * into d;
 end if;
 update zoi.creator_campaigns set version=version+1,updated_at=clock_timestamp() where id=c.id returning * into c;
 insert into zoi.creator_audit(campaign_id,actor_id,action,details) values(c.id,actor,'deliverable_saved',jsonb_build_object('deliverable_id',d.id,'version',d.version,'campaign_version',c.version));
 return jsonb_build_object('ok',true,'deliverable',to_jsonb(d),'campaign',to_jsonb(c));
end $$;
create function public.creator_brief_share(p_campaign uuid,p_expected_version integer,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare c zoi.creator_campaigns;b zoi.creator_briefs;actor uuid;draft jsonb;deliverables jsonb;
begin
 c:=zoi.creator_write(p_campaign,true);actor:=(select id from zoi.user_profiles where auth_user_id=auth.uid());if p_request is null then raise exception 'invalid_creator_request';end if;
 select * into b from zoi.creator_briefs where shared_by=actor and request_id=p_request;
 if b.id is not null then if b.campaign_id is distinct from c.id or b.source_version is distinct from p_expected_version then raise exception 'creator_request_conflict';end if;return jsonb_build_object('ok',true,'brief',to_jsonb(b),'campaign',to_jsonb(c));end if;
 if c.version is distinct from p_expected_version then raise exception 'creator_version_conflict';end if;
 if exists(select 1 from zoi.creator_briefs where campaign_id=c.id and version=c.shared_version and source_version=c.version-1) then raise exception 'creator_no_changes_to_share';end if;
 if c.shared_version>=100 then raise exception 'creator_brief_version_limit';end if;
 draft:=zoi.creator_draft(c.kind,c.draft,true);
 select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'title',d.title,'description',d.description,'channel',d.channel,'due_at',d.due_at) order by d.created_at,d.id),'[]') into deliverables from zoi.creator_deliverables d join zoi.ops_records t on t.id=d.task_id and t.archived_at is null and t.project_id=c.project_id where d.campaign_id=c.id;
 if jsonb_array_length(deliverables)=0 then raise exception 'creator_deliverables_required';end if;
 insert into zoi.creator_briefs(campaign_id,version,source_version,payload,request_id,shared_by) values(c.id,c.shared_version+1,c.version,jsonb_build_object('kind',c.kind,'brief',draft,'deliverables',deliverables,'acknowledgment','Workflow approval only; not a legal signature or payment'),p_request,actor) returning * into b;
 update zoi.creator_campaigns set shared_version=b.version,version=version+1,updated_at=clock_timestamp() where id=c.id returning * into c;
 insert into zoi.creator_audit(campaign_id,actor_id,action,details) values(c.id,actor,'brief_shared',jsonb_build_object('brief_id',b.id,'version',b.version));
 return jsonb_build_object('ok',true,'brief',to_jsonb(b),'campaign',to_jsonb(c));
end $$;
create function public.creator_brief_decide(p_brief uuid,p_decision text,p_note text,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare c zoi.creator_campaigns;b zoi.creator_briefs;actor uuid;cid uuid;
begin
 select campaign_id into cid from zoi.creator_briefs where id=p_brief;c:=zoi.creator_write(cid,false);actor:=c.customer_id;
 if p_request is null or p_decision is null or p_decision not in('accepted','changes_requested') or length(coalesce(p_note,''))>2000 then raise exception 'invalid_creator_decision';end if;
 select * into b from zoi.creator_briefs where id=p_brief for update;
 if b.status<>'shared' then if b.decision_request is distinct from p_request or b.status is distinct from p_decision or b.decision_note is distinct from coalesce(p_note,'') then raise exception 'creator_decision_already_recorded';end if;return jsonb_build_object('ok',true,'brief',to_jsonb(b));end if;
 if b.version<>c.shared_version then raise exception 'creator_brief_superseded';end if;
 update zoi.creator_briefs set status=p_decision,decision_note=coalesce(p_note,''),decision_request=p_request,decided_by=actor,decided_at=clock_timestamp() where id=b.id returning * into b;
 insert into zoi.creator_audit(campaign_id,actor_id,action,details) values(c.id,actor,'brief_decided',jsonb_build_object('brief_id',b.id,'decision',p_decision,'note',coalesce(p_note,'')));
 return jsonb_build_object('ok',true,'brief',to_jsonb(b));
end $$;
create function public.creator_submission_send(p_campaign uuid,p_deliverable uuid,p_url text,p_note text,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare c zoi.creator_campaigns;b zoi.creator_briefs;s zoi.creator_submissions;actor uuid;
begin
 c:=zoi.creator_write(p_campaign,true);actor:=(select id from zoi.user_profiles where auth_user_id=auth.uid());
 if p_request is null or length(coalesce(p_url,''))>2000 or p_url is null or p_url !~ '^https://[A-Za-z0-9][A-Za-z0-9.-]*\.[A-Za-z]{2,}(:[0-9]{1,5})?([/?#][^[:space:][:cntrl:]]*)?$' or length(coalesce(p_note,''))>2000 then raise exception 'invalid_creator_delivery_link';end if;
 select * into s from zoi.creator_submissions where submitted_by=actor and request_id=p_request;
 if s.id is not null then if s.campaign_id is distinct from c.id or s.deliverable_id is distinct from p_deliverable or s.url is distinct from p_url or s.note is distinct from coalesce(p_note,'') then raise exception 'creator_request_conflict';end if;return jsonb_build_object('ok',true,'submission',to_jsonb(s));end if;
 select * into b from zoi.creator_briefs where campaign_id=c.id and version=c.shared_version;
 if b.status is distinct from 'accepted' or not exists(select 1 from jsonb_array_elements(b.payload->'deliverables') d where d->>'id'=p_deliverable::text) then raise exception 'creator_accepted_brief_required';end if;
 if not exists(select 1 from zoi.creator_deliverables d join zoi.ops_records t on t.id=d.task_id where d.id=p_deliverable and d.campaign_id=c.id and t.project_id=c.project_id and t.workspace_id=c.workspace_id and t.archived_at is null) then raise exception 'creator_delivery_task_unavailable';end if;
 if exists(select 1 from zoi.creator_submissions where brief_id=b.id and deliverable_id=p_deliverable and status in('submitted','accepted')) then raise exception 'creator_delivery_already_submitted';end if;
 if (select count(*) from zoi.creator_submissions where campaign_id=c.id)>=500 then raise exception 'creator_submission_limit';end if;
 insert into zoi.creator_submissions(campaign_id,brief_id,deliverable_id,url,note,request_id,submitted_by) values(c.id,b.id,p_deliverable,p_url,coalesce(p_note,''),p_request,actor) returning * into s;
 insert into zoi.creator_audit(campaign_id,actor_id,action,details) values(c.id,actor,'delivery_submitted',jsonb_build_object('submission_id',s.id,'brief_id',b.id,'deliverable_id',p_deliverable));
 return jsonb_build_object('ok',true,'submission',to_jsonb(s));
end $$;
create function public.creator_submission_decide(p_submission uuid,p_decision text,p_note text,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare c zoi.creator_campaigns;s zoi.creator_submissions;b zoi.creator_briefs;cid uuid;task zoi.ops_records;after_task zoi.ops_records;
begin
 select campaign_id into cid from zoi.creator_submissions where id=p_submission;c:=zoi.creator_write(cid,false);
 if p_request is null or p_decision is null or p_decision not in('accepted','changes_requested') or length(coalesce(p_note,''))>2000 then raise exception 'invalid_creator_decision';end if;
 select * into s from zoi.creator_submissions where id=p_submission for update;
 if s.status<>'submitted' then if s.decision_request is distinct from p_request or s.status is distinct from p_decision or s.decision_note is distinct from coalesce(p_note,'') then raise exception 'creator_decision_already_recorded';end if;return jsonb_build_object('ok',true,'submission',to_jsonb(s));end if;
 select * into b from zoi.creator_briefs where id=s.brief_id;if b.version<>c.shared_version or b.status<>'accepted' then raise exception 'creator_brief_superseded';end if;
 if p_decision='accepted' then
  select t.* into task from zoi.ops_records t join zoi.creator_deliverables d on d.task_id=t.id where d.id=s.deliverable_id and d.campaign_id=c.id and t.workspace_id=c.workspace_id and t.kind='task' and t.project_id=c.project_id and t.archived_at is null for update of t;
  if task.id is null then raise exception 'creator_delivery_task_unavailable';end if;
  update zoi.ops_records set status='completed',version=version+1,updated_at=clock_timestamp() where id=task.id returning * into after_task;
  insert into zoi.ops_audit(workspace_id,record_id,actor_profile_id,action,version,before_data,after_data) values(c.workspace_id,task.id,c.customer_id,'updated',after_task.version,to_jsonb(task),to_jsonb(after_task));
 end if;
 update zoi.creator_submissions set status=p_decision,decision_note=coalesce(p_note,''),decision_request=p_request,decided_by=c.customer_id,decided_at=clock_timestamp() where id=s.id returning * into s;
 insert into zoi.creator_audit(campaign_id,actor_id,action,details) values(c.id,c.customer_id,'delivery_decided',jsonb_build_object('submission_id',s.id,'decision',p_decision,'note',coalesce(p_note,'')));
 return jsonb_build_object('ok',true,'submission',to_jsonb(s));
end $$;
create function public.creator_get(p_campaign uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare c zoi.creator_campaigns;actor uuid;operator boolean;briefs jsonb;deliverables jsonb;submissions jsonb;audit jsonb;can_write boolean;summary jsonb;latest zoi.creator_briefs;
begin
 actor:=(select id from zoi.user_profiles where auth_user_id=auth.uid());select * into c from zoi.creator_campaigns where id=p_campaign;
 operator:=coalesce(zoi.ops_role(c.workspace_id),'') in('owner','admin','editor');
 if auth.uid() is null or c.id is null or (not operator and (actor is distinct from c.customer_id or c.shared_version=0)) then raise exception 'creator_permission_denied' using errcode='42501';end if;
 select * into latest from zoi.creator_briefs where campaign_id=c.id and version=c.shared_version;
 select coalesce(jsonb_agg(to_jsonb(b) order by b.version desc),'[]') into briefs from zoi.creator_briefs b where campaign_id=c.id;
 select coalesce(jsonb_agg(to_jsonb(s) order by s.created_at desc),'[]') into submissions from zoi.creator_submissions s where campaign_id=c.id;
 if operator then
  summary:=to_jsonb(c);
  select coalesce(jsonb_agg(to_jsonb(d) order by d.created_at,d.id),'[]') into deliverables from zoi.creator_deliverables d where campaign_id=c.id;
  select coalesce(jsonb_agg(to_jsonb(a) order by a.id desc),'[]') into audit from(select * from zoi.creator_audit where campaign_id=c.id order by id desc limit 100)a;
 else
  summary:=jsonb_build_object('id',c.id,'kind',c.kind,'shared_version',c.shared_version,'title',latest.payload->'brief'->>'title','inquiry_id',c.inquiry_id);
  deliverables:=coalesce(latest.payload->'deliverables','[]');audit:='[]';
 end if;
 can_write:=exists(select 1 from zoi.inquiry_threads t join zoi.listings l on l.id=t.listing_id join zoi.ops_records p on p.id=c.project_id where t.id=c.inquiry_id and l.owner_workspace_id=c.workspace_id and l.publish_status='published' and coalesce(l.marketplace_status,'')<>'hidden' and p.archived_at is null);
 return jsonb_build_object('ok',true,'campaign',summary,'operator',operator,'briefs',briefs,'deliverables',deliverables,'submissions',submissions,'audit',audit,'can_write',can_write);
end $$;
create function public.creator_list(p_workspace uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare role text;campaigns jsonb;companies jsonb;inquiries jsonb;
begin
 role:=zoi.ops_role(p_workspace);if auth.uid() is null or coalesce(role,'') not in('owner','admin','editor') then raise exception 'creator_permission_denied' using errcode='42501';end if;
 select coalesce(jsonb_agg(to_jsonb(c) order by c.updated_at desc),'[]') into campaigns from(select * from zoi.creator_campaigns where workspace_id=p_workspace order by updated_at desc limit 100)c;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title) order by title),'[]') into companies from zoi.ops_records where workspace_id=p_workspace and kind='company' and archived_at is null;
 select coalesce(jsonb_agg(to_jsonb(t) order by updated_at desc),'[]') into inquiries from(select t.id,t.subject,t.customer_id,t.updated_at from zoi.inquiry_threads t join zoi.listings l on l.id=t.listing_id where t.workspace_id=p_workspace and l.owner_workspace_id=p_workspace and l.publish_status='published' and coalesce(l.marketplace_status,'')<>'hidden' and not exists(select 1 from zoi.creator_campaigns c where c.inquiry_id=t.id) order by t.updated_at desc limit 100)t;
 return jsonb_build_object('ok',true,'role',role,'campaigns',campaigns,'companies',companies,'inquiries',inquiries);
end $$;
create function public.creator_customer_list() returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;campaigns jsonb;
begin
 if auth.uid() is null then raise exception 'sign_in_required' using errcode='42501';end if;actor:=(select id from zoi.user_profiles where auth_user_id=auth.uid());
 select coalesce(jsonb_agg(to_jsonb(c) order by updated_at desc),'[]') into campaigns from(select c.id,c.kind,c.shared_version,b.payload->'brief'->>'title' as title,b.status,c.updated_at from zoi.creator_campaigns c join zoi.creator_briefs b on b.campaign_id=c.id and b.version=c.shared_version where c.customer_id=actor order by c.updated_at desc limit 100)c;
 return jsonb_build_object('ok',true,'campaigns',campaigns);
end $$;
revoke all on function public.creator_convert(uuid,uuid,uuid,text,uuid),public.creator_draft_save(uuid,integer,jsonb),public.creator_deliverable_save(uuid,uuid,integer,jsonb),public.creator_brief_share(uuid,integer,uuid),public.creator_brief_decide(uuid,text,text,uuid),public.creator_submission_send(uuid,uuid,text,text,uuid),public.creator_submission_decide(uuid,text,text,uuid),public.creator_get(uuid),public.creator_list(uuid),public.creator_customer_list() from public,anon,authenticated;
grant execute on function public.creator_convert(uuid,uuid,uuid,text,uuid),public.creator_draft_save(uuid,integer,jsonb),public.creator_deliverable_save(uuid,uuid,integer,jsonb),public.creator_brief_share(uuid,integer,uuid),public.creator_brief_decide(uuid,text,text,uuid),public.creator_submission_send(uuid,uuid,text,text,uuid),public.creator_submission_decide(uuid,text,text,uuid),public.creator_get(uuid),public.creator_list(uuid),public.creator_customer_list() to authenticated;
commit;

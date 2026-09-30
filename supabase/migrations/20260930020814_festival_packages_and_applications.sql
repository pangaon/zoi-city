begin;
set local lock_timeout='5s';
create table zoi.festival_packages(id uuid primary key,workspace_id uuid not null references zoi.workspaces(id),event_id uuid not null references zoi.listings(id),kind text not null check(kind in('booth','sponsor')),name text not null,description text not null,benefits jsonb not null,price_cents integer not null,currency text not null,capacity integer not null,closes_at timestamptz not null check(isfinite(closes_at)),timezone text not null,active boolean not null default false,version integer not null default 1,created_by uuid not null references zoi.user_profiles(id),initial_data jsonb not null,created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp());
create table zoi.festival_applications(id uuid primary key default gen_random_uuid(),package_id uuid not null references zoi.festival_packages(id),workspace_id uuid not null references zoi.workspaces(id),event_id uuid not null references zoi.listings(id),profile_id uuid not null references zoi.user_profiles(id),request_id uuid not null,initial_data jsonb not null,data jsonb not null,terms jsonb not null,units integer not null,total_cents bigint not null,inquiry_id uuid not null unique references zoi.inquiry_threads(id),status text not null default 'submitted' check(status in('submitted','approved','declined','withdrawn','cancelled')),version integer not null default 1,review_reason text,reviewed_by uuid references zoi.user_profiles(id),reviewed_at timestamptz,created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),unique(profile_id,request_id));
create unique index festival_one_active_application on zoi.festival_applications(package_id,profile_id) where status in('submitted','approved');
create table zoi.festival_audit(id bigint generated always as identity primary key,workspace_id uuid not null references zoi.workspaces(id),package_id uuid not null references zoi.festival_packages(id),application_id uuid references zoi.festival_applications(id),actor_id uuid not null references zoi.user_profiles(id),action text not null,before_state jsonb,after_state jsonb not null,reason text not null default '',created_at timestamptz not null default clock_timestamp());
create index festival_package_event on zoi.festival_packages(event_id,active);
create index festival_package_workspace on zoi.festival_packages(workspace_id,updated_at desc);
create index festival_application_package_status on zoi.festival_applications(package_id,status);
create index festival_application_workspace on zoi.festival_applications(workspace_id,created_at desc,id);
create index festival_application_actor on zoi.festival_applications(profile_id,created_at desc,id);
create index festival_audit_workspace on zoi.festival_audit(workspace_id,id desc);
alter table zoi.festival_packages enable row level security;alter table zoi.festival_applications enable row level security;alter table zoi.festival_audit enable row level security;
revoke all on zoi.festival_packages,zoi.festival_applications,zoi.festival_audit from public,anon,authenticated;
create function zoi.festival_actor(p_workspace uuid,p_manage boolean default false) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid;role text;
begin
 role:=zoi.ops_role(p_workspace);if auth.uid() is null or coalesce(role,'') not in('owner','admin','editor') or (p_manage and role not in('owner','admin')) then raise exception 'festival_permission_denied' using errcode='42501';end if;select id into actor from zoi.user_profiles where auth_user_id=auth.uid();return actor;
end $$;
create function zoi.festival_event(p_event uuid,p_workspace uuid) returns void language plpgsql security definer set search_path='' as $$
begin perform 1 from zoi.listings where id=p_event and owner_workspace_id=p_workspace and publish_status='published' and coalesce(marketplace_status,'')<>'hidden' for share;if not found then raise exception 'festival_event_unavailable';end if;end $$;
create function zoi.festival_form(p_data jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare units integer;
begin
 if jsonb_typeof(p_data) is distinct from 'object' or octet_length(p_data::text)>18000 or length(btrim(coalesce(p_data->>'organisation',''))) not between 1 and 160 or length(btrim(coalesce(p_data->>'contact_name',''))) not between 1 and 120 or length(coalesce(p_data->>'contact_email',''))>160 or coalesce(p_data->>'contact_email','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or coalesce(p_data->>'category','') not in('food','crafts','books','community','sponsor','other') or length(coalesce(p_data->>'notes',''))>2500 then raise exception 'invalid_festival_application';end if;
 begin units:=(p_data->>'units')::integer;exception when others then raise exception 'invalid_festival_application';end;if units is null or units not between 1 and 10 then raise exception 'invalid_festival_units';end if;
 return jsonb_build_object('organisation',btrim(p_data->>'organisation'),'contact_name',btrim(p_data->>'contact_name'),'contact_email',lower(btrim(p_data->>'contact_email')),'category',p_data->>'category','units',units,'notes',coalesce(p_data->>'notes',''));
end $$;
revoke all on function zoi.festival_actor(uuid,boolean),zoi.festival_event(uuid,uuid),zoi.festival_form(jsonb) from public,anon,authenticated;
create function public.festival_package_save(p_workspace uuid,p_id uuid,p_expected_version integer,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;p zoi.festival_packages;prior zoi.festival_packages;eid uuid;price integer;v_capacity integer;deadline timestamptz;v_active boolean;allocated integer;
begin
 actor:=zoi.festival_actor(p_workspace,true);if p_id is null then raise exception 'festival_package_id_required';end if;
 -- An exact creation retry remains readable after its deadline or host visibility changes.
 if p_expected_version=0 then
  select * into prior from zoi.festival_packages where id=p_id;
  if prior.id is not null then if prior.workspace_id is distinct from p_workspace or prior.initial_data is distinct from p_data then raise exception 'festival_request_conflict';end if;return jsonb_build_object('ok',true,'package',to_jsonb(prior));end if;
 end if;
 if jsonb_typeof(p_data) is distinct from 'object' or octet_length(p_data::text)>40000 or coalesce(p_data->>'kind','') not in('booth','sponsor') or length(btrim(coalesce(p_data->>'name',''))) not between 1 and 160 or length(coalesce(p_data->>'description',''))>3000 or coalesce(p_data->>'currency','') !~ '^[A-Z]{3}$' or jsonb_typeof(p_data->'active') is distinct from 'boolean' or jsonb_typeof(coalesce(p_data->'benefits','[]')) is distinct from 'array' then raise exception 'invalid_festival_package';end if;
 if jsonb_array_length(coalesce(p_data->'benefits','[]'))>20 or exists(select 1 from jsonb_array_elements(coalesce(p_data->'benefits','[]')) b where jsonb_typeof(b)<>'string' or length(b#>>'{}') not between 1 and 200) then raise exception 'invalid_festival_benefits';end if;
 if coalesce(p_data->>'closes_at','') !~ '(Z|[+-][0-9]{2}:[0-9]{2})$' or not exists(select 1 from pg_catalog.pg_timezone_names where name=p_data->>'timezone') then raise exception 'festival_timezone_required';end if;
 begin eid:=(p_data->>'event_id')::uuid;price:=(p_data->>'price_cents')::integer;v_capacity:=(p_data->>'capacity')::integer;deadline:=(p_data->>'closes_at')::timestamptz;v_active:=(p_data->>'active')::boolean;exception when others then raise exception 'invalid_festival_package';end;
 if price is null or price not between 0 and 100000000 or v_capacity is null or v_capacity not between 1 and 5000 or deadline is null or not isfinite(deadline) or (v_active and deadline<=clock_timestamp()) then raise exception 'invalid_festival_package';end if;
 perform zoi.festival_event(eid,p_workspace);
 perform 1 from zoi.workspaces where id=p_workspace for update;
 select * into prior from zoi.festival_packages where id=p_id for update;
 if p_expected_version=0 and prior.id is not null then if prior.workspace_id is distinct from p_workspace or prior.initial_data is distinct from p_data then raise exception 'festival_request_conflict';end if;return jsonb_build_object('ok',true,'package',to_jsonb(prior));end if;
 if prior.id is null then
  if p_expected_version is distinct from 0 then raise exception 'festival_version_conflict';end if;
  if (select count(*) from zoi.festival_packages where workspace_id=p_workspace)>=200 then raise exception 'festival_package_limit';end if;
  insert into zoi.festival_packages(id,workspace_id,event_id,kind,name,description,benefits,price_cents,currency,capacity,closes_at,timezone,active,created_by,initial_data) values(p_id,p_workspace,eid,p_data->>'kind',btrim(p_data->>'name'),coalesce(p_data->>'description',''),coalesce(p_data->'benefits','[]'),price,p_data->>'currency',v_capacity,deadline,p_data->>'timezone',v_active,actor,p_data) returning * into p;
 else
  if prior.workspace_id is distinct from p_workspace then raise exception 'festival_permission_denied' using errcode='42501';end if;if prior.version is distinct from p_expected_version then raise exception 'festival_version_conflict';end if;
  if (prior.event_id<>eid or prior.kind<>p_data->>'kind') and exists(select 1 from zoi.festival_applications where package_id=p_id) then raise exception 'festival_package_has_applications';end if;
  select coalesce(sum(units),0) into allocated from zoi.festival_applications where package_id=p_id and status='approved';if v_capacity<allocated then raise exception 'festival_capacity_below_allocations';end if;
  update zoi.festival_packages set event_id=eid,kind=p_data->>'kind',name=btrim(p_data->>'name'),description=coalesce(p_data->>'description',''),benefits=coalesce(p_data->'benefits','[]'),price_cents=price,currency=p_data->>'currency',capacity=v_capacity,closes_at=deadline,timezone=p_data->>'timezone',active=v_active,version=version+1,updated_at=clock_timestamp() where id=p_id returning * into p;
 end if;
 insert into zoi.festival_audit(workspace_id,package_id,actor_id,action,before_state,after_state) values(p_workspace,p.id,actor,case when prior.id is null then 'offer_created' else 'offer_updated' end,case when prior.id is null then null else to_jsonb(prior) end,to_jsonb(p));
 return jsonb_build_object('ok',true,'package',to_jsonb(p));
end $$;
create function public.festival_apply(p_package uuid,p_expected_package_version integer,p_request uuid,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;p zoi.festival_packages;a zoi.festival_applications;data jsonb;allocated integer;t zoi.inquiry_threads;terms jsonb;message text;
begin
 if auth.uid() is null then raise exception 'sign_in_required' using errcode='42501';end if;actor:=zoi.ensure_profile();perform 1 from zoi.user_profiles where id=actor for update;
 if p_request is null then raise exception 'invalid_festival_request';end if;
 select * into a from zoi.festival_applications where profile_id=actor and request_id=p_request;
 if a.id is not null then if a.package_id is distinct from p_package or a.initial_data is distinct from p_data or (a.terms->>'package_version')::integer is distinct from p_expected_package_version then raise exception 'festival_request_conflict';end if;return jsonb_build_object('ok',true,'application',to_jsonb(a));end if;
 data:=zoi.festival_form(p_data);
 select * into p from zoi.festival_packages where id=p_package;if p.id is null then raise exception 'festival_offer_unavailable';end if;perform zoi.festival_event(p.event_id,p.workspace_id);
 select * into p from zoi.festival_packages where id=p_package for update;
 if not p.active or p.closes_at<=clock_timestamp() then raise exception 'festival_offer_unavailable';end if;
 if p.version is distinct from p_expected_package_version then raise exception 'festival_offer_changed';end if;
 if exists(select 1 from zoi.festival_applications where package_id=p.id and profile_id=actor and status in('submitted','approved')) then raise exception 'festival_application_exists';end if;
 if (select count(*) from zoi.festival_applications where profile_id=actor and created_at>=clock_timestamp()-interval '1 day')>=10 then raise exception 'festival_application_limit';end if;
 select coalesce(sum(units),0) into allocated from zoi.festival_applications where package_id=p.id and status='approved';if allocated+(data->>'units')::integer>p.capacity then raise exception 'festival_offer_full';end if;
 terms:=jsonb_build_object('package_version',p.version,'kind',p.kind,'name',p.name,'description',p.description,'benefits',p.benefits,'price_cents',p.price_cents,'currency',p.currency,'closes_at',p.closes_at,'timezone',p.timezone);
 message:='Festival application from '||(data->>'organisation')||E'\nContact: '||(data->>'contact_name')||' · '||(data->>'contact_email')||E'\nRequested units: '||(data->>'units')||E'\n'||(data->>'notes');
 insert into zoi.inquiry_threads(listing_id,workspace_id,customer_id,request_id,subject,initial_body) values(p.event_id,p.workspace_id,actor,gen_random_uuid(),'Festival: '||left(p.name,100),message) returning * into t;
 insert into zoi.inquiry_messages(thread_id,author_id,author_side,request_id,body) values(t.id,actor,'customer',gen_random_uuid(),message);
 insert into zoi.inquiry_audit(thread_id,actor_id,action,after_state) values(t.id,actor,'created',jsonb_build_object('status','open','version',1,'source','festival_application'));
 insert into zoi.festival_applications(package_id,workspace_id,event_id,profile_id,request_id,initial_data,data,terms,units,total_cents,inquiry_id) values(p.id,p.workspace_id,p.event_id,actor,p_request,p_data,data,terms,(data->>'units')::integer,p.price_cents::bigint*(data->>'units')::integer,t.id) returning * into a;
 insert into zoi.festival_audit(workspace_id,package_id,application_id,actor_id,action,after_state) values(a.workspace_id,p.id,a.id,actor,'application_submitted',to_jsonb(a));
 return jsonb_build_object('ok',true,'application',to_jsonb(a));
end $$;
create function public.festival_application_edit(p_application uuid,p_expected_version integer,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;a zoi.festival_applications;prior zoi.festival_applications;p zoi.festival_packages;v_data jsonb;allocated integer;
begin
 actor:=(select id from zoi.user_profiles where auth_user_id=auth.uid());select * into prior from zoi.festival_applications where id=p_application;
 if auth.uid() is null or prior.id is null or prior.profile_id is distinct from actor then raise exception 'festival_permission_denied' using errcode='42501';end if;
 perform zoi.festival_event(prior.event_id,prior.workspace_id);select * into p from zoi.festival_packages where id=prior.package_id for update;select * into prior from zoi.festival_applications where id=p_application for update;
 if prior.version is distinct from p_expected_version then raise exception 'festival_version_conflict';end if;if prior.status<>'submitted' then raise exception 'festival_application_locked';end if;
 v_data:=zoi.festival_form(p_data);if (v_data->>'units')::integer>p.capacity then raise exception 'festival_offer_full';end if;
 update zoi.festival_applications set data=v_data,units=(v_data->>'units')::integer,total_cents=(terms->>'price_cents')::bigint*(v_data->>'units')::integer,version=version+1,updated_at=clock_timestamp() where id=prior.id returning * into a;
 insert into zoi.festival_audit(workspace_id,package_id,application_id,actor_id,action,before_state,after_state) values(a.workspace_id,p.id,a.id,actor,'application_edited',to_jsonb(prior),to_jsonb(a));
 return jsonb_build_object('ok',true,'application',to_jsonb(a));
end $$;
create function public.festival_application_decide(p_workspace uuid,p_application uuid,p_expected_version integer,p_action text,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;a zoi.festival_applications;prior zoi.festival_applications;p zoi.festival_packages;allocated integer;new_status text;
begin
 actor:=zoi.festival_actor(p_workspace);select * into prior from zoi.festival_applications where id=p_application and workspace_id=p_workspace;if prior.id is null then raise exception 'festival_application_unavailable';end if;
 if p_action='approve' then perform zoi.festival_event(prior.event_id,p_workspace);end if;
 select * into p from zoi.festival_packages where id=prior.package_id for update;select * into prior from zoi.festival_applications where id=p_application for update;
 if prior.version is distinct from p_expected_version then raise exception 'festival_version_conflict';end if;
 if p_action='approve' and prior.status='submitted' then
  select coalesce(sum(units),0) into allocated from zoi.festival_applications where package_id=p.id and status='approved';if allocated+prior.units>p.capacity then raise exception 'festival_offer_full';end if;new_status:='approved';
 elsif p_action='decline' and prior.status='submitted' then new_status:='declined';
 elsif p_action='cancel' and prior.status='approved' then new_status:='cancelled';
 else raise exception 'festival_transition_not_allowed';end if;
 if length(coalesce(p_reason,''))>1000 or (p_action in('decline','cancel') and btrim(coalesce(p_reason,''))='') then raise exception 'festival_reason_required';end if;
 update zoi.festival_applications set status=new_status,review_reason=coalesce(p_reason,''),reviewed_by=actor,reviewed_at=clock_timestamp(),version=version+1,updated_at=clock_timestamp() where id=prior.id returning * into a;
 insert into zoi.festival_audit(workspace_id,package_id,application_id,actor_id,action,before_state,after_state,reason) values(p_workspace,p.id,a.id,actor,'application_'||new_status,to_jsonb(prior),to_jsonb(a),coalesce(p_reason,''));
 return jsonb_build_object('ok',true,'application',to_jsonb(a));
end $$;
create function public.festival_application_withdraw(p_application uuid,p_expected_version integer,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;a zoi.festival_applications;prior zoi.festival_applications;
begin
 actor:=(select id from zoi.user_profiles where auth_user_id=auth.uid());select * into prior from zoi.festival_applications where id=p_application;
 if auth.uid() is null or prior.id is null or prior.profile_id is distinct from actor then raise exception 'festival_permission_denied' using errcode='42501';end if;
 perform 1 from zoi.festival_packages where id=prior.package_id for update;select * into prior from zoi.festival_applications where id=p_application for update;
 if prior.version is distinct from p_expected_version then raise exception 'festival_version_conflict';end if;if prior.status not in('submitted','approved') then raise exception 'festival_transition_not_allowed';end if;
 if length(btrim(coalesce(p_reason,''))) not between 1 and 1000 then raise exception 'festival_reason_required';end if;
 update zoi.festival_applications set status='withdrawn',review_reason=btrim(p_reason),reviewed_by=actor,reviewed_at=clock_timestamp(),version=version+1,updated_at=clock_timestamp() where id=prior.id returning * into a;
 insert into zoi.festival_audit(workspace_id,package_id,application_id,actor_id,action,before_state,after_state,reason) values(a.workspace_id,a.package_id,a.id,actor,'application_withdrawn',to_jsonb(prior),to_jsonb(a),btrim(p_reason));
 return jsonb_build_object('ok',true,'application',to_jsonb(a));
end $$;
create function public.festival_catalog(p_event uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare host zoi.listings;packages jsonb;
begin
 select * into host from zoi.listings where id=p_event and publish_status='published' and coalesce(marketplace_status,'')<>'hidden';if host.id is null then return jsonb_build_object('ok',true,'available',false,'packages','[]'::jsonb);end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'kind',p.kind,'name',p.name,'description',p.description,'benefits',p.benefits,'price_cents',p.price_cents,'currency',p.currency,'capacity',p.capacity,'allocated',p.allocated,'remaining',greatest(0,p.capacity-p.allocated),'closes_at',p.closes_at,'timezone',p.timezone,'version',p.version,'application_required',true,'payment_collected',false,'offer_url','/festival/?event='||p.event_id||'&offer='||p.id) order by p.kind,p.name),'[]') into packages from(select p.*,(select coalesce(sum(units),0) from zoi.festival_applications where package_id=p.id and status='approved') as allocated from zoi.festival_packages p where p.event_id=host.id and p.workspace_id=host.owner_workspace_id and p.active and p.closes_at>clock_timestamp())p;
 return jsonb_build_object('ok',true,'available',jsonb_array_length(packages)>0,'event_name',host.name,'packages',packages);
end $$;
create function public.festival_operator(p_workspace uuid,p_event uuid default null,p_status text default null,p_offset integer default 0) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;role text;events jsonb;packages jsonb;applications jsonb;audit jsonb;
begin
 actor:=zoi.festival_actor(p_workspace);role:=zoi.ops_role(p_workspace);
 if p_offset is null or p_offset<0 or p_offset>100000 or (p_status is not null and p_status not in('submitted','approved','declined','withdrawn','cancelled')) then raise exception 'invalid_festival_filter';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'entity_type',entity_type) order by name),'[]') into events from zoi.listings where owner_workspace_id=p_workspace and publish_status='published' and coalesce(marketplace_status,'')<>'hidden';
 select coalesce(jsonb_agg(to_jsonb(p) order by updated_at desc,id),'[]') into packages from(select p.*,(select coalesce(sum(units),0) from zoi.festival_applications where package_id=p.id and status='approved') as allocated from zoi.festival_packages p where workspace_id=p_workspace and (p_event is null or event_id=p_event))p;
 select coalesce(jsonb_agg(to_jsonb(a) order by created_at desc,id),'[]') into applications from(select a.*,l.name as event_name from zoi.festival_applications a join zoi.listings l on l.id=a.event_id where a.workspace_id=p_workspace and (p_event is null or a.event_id=p_event) and (p_status is null or a.status=p_status) order by a.created_at desc,a.id limit 50 offset p_offset)a;
 select coalesce(jsonb_agg(to_jsonb(a) order by id desc),'[]') into audit from(select * from zoi.festival_audit where workspace_id=p_workspace order by id desc limit 100)a;
 return jsonb_build_object('ok',true,'role',role,'events',events,'packages',packages,'applications',applications,'audit',audit,'next_offset',case when jsonb_array_length(applications)=50 then p_offset+50 else null end);
end $$;
create function public.festival_my_applications(p_event uuid default null,p_offset integer default 0) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;applications jsonb;
begin
 if auth.uid() is null then raise exception 'sign_in_required' using errcode='42501';end if;actor:=(select id from zoi.user_profiles where auth_user_id=auth.uid());if p_offset is null or p_offset<0 or p_offset>100000 then raise exception 'invalid_festival_filter';end if;
 select coalesce(jsonb_agg(to_jsonb(a) order by created_at desc,id),'[]') into applications from(select a.*,l.name as event_name from zoi.festival_applications a join zoi.listings l on l.id=a.event_id where a.profile_id=actor and (p_event is null or a.event_id=p_event) order by a.created_at desc,a.id limit 50 offset p_offset)a;
 return jsonb_build_object('ok',true,'applications',applications,'next_offset',case when jsonb_array_length(applications)=50 then p_offset+50 else null end);
end $$;
revoke all on function public.festival_package_save(uuid,uuid,integer,jsonb),public.festival_apply(uuid,integer,uuid,jsonb),public.festival_application_edit(uuid,integer,jsonb),public.festival_application_decide(uuid,uuid,integer,text,text),public.festival_application_withdraw(uuid,integer,text),public.festival_catalog(uuid),public.festival_operator(uuid,uuid,text,integer),public.festival_my_applications(uuid,integer) from public,anon,authenticated;
grant execute on function public.festival_catalog(uuid) to anon,authenticated;
grant execute on function public.festival_package_save(uuid,uuid,integer,jsonb),public.festival_apply(uuid,integer,uuid,jsonb),public.festival_application_edit(uuid,integer,jsonb),public.festival_application_decide(uuid,uuid,integer,text,text),public.festival_application_withdraw(uuid,integer,text),public.festival_operator(uuid,uuid,text,integer),public.festival_my_applications(uuid,integer) to authenticated;
commit;

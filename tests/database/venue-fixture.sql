-- Isolated test database only. Shapes follow inspected production metadata.
create role anon;create role authenticated;create schema auth;create schema zoi;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table zoi.user_profiles(id uuid primary key,auth_user_id uuid unique);
create table zoi.workspaces(id uuid primary key);
create table zoi.workspace_members(workspace_id uuid,profile_id uuid,role text);
create table zoi.listings(id uuid primary key,owner_workspace_id uuid,entity_type text,publish_status text,marketplace_status text);
create table zoi.ticket_types(id bigint primary key,event_id uuid,workspace_id uuid,name text,description text,price_cents integer not null default 0,currency text not null default 'EUR',capacity integer,reserved integer not null default 0,active boolean not null default true,sort integer);
create table zoi.ticket_reservations(id uuid primary key default gen_random_uuid(),event_id uuid not null,ticket_type_id bigint not null,buyer_name text not null,buyer_email text not null,qty integer not null,amount_cents integer not null,status text not null,checked_in_at timestamptz,payment_status text,code text unique default upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)));
create function zoi.ensure_profile() returns uuid language sql security definer as $$select id from zoi.user_profiles where auth_user_id=auth.uid()$$;
create function zoi.flag(text) returns boolean language sql as $$select true$$;
create function public.tickets_reserve(p_event uuid,p_type bigint,p_name text,p_email text,p_qty integer default 1) returns jsonb language plpgsql security definer set search_path='zoi','public' as $$
declare t zoi.ticket_types;r zoi.ticket_reservations;
begin
 if not zoi.flag('feature_tickets') then raise exception 'ticketing_paused';end if;
 if coalesce(btrim(p_name),'')='' or coalesce(btrim(p_email),'')='' then raise exception 'name and email required';end if;
 if coalesce(p_qty,0)<1 then p_qty:=1;end if;
 select * into t from zoi.ticket_types where id=p_type and event_id=p_event and active=true for update;
 if not found then raise exception 'ticket type not found';end if;
 if coalesce(t.price_cents,0)>0 then raise exception 'priced_tickets_require_checkout';end if;
 if t.capacity is not null and t.reserved+p_qty>t.capacity then raise exception 'not enough tickets left';end if;
 update zoi.ticket_types set reserved=reserved+p_qty where id=t.id;
 insert into zoi.ticket_reservations(event_id,ticket_type_id,buyer_name,buyer_email,qty,amount_cents,status) values(p_event,p_type,btrim(p_name),btrim(p_email),p_qty,0,'reserved') returning * into r;
 return jsonb_build_object('ok',true,'code',r.code,'qty',r.qty,'amount_cents',0,'currency',t.currency,'paid',false);
end$$;
insert into zoi.user_profiles values('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000002'),('00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000003');
insert into zoi.workspaces values('10000000-0000-4000-8000-000000000001'),('10000000-0000-4000-8000-000000000002');
insert into zoi.workspace_members values('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','owner'),('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000003','member');
insert into zoi.listings values('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','event','published','');
insert into zoi.ticket_types(id,event_id,workspace_id,name,capacity) values(1,'20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Free seating',24);

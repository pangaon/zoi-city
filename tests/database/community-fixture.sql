create role anon;create role authenticated;create role service_role bypassrls;
create schema auth;create schema zoi;grant usage on schema public,zoi,auth to anon,authenticated,service_role;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table zoi.user_profiles(id uuid primary key default gen_random_uuid(),auth_user_id uuid,display_name text,first_name text,city text);
create function zoi.ensure_profile() returns uuid language plpgsql security definer as $$declare v uuid;begin select id into v from zoi.user_profiles where auth_user_id=auth.uid();if v is null then insert into zoi.user_profiles(auth_user_id) values(auth.uid()) returning id into v;end if;return v;end$$;
create function zoi.is_admin() returns boolean language sql as $$select coalesce(current_setting('test.admin',true),'')='yes'$$;
create table zoi.listings(id uuid primary key,name text,slug text,entity_type text,publish_status text,marketplace_status text);
create table zoi.feed_posts(id uuid primary key default gen_random_uuid(),profile_id uuid references zoi.user_profiles(id),body text check(char_length(body) between 1 and 1000),listing_id uuid,listing_name text,listing_slug text,nameday_ref text,likes integer default 0,comments integer default 0,created_at timestamptz default now(),media jsonb default '[]',status text default 'visible');
create table zoi.feed_comments(id uuid primary key default gen_random_uuid(),post_id uuid references zoi.feed_posts(id) on delete cascade,profile_id uuid not null,body text check(char_length(body) between 1 and 500),created_at timestamptz default now(),status text default 'visible');
create table zoi.feed_likes(post_id uuid references zoi.feed_posts(id) on delete cascade,profile_id uuid,created_at timestamptz default now(),primary key(post_id,profile_id));
create table zoi.feed_blocks(blocker uuid not null,blocked uuid not null,created_at timestamptz not null default now(),primary key(blocker,blocked));

create table zoi.feed_follows(follower uuid not null,followee uuid not null,created_at timestamptz not null default now(),primary key(follower,followee));create table zoi.feed_reports(id bigserial primary key,post_id uuid not null,profile_id uuid not null,reason text,created_at timestamptz default now(),unique(post_id,profile_id));alter table zoi.listings add column canonical_path text,add column city text;

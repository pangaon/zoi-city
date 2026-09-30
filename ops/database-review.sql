select jsonb_build_object(
 'tables',(select jsonb_agg(x) from(select table_name,column_name,data_type,udt_name,is_nullable,column_default from information_schema.columns where table_schema='zoi' and (table_name like 'social_%' or table_name like '%oauth%') order by table_name,ordinal_position)x),
 'policies',(select jsonb_agg(x) from(select * from pg_policies where schemaname='zoi' and (tablename like 'social_%' or tablename like '%oauth%'))x),
 'functions',(select jsonb_agg(x) from(select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) as arguments,pg_get_functiondef(p.oid) as definition,p.proacl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','zoi') and (p.proname like 'social_%' or p.proname like '%oauth%'))x)
) as social_connection_review;

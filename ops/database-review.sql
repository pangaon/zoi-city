select jsonb_build_object(
 'columns',(select jsonb_agg(x) from(select table_name,column_name,data_type,udt_name,is_nullable,column_default from information_schema.columns where table_schema='zoi' and table_name in('feed_blocks','feed_follows','feed_reports') order by ordinal_position)x),
 'constraints',(select jsonb_agg(x) from(select c.relname,con.conname,pg_get_constraintdef(con.oid) as definition from pg_constraint con join pg_class c on c.oid=con.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='zoi' and c.relname in('feed_blocks','feed_follows','feed_reports'))x),
 'tables',(select jsonb_agg(table_name) from information_schema.tables where table_schema='zoi' and (table_name like 'feed_%' or table_name like 'community_%')),
 'functions',(select jsonb_agg(x) from(select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) as arguments,pg_get_functiondef(p.oid) as definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','zoi') and (p.proname like 'feed_%' or p.proname like 'community_%' or p.proname in('is_admin','current_profile')))x)
) as community_review;

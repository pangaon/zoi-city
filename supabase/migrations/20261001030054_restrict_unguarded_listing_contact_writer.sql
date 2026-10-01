begin;
-- Historical enrichment helper has no caller authorization in its body.
-- Preserve trusted server enrichment; prevent public listing mutation by slug.
revoke all on function public.zoi_update_contact(text,text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.zoi_update_contact(text,text,text,text,text,text,text,text) to service_role;
commit;

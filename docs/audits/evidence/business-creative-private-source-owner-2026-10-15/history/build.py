from pathlib import Path
import json,re,hashlib
r=Path('/workspaces/zoi-business-private-source-work');migration=r/'supabase/migrations/20261015222952_business_creative_owner_private_source.sql'
contracts=[]
for n in ['root-private-source-contracts.json','root-private-source-additional-contracts.json']:
 for f in json.load(open('/home/codespace/.cache/zoi/business-destination-review-20261015/'+n))['functions']:
  if 'signature' not in f:
   f['signature']=f['schema']+'.'+f['name']+'('+{'home_content_get':'uuid,uuid','bizpage_get':'uuid,uuid','home_revision_baseline':'zoi.listings'}[f['name']]+')'
  elif '.' not in f['signature'].split('(')[0]:f['signature']='public.'+f['signature']
  contracts.append(f)
for f in json.load(open(r/'tests/database/fixtures/business-creative-live-contracts.json'))['functions']:
 sig=f['signature']if f['signature'].startswith('zoi.')else'public.'+f['signature']
 if sig in ['public.home_entity(text)','zoi.business_creative_source(jsonb)','zoi.assert_workspace_write(uuid,text[])','zoi.home_content_authorize(uuid,uuid)','zoi.suite_current_session()']:
  contracts.append({**f,'signature':sig})
for f in json.load(open(r/'tests/database/fixtures/business-destination-live.json'))['functions']:
 if f['signature']=='zoi.business_creative_source(jsonb)':contracts.append(f)
new=[]
def extract(path,name):
 s=(r/path).read_text();m=re.search(r'CREATE FUNCTION '+re.escape(name)+r'\([^$]*?AS\s*\$\$(.*?)\$\$;',s,re.S|re.I)
 assert m,name
 return m.group(0),m.group(1)
callers=[('supabase/migrations/20261015160834_business_creative_draft_receipts.sql','zoi.business_creative_receipt','uuid,uuid,uuid'),('supabase/migrations/20261015160834_business_creative_draft_receipts.sql','public.business_creative_draft_save','uuid,uuid,uuid,jsonb'),('supabase/migrations/20261015160834_business_creative_draft_receipts.sql','public.business_creative_draft_get','uuid,uuid'),('supabase/migrations/20261015180036_studio_media_image_composition_verified.sql','zoi.studio_render_context','uuid,uuid,uuid,jsonb'),('supabase/migrations/20261015180036_studio_media_image_composition_verified.sql','zoi.studio_media_insert_allowed','text,text'),('supabase/migrations/20261015214254_business_creative_destination_review.sql','zoi.business_creative_destination_context','uuid,uuid,uuid'),('supabase/migrations/20261015214254_business_creative_destination_review.sql','public.business_creative_destinations_recover','uuid,uuid,uuid,boolean')]
for path,name,args in callers:
 definition,body=extract(path,name);assert body.count('zoi.business_creative_source(public.home_entity(slug))')==1
 var={'zoi.studio_render_context':'ws,listing','zoi.studio_media_insert_allowed':'g.workspace_id,g.listing_id','public.business_creative_draft_save':'p_workspace,p_listing','zoi.business_creative_receipt':'p_workspace,p_listing','public.business_creative_draft_get':'p_workspace,r.listing_id','zoi.business_creative_destination_context':'p_workspace,r.listing_id','public.business_creative_destinations_recover':'p_workspace,r.listing_id'}[name]
 definition=definition.replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION',1).replace('zoi.business_creative_source(public.home_entity(slug))','zoi.business_creative_current_source('+var+')')
 new.append(definition);contracts.append({'signature':name+'('+args+')','body_md5':hashlib.md5(body.encode()).hexdigest(),'source':path,'owner':'postgres','config':['search_path=""'],'security_definer':True,'acl':'{postgres=X/postgres,authenticated=X/postgres}'if name.startswith('public.')or name=='zoi.studio_media_insert_allowed'else'{postgres=X/postgres}'})
definition,body=extract('supabase/migrations/20261015180036_studio_media_image_composition_verified.sql','public.business_creative_render_save')
definition=definition.replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION',1).replace("'kind','published_business_image_composition'","'kind',CASE WHEN p_payload#>>'{source,_creative_source,type}'='owner_private_draft'THEN'owner_private_business_image_composition'ELSE'published_business_image_composition'END")
new.append(definition);contracts.append({'signature':'public.business_creative_render_save(uuid,uuid,uuid,jsonb)','body_md5':hashlib.md5(body.encode()).hexdigest(),'owner':'postgres','config':['search_path=""'],'security_definer':True,'acl':'{postgres=X/postgres,authenticated=X/postgres}'})
new=[d.replace("'kind','published_business_reference'","'kind',CASE WHEN p_payload#>>'{source,_creative_source,type}'='owner_private_draft'THEN'owner_private_business_reference'ELSE'published_business_reference'END")if d.startswith('CREATE OR REPLACE FUNCTION public.business_creative_draft_save(')else d for d in new]
pdef,pbody=extract('supabase/migrations/20261015160834_business_creative_draft_receipts.sql','zoi.business_creative_project_layer');pdef=pdef.replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION',1).replace("WHEN 'top'THEN ARRAY['id'","WHEN 'top'THEN ARRAY['_creative_source','id'",1);new.insert(0,pdef);contracts.append({'signature':'zoi.business_creative_project_layer(jsonb,text)','body_md5':hashlib.md5(pbody.encode()).hexdigest(),'owner':'postgres','config':['search_path=""'],'security_definer':False,'acl':'{postgres=X/postgres}'})
fixture={'scope':'Exact captured owner functions plus exact accepted current seven creative/Raster/destination source callers. No live queries by author. Published public source contract unchanged.','functions':contracts};(r/'tests/database/fixtures/business-creative-private-source-live.json').write_text(json.dumps(fixture,indent=2)+'\n')
guards=[]
for f in contracts:
 g="IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('"+f['signature']+"')AND md5(prosrc)='"+f['body_md5']+"'AND proowner='postgres'::regrole "
 if 'acl'in f:g+="AND proacl::text IS NOT DISTINCT FROM "+("NULL"if f['acl']is None else "'"+f['acl']+"'")+" AND proconfig IS NOT DISTINCT FROM ARRAY["+','.join("'"+x.replace("'","''")+"'"for x in f['config'])+"]::text[]AND prosecdef="+str(f['security_definer']).lower()
 g+=" AND provolatile='"+("i"if f['signature']=='zoi.business_creative_project_layer(jsonb,text)'or re.search(r'\bIMMUTABLE\b',f.get('definition',''),re.I)else("s"if re.search(r'\bSTABLE\b',f.get('definition',''),re.I)else'v'))+"'"
 g+=")THEN RAISE EXCEPTION 'business_private_dependency_changed: "+f['signature']+"';END IF;";guards.append(g)
head="BEGIN;\nSET LOCAL lock_timeout='1s';SET LOCAL statement_timeout='5s';\nDO $guard$ BEGIN IF current_user<>'postgres'THEN RAISE EXCEPTION 'business_private_postgres_required';END IF;\n"+'\n'.join(guards)+"\nEND $guard$;\n"
table=json.load(open('/home/codespace/.cache/zoi/business-destination-review-20261015/root-private-source-contracts.json'))
head+="DO $guard$DECLARE acl text;BEGIN acl:=CASE WHEN current_setting('server_version_num')::integer>=170000 AND current_setting('server_version_num')::integer<180000 THEN '{postgres=arwdDxtm/postgres}'WHEN current_setting('server_version_num')::integer>=160000 AND current_setting('server_version_num')::integer<170000 THEN '{postgres=arwdDxt/postgres}'ELSE NULL END;IF acl IS NULL OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='zoi.home_designs'::regclass AND relowner='postgres'::regrole AND relacl::text IS NOT DISTINCT FROM acl AND relrowsecurity)THEN RAISE EXCEPTION 'business_private_revision_catalog_changed';END IF;\n"
head+="IF(SELECT count(*)FROM pg_attribute WHERE attrelid='zoi.home_designs'::regclass AND attnum>0 AND NOT attisdropped)<>12 THEN RAISE EXCEPTION 'business_private_revision_columns_changed';END IF;\n"
for c in table['home_designs_columns']:
 head+="IF NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='zoi.home_designs'::regclass AND attname='"+c['name']+"'AND NOT attisdropped AND format_type(atttypid,atttypmod)='"+c['type']+"'AND attnotnull="+str(c['not_null']).lower()+")THEN RAISE EXCEPTION 'business_private_revision_columns_changed';END IF;\n"
head+="END $guard$;\n"
helper=r'''
-- One read-only source assembler, including inside the nonce-first Storage
-- policy. NO row/advisory locks, no owner getter/preview calls, no writes here.
-- Lock-taking entrypoints authorize and lock the listing first; final consume
-- recomputes this same source under that lock. Storage permission alone does not
-- freeze owner edits or make bytes eligible for final canonical consumption.
CREATE FUNCTION zoi.business_creative_current_entity(p_workspace uuid,p_listing uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''AS $$
DECLARE l zoi.listings;d zoi.home_designs;e jsonb;p jsonb;owner jsonb;content jsonb;identity jsonb;revision jsonb;
BEGIN
 SELECT *INTO l FROM zoi.listings WHERE id=p_listing AND owner_workspace_id=p_workspace;
 IF l.id IS NULL THEN RETURN NULL;END IF;
 e:=public.home_entity(l.slug);
 IF e IS NOT NULL THEN RETURN e;END IF;
 -- A distinct owner-private branch, never a visibility override or archived
 -- fixture adoption. Other blocked/moderated states stay unavailable.
 IF l.publish_status IS DISTINCT FROM'draft'OR coalesce(l.moderation_status,'')NOT IN('clean','cleared')THEN RETURN NULL;END IF;
 IF current_setting('transaction_isolation')IS DISTINCT FROM'read committed'THEN RAISE EXCEPTION 'business_private_isolation_unsupported';END IF;
 SELECT *INTO d FROM zoi.home_designs WHERE listing_id=p_listing AND workspace_id=p_workspace;
 p:=coalesce(l.profile,'{}')-'_coverage';IF p?'_enrich'THEN p:=jsonb_set(p,'{_enrich}',(p->'_enrich')-'lease');END IF;
 owner:=coalesce(zoi.public_owner_content(l.id),'{}');
 -- Exact canonical bizpage_get base values + current identity. Do not invoke
 -- its locking authorization from Storage INSERT after the nonce lock.
 e:=jsonb_build_object('id',l.id,'name',l.name,'slug',l.slug,'path',coalesce(l.canonical_path,'/p/'||l.slug),'description',l.description,'phone',l.phone,'email',l.email,'website',l.website,'hours',l.hours,'price_range',l.price_range,'photo_url',l.photo_url,'social_links',coalesce(l.social_links,'{}'));
 identity:=jsonb_build_object('id',l.id,'name',l.name,'slug',l.slug,'canonical_slug',l.slug,'address',l.address,'city',l.city,'country',l.country,'entity_type',l.entity_type,'category_slug',(SELECT slug FROM zoi.categories WHERE id=l.primary_category_id),'primary_category_id',l.primary_category_id,'owner_workspace_id',l.owner_workspace_id,'owner_user_id',to_jsonb(l)->'owner_user_id','claim_status',to_jsonb(l)->'claim_status','publish_status',l.publish_status,'moderation_status',l.moderation_status,'marketplace_status',l.marketplace_status);
 IF coalesce(d.staged,false)THEN
  IF d.content_baseline IS DISTINCT FROM zoi.home_revision_baseline(l)THEN RAISE EXCEPTION 'business_private_revision_stale';END IF;
  content:=d.draft_content;
  IF jsonb_typeof(content->'base')IS DISTINCT FROM'object'OR jsonb_typeof(content->'profile')IS DISTINCT FROM'object'THEN RAISE EXCEPTION 'business_private_revision_invalid';END IF;
  -- Same authored null/removal precedence as home_revision_preview_data;
  -- no preview receipt mutation and no synthetic published/visible flags.
  p:=(p-ARRAY(SELECT jsonb_array_elements_text(coalesce(content->'profile_remove','[]'))))||(content->'profile');
  owner:=owner||(content->'base')||jsonb_build_object('profile',(coalesce(owner->'profile','{}')-ARRAY(SELECT jsonb_array_elements_text(coalesce(content->'profile_remove','[]'))))||(content->'profile'));
  e:=e||(content->'base');
  IF content->>'media_remove'='true'THEN p:=p-'owner_media';END IF;
  IF content?'media'THEN p:=jsonb_set(p,'{owner_media}',jsonb_build_object('version',coalesce((l.profile#>>'{owner_media,version}')::integer,0)+1,'items',content->'media'));END IF;
 END IF;
 revision:=jsonb_build_object('type','owner_private_draft','schema',1,'workspace',p_workspace,'listing',l.id,'content_version',zoi.home_content_version(l),'baseline',zoi.home_revision_baseline(l),'staged',coalesce(d.staged,false),'revision',coalesce(d.version,0),'revision_baseline',d.content_baseline);
 e:=e||identity||jsonb_build_object('profile',p,'owner_content',owner,'_creative_source',revision);
 IF octet_length(e::text)>300000 THEN RAISE EXCEPTION 'business_private_source_too_large';END IF;
 RETURN e;
END$$;
CREATE FUNCTION zoi.business_creative_current_source(p_workspace uuid,p_listing uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''AS $$
BEGIN RETURN zoi.business_creative_source(zoi.business_creative_current_entity(p_workspace,p_listing));
EXCEPTION WHEN raise_exception THEN
 -- A historical immutable receipt remains readable under current owner/Auth
 -- authority even if its current private source is unavailable. Never call it
 -- current, and never mask unknown SQL/authority/isolation errors.
 IF SQLERRM IN('business_private_revision_stale','business_private_revision_invalid','business_private_source_too_large')THEN RETURN NULL;END IF;RAISE;
END$$;
CREATE FUNCTION public.business_creative_source_get(p_workspace uuid,p_listing uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''AS $$
DECLARE s jsonb;e jsonb;source jsonb;kind text;
BEGIN
 PERFORM zoi.assert_workspace_write(p_workspace);PERFORM zoi.home_content_authorize(p_workspace,p_listing);PERFORM zoi.suite_current_session();
 s:=public.home_content_get(p_workspace,p_listing);
 e:=zoi.business_creative_current_entity(p_workspace,p_listing);
 IF e IS NULL OR e->>'id'IS DISTINCT FROM p_listing::text THEN RAISE EXCEPTION 'business_creative_listing_unavailable';END IF;
 kind:=CASE WHEN e?'_creative_source'THEN'owner_private_draft'ELSE'published_reference'END;
 IF kind='owner_private_draft'AND e#>>'{_creative_source,content_version}'IS DISTINCT FROM s->>'version'THEN RAISE EXCEPTION 'business_private_source_changed';END IF;
 source:=zoi.business_creative_source(e);
 IF octet_length(source::text)>64000 THEN RAISE EXCEPTION 'business_private_source_too_large';END IF;
 PERFORM zoi.assert_workspace_write(p_workspace);PERFORM zoi.home_content_authorize(p_workspace,p_listing);PERFORM zoi.suite_current_session();
 RETURN jsonb_build_object('ok',true,'workspace_id',p_workspace,'listing_id',p_listing,'source_type',kind,'entity',e,'source',source);
END$$;
REVOKE ALL ON FUNCTION zoi.business_creative_current_entity(uuid,uuid),zoi.business_creative_current_source(uuid,uuid),public.business_creative_source_get(uuid,uuid)FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.business_creative_source_get(uuid,uuid)TO authenticated;
'''
migration.write_text(head+helper+'\n'+'\n\n'.join(new)+"\nNOTIFY pgrst,'reload schema';\nCOMMIT;\n")
print('Wrote guarded migration, captured fixture and exact seven replacements')

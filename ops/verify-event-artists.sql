BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SET LOCAL request.jwt.claim.sub='2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd';
DO $$
DECLARE ws uuid:='053a5656-b19b-48a4-8721-65c4674f647c';actor uuid:='21a04e78-e3b1-448e-8517-47aad25dd5da';ev uuid:=gen_random_uuid();artist uuid:=gen_random_uuid();appearance uuid:=gen_random_uuid();r jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM zoi.user_profiles p JOIN zoi.workspace_members m ON m.profile_id=p.id WHERE p.id=actor AND p.auth_user_id=auth.uid() AND m.workspace_id=ws AND m.role IN('owner','admin')) THEN RAISE EXCEPTION 'qa_scope_unavailable';END IF;
 IF NOT EXISTS(SELECT 1 FROM zoi.categories WHERE id=6 AND slug='events-entertainment') THEN RAISE EXCEPTION 'qa_event_category_unavailable';END IF;
 INSERT INTO zoi.listings(id,name,slug,entity_type,owner_workspace_id,primary_category_id,publish_status,moderation_status,marketplace_status) VALUES
 (ev,'Private rollback event artists QA','qa-event-artists-'||ev,'event',ws,6,'published','clean','visible'),
 (artist,'Private rollback artist QA','qa-event-artist-'||artist,'artist',ws,6,'published','clean','visible');
 IF (SELECT count(*) FROM zoi.listings WHERE id IN(ev,artist) AND owner_workspace_id=ws AND publish_status='published' AND moderation_status='clean' AND marketplace_status='visible') IS DISTINCT FROM 2::bigint THEN RAISE EXCEPTION 'qa_public_eligibility_failed';END IF;
 INSERT INTO zoi.artist_appearances(id,artist_id,event_id,artist_workspace,event_workspace,starts_at,ends_at,timezone,source_url,event_confirmed_by,artist_confirmed_by,status,created_by,initial_data)
 VALUES(appearance,artist,ev,ws,ws,clock_timestamp()+interval '1 day',clock_timestamp()+interval '2 days','UTC','https://example.test/rollback-only',actor,actor,'confirmed',actor,'{"private":"rollback-only"}');
 r:=public.event_artists(ev);
 IF r->>'ok' IS DISTINCT FROM 'true' OR r#>>'{artists,0,artist_id}' IS DISTINCT FROM artist::text OR jsonb_array_length(r->'artists') IS DISTINCT FROM 1 OR jsonb_array_length(public.artist_shows(artist)->'shows') IS DISTINCT FROM 1 THEN RAISE EXCEPTION 'event_artist_projection_failed';END IF;
 IF (r#>'{artists,0}') ?| ARRAY['artist_workspace','event_workspace','initial_data','created_by','artist_confirmed_by','event_confirmed_by'] THEN RAISE EXCEPTION 'event_artist_private_projection';END IF;
 UPDATE zoi.listings SET moderation_status='flagged' WHERE id=artist;
 IF jsonb_array_length(public.event_artists(ev)->'artists') IS DISTINCT FROM 0 OR jsonb_array_length(public.artist_shows(artist)->'shows') IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'event_artist_moderation_failed';END IF;
 UPDATE zoi.listings SET moderation_status='clean' WHERE id=artist;
 UPDATE zoi.listings SET marketplace_status='hidden' WHERE id=ev;
 IF jsonb_array_length(public.event_artists(ev)->'artists') IS DISTINCT FROM 0 OR jsonb_array_length(public.artist_shows(artist)->'shows') IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'event_artist_hidden_failed';END IF;
 UPDATE zoi.listings SET marketplace_status='visible' WHERE id=ev;
 UPDATE zoi.artist_appearances SET artist_confirmed_by=NULL WHERE id=appearance;
 IF jsonb_array_length(public.event_artists(ev)->'artists') IS DISTINCT FROM 0 OR jsonb_array_length(public.artist_shows(artist)->'shows') IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'event_artist_confirmation_failed';END IF;
 IF NOT has_function_privilege('anon','public.event_artists(uuid)','EXECUTE') OR has_table_privilege('anon','zoi.artist_appearances','SELECT') THEN RAISE EXCEPTION 'event_artist_acl_failed';END IF;
END $$;
SELECT 'event_artists_rollback_checks_passed' AS result;
ROLLBACK;

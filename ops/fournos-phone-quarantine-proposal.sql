-- PROPOSAL ONLY: reviewed source first telephone belongs to Fourways The View.
-- Exactly14 other records; The View ce057240 is deliberately retained.
BEGIN;
SET LOCAL statement_timeout='15s';
SET LOCAL lock_timeout='3s';
DO $audit$
DECLARE item record; current_row zoi.listings; evidence jsonb; n int:=0;
BEGIN
 FOR item IN SELECT * FROM (VALUES ('01727864-b90f-4a52-98b0-995155f9e652'::uuid,'abe06c8009125afa0bbf07a8633ce4fa','d6226db713536e8a71afc92c95cc526a'),
('048c48ab-4ff1-4e4e-a6c9-bd4ff7cc31dd'::uuid,'456ba379a10ed0c7c2a6649850bceaa4','f2cdc31dc5fd2d84cf35c006c7224182'),
('1f40667c-b562-4397-9f01-3a509c9860fd'::uuid,'ed94da9eca2a0157ee6a606eab40113a','39824ca2030be155628c86727f373e4c'),
('30cb5e78-a32f-4e16-9ea0-07eb5cafed78'::uuid,'ed94da9eca2a0157ee6a606eab40113a','72894f057a9a5a748bc3137d39548000'),
('438845e1-2e64-4958-ba98-d50e51a5d8c0'::uuid,'ed94da9eca2a0157ee6a606eab40113a','83d8a6607c37826dddffc02ec4c49c87'),
('6e3ff268-a5d9-44ed-9373-1058d45c69f7'::uuid,'bbd41a7c6b9a8424f4031af533f94917','fea225d95b6956328b5fa20483507560'),
('8f015fb0-6fb0-4c42-982a-06bde97afbcc'::uuid,'2bc96de52062da4fb9bcfe18cf69c4f2','c65ea99b3ef7edadfb2d21989e79d05a'),
('95d6660e-696c-4faa-8c59-32327f992029'::uuid,'2bc96de52062da4fb9bcfe18cf69c4f2','0433bbf80e5c82dd867c0b34b82e15f6'),
('9fa58b68-ecec-4c21-8c18-bb826c8b6165'::uuid,'2bc96de52062da4fb9bcfe18cf69c4f2','f4e688c63890185a796a692197f83e88'),
('a95b59f6-13b6-4eb9-b1f3-6d5dd790badd'::uuid,'2bc96de52062da4fb9bcfe18cf69c4f2','f7118725f812b51f11e097c7f7d29679'),
('ad0e7dfb-db5d-4702-90e7-26bd3d0aae95'::uuid,'2bc96de52062da4fb9bcfe18cf69c4f2','9f77dd1342426de7fe51fa0e55bea33e'),
('c2c2591d-b302-4c62-a088-90256caff9ab'::uuid,'2bc96de52062da4fb9bcfe18cf69c4f2','8bd90b3289f0c6b606ab6f9057d08a03'),
('d3447f38-1ac5-498f-86ae-657fa6e4a4a3'::uuid,'2bc96de52062da4fb9bcfe18cf69c4f2','654452744b030691bdd66e414123d348'),
('e4bc1a08-da30-4c3e-aa67-465b33e6a816'::uuid,'2bc96de52062da4fb9bcfe18cf69c4f2','d19efebc819f6fd4e458c754a6afd5fe')) expected(id,profile_hash,base_hash)
 LOOP
  SELECT * INTO STRICT current_row FROM zoi.listings WHERE id=item.id FOR UPDATE;
  IF current_row.website IS DISTINCT FROM 'https://www.fournos.co.za/' OR
    md5(current_row.profile::text) IS DISTINCT FROM item.profile_hash OR
    md5((to_jsonb(current_row)-'profile'-'updated_at')::text) IS DISTINCT FROM item.base_hash OR
    zoi.public_owner_content(item.id) IS DISTINCT FROM '{}'::jsonb OR
    current_row.profile#>>'{_enrich,source_url}' IS DISTINCT FROM 'https://www.fournos.co.za/' OR
    current_row.profile#>>'{_enrich,phone}' IS DISTINCT FROM '+27100277363'
  THEN RAISE EXCEPTION 'fournos_phone_snapshot_changed';END IF;
  evidence=jsonb_build_object('phone',current_row.profile#>'{_enrich,phone}','source_url',current_row.profile#>'{_enrich,source_url}','checked_at',current_row.profile#>'{_enrich,checked_at}','provenance',current_row.profile#>'{_enrich,provenance,phone}','reason','root_first_phone_belongs_to_fourways_the_view','reviewed_at','2026-09-30','source_evidence','official_fournos_popup_titles_and_tel_blocks');
  IF current_row.profile#>'{_enrich,quarantined_contact_evidence}' IS NOT NULL THEN RAISE EXCEPTION 'fournos_prior_quarantine_requires_review';END IF;
  UPDATE zoi.listings SET profile=jsonb_set(current_row.profile,'{_enrich}',((current_row.profile->'_enrich')-'phone')||jsonb_build_object('quarantined_contact_evidence',evidence)) WHERE id=item.id;
  SELECT * INTO STRICT current_row FROM zoi.listings WHERE id=item.id;
  IF md5((to_jsonb(current_row)-'profile'-'updated_at')::text) IS DISTINCT FROM item.base_hash OR zoi.public_owner_content(item.id) IS DISTINCT FROM '{}'::jsonb OR current_row.profile#>'{_enrich,phone}' IS NOT NULL OR current_row.profile#>'{_enrich,quarantined_contact_evidence}' IS DISTINCT FROM evidence THEN RAISE EXCEPTION 'fournos_quarantine_postcondition';END IF;
  n:=n+1;
 END LOOP;
 IF n<>14 THEN RAISE EXCEPTION 'fournos_quarantine_count';END IF;
END $audit$;
SELECT jsonb_build_object('ok',true,'phone_fallbacks_quarantined',14,'correct_the_view_retained',true,'owner_base_unchanged',true) AS result;
COMMIT;

BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
-- Precision claim correction only. No coordinate is moved or certified as exact.
-- Exact unowned snapshots from independently reviewable durable city-centroid metadata.
DO $correction$
DECLARE target jsonb;before_row zoi.listings;after_row zoi.listings;request uuid;changed integer:=0;
BEGIN
 FOR target IN SELECT value FROM jsonb_array_elements($precision_targets$[
  {
    "id": "68b47c4f-cded-4ad7-becf-65498eca6d01",
    "expected": "77e46b685db36b85d2a615b1393b1368"
  },
  {
    "id": "6b576fef-f96e-48dc-9c56-51ef36175b1e",
    "expected": "897186f9d050c8f952e07b4b9125636f"
  },
  {
    "id": "0f98674b-fd14-4923-ad75-4a819a2d7a94",
    "expected": "199d550ff539db89ca426195395ee507"
  },
  {
    "id": "b22fbe09-6f59-4af6-af3c-98d3042fd3f3",
    "expected": "7cac2e88c536a1ec0a55d0cb000580de"
  },
  {
    "id": "bb3d7ff2-56c2-4f35-b4fc-d8d5b4745582",
    "expected": "927b8bf7e4cb4e99303c3fefef202f39"
  },
  {
    "id": "e9ae9dac-7d55-4c3e-ac4d-e66945e1f3d1",
    "expected": "d8de340333312a8fd437902fb359afaa"
  },
  {
    "id": "13cff910-d616-48c2-9350-cbc290643afc",
    "expected": "16f476852b6592c633255b26b2db1c72"
  },
  {
    "id": "d10d0446-cd92-474d-b447-37fba69ed824",
    "expected": "61adf1a590c2d1fd8592869c7b126627"
  },
  {
    "id": "04bdefa7-b545-4cdd-b3d5-54e978acfc0b",
    "expected": "5bcf992fdecccffb666759e63d259570"
  },
  {
    "id": "07635b79-8d6a-406b-96e2-5617b514f9a6",
    "expected": "b04582598b31a70cc1b9d116800a2d6b"
  },
  {
    "id": "0f3bbc5c-b527-41ce-bb82-9148186134ac",
    "expected": "c2b2bd0f8eefcfa4bcdd2cc96454496a"
  },
  {
    "id": "11412c1b-edff-431c-8ff5-42cf897bc412",
    "expected": "a797c9485ac34e812e83aa8d38f1d353"
  },
  {
    "id": "3968431e-3fe5-40f0-a291-e210ccd278e9",
    "expected": "5e58b6c25759849b39a284b046c5b2c2"
  },
  {
    "id": "456f36b1-d9e6-4310-90de-9abe5aad3ec7",
    "expected": "2404021028ab9d887d7a0c046b574364"
  },
  {
    "id": "557047c8-a324-46a7-bbf3-9bb6e0a452a3",
    "expected": "7e6eb2d66e1d1ba9ebfe91fc2224c2fa"
  },
  {
    "id": "68d7433c-6402-47b0-afdf-7d0c0a595b40",
    "expected": "1213756ba072e50e69dfd0fec23a9fd5"
  },
  {
    "id": "7114955c-7156-45e8-bf8c-acb041a3a4b1",
    "expected": "8c92f6f1167908241443e2bbb019a6d4"
  },
  {
    "id": "78c9d4b8-deb7-4617-a9d8-1c23ea470482",
    "expected": "43810023aa9a9c2684b15b5e3427c448"
  },
  {
    "id": "98fed1f3-782a-46a1-a543-f5538c527d71",
    "expected": "45651185f55759ea2c3074ccfab17a5f"
  },
  {
    "id": "b6b7ac03-40cf-4206-81b8-e6f3eb318468",
    "expected": "50331fb365007b2c1bd109c27cfa6731"
  },
  {
    "id": "c8b64e10-994a-48ea-8e79-4c88a154a9cb",
    "expected": "ed202de4ba66702d7951312d0b919bfd"
  },
  {
    "id": "d07f6ede-0a94-4f22-bb1d-275cdaafb6b1",
    "expected": "8669ffb04d1c9bdb26ff3ba2cc0518ec"
  },
  {
    "id": "d2c5b713-22e3-4560-95f6-a96bd2f32f25",
    "expected": "d8f4bcd0ee25bd118ba31a6c163c3827"
  },
  {
    "id": "e0355810-0d12-4071-9289-08fdd7d2deab",
    "expected": "332d2cad70e28cff3fb5d61b6e156aad"
  }
]$precision_targets$::jsonb) LOOP
  SELECT * INTO before_row FROM zoi.listings WHERE id=(target->>'id')::uuid FOR UPDATE;
  IF NOT FOUND OR zoi.geography_fingerprint(before_row) IS DISTINCT FROM target->>'expected'
   OR before_row.owner_user_id IS NOT NULL OR before_row.owner_workspace_id IS NOT NULL
   OR before_row.publish_status IS DISTINCT FROM 'published'
   OR before_row.moderation_status NOT IN('clean','cleared')
   OR coalesce(before_row.marketplace_status,'')='hidden'
   OR before_row.geo_precision IS DISTINCT FROM 'street'
   OR before_row.profile#>>'{_geo,method}' IS DISTINCT FROM 'city centroid'
   OR before_row.profile#>>'{_geo,precision}' IS DISTINCT FROM 'city'
  THEN RAISE EXCEPTION 'centroid_precision_snapshot_changed:%',target->>'id';END IF;
  UPDATE zoi.listings SET geo_precision='city' WHERE id=before_row.id RETURNING * INTO after_row;
  IF NOT FOUND OR after_row.latitude IS DISTINCT FROM before_row.latitude OR after_row.longitude IS DISTINCT FROM before_row.longitude
   OR (to_jsonb(after_row)-ARRAY['geo_precision','updated_at']) IS DISTINCT FROM (to_jsonb(before_row)-ARRAY['geo_precision','updated_at'])
  THEN RAISE EXCEPTION 'centroid_precision_unrelated_change:%',target->>'id';END IF;
  request:=gen_random_uuid();
  INSERT INTO zoi.geography_reviews(request_id,listing_id,payload,receipt,before_geo,after_fingerprint)
  VALUES(request,before_row.id,
   jsonb_build_object('kind','precision_claim_correction','migration','20261014050623_centroid_precision_claim_cas','expected',target->>'expected','reason','street_column_conflicts_with_documented_city_centroid','source_metadata',before_row.profile->'_geo','coordinate_changed',false,'street_review_claimed',false),
   jsonb_build_object('ok',true,'request_id',request,'listing_id',before_row.id,'latitude',after_row.latitude,'longitude',after_row.longitude,'precision','city','kind','precision_claim_correction','coordinate_changed',false),
   jsonb_build_object('latitude',before_row.latitude,'longitude',before_row.longitude,'geo_precision',before_row.geo_precision,'profile_was_null',before_row.profile IS NULL,'had_geo',coalesce(before_row.profile,'{}'::jsonb)?'_geo','geo',before_row.profile->'_geo'),
   zoi.geography_fingerprint(after_row));
  changed:=changed+1;
 END LOOP;
 IF changed<>24 THEN RAISE EXCEPTION 'centroid_precision_count_mismatch';END IF;
END $correction$;
-- Existing service-only geography_review_revert retains full-row/ownership CAS.
-- geography_reviewed_point never advertises these city receipts as street proof.
COMMIT;

BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
-- Correct canonical city context, never an address/entrance certification.
DO $repair$
DECLARE target jsonb;before_row zoi.listings;after_row zoi.listings;place_row zoi.places;request uuid;changed integer:=0;
BEGIN
FOR target IN SELECT value FROM jsonb_array_elements($targets$[
  {
    "id": "59769e67-156a-4514-8755-88dd803880b5",
    "slug": "γευση-ζωης-πολίχνη-56535",
    "name": "ΓΕΥΣΗ ΖΩΗΣ",
    "city": "Πολίχνη",
    "country": "Greece",
    "latitude": 37.270848,
    "longitude": 21.947102,
    "geo_precision": "none",
    "geo": {
      "method": "city centroid",
      "source": "openstreetmap",
      "precision": "city",
      "geocoded_at": "2026-08-23"
    },
    "database_snapshot": "226b028c10ef1878249afbfbcfb887a4",
    "owner_user_id": null,
    "owner_workspace_id": null,
    "place_id": 5160,
    "name_en": "Polichni",
    "name_el": "Πολίχνη",
    "country_code": "GR",
    "target_latitude": 40.66671,
    "target_longitude": 22.94881,
    "geonames_id": 734538,
    "source": "geonames",
    "is_verified": true,
    "place_snapshot": "7302189f44b624e610d3eafe9441beda"
  },
  {
    "id": "65a91f82-86ce-4c50-bb8e-69351017da14",
    "slug": "7-towers-συκιές-56626",
    "name": "7 TOWERS",
    "city": "Συκιές",
    "country": "Greece",
    "latitude": 38.65986,
    "longitude": 21.993464,
    "geo_precision": "none",
    "geo": {
      "method": "city centroid",
      "source": "openstreetmap",
      "precision": "city",
      "geocoded_at": "2026-08-23"
    },
    "database_snapshot": "7178046c738cb43ebcf4c755ad99f6e7",
    "owner_user_id": null,
    "owner_workspace_id": null,
    "place_id": 2631,
    "name_en": "Sykies",
    "name_el": "Συκιές",
    "country_code": "GR",
    "target_latitude": 40.64944,
    "target_longitude": 22.95083,
    "geonames_id": 734301,
    "source": "geonames",
    "is_verified": true,
    "place_snapshot": "f87cb795c74e1df87d65a6dc34db1a04"
  },
  {
    "id": "98754633-a310-40d1-a298-99138868e267",
    "slug": "cafe-la-tour-πολίχνη-56533",
    "name": "CAFE LA TOUR",
    "city": "Πολίχνη",
    "country": "Greece",
    "latitude": 37.270848,
    "longitude": 21.947102,
    "geo_precision": "none",
    "geo": {
      "method": "city centroid",
      "source": "openstreetmap",
      "precision": "city",
      "geocoded_at": "2026-08-23"
    },
    "database_snapshot": "608aa166d1914858bc9445dc2cb88471",
    "owner_user_id": null,
    "owner_workspace_id": null,
    "place_id": 5160,
    "name_en": "Polichni",
    "name_el": "Πολίχνη",
    "country_code": "GR",
    "target_latitude": 40.66671,
    "target_longitude": 22.94881,
    "geonames_id": 734538,
    "source": "geonames",
    "is_verified": true,
    "place_snapshot": "7302189f44b624e610d3eafe9441beda"
  },
  {
    "id": "b7dc6f74-d1a4-4c0e-b7a0-ca75cabd962b",
    "slug": "μοι-πεύκα-πεύκα-57010",
    "name": "ΜΟΙ - Πεύκα",
    "city": "Πεύκα",
    "country": "Greece",
    "latitude": 40.900845,
    "longitude": 26.041276,
    "geo_precision": "none",
    "geo": {
      "method": "city centroid",
      "source": "openstreetmap",
      "precision": "city",
      "geocoded_at": "2026-08-23"
    },
    "database_snapshot": "3c1d5daa09c92ec8eb0195c95a3ebd72",
    "owner_user_id": null,
    "owner_workspace_id": null,
    "place_id": 5126,
    "name_en": "Pefka",
    "name_el": "Πεύκα",
    "country_code": "GR",
    "target_latitude": 40.65806,
    "target_longitude": 22.99378,
    "geonames_id": 734405,
    "source": "geonames",
    "is_verified": true,
    "place_snapshot": "8404f44edcb02ef02159f61fac15cc8e"
  },
  {
    "id": "cf6a8861-1769-45bb-8f3d-c34e66e71043",
    "slug": "απεναντι-απ-τα-καστρα-συκιές-56626",
    "name": "ΑΠΕΝΑΝΤΙ ΑΠ'ΤΑ ΚΑΣΤΡΑ",
    "city": "Συκιές",
    "country": "Greece",
    "latitude": 38.65986,
    "longitude": 21.993464,
    "geo_precision": "none",
    "geo": {
      "method": "city centroid",
      "source": "openstreetmap",
      "precision": "city",
      "geocoded_at": "2026-08-23"
    },
    "database_snapshot": "5fa43def356d9789e7e7483cde56d8ca",
    "owner_user_id": null,
    "owner_workspace_id": null,
    "place_id": 2631,
    "name_en": "Sykies",
    "name_el": "Συκιές",
    "country_code": "GR",
    "target_latitude": 40.64944,
    "target_longitude": 22.95083,
    "geonames_id": 734301,
    "source": "geonames",
    "is_verified": true,
    "place_snapshot": "f87cb795c74e1df87d65a6dc34db1a04"
  }
]$targets$::jsonb) LOOP
 SELECT * INTO before_row FROM zoi.listings WHERE id=(target->>'id')::uuid FOR UPDATE;
 SELECT * INTO place_row FROM zoi.places WHERE id=(target->>'place_id')::bigint FOR SHARE;
 IF before_row.id IS NULL OR place_row.id IS NULL
 OR zoi.geography_fingerprint(before_row) IS DISTINCT FROM target->>'database_snapshot'
 OR md5(to_jsonb(place_row)::text) IS DISTINCT FROM target->>'place_snapshot'
 OR before_row.owner_user_id IS NOT NULL OR before_row.owner_workspace_id IS NOT NULL
 OR before_row.publish_status IS DISTINCT FROM 'published' OR (before_row.moderation_status IS DISTINCT FROM 'clean' AND before_row.moderation_status IS DISTINCT FROM 'cleared')
 OR before_row.marketplace_status IS NOT DISTINCT FROM 'hidden' OR before_row.duplicate_status IS NOT DISTINCT FROM 'confirmed_duplicate' OR before_row.place_id IS DISTINCT FROM place_row.id
 OR place_row.is_verified IS DISTINCT FROM true OR place_row.place_type IS DISTINCT FROM 'city'
 OR place_row.source IS DISTINCT FROM 'geonames' OR place_row.geonames_id IS NULL
 OR lower(trim(before_row.city)) IS DISTINCT FROM lower(trim(place_row.name_el))
 OR before_row.country IS DISTINCT FROM 'Greece' OR place_row.country_code IS DISTINCT FROM 'GR'
 OR zoi.geo_effective_precision(before_row.geo_precision,before_row.profile->'_geo') IS DISTINCT FROM 'city'
 OR before_row.latitude IS NULL OR before_row.longitude IS NULL
 OR place_row.latitude IS NULL OR place_row.longitude IS NULL
 OR abs(place_row.latitude)>90 OR abs(place_row.longitude)>180
 OR (abs(before_row.latitude-place_row.latitude)<=1 AND abs(before_row.longitude-place_row.longitude)<=1)
 THEN RAISE EXCEPTION 'canonical_locality_snapshot_changed:%',target->>'id'; END IF;
 request:=gen_random_uuid();
 UPDATE zoi.listings SET latitude=place_row.latitude,longitude=place_row.longitude,geo_precision='city',
 profile=jsonb_set(coalesce(profile,'{}'::jsonb),'{_geo}',jsonb_build_object('method','city centroid','precision','city','source','geonames','geonames_id',place_row.geonames_id,'place_id',place_row.id,'request_id',request,'geocoded_at',current_date::text,'scope','canonical_city_context','street_review_claimed',false))
 WHERE id=before_row.id RETURNING * INTO after_row;
 IF (to_jsonb(after_row)-ARRAY['latitude','longitude','geo_precision','profile','updated_at']) IS DISTINCT FROM (to_jsonb(before_row)-ARRAY['latitude','longitude','geo_precision','profile','updated_at'])
 OR after_row.profile-'_geo' IS DISTINCT FROM before_row.profile-'_geo'
 THEN RAISE EXCEPTION 'canonical_locality_unrelated_change:%',target->>'id';END IF;
 INSERT INTO zoi.geography_reviews(request_id,listing_id,payload,receipt,before_geo,after_fingerprint)
 VALUES(request,before_row.id,jsonb_build_object('kind','canonical_locality_position_correction','migration','20261014134155_canonical_locality_native_name_position_cas','expected',target->>'database_snapshot','place_snapshot',target->>'place_snapshot','canonical_place',to_jsonb(place_row),'street_review_claimed',false,'source_archive_sha256','9e70c809e62b33199ebcb703ab0a27fa8a864cc06460bdfa6b60e23b88b9101b','city_name_match','exact_canonical_native_name_and_official_geonames_alias'),
 jsonb_build_object('ok',true,'request_id',request,'listing_id',before_row.id,'latitude',after_row.latitude,'longitude',after_row.longitude,'precision','city','kind','canonical_locality_position_correction','coordinate_changed',true),
 jsonb_build_object('latitude',before_row.latitude,'longitude',before_row.longitude,'geo_precision',before_row.geo_precision,'profile_was_null',before_row.profile IS NULL,'had_geo',coalesce(before_row.profile,'{}'::jsonb)?'_geo','geo',before_row.profile->'_geo'),zoi.geography_fingerprint(after_row));
 changed:=changed+1;
END LOOP;
IF changed<>5 THEN RAISE EXCEPTION 'canonical_locality_count_mismatch';END IF;
END $repair$;
COMMIT;

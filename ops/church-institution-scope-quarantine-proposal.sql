-- EXECUTED ONCE by root 2026-09-30; retained for audit. DO NOT REPLAY.
-- REVIEW ONLY:84 exact public church records pointing to the archdiocese root.
-- Preserve source data privately; marker instructs public projection to quarantine
-- unscoped institutional content. No owner/base field is changed.
BEGIN;
SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='30s';
DO $quarantine$
DECLARE candidate record;l zoi.listings;changed integer:=0;machine jsonb;
BEGIN
 FOR candidate IN SELECT * FROM (VALUES
('93341806-aed8-4590-85c9-8c361bb6afeb'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','e097536600be2431df5b2fccc3b0f080'),
('5a4946d5-e49d-439a-8a39-88fc417b910c'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','86e392fa0e060a1c3e1457bc0f41d70a'),
('5a8bdc70-5951-4bc4-a69c-a02ad288c069'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','ef979a790559adb3ae05181e5e1c3724'),
('3a4f13b3-57a8-4ebb-82d0-120ded5406a2'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','0bffbe138fc891847cd686d1000ba8aa'),
('5cea382c-2f3f-4e4a-9987-90515f75f8eb'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','88b54129ad6749706906fe408050972e'),
('960a5263-98e0-49c6-8cd2-af1f573d3dc5'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','9406d5a7a4df4e204292697408873aaa'),
('04cd17cf-7b30-4560-b7fc-de1dac6db0b1'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','63dbfd48df1fc2f42f084921081b606f'),
('3cd69e2f-78ce-4e69-84f5-2f94bf8d1a75'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','21fe314799880b24f3ffa5e6b475fa5b'),
('0a69462a-9f9a-4969-bd5b-dbb2c5018bdf'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','a156670b121d8151246002207dc1a9a3'),
('1368df50-d879-4611-b13e-ec9e0a1ce2ed'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','d3d0df3fa07231cf463481e53020954d'),
('179a1050-eac6-4943-ad43-0f0c967d5c92'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','9519196d76a67a11833abb580f7475f7'),
('21ba87a9-3fb2-42ba-8832-3735cca9e63e'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','b35879ae3a05db4afcd751ae84549ae8'),
('426fc3da-65f7-4a74-9dec-2affd3919e88'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','8722b544bf967fcdc3543915bc0fec86'),
('2463edbc-8d10-4db8-bdb9-f4defad27116'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','d87e4422169c61eb1b290134a690992c'),
('45907f9c-46a5-43b5-a331-f3f727d0195c'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','371fd94f965005c6c8f09d886e76b18a'),
('45ae05d2-6ba5-4ff8-97a0-d1b8030002cc'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','26fbbca06cf6fac715990117911e773f'),
('46ba979b-04f3-4a8e-a1fb-4d11594a2d1f'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','aa09e11d387c50b53ace732bb1be89fa'),
('4983da50-1424-48a3-bb98-ed50fe2fbc80'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','9015d96d4951e4e61188ff8cfb379133'),
('276001e6-ea47-42bc-b7fb-4f7eebac6387'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','c661654c9ff8f80a21648afd6a228357'),
('4aeb1873-ae4a-4df4-b999-f6e65da30cd5'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','3e054a3ffe8cd35223436f6abd81235c'),
('283d59b0-a11b-4c1e-bdce-1c938fe5d4f7'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','56253dbaf11dcc8e993e0fedb888ae57'),
('4d728534-41ff-4ecd-8d82-b71877d0c7c0'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','645b6f9ffbd7b7041f1544968450b9b0'),
('50169aa6-5cf1-448f-8c54-fcf1de6a68c8'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','8d9ae8e20a38195bee9724e54fae42dd'),
('513b650a-ea27-446e-89dc-2db72e757d61'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','74d47f9e23c460d96ea8045b4b5a9829'),
('52c9ade9-652d-4a3e-b213-b9e4cc35e349'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','95e396d10c0f2a3b8b44ce0d9f15934c'),
('6616a86f-9c22-4b0b-99b0-1df169f558bb'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','34b61a61e68f1b931324157b1b355dd7'),
('6dada8ad-b318-4b9c-8cf4-f8efcf1989a1'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','8bca998089b68debc54a68cc996694af'),
('72bfd3ad-25df-4b67-b226-323450462d15'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','c41dbc17c3f6ea9935341e1ec3ab0084'),
('745604a4-e202-4d92-bab0-2da02a23fc2e'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','7b49514cc353189a1fdec1ce069c5742'),
('765231d3-581a-4657-a37d-032f5c7b31cd'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','9fb7bafff8c11d7846d6d886c738017f'),
('79764ced-2aa1-4271-b15b-83d303cfbe9f'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','56253dbaf11dcc8e993e0fedb888ae57'),
('79d02597-86e6-436d-90c2-b3c4486e85ef'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','040ade82ddbdad1a5c2d833ee1ccf6a8'),
('7b242add-4818-481f-8d14-ebb00385c9bf'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','56253dbaf11dcc8e993e0fedb888ae57'),
('53f0fbd0-f27d-4ea7-bfb1-170fc39614d5'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','05550a5461f403ff14fa5653a01ac51b'),
('7dad32ad-c9b5-4312-92b7-a31a0fe1ef52'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','95e396d10c0f2a3b8b44ce0d9f15934c'),
('86f22daa-0888-423a-8369-14895eb72c8d'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','dc41f00d19c0695d11d94634907b2e16'),
('9a0c91ce-1efa-4396-8f05-8a47089caa3d'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','d4e7f8bf04c204fa4778507f13bf39ea'),
('9ebc0279-6496-4875-8cfe-f03da958ed06'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','8688ccc0a83fa9f10b5059e3894196cf'),
('a10fe069-48f5-4790-89b3-1c664c877cf4'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','13691d89f91cea0d28caf70cde7a805c'),
('a43fab84-7a47-49f1-b832-380d09365478'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','53bd60b541b065de663e2a094e3279c4'),
('a56257fb-75b6-49c4-9116-62f90f050c52'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','6caa2ead6dff5156e2a6dc2b268482e9'),
('a76db740-f3f9-4d43-b781-20ee097adbf8'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','e07f070e2af62f74af6b76f993cbbe64'),
('a99fe992-2c21-4001-b68c-edd71cf9568e'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','be97debd4b0fffe403a913d506515489'),
('aa67d101-8aae-499a-88da-f81bb44e3624'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','8c2cf620110dd75491ea5ac1f1229ef1'),
('ac3c839a-08f3-4648-9351-870b85e876c9'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','1255c2c48c000e2d919b3bd196917eff'),
('2d878b80-22dd-431c-945b-b67eeb260092'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','a913cd69cb0861a5f3e96a97bef6d046'),
('ad819555-aada-4785-bf34-657cff36a3eb'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','384418ac1fc8868d9fec5f2d769c46a7'),
('ae123c1d-fb25-442e-a65e-64568566c319'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','83a5b55335b87e18879f851c5dad2a1f'),
('52d937e8-3fee-41c1-8940-a6b766305139'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','656fcadcbab024cfe32fa96ec9f548db'),
('b7de9a85-f706-4751-a84b-fc2de02c3823'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','abf10abcaa12e80e57f06634cca18321'),
('b8f3d15e-d65c-41f8-bea8-09516973a2af'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','c998524f3c897e57fdb7a147c624f8bd'),
('c0b34ae4-4596-48a8-9242-f11a71f88354'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','2d7c8227b5747c6f6fc6c55eff9e32b4'),
('c5e8dc67-d9b3-41e6-9505-092afcec2a49'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','9b085a3ad1bb287727948eb121545591'),
('c6d6e423-3247-4ecc-9de4-aef658588d7f'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','f966e5e84d3ea4f1678f48ccb9863106'),
('c764f695-50ce-49ce-818b-6ad9eca7a3e1'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','b8401048a8f11b8ec4cfe9a40a188186'),
('d1836129-1f12-4a76-8568-ad2dc4d0f93f'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','3d2e2f5d88842d4cd741cae6d92efac5'),
('54af044c-9086-48ef-a70b-9fcf68a875ef'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','d95e9a25e517db790b5197b322fb60b1'),
('d77ec331-e1e7-4313-91d7-fa1f82271cb7'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','8f88372e3c0e1587ca4fa7905220433e'),
('dc9015dd-c651-470a-8d61-247f15feb405'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','a72113b557ca45ccefa76a9df37302dc'),
('df916d00-9e55-4086-aa80-40adb3452453'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','964c2463b2fa064355c9035e7751d24c'),
('dfa3af32-076c-40a0-affa-b8a8968f92cf'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','3d192df5937d12e940051ae89adec270'),
('e0490a9e-5b1e-4754-a8e4-193dedf27368'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','92ed16ed953dd64eb888f24b5da71bd0'),
('e3239a03-75da-4b7c-9e5a-8343901c03ea'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','06cd891ec1fe8ec57c87cf45c871e67e'),
('556ca7ca-fc95-47b6-b2b8-99f987bbe4da'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','146347160166b197a679f397cd90fd95'),
('e3b0164d-9ba7-4843-b884-6fd6eeaa2d31'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','2d6a9e61c4809bd927de15ed8d56f538'),
('e9dd2193-4713-45c5-81c6-3268aa7a6de5'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','09bae3195a4a2448c1bfa528644c31d2'),
('e9edeb6a-10f5-43c6-8015-4c68c2598f6a'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','a156670b121d8151246002207dc1a9a3'),
('eba05c3a-e700-4e50-90bf-8f1f6a8b9470'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','0ea13818b9a5c05d54153163bde2ff37'),
('ebb64394-3ecd-4248-acf9-ecc8e2defdd0'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','99a77de50d18128099193d4d917c031b'),
('f01fe399-37b2-4c7b-b3a6-c4cc624b7d10'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','0406bfacce1e257b5ab567f93350f2ab'),
('f15f817b-e919-4c78-856d-6cd1be14238c'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','0277c7250830677e90c32ec27a6aeded'),
('f390f274-4d61-4315-86b8-9e358b905b89'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','6b06b0f579a6e47029f0b7527d9bdb99'),
('f472a394-1188-4a9b-9dd9-cdd982aa5ef4'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','feb6d945faa94be0deafa46b8c32670a'),
('fa8d8926-2739-4af4-9799-8fb21561229c'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','6789ba9821727581ee2a0c0a98a349a8'),
('572ad656-b37f-490b-a451-01abb3b6aca8'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','8d255b3999681051f71da73abb2e9acc'),
('573095e2-07bc-469c-9361-fc11736cf4d9'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','75af92a16032639b8bbb9e344e8cc5b6'),
('fc981687-bbf6-45b0-9e94-c737fd34f7c2'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','9406d5a7a4df4e204292697408873aaa'),
('10d9ab61-897f-42e9-b5b0-da3f187020da'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','2225768076d10fcdd08ebf7c5cc0d23f'),
('8daac317-fb7a-4802-b1de-ca056ea1f11b'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','03ebf0d426f44cdf208926bdd20169fc'),
('cf4485f7-8639-4158-9d0e-7a86cb77a381'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','d9234ba5f610ad3f0dec7c9b7e09eb77'),
('ede11db6-8381-4c58-8869-d61434e0f1a3'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','776700b38895d91063aca4339db02c6c'),
('38a7cc6f-c1a0-4148-aea9-27bf9508d18c'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','21fe314799880b24f3ffa5e6b475fa5b'),
('4819f487-59bb-4941-9de0-af7ee0b97f44'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','b8241bccfbb5041d2223678c7f5b6e7e'),
('9cd5a819-db4d-44e8-930e-717c2be0c1f7'::uuid,'a212b65cd120a19ae3957f40aed3ff2d','6789ba9821727581ee2a0c0a98a349a8')
 )v(id,machine_hash,source_fingerprint) ORDER BY id LOOP
  SELECT * INTO l FROM zoi.listings WHERE id=candidate.id FOR UPDATE;
  IF l.id IS NULL OR l.entity_type IS DISTINCT FROM 'church' OR l.publish_status IS DISTINCT FROM 'published' OR l.moderation_status IS NULL OR l.moderation_status NOT IN('clean','cleared') OR coalesce(l.marketplace_status,'')='hidden' OR l.website IS DISTINCT FROM 'https://ortodossia.it' OR l.owner_workspace_id IS NOT NULL OR coalesce(zoi.public_owner_content(l.id),'{}'::jsonb)<>'{}'::jsonb OR md5((l.profile->'_enrich')::text) IS DISTINCT FROM candidate.machine_hash OR zoi.listing_quality_fingerprint(l) IS DISTINCT FROM candidate.source_fingerprint THEN RAISE EXCEPTION 'church_scope_batch_changed';END IF;
  machine:=(l.profile->'_enrich')||jsonb_build_object('blocked','true','blocked_reason','source_scope_mismatch','crawl_status','error','status','error','last_error','source_scope_mismatch','last_attempt_at',clock_timestamp(),'scope_review_required',true,'source_scope','parish_on_institution_site');
  UPDATE zoi.listings SET profile=jsonb_set(l.profile,'{_enrich}',machine),updated_at=clock_timestamp() WHERE id=l.id;
  changed:=changed+1;
 END LOOP;
 IF changed<>84 THEN RAISE EXCEPTION 'church_scope_batch_count';END IF;
END $quarantine$;
COMMIT;
SELECT count(*) AS quarantined_church_records FROM zoi.listings WHERE entity_type='church' AND website='https://ortodossia.it' AND profile#>>'{_enrich,blocked_reason}'='source_scope_mismatch';

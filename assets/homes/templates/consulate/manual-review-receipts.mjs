// SERVER-ONLY review receipts. Actual retained reader documents, not raw HTTP200.
// content_sha256 binds reviewed profile facts; reader_document_sha256 binds the
// separately retained official page-reader document. Never clear DB holds.
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
export const DIPLOMATIC_MANUAL_REVIEW_RECEIPTS=freeze([
  {
    "version": 1,
    "channel": "manual_reviewed_official_source",
    "review_id": "4d22ae61-7ea3-4330-a23d-f757a9139139",
    "reviewed_at": "2026-10-15T02:19:17.132Z",
    "expires_at": "2026-10-21T02:06:26.075Z",
    "reviewed_by": "zoi-delivery/enrichment-specialist",
    "review_method": "retained_official_page_reader",
    "identity_verified": true,
    "branch_verified": true,
    "challenge_free": true,
    "scope": {
      "id": "2aa582e9-1142-4c06-9b06-056fa35f46bf",
      "name": "Embassy of Greece in London",
      "entity_type": "organization",
      "city": "London",
      "country": "United Kingdom",
      "website": "https://www.mfa.gr/uk/en/"
    },
    "content_sha256": "4566c33c04d683df983685ad7b7abd1754c4863edff42135fb598f5f2e2068bc",
    "documents": [
      {
        "url": "https://www.mfa.gr/uk/en/the-embassy/contact-london/",
        "artifact_kind": "retained_page_reader_document",
        "reader_document_sha256": "a0647bb46150bab4eeffdac93e3c719fc10ab6183fdc34734ce4df89731590f4",
        "bytes": 4666,
        "complete_reader_document": true,
        "reader_crawled": "today",
        "raw_http_status": null,
        "retrieved_at": "2026-10-15T02:06:26.075Z",
        "role": "official",
        "reader_ref": "turn82view0"
      },
      {
        "url": "https://www.mfa.gr/uk/en/services/citizen-services/appointment-booking-system/",
        "artifact_kind": "retained_page_reader_document",
        "reader_document_sha256": "8aec7e97ca23575dcb7948dbfea26aefd1a835d5a4e0a374af4020173615f5a2",
        "bytes": 6240,
        "complete_reader_document": true,
        "reader_crawled": "today",
        "raw_http_status": null,
        "retrieved_at": "2026-10-15T02:07:55.730Z",
        "role": "official",
        "reader_ref": "turn83view1"
      },
      {
        "url": "https://www.mfa.gr/uk/en/services/citizen-services/",
        "artifact_kind": "retained_page_reader_document",
        "reader_document_sha256": "fd85ac212fbbb21cc965d1a27f6c12c731a4d26be042fd00670a8947e7d1569b",
        "bytes": 7801,
        "complete_reader_document": true,
        "reader_crawled": "today",
        "raw_http_status": null,
        "retrieved_at": "2026-10-15T02:07:55.730Z",
        "role": "official",
        "reader_ref": "turn83view2"
      },
      {
        "url": "https://www.mfa.gr/uk/en/services/citizen-services/passports/",
        "artifact_kind": "retained_page_reader_document",
        "reader_document_sha256": "6f66a995bb1875f02607611a0325eb27a0679914a64bca288cecb3359619852e",
        "bytes": 5917,
        "complete_reader_document": true,
        "reader_crawled": "today",
        "raw_http_status": null,
        "retrieved_at": "2026-10-15T02:08:37.948Z",
        "role": "official",
        "reader_ref": "turn86view0"
      },
      {
        "url": "https://www.mfa.gr/uk/en/services/citizen-services/registration-birth-marriage-divorce-death/",
        "artifact_kind": "retained_page_reader_document",
        "reader_document_sha256": "3a05c5d50315dbb3dfeae03454557797b74dd872d504e7bb627a08df6777bdb6",
        "bytes": 6776,
        "complete_reader_document": true,
        "reader_crawled": "today",
        "raw_http_status": null,
        "retrieved_at": "2026-10-15T02:08:37.948Z",
        "role": "official",
        "reader_ref": "turn86view1"
      },
      {
        "url": "https://www.mfa.gr/uk/en/services/citizen-services/notarial-deeds/",
        "artifact_kind": "retained_page_reader_document",
        "reader_document_sha256": "d4f50a62d25fc2c27ac5d5a258fd236bf820610baadd54c1a8854003046abf2e",
        "bytes": 7670,
        "complete_reader_document": true,
        "reader_crawled": "today",
        "raw_http_status": null,
        "retrieved_at": "2026-10-15T02:08:37.948Z",
        "role": "official",
        "reader_ref": "turn86view2"
      },
      {
        "url": "https://www.mfa.gr/uk/en/the-embassy/embassy-sections/consular-office/",
        "artifact_kind": "retained_page_reader_document",
        "reader_document_sha256": "8d19e8370afe486d6f4093dbaaa8f152ea5d9abfaf05d0f0ff74c37bebd0b831",
        "bytes": 3986,
        "complete_reader_document": true,
        "reader_crawled": "today",
        "raw_http_status": null,
        "retrieved_at": "2026-10-15T02:07:55.730Z",
        "role": "official",
        "reader_ref": "turn83view0"
      },
      {
        "url": "https://www.mfa.gr/uk/en/the-embassy/embassy-sections/",
        "artifact_kind": "retained_page_reader_document",
        "reader_document_sha256": "931c52290dc8bdcc2a581ced714bcae2d46ca0cb05869f8e0904fc29a765abfa",
        "bytes": 4481,
        "complete_reader_document": true,
        "reader_crawled": "today",
        "raw_http_status": null,
        "retrieved_at": "2026-10-15T02:08:37.948Z",
        "role": "official",
        "reader_ref": "turn86view3"
      },
      {
        "url": "https://www.supersaas.com/schedule/login/Greek_Embassy_London/Greek_Passports",
        "artifact_kind": "retained_page_reader_document",
        "reader_document_sha256": "f0a133f57b9cb61cea4e1e7350d7d9b832df94fdd980d5729bcfa34f666a65ee",
        "bytes": 1373,
        "complete_reader_document": true,
        "reader_crawled": "today",
        "raw_http_status": null,
        "retrieved_at": "2026-10-15T02:18:17.964Z",
        "role": "linked_provider",
        "linked_from": "https://www.mfa.gr/uk/en/services/citizen-services/appointment-booking-system/",
        "linked_from_reader_sha256": "8aec7e97ca23575dcb7948dbfea26aefd1a835d5a4e0a374af4020173615f5a2",
        "reader_ref": "turn89view0",
        "reader_request_kind": "click",
        "linked_from_reader_ref": "turn83view1",
        "linked_from_link_id": 27
      }
    ]
  },
  {
    "version": 1,
    "channel": "manual_reviewed_official_source",
    "review_id": "30cec527-853c-4e09-89ef-f872a9fde22c",
    "reviewed_at": "2026-10-15T02:19:17.134Z",
    "expires_at": "2026-10-21T02:06:26.075Z",
    "reviewed_by": "zoi-delivery/enrichment-specialist",
    "review_method": "retained_official_page_reader",
    "identity_verified": true,
    "branch_verified": true,
    "challenge_free": true,
    "scope": {
      "id": "396fbfed-5b64-45ff-836a-089cdafeae63",
      "name": "Consulate General of Greece in Toronto",
      "entity_type": "organization",
      "city": "Toronto",
      "country": "Canada",
      "website": "https://www.mfa.gr/canada/en/consulate-general-in-toronto/"
    },
    "content_sha256": "6233f6599d1f7413beccf60a914c46b940a4d7f6571daa09cf04740331218331",
    "documents": [
      {
        "url": "https://www.mfa.gr/canada/en/consulate-general-in-toronto/contact-toronto/",
        "artifact_kind": "retained_page_reader_document",
        "reader_document_sha256": "1ebd9d5b64c13e82b5d18473f7b7551c2858a1c2e9a421ec0b5de37f3ec424bf",
        "bytes": 6883,
        "complete_reader_document": true,
        "reader_crawled": "today",
        "raw_http_status": null,
        "retrieved_at": "2026-10-15T02:06:26.075Z",
        "role": "official",
        "reader_ref": "turn82view1"
      },
      {
        "url": "https://www.mfa.gr/canada/en/consulate-general-in-toronto/",
        "artifact_kind": "retained_page_reader_document",
        "reader_document_sha256": "aa703c35416821f32e8234c1c6eac4a43f168957185f6e7684820380bf09de98",
        "bytes": 10926,
        "complete_reader_document": true,
        "reader_crawled": "today",
        "raw_http_status": null,
        "retrieved_at": "2026-10-15T02:08:37.754Z",
        "role": "official",
        "reader_ref": "turn84view0"
      },
      {
        "url": "https://www.mfa.gr/canada/en/services/citizen-services/?service_category=toronto-services",
        "artifact_kind": "retained_page_reader_document",
        "reader_document_sha256": "c7e407b60a9d47851062c94532fa42bf93a3286e8220efe8f19c5f82f4771965",
        "bytes": 7106,
        "complete_reader_document": true,
        "reader_crawled": "today",
        "raw_http_status": null,
        "retrieved_at": "2026-10-15T02:09:21.216Z",
        "role": "official",
        "reader_ref": "turn87view1"
      },
      {
        "url": "https://www.mfa.gr/canada/en/services/citizen-services/power-of-attorney/",
        "artifact_kind": "retained_page_reader_document",
        "reader_document_sha256": "45887119d7659fe73dcdcc0a828620a8e0935c64826b1844bb5d45a0ce1a92dc",
        "bytes": 9250,
        "complete_reader_document": true,
        "reader_crawled": "today",
        "raw_http_status": null,
        "retrieved_at": "2026-10-15T02:09:21.216Z",
        "role": "official",
        "reader_ref": "turn87view0"
      },
      {
        "url": "https://www.supersaas.com/form/Greece_in_Toronto/Notary_Public",
        "artifact_kind": "retained_page_reader_document",
        "reader_document_sha256": "e30813890a7b19527f6d6412a7caba8fdf52c24210209f4203191d648a22bc0d",
        "bytes": 7388,
        "complete_reader_document": true,
        "reader_crawled": "today",
        "raw_http_status": null,
        "retrieved_at": "2026-10-15T02:18:17.964Z",
        "role": "linked_provider",
        "linked_from": "https://www.mfa.gr/canada/en/services/citizen-services/power-of-attorney/",
        "linked_from_reader_sha256": "45887119d7659fe73dcdcc0a828620a8e0935c64826b1844bb5d45a0ce1a92dc",
        "reader_ref": "turn89view1",
        "reader_request_kind": "click",
        "linked_from_reader_ref": "turn87view0",
        "linked_from_link_id": 37
      }
    ]
  },
  {
    "version": 1,
    "channel": "manual_reviewed_official_source",
    "review_id": "812513e3-de95-4039-b8f1-1109dc3c515f",
    "reviewed_at": "2026-10-15T02:12:43.418Z",
    "expires_at": "2026-10-17T02:08:37.849Z",
    "reviewed_by": "zoi-delivery/enrichment-specialist",
    "review_method": "retained_official_page_reader",
    "identity_verified": true,
    "branch_verified": true,
    "challenge_free": true,
    "scope": {
      "id": "07d70d69-9456-4a2e-8648-52a58cceb5e5",
      "name": "Consulate of Greece in Perth",
      "entity_type": "organization",
      "city": "Perth",
      "country": "Australia",
      "website": "https://www.mfa.gr/australia/en/consulate-in-perth/"
    },
    "content_sha256": "1019f59580e319256c607ed7f6f35026ff2441562d95899ad8a25e66c5a3fa22",
    "documents": [
      {
        "url": "https://www.mfa.gr/australia/en/consulate-in-perth/contact/",
        "artifact_kind": "retained_page_reader_document",
        "reader_document_sha256": "c4cd0bd8120a61023cecf7770226575598488e8073aedd9dffba17f0df7c3d45",
        "bytes": 7022,
        "complete_reader_document": true,
        "reader_crawled": "today",
        "raw_http_status": null,
        "retrieved_at": "2026-10-15T02:06:26.075Z",
        "role": "official",
        "reader_ref": "turn82view2"
      },
      {
        "url": "https://www.mfa.gr/australia/en/services/citizen-services/passports/",
        "artifact_kind": "retained_page_reader_document",
        "reader_document_sha256": "350786ee1e5aff591a110cc1c7ee416673a5f41276d1e5651b339933d8c40a26",
        "bytes": 16627,
        "complete_reader_document": true,
        "reader_crawled": "4 days ago",
        "raw_http_status": null,
        "retrieved_at": "2026-10-15T02:08:37.849Z",
        "role": "official",
        "reader_ref": "turn85view1"
      },
      {
        "url": "https://www.mfa.gr/australia/en/services/citizen-services/myconsullive-services/",
        "artifact_kind": "retained_page_reader_document",
        "reader_document_sha256": "949ce7357bf526fbeefa2d0a099ed5b02b1196560b1ea1accd95332c486f3c77",
        "bytes": 8336,
        "complete_reader_document": true,
        "reader_crawled": "today",
        "raw_http_status": null,
        "retrieved_at": "2026-10-15T02:08:37.849Z",
        "role": "official",
        "reader_ref": "turn85view2"
      }
    ]
  }
]);

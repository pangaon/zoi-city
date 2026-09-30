# Healthcare professional homes

`renderHealthHome(entity,publishedDesign?)` in `api/_health-home.js` supports visible professional records with a published healthcare profession/category. Default Concierge; all four IDs atelier/concierge/table/parea supported. Pure model/render are reusable across nurses, doctors, dentists and allied professionals; no fixture-ID dependency. Owner section order, hidden sections and copy supported. Canonical `/professional/<slug>`.

## Facts and identity
Consumes `profile._enrich.member` reviewed source contract. Explicit owner fields take precedence for published profession, credentials, languages, specialties, education, phone/email and portrait. Reviewed member name/province/city/country/source are shown. Registered Nurse stays Registered Nurse; no inferred Clinic title or licensing verification. Member profile source must be HTTPS with a name/profession.

Never falls back to organization logo/photo/social or inherited entity description for reviewed members. If no portrait is published or image loading fails, a clearly labelled initials fallback appears. Angie source portrait URL was found on the official profile, but HTTP image fetch returned HTML anti-bot content; no fake image substitutes. Parent source repair handles storing reviewed member data.

Affiliation is an independently linked Organization. Approved CHMS older canonical slug `canadian-hellenic-medical-society-toronto` is a historical slug, not a claim of Toronto branch/address. Name is Canadian Hellenic Medical Society; role Associate is sourced membership, not employment/ownership or licence verification. No society address/socials are attributed to the person.

SSR emits Person JSON-LD, jobTitle from published profession, optional safe contact, portrait, languages, published education and `memberOf` Organization. Never MedicalClinic, employer, inferred office address or verified licence.

## Customer tools
Contact card download (vCard3), copy published details, share profile; no automatic outbound messages. Contact preparation allows only published language choices and generic question enums. No symptoms, patient details, identifiers, notes or upload controls. Browser-local storage `zoi.health.contact.v1.<listing-id>` with readback, copy/edit/clear and storage failure fallback. It does not make appointments or send requests.

`inquiry_availability(p_listing)` and `booking_catalog(p_listing,p_from,p_to)` called only on button click with anonymous auth; booking range is next7days. Only exact valid ok/available receipts expose existing enabled Zoi workflows. Network failure shows retry, unavailable stays explicit. Authorized owner controls remain in existing `/social/` workspace.

## Validation
7 unit tests: real Angie source fields, generic eligibility, no association identity leakage, all4 control sets, enum-only preparation, vCard injection safety, unsafe URL/clear handling, contrast >=4.5, Person schema. Four designs at390/1440: no overflow, proper nurse identity, portrait failure fallback, stored checklist/reopen/focus and actual vCard download initiation. Isolated availability mocks verify outage→retry→success and false/no route disclosure. No production writes, messages or appointments created.

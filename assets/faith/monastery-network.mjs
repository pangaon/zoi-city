// Exact institutions matched to the monastery's own affiliated-monasteries page.
// Relationship means listed affiliation, not common ownership or governance.
export const MONASTERY_SOURCE='https://stanthonysmonastery.org/pages/affiliated-monasteries';
export const MONASTERY_CHECKED='2026-09-30';
const rows=[
['b0bd03bf-18ed-4ee8-9d0c-e607c4eb66cb','St Anthony’s','Florence','Arizona','US','st-anthonys-monastery-az'],
['fb884ee1-42e2-44ac-ba53-5721a94282e7','Nativity of the Theotokos','Saxonburg','Pennsylvania','US','nativity-theotokos-monastery-pa'],
['d8148947-523b-45ae-89a7-9536a0e5c17e','St Kosmas Aitolos','Bolton','Ontario','CA','st-kosmas-aitolos-monastery-on'],
['3c23cabf-70a4-4249-92e9-2ba57d1f4678','Panagia Parigoritissa · Virgin Mary the Consolatory','Brownsburg-Chatham','Quebec','CA','holy-monastery-of-the-virgin-mary-the-consolatory-brownsburg-chatham-3c23ca'],
['2cd18f33-cafb-4104-94b5-6c3ca606e49e','St John Chrysostomos','Pleasant Prairie','Wisconsin','US','st-john-chrysostom-monastery-pleasant-prairie'],
['5d5090e7-97bd-4d13-b8a0-d74cfe1be83d','Holy Protection','White Haven','Pennsylvania','US','holy-protection-monastery-pa'],
['a85d2a41-af22-4e58-888d-26fd38fbdf99','Theotokos, the Life-Giving Spring','Dunlap','California','US','holy-monastery-of-the-theotokos-the-life-giving-spring-dunlap'],
['38982c07-fc54-418f-a524-75c67693c29d','St John the Forerunner','Goldendale','Washington','US','st-john-forerunner-monastery-wa'],
['ac85ae08-8c71-47f1-b2a2-9d193e13f1c0','Holy Archangels','Kendalia','Texas','US','holy-archangels-monastery-kendalia'],
['6d4ecb54-2ee8-4503-a454-61dfeb23667b','Panagia Vlahernon','Williston','Florida','US','panagia-vlahernon-monastery-williston'],
['2da06fce-8ca5-414d-9fc9-05dfba0de8ce','Annunciation','Reddick','Florida','US','annunciation-theotokos-monastery-fl'],
[null,'Holy Trinity','Smiths Creek','Michigan','US',null],
['20eedf3a-1698-40b6-8c91-e2be929bb1bc','Panagia Prousiotissa','Troy','North Carolina','US','panagia-prousiotissa-greek-orthodox-monastery-troy'],
['d44ad5f5-e9a3-4e57-a396-8956258acba9','Panagia Pammakaristou','Lawsonville','North Carolina','US','panagia-pammakaristos-greek-orthodox-monastery-lawsonville'],
['a85fccea-9510-46c9-aae1-f33338dd05f2','Holy Transfiguration','Harvard','Illinois','US','holy-transfiguration-greek-orthodox-monastery-harvard'],
['8cb90b78-47aa-4665-8432-b07af877aff5','St Nektarios','Roscoe','New York','US','st-nektarios-greek-orthodox-monastery-roscoe-ny'],
['2069c649-8307-4bd9-b70f-2b69d6d06308','St Paraskevi','Washington','Texas','US','saint-paraskevi-greek-orthodox-monastery-washington']
];
export const MONASTERIES=rows.map(([id,name,city,region,country,slug])=>Object.freeze({id,name,city,region,country,slug,path:slug?'/church/'+slug:null,kind:'monastery',source:MONASTERY_SOURCE,checked_at:MONASTERY_CHECKED}));
// These aliases were individually matched by name AND city, not by dedication alone.
export const MONASTERY_ALIASES=Object.freeze({
'1ad9682e-d5e9-43e9-9626-6c22555891e0':'b0bd03bf-18ed-4ee8-9d0c-e607c4eb66cb','91ff5224-1079-4e90-872b-ae102a60313c':'b0bd03bf-18ed-4ee8-9d0c-e607c4eb66cb',
'11fb06d6-58e4-4094-be60-fc4d10c3d4ae':'3c23cabf-70a4-4249-92e9-2ba57d1f4678','3b11f9fd-330c-4f80-814c-33ef3fa1c7bb':'3c23cabf-70a4-4249-92e9-2ba57d1f4678',
'ad4d16cb-8eac-422e-83cc-00ee7f4a584e':'2cd18f33-cafb-4104-94b5-6c3ca606e49e','3db7e389-79f5-4e0f-8b60-16aa8461e466':'5d5090e7-97bd-4d13-b8a0-d74cfe1be83d',
'b83bfbdb-72bd-47dd-8f1e-ce588ea7dcf7':'a85d2a41-af22-4e58-888d-26fd38fbdf99','c8341be1-6529-4576-b6d0-f2aa0b54983d':'38982c07-fc54-418f-a524-75c67693c29d',
'39b2f556-1e00-45ee-a6a6-c48a673fa51c':'2da06fce-8ca5-414d-9fc9-05dfba0de8ce','b2198091-6e7d-429a-aa11-36a924fd7219':'d44ad5f5-e9a3-4e57-a396-8956258acba9',
'f696c813-3a75-4c6e-afc8-bf178a3e6374':'fb884ee1-42e2-44ac-ba53-5721a94282e7','c447856b-3396-4272-b18f-04dd837e9865':'8cb90b78-47aa-4665-8432-b07af877aff5'
});
export function monasteryIdentity(id){if(!id)return null;return MONASTERIES.find(x=>x.id===(MONASTERY_ALIASES[id]||id))||null;}

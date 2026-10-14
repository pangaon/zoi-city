import { readFile,writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { canonical,sha256 } from '../quality/evidence.mjs';
import { positionCohorts,diagnosePosition } from '../../assets/map-data/coordinate-integrity.mjs';
/** Read-only whole-catalogue planner. Every row has a deterministic state/task;
 * candidate preparation reuses source-coordinate-audit + reviewed writer.
 * No address is submitted to a provider; no position is changed. */
export function planCatalogueGeography(rows,{capturedAt=new Date().toISOString(),countryExtents={}}={}){
 if(!Array.isArray(rows)||rows.length>100000||rows.some(r=>!r?.id||!r?.name)||new Set(rows.map(r=>r.id)).size!==rows.length)throw Error('invalid_coordinate_catalogue_snapshot');
 const cohorts=positionCohorts(rows),countries=Object.create(null),states=Object.create(null),tasks=[];
 for(const row of rows){
  const result=diagnosePosition(row,{cohort:cohorts.get(row.id),countryExtent:countryExtents[row.country]});
  const country=typeof row.country==='string'&&row.country.trim()?row.country.trim():'Unresolved country';
  countries[country]||={records:0,reviewed:0,exact_source_research:0,owner_review:0,missing_coordinates:0};countries[country].records++;
  states[result.state]=(states[result.state]||0)+1;
  if(result.reviewed){countries[country].reviewed++;continue;}
  const owned=!!(row.owner_managed||row.owner_workspace_id||row.owner_user_id),identityConflict=result.reasons.includes('source_branch_or_person_scope_requires_review');
  const task=owned?'owner_location_review':identityConflict?'source_identity_review':row.website?'official_source_coordinate_review':'official_source_identification';
  if(owned)countries[country].owner_review++;else countries[country].exact_source_research++;
  if(result.state==='missing_coordinates')countries[country].missing_coordinates++;
  tasks.push({listing_id:row.id,slug:row.slug,country,task,priority:result.reasons.includes('street_label_conflicts_with_centroid_source')?0:result.reasons.includes('outside_reviewed_country_extent')?1:result.review_required?2:3,
   coordinate_state:result,source_url:row.website||null,database_snapshot:row.database_snapshot||null,
   snapshot_sha256:sha256(canonical({id:row.id,name:row.name,website:row.website,address:row.address,city:row.city,country:row.country,latitude:row.latitude??row.lat,longitude:row.longitude??row.lng,geo_precision:row.geo_precision,geo_metadata:row.geo_metadata,owner_managed:owned})),
   application_state:'not_applied',next_action:owned?'Ask the current authorized owner to review location in the existing workspace; imports must not override ownership.':identityConflict?'Resolve the exact person, branch and official source before researching coordinates.':'Capture official source and exact address, independently review the candidate, then prepare the existing receipt-backed geography_review_apply request.'});
 }
 tasks.sort((a,b)=>a.priority-b.priority||a.country.localeCompare(b.country)||a.listing_id.localeCompare(b.listing_id));
 return {schema_version:1,kind:'global_coordinate_repair_plan',captured_at:capturedAt,records:rows.length,countries,states,tasks,provider_calls:0,coordinate_writes:0,coverage:'Every supplied row assessed; source inspection, candidate acceptance and visible-map QA remain separate stages.'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const [input,output]=process.argv.slice(2);if(!input||!output)throw Error('usage: catalogue-snapshot.json new-plan.json');const plan=planCatalogueGeography(JSON.parse(await readFile(input,'utf8')));await writeFile(output,JSON.stringify(plan,null,2)+'\n',{flag:'wx',mode:0o600});console.log(JSON.stringify({output,records:plan.records,countries:Object.keys(plan.countries).length,tasks:plan.tasks.length,provider_calls:0,coordinate_writes:0}));}

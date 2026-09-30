/** Release gates are enabled only after reviewed backend deployment and acceptance.
 * Presence audit 2026-09-30: all 130 referenced RPCs exist, including 11 youth functions.
 * Guardian migration 20260930073344 passed production rollback acceptance (CI36684363030).
 * This is a conservative release snapshot, not a claim of end-to-end verification.
 */
const readiness:Record<string,boolean>=Object.freeze({guardianProgrammes:true,externalSocialPublishing:false,artistCityDemand:true});
export function backendReady(feature:string){return Object.hasOwn(readiness,feature)&&readiness[feature]===true;}

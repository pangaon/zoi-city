// Outbound website navigation only. Media and embeds retain their HTTPS validators.
import {officialSiteURL,selectedOfficialWebsite} from '../enrichment/official-source-policy.mjs';
export function officialURL(value,entity){return entity?selectedOfficialWebsite(entity):officialSiteURL(value);}

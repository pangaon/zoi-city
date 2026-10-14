// Outbound website navigation only. Media and embeds retain their HTTPS validators.
import {outwardWebsiteURL,selectedOutwardWebsite} from '../enrichment/official-source-policy.mjs';
export function officialURL(value,entity){return entity?selectedOutwardWebsite(entity):outwardWebsiteURL(value);}

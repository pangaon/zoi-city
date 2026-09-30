// Reuse the exact deployed extractor body. Only trusted repository code is compiled;
// website HTML is a data argument and is never evaluated here.
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {createHash} from 'node:crypto';
import {extractStructuredMenu} from '../../supabase/functions/zoi-enrich/_menus.js';
import {extractSiteImages} from '../../supabase/functions/zoi-enrich/_images.js';
import {extractSocialLinks} from '../../supabase/functions/zoi-enrich/_social.js';
import {extractPublicMedia} from '../../supabase/functions/zoi-enrich/_media.js';
const source=readFileSync(new URL('../../supabase/functions/zoi-enrich/index.ts',import.meta.url),'utf8');
const start=source.indexOf('const AGGREGATORS ='),marker='return { profile, provenance, aggregator: isAgg, host };\n}',end=source.indexOf(marker,start);
if(start<0||end<start)throw Error('extractor_contract_changed');
const body=source.slice(start,end+marker.length);
export const extractorHash=createHash('sha256').update(body).digest('hex');
export const extractRenderedSource=new Function('extractStructuredMenu','extractSiteImages','extractSocialLinks','extractPublicMedia',stripTypeScriptTypes(body)+';return extract;')(extractStructuredMenu,extractSiteImages,extractSocialLinks,extractPublicMedia);

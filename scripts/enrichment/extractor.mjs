import {imageDocumentElements} from '../../supabase/functions/zoi-enrich/_image-document.js';
import {sourceCopyPlaceholder} from '../../assets/enrichment/client-brief.mjs';
import {usablePhone} from '../../supabase/functions/zoi-enrich/_phone.js';
import {extractHospitality} from '../../supabase/functions/zoi-enrich/_hospitality.js';
// Reuse the repository worker extractor body. Deployment is verified separately.
// Only trusted repository code is compiled;
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
// A capture must identify the helper code that actually shaped its result, too.
// Keep this explicit manifest in sync with the injected pure helpers and their imports.
const helpers=['_phone.js','_menus.js','_images.js','_image-context.js','_image-document.js','_social.js','_media.js','_hospitality.js'];
const implementation={body,source_copy_helper:readFileSync(new URL('../../assets/enrichment/client-brief.mjs',import.meta.url),'utf8'),helpers:Object.fromEntries(helpers.map(name=>[name,readFileSync(new URL('../../supabase/functions/zoi-enrich/'+name,import.meta.url),'utf8')]))};
export const extractorHash=createHash('sha256').update(JSON.stringify(implementation)).digest('hex');
export const extractRenderedSource=new Function('imageDocumentElements','sourceCopyPlaceholder','usablePhone','extractStructuredMenu','extractSiteImages','extractSocialLinks','extractPublicMedia','extractHospitality',stripTypeScriptTypes(body)+';return extract;')(imageDocumentElements,sourceCopyPlaceholder,usablePhone,extractStructuredMenu,extractSiteImages,extractSocialLinks,extractPublicMedia,extractHospitality);

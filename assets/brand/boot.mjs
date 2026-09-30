import {applySiteIdentity} from './site-identity.mjs?v=20260930';
if(!window.__zoiIdentityBoot){window.__zoiIdentityBoot=true;applySiteIdentity().catch(()=>{});}

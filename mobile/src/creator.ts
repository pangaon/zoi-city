export type BioDraft = { slug:string;title:string;tagline:string;theme:string;links:{label:string;url:string}[];photo_url:string;published:boolean };
export function httpLink(value:string) { try { const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password; } catch { return false; } }
export function bioPayload(workspace:string,draft:BioDraft) {
 const slug=draft.slug.trim(),title=draft.title.trim();
 if(!/^[a-z0-9][a-z0-9-]{2,39}$/.test(slug)) throw new Error('Choose a handle of 3–40 lowercase letters, numbers or hyphens.');
 if(!title||title.length>80||draft.tagline.length>160) throw new Error('Use a title up to 80 characters and tagline up to 160.');
 if(!['dark','light','gold'].includes(draft.theme)) throw new Error('Choose a supported theme.');
 if(draft.links.length>12) throw new Error('Use up to 12 links.');
 const links=draft.links.map(link=>{const label=link.label.trim(),url=link.url.trim();if(!label||label.length>60||url.length>500||!httpLink(url))throw new Error('Every link needs a label up to 60 characters and an http(s) URL up to 500.');return {label,url};});
 if(draft.photo_url&&!httpLink(draft.photo_url)) throw new Error('Use an http(s) photo URL.');
 return {p_workspace:workspace,p_slug:slug,p_title:title,p_tagline:draft.tagline,p_theme:draft.theme,p_links:links,p_photo:draft.photo_url||null,p_published:draft.published};
}
export function bioReceipt(value:any,slug:string) { if(value?.ok!==true||value.slug!==slug||typeof value.url!=='string'||!httpLink(value.url))throw new Error('The profile save was not confirmed. Your draft is preserved.');return value.url as string; }

// Outbound website navigation only. Media and embeds retain their HTTPS validators.
export function officialURL(value){try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.href:'';}catch{return '';}}

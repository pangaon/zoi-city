import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';
const css=readFileSync(new URL('../../assets/zoi-theme.css',import.meta.url),'utf8');
function lum(hex){const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb.reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);}
function contrast(a,b){const [low,high]=[lum(a),lum(b)].sort((x,y)=>x-y);return(high+.05)/(low+.05);}
test('shared text and primary-button tokens meet normal-text contrast on supported theme surfaces',()=>{
 const base=css.match(/:root\s*\{([^}]+)\}/)[1];
 for(const theme of ['dark','light','gold']){
  const block=theme==='dark'?'':css.match(new RegExp('\\[data-theme="'+theme+'"\\]\\s*\\{([^}]+)\\}'))[1];
  const t=Object.fromEntries([...`${base}${block}`.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})\b/gi)].map(m=>[m[1],m[2]]));
  for(const bg of ['bg','bg2','card','card2'])for(const fg of ['tx','mut','dim','acc'])assert.ok(contrast(t[fg],t[bg])>=4.5,`${theme} ${fg} on ${bg}: ${contrast(t[fg],t[bg]).toFixed(2)}`);
  assert.ok(contrast(t['btn-fg'],t['btn-bg'])>=4.5,theme+' primary button');
  assert.ok(contrast(t['on-text'],t.tx)>=4.5,theme+' inverted selection and action');
  assert.ok(contrast(t['on-gold'],t.gold)>=4.5,theme+' gold button');
 }
});

test('primary gradient labels remain readable at both color stops',()=>{
 for(const rule of [css.match(/\.btn-primary\{([^}]+)\}/)[1],css.match(/\.btn-primary:hover\{([^}]+)\}/)[1]+';color:#ffffff']){
 const colors=[...rule.matchAll(/#[0-9a-f]{6}/gi)].map(x=>x[0]);
 for(const stop of colors.slice(0,2))assert.ok(contrast(stop,colors[2])>=4.5,stop+' gradient stop');
 }
});

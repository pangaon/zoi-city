import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const compile=(name,deps)=>{const module={exports:{}};vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/'+name,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:n=>{if(n.endsWith('.png'))return n;if(!(n in deps))throw Error('Unexpected dependency '+n);return deps[n];}});return module.exports;};
const jsx=(type,props,key)=>({type,props,key});
const nodes=tree=>{const result=[];const walk=n=>{if(Array.isArray(n))n.forEach(walk);else if(n&&typeof n==='object'){result.push(n);walk(n.props?.children);}};walk(tree);return result;};
const text=n=>typeof n==='string'?n:Array.isArray(n)?n.map(text).join(''):n&&typeof n==='object'?text(n.props?.children):'';
const flatten=style=>Object.assign({},...[style].flat(Infinity).filter(Boolean));
function mount({platform='ios',dark=false,scale=1,width=390,motion=false,glass=false,target}={}){
 let slot=0,tree;const state=[],calls=[];
 const react={useMemo:fn=>fn(),useCallback:fn=>fn,useEffect(){},useLayoutEffect(){},useRef:value=>({current:value}),useState(initial){const i=slot++;if(!(i in state))state[i]=initial;return[state[i],value=>state[i]=typeof value==='function'?value(state[i]):value];}};
 const palette={ink:dark?'#f5faff':'#10294d',muted:dark?'#bed1e7':'#435c7c',accent:dark?'#76c6ff':'#075dcc'};
 const rn={Image:'Image',Modal:'Modal',View:'View',ScrollView:'ScrollView',Pressable:'Pressable',Platform:{OS:platform,select:values=>values[platform]??values.default},StyleSheet:{create:x=>x,absoluteFill:{position:'absolute',inset:0}},useColorScheme:()=>dark?'dark':'light',useWindowDimensions:()=>({width,fontScale:scale})};
 const deps={'react':react,'react/jsx-runtime':{jsx,jsxs:jsx},'react-native':rn,'expo-linear-gradient':{LinearGradient:'Gradient'},'expo-blur':{BlurView:'Blur'},'./ScaleText':{ScaleText:'Text'},'./brand':{LIGHT:palette,DARK:palette},'./Icon':{Icon:'Icon'},'./Presentation':{usePresentationPreferences:()=>({motion,glass})},'./navigationLayout':compile('navigationLayout.ts',{})};
 const home=compile('HomeExperience.tsx',deps),chrome=compile('AppChrome.tsx',deps),child={type:'ActualPublicRecords',props:{}};
 const render=kind=>{slot=0;tree=kind==='home'?home.HomeExperience({navigate:id=>calls.push(id),onMap:()=>calls.push('map'),onShop:()=>calls.push('shop'),children:child}):kind==='header'?chrome.AppHeader({onHome:()=>calls.push('home'),onAccount:()=>calls.push('account')}):chrome.PrimaryNavigation({activeId:'home',onNavigate:id=>calls.push(id),blurTarget:target});return tree;};
 return{render,calls,child,nodes:()=>nodes(tree),click:label=>{const n=nodes(tree).find(n=>n.type==='Pressable'&&n.props.accessibilityLabel===label);assert(n,'Missing '+label);n.props.onPress();}};
}
test('Home keeps actual child records and all seven destination actions across size, theme and native font variants',()=>{
 for(const platform of ['ios','android'])for(const dark of [false,true])for(const [width,scale]of [[320,2],[390,1],[780,2]]){
  const h=mount({platform,dark,width,scale});h.render('home');assert(h.nodes().includes(h.child));assert.deepEqual(h.calls,[]);
  for(const label of ['Discover places and people','Explore the map','Shop BuyGreek marketplace','Community','Events','Discover','For business'])h.click(label);
  assert.deepEqual(h.calls,['discover','map','shop','community','tickets','discover','grow']);
  for(const n of h.nodes().filter(n=>n.type==='Text')){assert.equal(n.props.numberOfLines,undefined);assert.equal(n.props.maxFontSizeMultiplier,undefined);assert.equal(flatten(n.props.style).height,undefined);}
  const headings=h.nodes().filter(n=>n.type==='Text'&&n.props.accessibilityRole==='header');assert(headings.length>=2);for(const n of headings){const style=flatten(n.props.style);assert.equal(style.fontFamily,undefined);assert.ok(style.fontSize<=32,`display type ${style.fontSize} should stay compact`);}
  const image=h.nodes().find(n=>n.type==='Image');assert.equal(image.props.accessible,false);assert.match(text(h.render('home')),/Your people\.\s*Your possibilities\./);assert.doesNotMatch(text(h.render('home')),/A little closer to home/);
 }
});
test('header home and account remain explicit actions at large text',()=>{
 const h=mount({width:320,scale:2});h.render('header');h.click('Zoi home');h.click('Your Zoi account');assert.deepEqual(h.calls,['home','account']);assert.doesNotMatch(text(h.render('header')),/GREEK ROOTS. GLOBAL LIFE./);
});
test('all sections opens without changing page, closes safely and navigates each real destination',()=>{
 for(const id of ['home','discover','community','tickets','grow']){
  const h=mount({width:320,scale:2});h.render('nav');h.click('All sections');h.render('nav');assert.deepEqual(h.calls,[]);assert.equal(h.nodes().find(n=>n.type==='Modal').props.visible,true);
  h.click('Close sections');h.render('nav');assert.equal(h.nodes().find(n=>n.type==='Modal').props.visible,false);assert.deepEqual(h.calls,[]);
  h.click('All sections');h.render('nav');const label={home:'Home',discover:'Discover',community:'Community',tickets:'Events',grow:'Grow'}[id];h.click('Go to '+label);h.render('nav');assert.deepEqual(h.calls,[id]);assert.equal(h.nodes().find(n=>n.type==='Modal').props.visible,false);
 }
});
test('glass requires presentation permission and an actual Android target; reduced-motion menu never fades',()=>{
 for(const platform of ['ios','android','web'])for(const glass of [false,true])for(const motion of [false,true])for(const target of [undefined,{current:{}}]){
  const h=mount({platform,glass,motion,target});h.render('nav');const blur=h.nodes().find(n=>n.type==='Blur');assert.equal(!!blur,glass&&(platform!=='android'||!!target));if(blur&&platform==='android'){assert.equal(blur.props.blurTarget,target);assert.equal(blur.props.blurMethod,'dimezisBlurViewSdk31Plus');}
  assert.equal(h.nodes().find(n=>n.type==='Modal').props.animationType,motion?'fade':'none');
 }
});

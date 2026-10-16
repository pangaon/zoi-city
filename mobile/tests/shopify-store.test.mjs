import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
function compile(p,deps,extra={}){const module={exports:{}};vm.runInNewContext(ts.transpileModule(read(p),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:n=>{if(!(n in deps))throw Error('Unexpected dependency '+n);return deps[n];},URL,...extra});return module.exports;}
const navigation=compile('../src/ShopifyNavigation.ts',{});
test('product and exact option deep links retain Shopify identity without building a second cart',()=>{
 assert.equal(navigation.shopifyInitialURL(),'https://buygreek.shop/');
 assert.equal(navigation.shopifyInitialURL('greeting-card','40234567890123'),'https://buygreek.shop/products/greeting-card?variant=40234567890123');
 for(const [product,variant]of [['../cart',''],['olive?variant=wrong',''],['https://other.test',''],['olive','invalid'],['','40234567890123']])assert.throws(()=>navigation.shopifyInitialURL(product,variant));
});
test('only exact secure store origin embeds; every other secure destination requires explicit handoff; unsafe schemes refuse',()=>{
 for(const path of ['/','/cart','/account/login','/checkouts/cn/session','/products/greeting-card?variant=40234567890123'])assert.equal(navigation.shopifyNavigation('https://buygreek.shop'+path).kind,'store');
 for(const url of ['https://shop.app/pay/session','https://checkout.shopify.com/session','https://accounts.shopify.com/auth','https://buygreek.shop.evil.test/','https://www.buygreek.shop/'])assert.equal(navigation.shopifyNavigation(url).kind,'browser');
 for(const url of ['http://buygreek.shop','javascript:alert(1)','intent://checkout','file:///private','data:text/html,test','about:blank','https://user:secret@buygreek.shop','https://buygreek.shop:8443/','https://buygreek.shop\\@evil.test',' https://buygreek.shop','//buygreek.shop/','https://buygreek.shop/\nunsafe'])assert.equal(navigation.shopifyNavigation(url).kind,'blocked',url);
});
function mounted(platform='native',props={}){
 const states=[],refs=[],effects=[],timers=new Map(),calls={open:[],back:0,reload:0,stop:0,exit:0};let slot=0,tree,hardware,throwOpen=false;
 const react={useState(initial){const n=slot++;if(!(n in states))states[n]=typeof initial==='function'?initial():initial;return[states[n],v=>{states[n]=typeof v==='function'?v(states[n]):v;}];},useRef(initial){const n=slot++;return refs[n]??=( {current:initial});},useEffect(run,deps){const n=slot++,old=effects[n];if(!old||deps.some((x,i)=>x!==old.deps[i])){old?.cleanup?.();effects[n]={deps,run};}}};
 const rn={View:'View',Pressable:'Pressable',ActivityIndicator:'ActivityIndicator',StyleSheet:{create:v=>v},Linking:{openURL:async url=>{calls.open.push(url);if(throwOpen)throw Error('Controlled browser failure');}},BackHandler:{addEventListener:(_name,fn)=>{hardware=fn;return{remove(){if(hardware===fn)hardware=null;}};}}};
 const jsx=(type,props,key)=>({type,props,key});
 const module=compile('../src/ShopifyStore.'+platform+'.tsx',{'react':react,'react/jsx-runtime':{jsx,jsxs:jsx},'react-native':rn,'react-native-webview':{WebView:'WebView'},'./ScaleText':{ScaleText:'Text'},'./ShopifyNavigation':navigation},{setTimeout:fn=>{const id=timers.size+1;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id)});
 let current={back:()=>calls.exit++,...props};
 const render=next=>{current={...current,...next};slot=0;tree=module.ShopifyStoreScreen(current);for(const e of effects)if(e?.run){const fn=e.run;e.run=null;e.cleanup=fn();}return tree;};
 render();render();
 const nodes=()=>{const out=[];const walk=n=>{if(Array.isArray(n))n.forEach(walk);else if(n&&typeof n==='object'){out.push(n);walk(n.props?.children);}};walk(tree);return out;};
 const text=n=>typeof n==='string'?n:Array.isArray(n)?n.map(text).join(''):n&&typeof n==='object'?text(n.props?.children):'';
 const web=()=>{const n=nodes().find(n=>n.type==='WebView');if(n)n.props.ref.current={goBack:()=>calls.back++,reload:()=>calls.reload++,stopLoading:()=>calls.stop++};return n;};
 const click=async label=>{const button=nodes().find(n=>n.type==='Pressable'&&text(n)===label);assert(button,'Missing '+label);assert(!button.props.disabled,'Disabled '+label);await button.props.onPress();await Promise.resolve();await Promise.resolve();render();};
 return{render,web,nodes,calls,click,text:()=>text(tree),hardware:()=>hardware?.(),slow:()=>{for(const fn of [...timers.values()])fn();render();},failBrowser:()=>throwOpen=true,dispose:()=>effects.forEach(e=>e?.cleanup?.())};
}
test('native store keeps persistent Shopify storage and never injects app state or payment handling',()=>{
 const h=mounted('native',{initialProduct:'greeting-card',initialVariant:'40234567890123'}),w=h.web().props;
 assert.equal(w.source.uri,navigation.shopifyInitialURL('greeting-card','40234567890123'));
 assert.equal(w.incognito,false);assert.equal(w.sharedCookiesEnabled,true);assert.equal(w.domStorageEnabled,true);assert.equal(w.cacheEnabled,true);assert.equal(w.thirdPartyCookiesEnabled,false);
 assert.equal(w.geolocationEnabled,false);assert.equal(w.mixedContentMode,'never');assert.equal(w.allowFileAccess,false);
 for(const key of ['injectedJavaScript','injectedJavaScriptBeforeContentLoaded','injectedJavaScriptObject','onMessage','basicAuthCredential'])assert.equal(key in w,false);
 assert.deepEqual(h.calls.open,[]);h.dispose();
});
test('external checkout/account popup stops before navigation and opens only after the explicit browser gesture',async()=>{
 const h=mounted(),w=h.web().props;
 assert.equal(w.onShouldStartLoadWithRequest({url:'https://shop.app/pay/session',isTopFrame:true}),false);h.render();assert.match(h.text(),/Continue at shop.app/);assert.deepEqual(h.calls.open,[]);
 await h.click('Stay in store');assert.doesNotMatch(h.text(),/Continue at/);
 w.onOpenWindow({nativeEvent:{targetUrl:'https://accounts.shopify.com/auth/session'}});h.render();assert.deepEqual(h.calls.open,[]);await h.click('Continue in browser');assert.deepEqual(h.calls.open,['https://accounts.shopify.com/auth/session']);
 w.onOpenWindow({nativeEvent:{targetUrl:'intent://payment'}});h.render();assert.equal(h.calls.open.length,1);assert.match(h.text(),/cannot open/);h.dispose();
});
test('same-store popup and incoming product changes retain the WebView host while ordinary reload/back preserve browser history',async()=>{
 const h=mounted(),original=h.web();original.props.onOpenWindow({nativeEvent:{targetUrl:'https://buygreek.shop/products/olive-oil?variant=40234567890123'}});h.render();assert.equal(h.web().key,original.key);assert.match(h.web().props.source.uri,/olive-oil\?variant=/);
 h.web().props.onNavigationStateChange({url:'https://buygreek.shop/cart',canGoBack:true});h.render();h.web();assert.equal(h.hardware(),true);assert.equal(h.calls.back,1);await h.click('Store back');assert.equal(h.calls.back,2);await h.click('Reload');assert.equal(h.calls.reload,1);assert.equal(h.web().key,original.key);
 h.render({initialProduct:'greeting-card',initialVariant:'40234567890123'});h.render();assert.equal(h.web().key,original.key);assert.match(h.web().props.source.uri,/greeting-card\?variant=/);assert.equal(h.hardware(),true);assert.equal(h.calls.exit,1);h.dispose();
});
test('slow/error/renderer failures retain browser escape and recover explicitly; failed external open keeps the store',async()=>{
 const h=mounted();h.web().props.onLoadStart();h.slow();assert.match(h.text(),/Taking longer/);await h.click('Retry');assert.equal(h.calls.reload,1);
 h.web().props.onError();h.render();assert.match(h.text(),/could not load/);await h.click('Retry store');assert.equal(h.calls.reload,2);
 const key=h.web().key;h.web().props.onRenderProcessGone();h.render();await h.click('Retry store');assert.notEqual(h.web().key,key);assert.equal(h.web().props.source.uri,'https://buygreek.shop/');
 h.failBrowser();await h.click('Open browser');assert.match(h.text(),/browser could not open/);assert.equal(h.web().props.source.uri,'https://buygreek.shop/');h.dispose();
});
test('unsafe committed navigation stops, subframes cannot launch the browser, and toolbar targets remain at least44',()=>{
 const h=mounted(),w=h.web().props;w.onNavigationStateChange({url:'https://foreign.example/checkout',canGoBack:true});h.render();assert.equal(h.calls.stop,1);assert.deepEqual(h.calls.open,[]);
 assert.equal(w.onShouldStartLoadWithRequest({url:'https://foreign.example/frame',isTopFrame:false}),false);h.render();assert.deepEqual(h.calls.open,[]);
 for(const n of h.nodes().filter(n=>n.type==='Pressable')){const styles=n.props.style.flat().filter(Boolean);assert(styles.some(s=>s.minHeight>=44&&s.minWidth>=44));}h.dispose();
});
test('web fallback is an honest product/option handoff with no iframe/cart or automatic navigation',async()=>{
 const h=mounted('web',{initialProduct:'greeting-card',initialVariant:'40234567890123'});assert.equal(h.web(),undefined);assert.deepEqual(h.calls.open,[]);assert.match(h.text(),/official store/);await h.click('Open BuyGreek store ↗');assert.equal(h.calls.open[0],navigation.shopifyInitialURL('greeting-card','40234567890123'));await h.click('Back to Zoi');assert.equal(h.calls.exit,1);h.dispose();
});

// Bundle the actual RN component with installed RN-web CJS distributions only.
// No network, package installation, Expo/EAS build or application runtime change.
const fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const mobile=path.resolve(__dirname,'../..'),resolve=createRequire(path.join(mobile,'package.json'));
const babel=resolve('@babel/core'),jsx=resolve.resolve('@babel/plugin-transform-react-jsx'),common=resolve.resolve('@babel/plugin-transform-modules-commonjs'),typescript=resolve.resolve('@babel/preset-typescript');
const modules=[],ids=new Map(),shim=path.join(__dirname,'../food-menu-browser/rn-web-scale-shim.jsx');
const boundary=new Set(['Auth','Bookings','EventHome','ArtistHome'].map(n=>path.join(mobile,'src',n+'.tsx')));
function resolveFile(from,name){try{return createRequire(from).resolve(name)}catch(error){if(name.startsWith('.'))for(const ext of['.tsx','.ts','.jsx','.js']){const file=path.resolve(path.dirname(from),name+ext);if(fs.existsSync(file))return file}throw error;}}
function add(file){if(ids.has(file))return ids.get(file);const id=modules.length;ids.set(file,id);modules.push(null);let code;
 if(file.endsWith('.png'))code='module.exports='+JSON.stringify('data:image/png;base64,'+fs.readFileSync(file).toString('base64'));
 else if(file.endsWith('.json'))code='module.exports='+fs.readFileSync(file,'utf8');
 else{code=fs.readFileSync(file,'utf8');if(/\.(tsx?|jsx|mjs|js)$/.test(file))code=babel.transformSync(code,{filename:file,babelrc:false,configFile:false,presets:/\.tsx?$/.test(file)?[[typescript,{allExtensions:true,isTSX:file.endsWith('.tsx')}]]:[],plugins:[[jsx,{runtime:'automatic'}],common]}).code;
 code=code.replace(/\brequire\(\s*(['"])([^'"]+)\1\s*\)/g,(_,q,name)=>{let dependency=name==='react-native'?shim:resolveFile(file,name);if(boundary.has(dependency))dependency=path.join(__dirname,'../food-menu-browser/profile-boundary.jsx');if(!path.isAbsolute(dependency))throw Error('Node builtin not allowed in browser: '+name);return '__require('+add(dependency)+')'});}
 modules[id]='function(module,exports,__require){\n'+code+'\n}';return id;}
const entry=add(path.join(__dirname,'fixture.jsx')),out=process.env.BUNDLE_PATH||'/tmp/zoi-published-fields-bundle.js';fs.writeFileSync(out,'(()=>{var process={env:{NODE_ENV:"development"}};const modules=['+modules.join(',\n')+'];const cache={};function __require(id){if(cache[id])return cache[id].exports;const module=cache[id]={exports:{}};modules[id](module,module.exports,__require);return module.exports;}__require('+entry+');})();');console.log('Bundled '+modules.length+' actual React/RN-web/source modules into '+out);

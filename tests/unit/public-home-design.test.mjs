import test from'node:test';import assert from'node:assert/strict';import{publishedHomeDesign}from'../../api/_home-design.js';
const design={schema_version:1,template:'parea',section_order:['intro'],hidden_sections:[],copy:{headline:'My home'},item_order:{offerings:[]}};
const entity={id:'one',published_design:{ok:true,listing:'one',version:2,design}};
test('canonical home accepts only its own explicitly published version',()=>{assert.deepEqual(publishedHomeDesign(entity),design);for(const patch of [{ok:false},{listing:'other'},{version:0},{design:{...design,template:'fake'}},{design:{...design,copy:{script:'bad'}}}])assert.equal(publishedHomeDesign({...entity,published_design:{...entity.published_design,...patch}}),null);assert.equal(publishedHomeDesign({id:'one',draft:design}),null)});

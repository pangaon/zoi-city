import test from 'node:test';import assert from 'node:assert/strict';import{cityChoices,countryChoices}from'../../assets/discovery/city-picker.mjs';
test('country city names deduplicate regions while preserving source country and exact city identity',()=>{
 const rows=[{city:'Nairobi',country:'Kenya',region:'Nairobi Area'},{city:'Nairobi',country:'Kenya',region:null},{city:'North York',country:'Canada'},{city:'Toronto',country:'Canada'},{city:'Toronto',country:'United States'}];
 assert.deepEqual(cityChoices(rows,'Canada'),[{city:'North York',country:'Canada'},{city:'Toronto',country:'Canada'}]);assert.equal(cityChoices(rows).length,4);assert.deepEqual(countryChoices(rows),['Canada','Kenya','United States']);
});
test('malformed catalogs fail explicitly and incomplete names cannot become invented cities',()=>{
 for(const bad of[null,{},'unavailable']){assert.throws(()=>cityChoices(bad),/city_response/);assert.throws(()=>countryChoices(bad),/country_response/);}
 assert.deepEqual(cityChoices([null,{city:'Toronto'}, {country:'Canada'},{city:5,country:'Canada'},{city:' ',country:'Canada'}]),[]);assert.deepEqual(countryChoices([{country:'  Canada '},{country:'Canada'},{country:null}]),['Canada']);
});

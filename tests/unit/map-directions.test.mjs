import test from 'node:test';
import assert from 'node:assert/strict';
import { navigationDestination, navigationURL, TRAVEL_MODES } from '../../assets/map-data/directions.mjs';
test('unreviewed coordinates never become a routing destination; public address can receive directions', () => {
  const place = { n: 'Actual café', addr: '25 Example St', city: 'Toronto', country: 'Canada', lat: 37, lng: 23 };
  assert.deepEqual(navigationDestination(place), { value: '25 Example St, Toronto, Canada', basis: 'address', label: '25 Example St, Toronto, Canada' });
  assert.equal(navigationDestination({ city: 'Toronto', lat: 37, lng: 23 }), null);
  assert.equal(navigationDestination(place, { reviewed: true }).value, '37,23');
  assert.equal(navigationDestination({lat:'37',lng:23}, { reviewed: true }), null);
  assert.equal(navigationDestination({lat:91,lng:23}, { reviewed: true }), null);
});
test('each travel mode uses actual provider directions; origin is optional and safely encoded', () => {
  const destination = navigationDestination({addr:'10 A & B Street',city:'Athens',country:'Greece'});
  for (const {value: mode} of TRAVEL_MODES) {
    const url = new URL(navigationURL(destination,{mode,origin:'5 Origin & Avenue'}));
    assert.equal(url.hostname,'www.google.com'); assert.equal(url.pathname,'/maps/dir/');
    assert.equal(url.searchParams.get('api'),'1'); assert.equal(url.searchParams.get('travelmode'),mode);
    assert.equal(url.searchParams.get('origin'),'5 Origin & Avenue');
    assert.equal(url.searchParams.get('destination'),'10 A & B Street, Athens, Greece');
    assert.equal(url.searchParams.get('dir_action'),'navigate');
  }
  assert.equal(new URL(navigationURL(destination)).searchParams.has('origin'),false);
  assert.throws(()=>navigationURL(destination,{mode:'flying'}));
  assert.throws(()=>navigationURL(destination,{origin:'x'.repeat(701)}));
  assert.equal(navigationURL(null),null);
});
test('bounded public addresses and origin content cannot inject provider URL parameters', () => {
  assert.equal(navigationDestination({addr:'x'.repeat(701)}),null);
  const destination=navigationDestination({addr:'<b>25 Example</b>\nStreet?origin=bad&travelmode=flying',country:'Greece'});
  const url=new URL(navigationURL(destination));
  assert.equal(url.searchParams.get('travelmode'),'driving');
  assert.equal(url.searchParams.has('origin'),false);
  assert.match(url.searchParams.get('destination'),/^25 Example Street/);
});

test('locality-only address and sentinel coordinates cannot receive premises directions',()=>{assert.equal(navigationDestination({addr:'Toronto',city:'Toronto',country:'Canada'}),null);assert.equal(navigationDestination({addr:'Toronto, Canada',city:'Toronto',country:'Canada'}),null);assert.equal(navigationDestination({lat:0,lng:0},{reviewed:true}),null);assert.equal(navigationDestination({addr:'25 Example St'}),null);});

import test from 'node:test';import assert from 'node:assert/strict';
import {zonedToInstant,localInput,confirmed,UUID} from '../../assets/bookings/model.mjs';
test('operator business timezone produces correct UTC timestamp',()=>{assert.equal(zonedToInstant('2026-10-01T12:00','Europe/Athens'),'2026-10-01T09:00:00.000Z');assert.equal(localInput('2026-10-01T09:00:00Z','Europe/Athens'),'2026-10-01T12:00');});
test('DST nonexistent and ambiguous times are rejected explicitly',()=>{assert.throws(()=>zonedToInstant('2026-03-29T03:30','Europe/Athens'),/does not exist/);assert.throws(()=>zonedToInstant('2026-10-25T03:30','Europe/Athens'),/occurs twice/);});
test('invalid dates and response errors cannot become successful bookings',()=>{assert.throws(()=>zonedToInstant('2026-02-31T10:00','Europe/Athens'));assert.throws(()=>confirmed({ok:false},'booking'));assert.equal(UUID.test('------------------------------------'),false);});

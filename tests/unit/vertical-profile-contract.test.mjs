import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verticalFor, profileForVertical } from '../../api/_verticals.js';

function normalize(entityType, categorySlug, profile) {
  const picked = verticalFor({ entity_type: entityType, category_slug: categorySlug });
  return profileForVertical(picked.v, profile || {});
}

test('church form keys are normalized to render keys', () => {
  const p = normalize('church', 'greek-orthodox-churches', {
    services: [{ name: 'Divine Liturgy', day: 'sun', time: '09:00', language: 'Greek / English' }],
    sacraments: 'Baptism, Wedding',
    stewardship_url: 'https://parish.example/give',
    festival: 'Greek Festival',
    patronal_feast: 'St George',
  });

  assert.equal(Array.isArray(p.schedule), true);
  assert.equal(p.schedule[0].label, 'Divine Liturgy');
  assert.deepEqual(p.sacraments, ['Baptism', 'Wedding']);
  assert.equal(p.giving.url, 'https://parish.example/give');
  assert.equal(p.festival.name, 'Greek Festival');
  assert.equal(p.patronal_feast.saint, 'St George');
});

test('restaurant form keys become actionable renderer keys', () => {
  const p = normalize('business', 'restaurants', {
    reserve_url: 'https://restaurant.example/book',
    order_url: 'https://restaurant.example/order',
    menu_url: 'https://restaurant.example/menu',
    price_range: '$$',
  });

  assert.equal(p.reserve, 'https://restaurant.example/book');
  assert.equal(Array.isArray(p.order), true);
  assert.equal(p.order[0].url, 'https://restaurant.example/order');
  assert.equal(Array.isArray(p.menu), true);
  assert.match(String(p.menu[0].items[0].note), /restaurant\.example\/menu/);
  assert.deepEqual(p.payment, ['Price range $$']);
});

test('professional, organization, event and generic aliases normalize cleanly', () => {
  const professional = normalize('professional', 'lawyers', {
    practice_areas: ['Migration law'],
    registrations: [{ body: 'Law Society', number: 'L123', jurisdiction: 'NSW' }],
    booking_url: 'https://firm.example/book',
    consult_fee: '$150',
  });
  assert.deepEqual(professional.services, ['Migration law']);
  assert.equal(professional.credentials[0], 'Law Society · L123 · NSW');
  assert.equal(professional.consult, 'https://firm.example/book');
  assert.equal(professional.fees, 'Consultation fee: $150');

  const organization = normalize('organization', 'hellenic-associations', {
    membership: 'Annual membership is open.',
    membership_url: 'https://assoc.example/join',
    give_url: 'https://assoc.example/donate',
    meetings: 'Second Tuesday monthly',
  });
  assert.equal(organization.join.url, 'https://assoc.example/join');
  assert.equal(organization.giving.url, 'https://assoc.example/donate');
  assert.equal(Array.isArray(organization.events), true);

  const event = normalize('event', 'festivals', {
    venue_name: 'Town Hall',
    tickets_url: 'https://tickets.example/fest',
  });
  assert.equal(event.venue, 'Town Hall');
  assert.equal(event.tickets, 'https://tickets.example/fest');

  const generic = normalize('business', 'unmatched-category', {
    booking_url: 'https://biz.example/book',
    highlights: ['Late hours', 'Family owned'],
  });
  assert.equal(generic.booking, 'https://biz.example/book');
  assert.deepEqual(generic.services, ['Late hours', 'Family owned']);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderSignatureCustomerShell} from '../../assets/events/signature/customer-a.mjs';
const html=readFileSync(new URL('../../events/giannis-ploutarchos-andromache-toronto-2027/index.html',import.meta.url),'utf8');
test('first HTML includes the same real concert shell used by client hydration',()=>{assert.ok(html.includes(renderSignatureCustomerShell()));assert.doesNotMatch(html,/Opening your night/);assert.match(html,/<h1>Giannis/);assert.match(html,/rel="preload" as="image" href="\/assets\/events\/signature\/poster.jpg"/);});
test('scene styles are available before the room is rendered',()=>{for(const name of ['customer-a','venue-experience','experience','lounge-scene','concert-scene','furnished-concert'])assert.ok(html.indexOf(`/assets/events/signature/${name}.css`)<html.indexOf('</head>'));});

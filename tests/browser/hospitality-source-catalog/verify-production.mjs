import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

// Read-only acceptance of the reviewed AMARA canary. Does not submit a plan,
// send an enquiry, enter the booking provider or mutate an account.
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/home/codespace/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',
  args: ['--no-sandbox'], headless: true,
});
const expected = [
  ['Deluxe Sea View Room', 'https://www.amarahotel.com/room/deluxe-sea-view-room/'],
  ['Deluxe Grand Sea View Room', 'https://www.amarahotel.com/room/deluxe-grand-sea-view-room/'],
];
const results = [];
try {
  for (const width of [390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('https://zoi.city/business/amara-hotel-limassol', { waitUntil: 'networkidle' });
    const hotel = await page.locator('#hospitality-data').evaluate(node => JSON.parse(node.textContent).hotel);
    assert.equal(hotel.id, '361c983b-29aa-4b4a-8bfa-ca4a17993e40');
    assert.equal(hotel.hero, 'https://www.amarahotel.com/wp-content/uploads/media/website/Suite-Terrace-2-1920x1201.jpg');
    assert.equal(hotel.provider, 'https://amarahotel.reserve-online.net/');
    assert.deepEqual(hotel.rooms.map(row => [row.name, row.source]), expected);
    assert.deepEqual(hotel.socials.map(row => row.url).sort(), [
      'https://www.youtube.com/channel/UCFEvGR2j5wEBcSIAkK29kwQ',
      'https://www.facebook.com/AmaraHotelCy/',
      'https://www.instagram.com/amarahotelcy/',
    ].sort());
    for (const [index, [name, url]] of expected.entries()) {
      const id = hotel.rooms[index].id;
      const button = page.locator(`[data-detail="${id}"]`);
      await button.click();
      const dialog = page.locator('#hh-dialog');
      assert(await dialog.isVisible());
      assert.equal(await dialog.locator('h2').textContent(), name);
      assert.equal(await dialog.locator('a').getAttribute('href'), url);
      assert.match(await dialog.textContent(), /availability and price depend on your dates/);
      await page.screenshot({ path: `/tmp/amara-production-room-${index}-${width}.png` });
      await page.keyboard.press('Escape');
      assert(await button.evaluate(node => document.activeElement === node));
      await page.locator(`[data-shortlist="${id}"]`).click();
      assert.equal(await page.locator('#hh-plan select[name="room"]').inputValue(), id);
      assert(await page.locator('#hh-plan input[name="arrive"]').evaluate(node => document.activeElement === node));
    }
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.deepEqual(errors, []);
    results.push({ width, rooms: 2, modalAndSource: true, focusAndShortlist: true, priorContentPreserved: true });
    await page.close();
  }
  console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }

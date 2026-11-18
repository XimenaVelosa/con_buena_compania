const { chromium } = require('../.local/qa/node_modules/playwright-core');
const assert = require('node:assert/strict');
const { mkdir } = require('node:fs/promises');
const path = require('node:path');

(async () => {
  const base = (process.env.CRM_FRONTEND_URL || 'http://127.0.0.1:4173').replace(/\/+$/, '');
  const artifacts = path.resolve(__dirname, '../.local/qa-artifacts');
  await mkdir(artifacts, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CRM_BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const widths = process.env.CRM_QA_WIDTHS ? process.env.CRM_QA_WIDTHS.split(',').map(Number) : [320, 375, 390, 768, 1024, 1440];
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      const page = await context.newPage();
      const errors = [];
      const failedAssets = [];
      const privateRequests = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('response', (response) => {
        if (response.status() >= 400 && /\/(?:images\/|fonts\/|landing\.|brand-logo\.png)/.test(new URL(response.url()).pathname)) failedAssets.push(`${response.status()} ${new URL(response.url()).pathname}`);
      });
      page.on('request', (request) => { if (/\/api\/|:3001\//.test(request.url())) privateRequests.push(request.url()); });
      await page.route('http://127.0.0.1:3001/**', (route) => route.fulfill({ status: 401, contentType: 'application/json', body: '{"message":"Ingresa para continuar."}', headers: { 'Access-Control-Allow-Origin': new URL(base).origin, 'Access-Control-Allow-Credentials': 'true' } }));
      const response = await page.goto(base, { waitUntil: 'networkidle' });
      assert.equal(response.status(), 200);
      await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.evaluate(() => document.fonts.check('800 16px Nunito')), true, 'Self-hosted brand font is loaded');
      assert.equal(await page.locator('.service-card').count(), 8);
      assert.equal(await page.locator('input[type=file], #client-form').count(), 0, 'Public landing has no authoring controls or CRM form');
      assert.equal(await page.locator('.brand img').getAttribute('src'), '/brand-logo.png');
      assert.equal(await page.locator('.footer-brand img').getAttribute('src'), '/brand-logo.png');
      const logoRatio = await page.locator('.brand img').evaluate((image) => { const rect = image.getBoundingClientRect(); return { rendered: rect.width / rect.height, original: image.naturalWidth / image.naturalHeight, width: image.naturalWidth }; });
      assert.equal(logoRatio.width, 2428);
      assert.ok(Math.abs(logoRatio.rendered - logoRatio.original) < .01, 'Original logo proportions are preserved');
      async function checkBounds(label) {
        const bounds = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, viewport: innerWidth, overflowing: [...document.querySelectorAll('.site-header,.hero-copy,.hero-visual,.section-heading,.scope-note,.duration-options,.estimate,.footer-top,.footer-bottom')].filter((element) => { const r = element.getBoundingClientRect(); return r.width > 0 && (r.left < -1 || r.right > innerWidth + 1); }).map((element) => element.className) }));
        assert.ok(bounds.page <= bounds.viewport + 1, `${width}px ${label}: document overflow ${JSON.stringify(bounds)}`);
        assert.deepEqual(bounds.overflowing, [], `${width}px ${label}: content stays inside viewport`);
      }
      await checkBounds('landing');
      const menu = page.locator('#menu-toggle');
      if (await menu.isVisible()) {
        await menu.click();
        assert.equal(await menu.getAttribute('aria-expanded'), 'true');
        await checkBounds('mobile menu');
        await page.locator('#public-navigation').getByRole('link', { name: 'Tarifas', exact: true }).click();
        assert.equal(await menu.getAttribute('aria-expanded'), 'false');
        await menu.click();
        await page.keyboard.press('Escape');
        assert.equal(await menu.getAttribute('aria-expanded'), 'false');
      }
      for (const [hours, total] of [[4, '$100.000'], [8, '$200.000'], [2, '$50.000']]) {
        await page.locator(`[data-hours="${hours}"]`).click();
        assert.equal(await page.locator('#price-estimate').textContent(), total);
        assert.equal(await page.locator('[data-hours][aria-pressed=true]').count(), 1);
        const link = new URL(await page.locator('#quote-email').getAttribute('href'));
        assert.equal(link.protocol, 'mailto:');
        assert.equal(link.pathname, 'gerencia@conbuenacompania.com');
        assert.ok(link.searchParams.get('subject').includes(`${hours} horas`));
        assert.ok(link.searchParams.get('body').includes(total));
        assert.ok(link.searchParams.get('body').includes('IVA incluido'));
      }
      await page.locator('#public-activities').scrollIntoViewIfNeeded();
      await page.locator('#activities-next').click();
      await page.waitForFunction(() => document.querySelector('#public-activities').scrollLeft > 5);
      await page.locator('#public-activities').focus();
      await page.keyboard.press('End');
      await page.waitForFunction(() => document.querySelector('#activities-next').disabled);
      await page.keyboard.press('Home');
      await page.waitForFunction(() => document.querySelector('#activities-previous').disabled);
      for (const index of (width === 320 ? [0, 1, 2, 3, 4, 5, 6, 7] : [0, 7])) {
        const link = page.locator('[data-service]').nth(index);
        const title = await link.locator('xpath=..').locator('h3').textContent();
        await link.click();
        await page.locator('#service-dialog').waitFor({ state: 'visible' });
        assert.equal(await page.locator('#service-dialog-title').textContent(), title);
        assert.ok((await page.locator('#service-dialog-description').textContent()).length > 60);
        assert.ok((await page.locator('#service-dialog-exclusions').textContent()).includes('oficios domésticos'));
        const contact = new URL(await page.locator('#service-email').getAttribute('href'));
        assert.ok(contact.searchParams.get('subject').includes(title));
        await page.locator('.service-considerations summary').click();
        assert.equal(await page.locator('#service-dialog-considerations').isVisible(), true);
        await page.locator('#service-dialog').evaluate((element) => { element.scrollTop = element.scrollHeight; });
        const close = await page.locator('#service-dialog-close').boundingBox();
        assert.ok(close.y >= 0 && close.y + close.height <= 901, 'Dialog close control remains available while scrolling');
        assert.equal(await page.locator('#service-dialog').evaluate((element) => element.scrollWidth <= element.clientWidth + 1), true, 'Dialog has no horizontal overflow');
        if (index === 0 && [390, 1440].includes(width)) await page.locator('#service-dialog').screenshot({ path: path.join(artifacts, `landing-detail-${width}.png`) });
        await page.keyboard.press('Escape');
        await page.locator('#service-dialog').waitFor({ state: 'hidden' });
        assert.equal(await link.evaluate((element) => document.activeElement === element), true, 'Focus returns to activity link');
      }
      await checkBounds('after modal');
      await page.locator('.site-footer').scrollIntoViewIfNeeded();
      await page.waitForFunction(() => document.querySelector('.footer-brand img').naturalWidth > 0);
      assert.deepEqual(privateRequests, [], 'Public landing does not request private CRM data');
      assert.deepEqual(failedAssets, []);
      if ([390, 1440].includes(width)) {
        await page.locator('#public-activities').evaluate((element) => { element.scrollLeft = 0; });
        await page.evaluate(() => scrollTo(0, 0));
        await page.screenshot({ path: path.join(artifacts, `landing-hero-${width}.png`) });
        await page.screenshot({ path: path.join(artifacts, `landing-full-${width}.png`), fullPage: true });
      }
      await page.locator('header [data-crm-link]').click();
      await page.waitForURL((url) => url.pathname === '/crm');
      await page.locator('#login-screen').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#client-form').isVisible(), false);
      await page.locator('.login-card .crm-back-to-site').click();
      await page.locator('.hero').waitFor({ state: 'visible' });
      assert.equal(new URL(page.url()).pathname, '/');
      await page.goto(`${base}/#clients`);
      await page.waitForURL((url) => url.pathname === '/crm' && url.hash === '#clients');
      await page.locator('#login-screen').waitFor({ state: 'visible' });
      assert.deepEqual(errors, [], 'No JavaScript errors in landing or CRM entry');
      console.log(`OK ${width}px: original logo, mobile menu, eight service details, calculator, email links, carousel, CRM access and legacy links; no overflow.`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });

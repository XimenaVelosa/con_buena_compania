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
        if (response.status() >= 400 && /\/(?:images\/|fonts\/|landing[.-]|brand-logo\.png)/.test(new URL(response.url()).pathname)) failedAssets.push(`${response.status()} ${new URL(response.url()).pathname}`);
      });
      page.on('request', (request) => {
        if (new URL(request.url()).pathname.endsWith('/service-requests/options')) return;
        if (/\/api\/|:3001\//.test(request.url())) privateRequests.push(request.url());
      });
      await page.route('http://127.0.0.1:3001/**', (route) => route.fulfill({ status: 401, contentType: 'application/json', body: '{"message":"Ingresa para continuar."}', headers: { 'Access-Control-Allow-Origin': new URL(base).origin, 'Access-Control-Allow-Credentials': 'true' } }));
      await page.route('**/service-requests/options', (route) => route.fulfill({
        json: {
          groups: [
            { title: 'Compras y diligencias', activities: [
              { id: 'personal-errands', title: 'Acompañamiento a diligencias bancarias, notariales o administrativas', description: 'Vamos con la persona a la entidad.', exclusions: ['Firmar por la persona.'] },
              { id: 'delegated-errands', title: 'Diligencias por encargo', description: 'Radicar, recoger o entregar documentos con autorización.', exclusions: ['Hacer trámites que exijan presencia personal.'] },
            ] },
            { title: 'Vida espiritual', activities: [{ id: 'religious-companionship', title: 'Acompañamiento religioso', description: 'Compañía para rezar el rosario o asistir a misa.', exclusions: ['Oficiar ceremonias.'] }] },
          ],
          days: ['Lunes'],
          departments: { 17: { name: 'Caldas', municipalities: { 17001: 'Manizales' } } },
          notice: { version: 'QA', text: 'Autorizo el contacto para responder mi solicitud.' },
        },
        headers: { 'Access-Control-Allow-Origin': new URL(base).origin },
      }));
      const response = await page.goto(base, { waitUntil: 'networkidle' });
      assert.equal(response.status(), 200);
      await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.evaluate(() => document.fonts.check('800 16px Nunito')), true, 'Self-hosted brand font is loaded');
      assert.equal(await page.locator('.service-card').count(), 10);
      assert.equal(await page.locator('input[type=file], #client-form').count(), 0, 'Public landing has no authoring controls or CRM form');
      assert.equal(await page.locator('.brand img').getAttribute('src'), '/brand-logo.png');
      assert.equal(await page.locator('.footer-brand img').getAttribute('src'), '/brand-logo.png');
      const logoRatio = await page.locator('.brand img').evaluate((image) => { const rect = image.getBoundingClientRect(); return { rendered: rect.width / rect.height, original: image.naturalWidth / image.naturalHeight, width: image.naturalWidth }; });
      assert.equal(logoRatio.width, 2428);
      assert.ok(Math.abs(logoRatio.rendered - logoRatio.original) < .01, 'Original logo proportions are preserved');
      async function checkBounds(label) {
        const bounds = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, viewport: innerWidth, overflowing: [...document.querySelectorAll('.site-header,.hero-copy,.hero-visual,.section-heading,.scope-note,.contact-inner,.footer-top,.footer-bottom')].filter((element) => { const r = element.getBoundingClientRect(); return r.width > 0 && (r.left < -1 || r.right > innerWidth + 1); }).map((element) => element.className) }));
        assert.ok(bounds.page <= bounds.viewport + 1, `${width}px ${label}: document overflow ${JSON.stringify(bounds)}`);
        assert.deepEqual(bounds.overflowing, [], `${width}px ${label}: content stays inside viewport`);
      }
      await checkBounds('landing');
      const menu = page.locator('#menu-toggle');
      if (await menu.isVisible()) {
        await menu.click();
        assert.equal(await menu.getAttribute('aria-expanded'), 'true');
        await checkBounds('mobile menu');
        await page.locator('#public-navigation').getByRole('link', { name: 'Cómo funciona', exact: true }).click();
        assert.equal(await menu.getAttribute('aria-expanded'), 'false');
        await menu.click();
        await page.keyboard.press('Escape');
        assert.equal(await menu.getAttribute('aria-expanded'), 'false');
      }
      assert.equal(await page.locator('#tarifas, [href="#tarifas"], [data-hours], #price-estimate').count(), 0);
      if (await menu.isVisible()) await menu.click();
      await page.getByRole('link', { name: 'Solicitar compañía' }).click();
      await page.waitForURL((url) => url.hash === '#contacto');
      const contactLink = new URL(await page.locator('#contacto .contact-email').getAttribute('href'));
      assert.equal(contactLink.protocol, 'mailto:');
      assert.equal(contactLink.pathname, 'gerencia@conbuenacompania.com');
      await page.getByRole('button', { name: 'Hablemos' }).click();
      await page.locator('#request-next').click();
      assert.ok(await page.locator('#request-activity-error').isVisible());
      assert.equal(await page.locator('#request-details').isVisible(), false);
      await page.getByRole('checkbox', { name: 'Acompañamiento religioso' }).check();
      await page.locator('#request-groups [value=personal-errands]').check();
      await page.locator('#request-groups [value=delegated-errands]').check();
      assert.equal(await page.locator('#request-groups input:checked').count(), 3);
      await page.locator('#request-next').click();
      await page.locator('#request-details input[name=department]').fill('caldas');
      assert.equal(await page.locator('#request-municipalities option').getAttribute('value'), 'Manizales');
      await page.locator('#request-close').click();
      assert.equal(await page.locator('#request-dialog').isVisible(), false);
      await page.locator('#public-activities').scrollIntoViewIfNeeded();
      await page.locator('#activities-next').click();
      await page.waitForFunction(() => document.querySelector('#public-activities').scrollLeft > 5);
      await page.locator('#public-activities').focus();
      await page.keyboard.press('End');
      await page.waitForFunction(() => document.querySelector('#activities-next').disabled);
      await page.keyboard.press('Home');
      await page.waitForFunction(() => document.querySelector('#activities-previous').disabled);
      for (const index of (width === 320 ? [...Array(10).keys()] : [0, 2, 3, 9])) {
        const link = page.locator('[data-service]').nth(index);
        const title = await link.locator('xpath=..').locator('h3').textContent();
        await link.click();
        await page.locator('#service-dialog').waitFor({ state: 'visible' });
        assert.equal(await page.locator('#service-dialog-title').textContent(), title);
        assert.ok((await page.locator('#service-dialog-description').textContent()).length > 60);
        assert.ok((await page.locator('#service-dialog-exclusions').textContent()).includes('oficios domésticos'));
        const contact = new URL(await page.locator('#service-email').getAttribute('href'));
        assert.ok(contact.searchParams.get('subject').includes(title));
        assert.equal(await page.locator('#service-video-placeholder').isVisible(), true, 'Missing video shows an honest placeholder');
        assert.equal(await page.locator('#service-video').isVisible(), false);
        assert.equal(await page.locator('#service-video').getAttribute('src'), null);
        assert.equal(await page.locator('#service-video-error').isVisible(), false);
        const frame = await page.locator('.service-video-frame').boundingBox();
        assert.ok(Math.abs(frame.width / frame.height - 16 / 9) < .02, 'Video stays 16:9 at every viewport');
        if (index === 0 && [390, 1440].includes(width)) {
          await page.locator('.service-experience').scrollIntoViewIfNeeded();
          await page.locator('#service-dialog').screenshot({ path: path.join(artifacts, `landing-video-${width}.png`) });
        }
        assert.equal(await page.locator('#service-dialog-exclusions').isVisible(), true);
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
      assert.equal(await page.locator('[data-crm-link]').count(), 1);
      await page.locator('footer [data-crm-link]').click();
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
      console.log(`OK ${width}px: original logo, mobile menu, activity details, companionship requests, email links, carousel, CRM access and legacy links; no overflow.`);
      await context.close();
    }

    // A short in-memory clip exercises the real native player without publishing sample media.
    const fixturePage = await browser.newPage();
    const clip = Buffer.from(await fixturePage.evaluate(async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 160; canvas.height = 90;
      const context = canvas.getContext('2d');
      const stream = canvas.captureStream(12);
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      const chunks = [];
      const recorded = new Promise((resolve) => {
        recorder.ondataavailable = (event) => chunks.push(event.data);
        recorder.onstop = () => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result.split(',')[1]);
          reader.readAsDataURL(new Blob(chunks, { type: 'video/webm' }));
        };
      });
      recorder.start();
      let frame = 0;
      const timer = setInterval(() => { context.fillStyle = frame++ % 2 ? '#13294b' : '#00aba6'; context.fillRect(0, 0, 160, 90); }, 80);
      await new Promise((resolve) => setTimeout(resolve, 900));
      clearInterval(timer); recorder.stop();
      const result = await recorded;
      stream.getTracks().forEach((track) => track.stop());
      return result;
    }), 'base64');
    await fixturePage.close();
    assert.ok(clip.length > 100, 'Playable test clip was recorded');
    for (const width of [390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      let videoRequests = 0;
      await page.route('**/videos/qa-player.webm', (route) => { videoRequests++; return route.fulfill({ contentType: 'video/webm', body: clip }); });
      await page.addInitScript(() => { window.CBC_ACTIVITY_VIDEOS = { 'medical-appointments': { src: '/videos/qa-player.webm' } }; });
      await page.goto(base, { waitUntil: 'networkidle' });
      assert.equal(videoRequests, 0, 'No video download on landing load');
      const first = page.locator('[data-service="medical-appointments"]');
      await first.click();
      const video = page.locator('#service-video');
      assert.equal(await video.isVisible(), true);
      assert.equal(await page.locator('#service-video-placeholder').isVisible(), false);
      assert.deepEqual(await video.evaluate((element) => ({ controls: element.controls, inline: element.playsInline, autoplay: element.autoplay, paused: element.paused, preload: element.preload })), { controls: true, inline: true, autoplay: false, paused: true, preload: 'none' });
      await video.scrollIntoViewIfNeeded();
      await video.evaluate(async (element) => { element.muted = true; await element.play(); });
      await page.waitForFunction(() => document.querySelector('#service-video').currentTime > .05);
      assert.ok(videoRequests > 0, 'Native player loads and plays configured media');
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => { const video = document.querySelector('#service-video'); return video.paused && !video.hasAttribute('src'); });
      await page.locator('[data-service="wellbeing-company"]').click();
      assert.equal(await video.getAttribute('src'), null, 'An activity without media does not inherit another video');
      assert.equal(await page.locator('#service-video-placeholder').isVisible(), true);
      await page.keyboard.press('Escape');
      await page.evaluate(() => { window.CBC_ACTIVITY_VIDEOS['medical-appointments'] = { src: '/videos/missing-qa.webm' }; });
      await first.click();
      await video.scrollIntoViewIfNeeded();
      await video.evaluate((element) => { element.load(); });
      await page.locator('#service-video-error').waitFor({ state: 'visible' });
      await page.evaluate(() => { window.CBC_ACTIVITY_VIDEOS['medical-appointments'] = { src: '/videos/qa-player.webm' }; });
      await page.locator('#service-video-retry').click();
      assert.equal(await video.isVisible(), true);
      assert.equal(await page.locator('#service-video-error').isVisible(), false);
      await video.evaluate(async (element) => { await element.play(); });
      await page.waitForFunction(() => document.querySelector('#service-video').currentTime > .05);
      await page.locator('#service-dialog-close').click();
      await page.waitForFunction(() => !document.querySelector('#service-video').hasAttribute('src'));
      console.log(`OK ${width}px: native video playback, no autoplay, activity isolation, stop on close, load failure and retry.`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });

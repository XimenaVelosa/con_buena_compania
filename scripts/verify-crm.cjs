// Optional browser QA: npm install --prefix .local/qa --no-save --package-lock=false playwright-core
const { chromium } = require('../.local/qa/node_modules/playwright-core');
const assert = require('node:assert/strict');
const { mkdir } = require('node:fs/promises');
const path = require('node:path');

(async () => {
  const executablePath = process.env.CRM_BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const browser = await chromium.launch({ executablePath, headless: true });
  const artifacts = path.resolve(__dirname, '../.local/qa-artifacts');
  await mkdir(artifacts, { recursive: true });
  try {
    for (const width of [320, 375, 390, 768, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      let authenticated = false;
      let changed = false;
      const user = { id: 'qa-user', username: 'admin', displayName: 'Administración', role: 'admin', mustChangePassword: true };
      const record = { id: '11111111-1111-4111-8111-111111111111', fullName: 'Cliente de prueba', phone: '3001234567', address: 'Calle 10 #20-30, Bogotá', visitDate: '2026-11-16', visitTime: '08:55', visitLocation: 'Calle 10 #20-30, Bogotá', visitAgentName: 'Responsable de visita', createdAt: '2026-11-16T10:00:00Z', independentActivities: '["Lectura"]' };
      record.emergencyContacts = JSON.stringify([{ type: 'guardian', fullName: 'Acudiente QA', idNumber: '001234567', address: 'Calle del acudiente 20', phone: '+57 300 123 4567' }, { type: 'additional', fullName: 'Contacto QA', idNumber: '00098765', address: 'Carrera de emergencia 30', phone: '+57 311 222 3344' }]);
      await page.route('http://127.0.0.1:3001/**', async (route) => {
        const url = new URL(route.request().url());
        let status = 200;
        let data;
        if (url.pathname === '/auth/login') { authenticated = true; data = { user: { ...user, mustChangePassword: !changed } }; }
        else if (!authenticated) { status = 401; data = { message: 'Ingresa para continuar.' }; }
        else if (url.pathname === '/auth/change-password') { changed = true; data = { user: { ...user, mustChangePassword: false } }; }
        else if (url.pathname === '/auth/logout') { authenticated = false; data = { ok: true }; }
        else if (url.pathname === '/auth/session') data = { user: { ...user, mustChangePassword: !changed } };
        else if (url.pathname === '/clients' && route.request().method() === 'POST') {
          const saved = route.request().postDataJSON();
          assert.equal(saved.payerName, 'Acudiente QA');
          assert.equal(saved.guardianIdNumber, '001234567');
          assert.equal(saved.guardianAddress, 'Calle del acudiente 20');
          assert.equal(saved.guardianPhone, '+57 300 123 4567');
          assert.deepEqual(JSON.parse(saved.emergencyContacts), JSON.parse(record.emergencyContacts));
          data = record;
        }
        else if (url.pathname === '/clients') data = [record];
        else data = record;
        await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data), headers: { 'Access-Control-Allow-Origin': 'http://127.0.0.1:4173', 'Access-Control-Allow-Credentials': 'true' } });
      });
      async function checkBounds(label) {
        const overflowing = await page.evaluate(() => [...document.querySelectorAll('body *')].filter((element) => {
          const style = getComputedStyle(element);
          const bounds = element.getBoundingClientRect();
          return style.visibility !== 'hidden' && bounds.width > 0 && bounds.height > 0 && (bounds.right > innerWidth + 1 || bounds.left < -1);
        }).map((element) => `${element.tagName}.${element.className}`));
        assert.deepEqual(overflowing, [], `${width}px ${label}: horizontal overflow`);
      }
      await page.goto('http://127.0.0.1:4173');
      await page.locator('#login-error').waitFor({ state: 'attached' });
      await checkBounds('login');
      await page.locator('#login-user').fill('admin');
      await page.locator('#login-password').fill('initial-password');
      await page.locator('#login-submit').click();
      await page.locator('#password-screen').waitFor({ state: 'visible' });
      await checkBounds('password');
      await page.locator('#current-password').fill('initial-password');
      await page.locator('#new-password').fill('a-personal-password');
      await page.locator('#confirm-password').fill('a-personal-password');
      await page.locator('#password-form button[type=submit]').click();
      await page.locator('#recent-records [data-detail]').waitFor();
      await checkBounds('dashboard');
      if ([390, 1440].includes(width)) await page.screenshot({ path: path.join(artifacts, `crm-${width}.png`), fullPage: true });
      await page.locator('[data-route=clients]').click();
      await page.locator('#client-search').fill('Bogota');
      assert.equal(await page.locator('#client-records .record-card').count(), 1);
      await checkBounds('clients');
      await page.locator('#client-records [data-detail]').click();
      await page.locator('#detail-content .detail-section').first().waitFor();
      assert.equal(await page.locator('#detail-content .detail-section').count(), 7);
      assert.ok((await page.locator('#detail-content').textContent()).includes('Contacto QA'));
      assert.ok(!(await page.locator('#detail-content').textContent()).includes('[object Object]'));
      await checkBounds('detail');
      await page.locator('#close-detail').click();
      await page.evaluate(() => { location.hash = 'new-visit'; });
      await page.locator('#client-form').waitFor({ state: 'visible' });
      await page.locator('[name=visitDate]').fill('2026-11-16');
      await page.locator('[name=visitTime]').fill('08:55');
      await page.locator('[name=visitLocation]').fill('Calle 10');
      await checkBounds('visit 1');
      const widths = await page.evaluate(() => ['visitDate', 'visitTime', 'visitLocation'].map((name) => document.querySelector(`[name=${name}]`).getBoundingClientRect().width));
      if (width < 701) assert.ok(Math.max(...widths) - Math.min(...widths) < 2, 'Mobile input widths should match');
      if (width === 390) await page.screenshot({ path: path.join(artifacts, 'visit-mobile.png'), fullPage: true });
      await page.locator('#next-button').click();
      assert.equal(await page.locator('[name=address]').inputValue(), 'Calle 10');
      await page.locator('[name=fullName]').fill('Persona QA');
      await page.locator('[name=address]').fill('Dirección distinta');
      await checkBounds('visit 2');
      await page.locator('#back-button').click();
      await page.locator('#next-button').click();
      assert.equal(await page.locator('[name=address]').inputValue(), 'Dirección distinta');
      for (let stage = 2; stage < 7; stage++) {
        await page.locator('#next-button').click();
        if (stage === 2) {
          await page.locator('[name=payerName]').fill('Acudiente QA');
          await page.locator('[name=guardianIdNumber]').fill('001234567');
          await page.locator('[name=guardianAddress]').fill('Calle del acudiente 20');
          await page.locator('[name=guardianPhone]').fill('+57 300 123 4567');
          if (width === 390) await page.screenshot({ path: path.join(artifacts, 'guardian-mobile.png'), fullPage: true });
        }
        if (stage === 6) {
          await page.locator('#emergency-use-guardian').check();
          assert.ok((await page.locator('#emergency-guardian-summary').textContent()).includes('Acudiente QA'));
          await page.locator('#emergency-add-other').check();
          await page.locator('#save-button').click();
          assert.ok((await page.locator('#emergency-contact-error').textContent()).length > 0);
          await page.locator('[data-emergency-field=fullName]').fill('Contacto QA');
          await page.locator('[data-emergency-field=idNumber]').fill('00098765');
          await page.locator('[data-emergency-field=address]').fill('Carrera de emergencia 30');
          await page.locator('[data-emergency-field=phone]').fill('+57 311 222 3344');
          assert.equal(await page.evaluate(() => JSON.parse(window.CBC_EMERGENCY.serialize()).length), 2);
          await page.locator('#emergency-add-other').uncheck();
          assert.equal(await page.evaluate(() => JSON.parse(window.CBC_EMERGENCY.serialize()).length), 1);
          await page.locator('#emergency-add-other').check();
          assert.equal(await page.locator('[data-emergency-field=fullName]').inputValue(), 'Contacto QA');
          await page.locator('#emergency-use-guardian').uncheck();
          assert.equal(await page.evaluate(() => JSON.parse(window.CBC_EMERGENCY.serialize())[0].type), 'additional');
          await page.locator('#emergency-use-guardian').check();
          await page.locator('#emergency-edit-guardian').click();
          await page.locator('[name=payerName]').fill('Acudiente actualizado');
          await page.locator('.progress-step[data-step="6"]').click();
          assert.ok((await page.locator('#emergency-guardian-summary').textContent()).includes('Acudiente actualizado'));
          await page.locator('#emergency-edit-guardian').click();
          await page.locator('[name=payerName]').fill('Acudiente QA');
          await page.locator('.progress-step[data-step="6"]').click();
          await page.reload();
          await page.locator('#crm-app').waitFor({ state: 'visible' });
          await page.locator('.progress-step[data-step="6"]').click();
          assert.equal(await page.locator('#emergency-use-guardian').isChecked(), true);
          assert.equal(await page.locator('#emergency-add-other').isChecked(), true);
          assert.equal(await page.locator('[data-emergency-field=fullName]').inputValue(), 'Contacto QA');
          if (width === 390) await page.screenshot({ path: path.join(artifacts, 'emergency-mobile.png'), fullPage: true });
        }
        await checkBounds(`visit ${stage + 1}`);
      }
      await page.locator('#save-button').click();
      await page.locator('#success-message').waitFor({ state: 'visible' });
      await checkBounds('saved');
      await page.locator('#logout-button').click();
      await page.locator('#login-screen').waitFor({ state: 'visible' });
      assert.deepEqual(errors, [], 'No browser JS errors');
      console.log(`OK ${width}px: login, password, CRM, search, detail, seven stages, save, logout; no horizontal overflow.`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });

// Optional browser QA: npm install --prefix .local/qa --no-save --package-lock=false playwright-core
const { chromium } = require('../.local/qa/node_modules/playwright-core');
const assert = require('node:assert/strict');
const { mkdir, readFile } = require('node:fs/promises');
const path = require('node:path');

(async () => {
  const executablePath = process.env.CRM_BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const browser = await chromium.launch({ executablePath, headless: true });
  const artifacts = path.resolve(__dirname, '../.local/qa-artifacts');
  await mkdir(artifacts, { recursive: true });
  const activityFixture = process.env.CRM_ACTIVITY_FIXTURE ? JSON.parse(await readFile(process.env.CRM_ACTIVITY_FIXTURE, 'utf8')) : {
    version: 'QA-ACT-v1', hash: 'd'.repeat(64), introduction: 'Actividades de interés. Con Buena Compañía no presta transporte; los acompañantes no conducen. Si necesita taxi, registre un contacto o autorice su coordinación.', scopeNotice: 'En ninguna actividad se permite conducir vehículos ni realizar oficios domésticos, como lavar platos, cocinar o limpiar.', commonExclusion: 'No se permite conducir ni realizar oficios domésticos.', taxiAuthorizationText: 'Autorizo a coordinar un taxi de confianza prestado por un tercero.',
    activities: ['Citas médicas, terapias o exámenes', 'Mercado y compras del hogar', 'Acompañamiento a diligencias bancarias, notariales o administrativas', 'Compras personales', 'Recogida en farmacia', 'Trámites institucionales', 'Equipos y herramientas digitales', 'Compañía, bienestar y juegos', 'Acompañamiento religioso', 'Diligencias por encargo', 'Álbum familiar'].map((title, index) => ({ id: `qa-activity-${index + 1}`, title, description: 'Acompañamiento respetuoso según el alcance de esta actividad.', exclusions: ['No representar a la persona ni tomar decisiones por ella.', 'No realizar tareas ajenas al acompañamiento.'] })),
  };
  try {
    for (const width of (process.env.CRM_QA_WIDTHS ? process.env.CRM_QA_WIDTHS.split(',').map(Number) : [320, 375, 390, 768, 1440])) {
      const activityCatalog = structuredClone(activityFixture);
      const expectedTransport = width === 390 ? 'authorize-taxi' : width === 1440 ? 'not-needed' : 'trusted-taxi';
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      let authenticated = false;
      let pendingPassword = false;
      let posts = 0;
      let activityCatalogOffline = false;
      const privacy = { configured: width === 1440, version: 'QA-v1', hash: 'a'.repeat(64), paragraphs: [
        { title: 'Autorización para el acompañamiento', text: 'Aviso de prueba: información reservada para evaluar, organizar y prestar el acompañamiento.' },
        { title: 'Reserva y derechos', text: 'La persona puede consultar y rectificar su información a través del equipo que gestiona el servicio. La política de tratamiento de datos aún no está publicada.' },
        { title: 'Datos sensibles: decisión separada y voluntaria', text: 'La persona puede continuar sin suministrar datos de salud ni autorizar su tratamiento.' },
        { title: 'Declaración de veracidad y colaboración', text: 'La persona declara de buena fe información veraz y actualizada, sin ocultar deliberadamente circunstancias conocidas relevantes para la seguridad.' },
        { title: 'Quién puede autorizar', text: 'El titular o su representante legitimado debe manifestar la autorización.' },
      ] };
      const user = { id: 'qa-user', username: 'admin', displayName: 'Administración', role: 'admin', mustChangePassword: false };
      const record = { id: '11111111-1111-4111-8111-111111111111', fullName: 'Cliente de prueba', phone: '3001234567', address: 'Calle 10 #20-30, Bogotá', visitDate: '2026-11-16', visitTime: '08:55', visitLocation: 'Calle 10 #20-30, Bogotá', visitAgentName: 'Responsable de visita', createdAt: '2026-11-16T10:00:00Z', independentActivities: '["Lectura"]' };
      record.emergencyContacts = JSON.stringify([{ type: 'guardian', fullName: 'Acudiente QA', idNumber: '001234567', address: 'Calle del acudiente 20', phone: '+57 300 123 4567' }, { type: 'additional', fullName: 'Contacto QA', idNumber: '00098765', address: 'Carrera de emergencia 30', phone: '+57 311 222 3344' }]);
      await page.route('http://127.0.0.1:3001/**', async (route) => {
        const url = new URL(route.request().url());
        let status = 200;
        let data;
        if (url.pathname === '/auth/login') { authenticated = true; data = { user: { ...user, mustChangePassword: pendingPassword } }; }
        else if (!authenticated) { status = 401; data = { message: 'Ingresa para continuar.' }; }
        else if (url.pathname === '/auth/logout') { authenticated = false; data = { ok: true }; }
        else if (url.pathname === '/auth/session') data = { user };
        else if (url.pathname === '/clients/privacy-notice') data = privacy;
        else if (url.pathname === '/clients/activity-options') {
          if (activityCatalogOffline) { status = 503; data = { message: 'Catálogo temporalmente no disponible.' }; }
          else data = activityCatalog;
        }
        else if (url.pathname === '/clients' && route.request().method() === 'POST') {
          const saved = route.request().postDataJSON();
          posts++;
          assert.equal(saved.authorization.personalData, true);
          assert.equal(saved.authorization.truthfulness, true);
          assert.equal(saved.authorization.sensitiveData, false);
          assert.equal(saved.authorization.signerName, 'Titular QA');
          assert.equal(saved.authorization.version, privacy.version);
          assert.equal(saved.authorization.noticeHash, privacy.hash);
          for (const field of ['mobilityNeeds', 'mobilityNotes', 'medicationSupport', 'personalCareSupport']) assert.equal(saved[field], undefined);
          assert.equal(saved.payerName, 'Acudiente QA');
          assert.equal(saved.guardianIdNumber, '001234567');
          assert.equal(saved.guardianAddress, 'Calle del acudiente 20');
          assert.equal(saved.guardianPhone, '+57 300 123 4567');
          assert.deepEqual(JSON.parse(saved.emergencyContacts), JSON.parse(record.emergencyContacts));
          assert.equal(saved.activitySelection.catalogVersion, activityCatalog.version);
          assert.equal(saved.activitySelection.catalogHash, activityCatalog.hash);
          assert.deepEqual(saved.activitySelection.selectedIds, [activityCatalog.activities[0].id, activityCatalog.activities[7].id]);
          assert.equal(saved.activitySelection.transportMode, expectedTransport);
          assert.equal(saved.activitySelection.taxiCoordinationAuthorized, expectedTransport === 'authorize-taxi');
          assert.equal(saved.activitySelection.taxiContacts.length, expectedTransport === 'trusted-taxi' ? 2 : 0);
          if (expectedTransport === 'authorize-taxi') assert.equal(saved.activitySelection.taxiAuthorizationName, 'Acudiente QA');
          if (expectedTransport === 'trusted-taxi') assert.equal(saved.activitySelection.taxiContacts[0].name, 'Conductor QA');
          assert.equal(saved._activityTaxiMode, undefined);
          assert.equal(saved._activityDraft, undefined);
          record.independentActivities = JSON.stringify(activityCatalog.activities.filter((activity) => saved.activitySelection.selectedIds.includes(activity.id)).map((activity) => activity.title));
          record.activityPreferences = JSON.stringify({ catalogVersion: activityCatalog.version, selectedActivities: activityCatalog.activities.filter((activity) => saved.activitySelection.selectedIds.includes(activity.id)), scopeNotice: activityCatalog.scopeNotice, transportMode: expectedTransport, taxiContacts: saved.activitySelection.taxiContacts, taxiAuthorization: { accepted: saved.activitySelection.taxiCoordinationAuthorized, authorizedBy: saved.activitySelection.taxiAuthorizationName, recordedAt: new Date().toISOString(), text: activityCatalog.taxiAuthorizationText } });
          record.dataAuthorization = JSON.stringify({ ...saved.authorization, recordedAt: new Date().toISOString(), noticeText: privacy.paragraphs.map((item) => item.text).join('\n') });
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
      await page.goto('http://127.0.0.1:4173/crm');
      await page.locator('#login-error').waitFor({ state: 'attached' });
      await checkBounds('login');
      if (width === 320) {
        pendingPassword = true;
        await page.locator('#login-user').fill('admin');
        await page.locator('#login-password').fill('legacy-pending-password');
        await page.locator('#login-submit').click();
        await page.waitForFunction(() => document.querySelector('#login-error').textContent.includes('administrador debe actualizar'));
        assert.equal(await page.locator('#crm-app').isVisible(), false, 'Legacy pending accounts require backend administration');
        assert.equal(await page.locator('#password-form').count(), 0);
        pendingPassword = false;
        authenticated = false;
      }
      await page.locator('#login-user').fill('admin');
      await page.locator('#login-password').fill('admin-managed-password');
      await page.locator('#login-submit').click();
      await page.locator('#recent-records [data-detail]').waitFor();
      assert.equal(await page.locator('#account-button, #password-screen, #password-form').count(), 0, 'Password administration is unavailable in the browser');
      await checkBounds('dashboard');
      if ([390, 1440].includes(width)) await page.screenshot({ path: path.join(artifacts, `crm-${width}.png`), fullPage: true });
      await page.locator('[data-route=clients]').click();
      await page.locator('#client-search').fill('Bogota');
      assert.equal(await page.locator('#client-records .record-card').count(), 1);
      await checkBounds('clients');
      await page.locator('#client-records [data-detail]').click();
      await page.locator('#detail-content .detail-section').first().waitFor();
      assert.equal(await page.locator('#detail-content .detail-section').count(), 8);
      assert.ok((await page.locator('#detail-content').textContent()).includes('No se presume su aceptación'));
      assert.ok((await page.locator('#detail-content').textContent()).includes('Actividades del formulario anterior'));
      assert.ok((await page.locator('#detail-content').textContent()).includes('Contacto QA'));
      assert.ok(!(await page.locator('#detail-content').textContent()).includes('[object Object]'));
      await checkBounds('detail');
      await page.locator('#close-detail').click();
      await page.evaluate(() => { location.hash = 'new-visit'; });
      await page.locator('#client-form').waitFor({ state: 'visible' });
      await page.locator('[name=visitDate]').fill('2026-11-16');
      await page.locator('[name=visitTime]').fill('08:55');
      assert.equal(await page.locator('[name=visitLocation]').isDisabled(), true);
      assert.equal(await page.locator('[name=fullName]').isDisabled(), true);
      assert.equal(await page.evaluate(() => sessionStorage.getItem('cbc-client-draft:qa-user')), null);
      await checkBounds('visit 1');
      const widths = await page.evaluate(() => ['visitDate', 'visitTime', 'visitLocation'].map((name) => document.querySelector(`[name=${name}]`).getBoundingClientRect().width));
      if (width < 701) assert.ok(Math.max(...widths) - Math.min(...widths) < 2, 'Mobile input widths should match');
      if (width === 390) await page.screenshot({ path: path.join(artifacts, 'visit-mobile.png'), fullPage: true });
      await page.locator('.progress-step[data-step="7"]').click();
      await page.locator('[data-panel="1"]').waitFor({ state: 'visible' });
      await page.waitForFunction(() => !document.querySelector('#privacy-personal').disabled);
      assert.equal(await page.locator('#privacy-policy-link').isVisible(), false);
      assert.equal(await page.locator('#privacy-personal').isChecked(), false);
      assert.equal(await page.locator('#privacy-truth').isChecked(), false);
      assert.equal(await page.locator('#privacy-sensitive').isChecked(), false);
      await page.locator('#next-button').click();
      assert.ok((await page.locator('#privacy-error').textContent()).length > 0);
      await page.locator('#privacy-signer').fill('Titular QA');
      await page.locator('#privacy-role').selectOption('representante');
      await page.locator('#privacy-personal').check();
      await page.locator('#privacy-truth').check();
      await page.locator('#next-button').click();
      assert.ok((await page.locator('#privacy-error').textContent()).includes('representación'));
      await page.locator('#privacy-basis').fill('Poder de representación de prueba QA');
      assert.equal(await page.evaluate(() => window.CBC_PRIVACY.allowed()), true);
      await page.locator('#privacy-role').selectOption('titular');
      await checkBounds('authorization');
      if ([390, 1440].includes(width)) await page.screenshot({ path: path.join(artifacts, `privacy-${width}.png`), fullPage: true });
      await page.locator('.progress-step[data-step="0"]').click();
      await page.locator('[name=visitLocation]').fill('Calle 10');
      await page.locator('#next-button').click();
      await page.locator('#next-button').click();
      assert.equal(await page.locator('[name=address]').inputValue(), 'Calle 10');
      await page.locator('[name=fullName]').fill('Persona QA');
      await page.locator('[name=address]').fill('Dirección distinta');
      await checkBounds('visit 3');
      await page.locator('#back-button').click();
      await page.locator('#next-button').click();
      assert.equal(await page.locator('[name=address]').inputValue(), 'Dirección distinta');
      for (let stage = 3; stage < 8; stage++) {
        await page.locator('#next-button').click();
        if (stage === 3) {
          await page.locator('[name=payerName]').fill('Acudiente QA');
          await page.locator('[name=guardianIdNumber]').fill('001234567');
          await page.locator('[name=guardianAddress]').fill('Calle del acudiente 20');
          await page.locator('[name=guardianPhone]').fill('+57 300 123 4567');
          if (width === 390) await page.screenshot({ path: path.join(artifacts, 'guardian-mobile.png'), fullPage: true });
        }
        if (stage === 4) {
          assert.equal(await page.locator('[name=mobilityNotes]').isDisabled(), true);
          await page.locator('[data-panel="4"] [data-edit-privacy]').click();
          await page.locator('#privacy-sensitive').check();
          await page.locator('.progress-step[data-step="4"]').click();
          await page.locator('[name=mobilityNotes]').fill('Información voluntaria QA');
          await page.locator('.progress-step[data-step="1"]').click();
          await page.locator('#privacy-sensitive').uncheck();
          await page.locator('.progress-step[data-step="4"]').click();
          assert.equal(await page.locator('[name=mobilityNotes]').isDisabled(), true);
          assert.equal(await page.evaluate(() => JSON.parse(sessionStorage.getItem('cbc-client-draft:qa-user')).mobilityNotes), undefined);
        }
        if (stage === 5) {
          await page.waitForFunction((count) => document.querySelectorAll('#activities-options .activity-card').length === count, activityCatalog.activities.length);
          assert.equal(await page.locator('.activity-description').count(), activityCatalog.activities.length);
          assert.equal(await page.locator('.activity-exclusions').count(), activityCatalog.activities.length);
          await page.locator('#activities-options input').nth(0).check();
          await page.locator('#activities-options input').nth(7).check();
          await page.locator('#next-button').click();
          assert.ok((await page.locator('#activity-selection-error').textContent()).includes('traslados'));
          await page.locator('[data-activity-transport-mode][value="trusted-taxi"]').check();
          await page.locator('#next-button').click();
          assert.ok((await page.locator('#activity-selection-error').textContent()).includes('nombre'));
          await page.locator('[data-taxi-field=name]').first().fill('Conductor QA');
          await page.locator('[data-taxi-field=phone]').first().fill('+57 300 123 4567');
          await page.locator('[data-taxi-field=company]').first().fill('Central QA');
          await page.locator('[data-taxi-field=plate]').first().fill('ABC123');
          await page.locator('#activity-add-taxi').click();
          await page.locator('[data-taxi-field=name]').nth(1).fill('Otro contacto QA');
          await page.locator('[data-taxi-field=phone]').nth(1).fill('3112223344');
          await page.locator('[data-activity-transport-mode][value="authorize-taxi"]').check();
          assert.equal(await page.evaluate(() => window.CBC_ACTIVITIES.serialize().taxiContacts.length), 0);
          assert.equal(await page.locator('#activity-taxi-authorization').isChecked(), false);
          await page.locator('#next-button').click();
          assert.ok((await page.locator('#activity-selection-error').textContent()).includes('autorización'));
          await page.locator('#activity-taxi-authorizer').fill('');
          await page.locator('#next-button').click();
          assert.ok((await page.locator('#activity-selection-error').textContent()).includes('quién autoriza'));
          await page.locator('#activity-taxi-authorizer').fill('Acudiente QA');
          await page.locator('#activity-taxi-authorization').check();
          if (expectedTransport !== 'authorize-taxi') await page.locator(`[data-activity-transport-mode][value="${expectedTransport}"]`).check();
          assert.equal(await page.evaluate(() => window.CBC_ACTIVITIES.serialize().taxiCoordinationAuthorized), expectedTransport === 'authorize-taxi');
          if (expectedTransport === 'trusted-taxi') assert.equal(await page.locator('[data-taxi-field=name]').first().inputValue(), 'Conductor QA');
          if ([390, 1440].includes(width)) {
            await page.locator('.activity-card').first().screenshot({ path: path.join(artifacts, `activity-card-${width}.png`) });
            await page.locator('.activity-transport').screenshot({ path: path.join(artifacts, `activity-transport-${width}.png`) });
          }
        }
        if (stage === 7) {
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
          await page.locator('.progress-step[data-step="7"]').click();
          assert.ok((await page.locator('#emergency-guardian-summary').textContent()).includes('Acudiente actualizado'));
          await page.locator('#emergency-edit-guardian').click();
          await page.locator('[name=payerName]').fill('Acudiente QA');
          await page.locator('.progress-step[data-step="7"]').click();
          if (width === 390) activityCatalogOffline = true;
          await page.reload();
          await page.locator('#crm-app').waitFor({ state: 'visible' });
          await page.waitForFunction(() => window.CBC_PRIVACY.allowed());
          if (width === 390) {
            await page.waitForFunction(() => document.querySelector('#activities-status').textContent.includes('temporalmente'));
            await page.locator('.progress-step[data-step="7"]').click();
            await page.locator('[name=finalNotes]').fill('Notas QA mientras el catálogo no está disponible');
            await page.locator('#save-button').click();
            assert.equal(posts, 0);
            assert.ok((await page.locator('#activity-selection-error').textContent()).includes('Carga y revisa'));
            activityCatalogOffline = false;
            await page.reload();
            await page.locator('#crm-app').waitFor({ state: 'visible' });
            await page.waitForFunction(() => window.CBC_PRIVACY.allowed());
          }
          await page.waitForFunction(() => window.CBC_ACTIVITIES.serialize()?.selectedIds.length === 2);
          assert.equal(await page.evaluate(() => window.CBC_ACTIVITIES.serialize().transportMode), expectedTransport);
          await page.locator('.progress-step[data-step="7"]').click();
          assert.equal(await page.locator('#privacy-sensitive').isChecked(), false);
          assert.equal(await page.locator('#emergency-use-guardian').isChecked(), true);
          assert.equal(await page.locator('#emergency-add-other').isChecked(), true);
          assert.equal(await page.locator('[data-emergency-field=fullName]').inputValue(), 'Contacto QA');
          if (width === 390) {
            await page.locator('.progress-step[data-step="1"]').click();
            privacy.version = 'QA-v2';
            privacy.hash = 'b'.repeat(64);
            await page.locator('#privacy-reload').click();
            await page.waitForFunction(() => document.querySelector('#privacy-version').textContent.includes('QA-v2'));
            assert.equal(await page.locator('#privacy-personal').isChecked(), false);
            assert.equal(await page.locator('#privacy-truth').isChecked(), false);
            await page.locator('.progress-step[data-step="7"]').click();
            assert.equal(await page.locator('[data-panel="1"]').isVisible(), true);
            await page.locator('#privacy-personal').check();
            await page.locator('#privacy-truth').check();
            privacy.configured = false;
            privacy.hash = 'c'.repeat(64);
            await page.locator('#privacy-reload').click();
            await page.waitForFunction(() => window.CBC_PRIVACY.serialize().noticeHash === 'c'.repeat(64));
            assert.equal(await page.locator('#privacy-signer').isDisabled(), false);
            assert.equal(await page.evaluate(() => window.CBC_PRIVACY.allowed()), false);
            await page.locator('#next-button').click();
            assert.ok((await page.locator('#privacy-error').textContent()).includes('declaración de veracidad'));
            await page.locator('#privacy-personal').check();
            await page.locator('#privacy-truth').check();
            assert.equal(await page.evaluate(() => window.CBC_PRIVACY.allowed()), true);
            privacy.configured = true;
            privacy.hash = 'b'.repeat(64);
            await page.locator('#privacy-reload').click();
            await page.waitForFunction(() => window.CBC_PRIVACY.serialize().noticeHash === 'b'.repeat(64));
            await page.locator('#privacy-personal').check();
            await page.locator('#privacy-truth').check();
            await page.locator('.progress-step[data-step="7"]').click();
            await page.locator('.progress-step[data-step="5"]').click();
            activityCatalog.version = 'QA-ACT-v2';
            activityCatalog.hash = 'e'.repeat(64);
            await page.locator('#activities-reload').click();
            await page.waitForFunction(() => window.CBC_ACTIVITIES.serialize()?.catalogHash === 'e'.repeat(64));
            assert.equal(await page.locator('#activities-options input:checked').count(), 0);
            assert.equal(await page.locator('#activity-taxi-authorization').isChecked(), false);
            assert.equal(await page.locator('#activities-updated').isVisible(), true);
            await page.locator('#activities-options input').nth(0).check();
            await page.locator('#activities-options input').nth(7).check();
            await page.locator('#activity-taxi-authorization').check();
            await page.locator('.progress-step[data-step="7"]').click();
          }
          if (width === 390) await page.screenshot({ path: path.join(artifacts, 'emergency-mobile.png'), fullPage: true });
        }
        await checkBounds(`visit ${stage + 1}`);
      }
      if (width === 390) {
        await page.locator('.progress-step[data-step="5"]').click();
        await page.locator('#activity-taxi-authorization').uncheck();
        await page.locator('.progress-step[data-step="4"]').click();
        await page.locator('.progress-step[data-step="7"]').click();
        await page.locator('#save-button').click();
        assert.equal(posts, 0);
        assert.equal(await page.locator('[data-panel="5"]').isVisible(), true);
        await page.locator('#activity-taxi-authorization').check();
        await page.locator('.progress-step[data-step="7"]').click();
      }
      await page.locator('#save-button').click();
      await page.locator('#success-message').waitFor({ state: 'visible' });
      assert.equal(posts, 1);
      await checkBounds('saved');
      await page.locator('[data-route=clients]').click();
      await page.locator('#client-records [data-detail]').click();
      await page.locator('#detail-content .detail-section').first().waitFor();
      assert.ok((await page.locator('#detail-content').textContent()).includes(expectedTransport === 'trusted-taxi' ? 'Conductor QA' : expectedTransport === 'authorize-taxi' ? 'Acudiente QA' : 'traslado resuelto'));
      await page.locator('#close-detail').click();
      await page.evaluate(() => { location.hash = 'new-visit'; });
      await page.locator('#new-client-button').click();
      assert.equal(await page.locator('#privacy-personal').isChecked(), false);
      assert.equal(await page.locator('#privacy-truth').isChecked(), false);
      assert.equal(await page.locator('#privacy-sensitive').isChecked(), false);
      assert.equal(await page.locator('[name=fullName]').inputValue(), '');
      assert.equal(await page.locator('#activity-taxi-authorization').isChecked(), false);
      assert.equal(await page.locator('#activities-options input:checked').count(), 0);
      assert.equal(await page.evaluate(() => sessionStorage.getItem('cbc-client-draft:qa-user')), null);
      await page.locator('#logout-button').click();
      await page.locator('#login-screen').waitFor({ state: 'visible' });
      assert.deepEqual(errors, [], 'No browser JS errors');
      console.log(`OK ${width}px: login, CRM, eight stages, explicit consent, optional health data, guardian, emergency contacts, draft, save, logout; no horizontal overflow.`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });

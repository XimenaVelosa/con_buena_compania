const { chromium } = require('../.local/qa/node_modules/playwright-core');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const credentials = await readFile(path.resolve(__dirname, '../../backend/.local/admin-initial-access.txt'), 'utf8');
  const username = /Usuario: (.+)/.exec(credentials)?.[1].trim();
  const password = /Contrase\u00f1a inicial: (.+)/.exec(credentials)?.[1].trim();
  assert.ok(username && password, 'Initial credentials are available');
  const browser = await chromium.launch({ executablePath: process.env.CRM_BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 850 }, reducedMotion: 'reduce' });
    await page.addInitScript(() => { window.CBC_API_URL = 'http://127.0.0.1:3002'; });
    await page.goto('http://127.0.0.1:4173');
    await page.locator('#login-user').fill(username);
    await page.locator('#login-password').fill(password);
    await page.locator('#login-submit').click();
    await page.locator('#password-screen').waitFor({ state: 'visible', timeout: 20000 });
    const session = await page.evaluate(async () => (await window.CBC_CRM.api('/auth/session')).user);
    assert.equal(session.username, username);
    assert.equal(session.mustChangePassword, true);
    await page.locator('#password-cancel').click();
    await page.locator('#login-screen').waitFor({ state: 'visible' });
    console.log('OK: real admin login, browser cookie session, mandatory password screen and logout. Initial password unchanged.');
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });

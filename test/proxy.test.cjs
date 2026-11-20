const { test } = require('node:test');
const assert = require('node:assert/strict');
const handler = require('../api/proxy.js');

function response() {
  return { headers: {}, code: null, body: null, setHeader(key, value) { this.headers[key] = value; }, status(code) { this.code = code; return this; }, json(data) { this.body = data; }, send(data) { this.body = data; } };
}

test('CRM proxy validates routes, requires explicit writes and forwards private cookies', async () => {
  const previousBackend = process.env.BACKEND_URL;
  const previousFetch = global.fetch;
  try {
    delete process.env.BACKEND_URL;
    global.fetch = async (url) => {
      assert.equal(String(url), 'https://con-buena-compania-backend.vercel.app/auth/session');
      return { status: 401, headers: { getSetCookie: () => [] }, text: async () => '{"message":"Ingresa para continuar."}' };
    };
    let res = response();
    await handler({ method: 'GET', url: '/api/proxy?route=auth%2Fsession', headers: {} }, res);
    assert.equal(res.code, 401);
    process.env.BACKEND_URL = 'https://api.example.com';
    res = response();
    await handler({ method: 'GET', url: '/api/other', headers: {} }, res);
    assert.equal(res.code, 404);
    res = response();
    await handler({ method: 'POST', url: '/api/auth/login', headers: {} }, res);
    assert.equal(res.code, 403);
    for (const url of ['/api/auth/change-password', '/api/proxy?route=auth%2Fchange-password']) {
      res = response();
      await handler({ method: 'POST', url, headers: { 'x-crm-request': '1', cookie: 'cbc_admin_session=opaque' }, body: { currentPassword: 'old', newPassword: 'replacement-password' } }, res);
      assert.equal(res.code, 404, 'Password changes are never forwarded to the backend');
    }
    global.fetch = async (url, options) => {
      assert.equal(String(url), 'https://api.example.com/auth/session');
      assert.equal(options.headers.Cookie, 'cbc_admin_session=opaque');
      return { status: 200, headers: { getSetCookie: () => ['cbc_admin_session=rotated; HttpOnly; Secure; SameSite=Lax'] }, text: async () => '{"user":{"username":"admin"}}' };
    };
    res = response();
    await handler({ method: 'GET', url: '/api/auth/session', headers: { cookie: 'cbc_admin_session=opaque' } }, res);
    assert.equal(res.code, 200);
    assert.equal(res.headers['Cache-Control'], 'no-store');
    assert.match(res.headers['Set-Cookie'][0], /HttpOnly/);
    assert.equal(JSON.parse(res.body).user.username, 'admin');
    res = response();
    await handler({ method: 'GET', url: '/api/proxy?route=auth/session', headers: { cookie: 'cbc_admin_session=opaque' } }, res);
    assert.equal(res.code, 200);
    res = response();
    await handler({ method: 'GET', url: '/api/proxy', query: { route: 'auth/session' }, headers: { cookie: 'cbc_admin_session=opaque' } }, res);
    assert.equal(res.code, 200);
    res = response();
    global.fetch = async (url) => {
      assert.equal(String(url), 'https://api.example.com/clients/privacy-notice');
      return { status: 200, headers: { getSetCookie: () => [] }, text: async () => '{"version":"QA","configured":true}' };
    };
    await handler({ method: 'GET', url: '/api/proxy?route=clients%2Fprivacy-notice', headers: { cookie: 'cbc_admin_session=opaque' } }, res);
    assert.equal(res.code, 200);
    assert.equal(res.headers['Cache-Control'], 'no-store');
    assert.equal(JSON.parse(res.body).version, 'QA');
    global.fetch = async (url) => {
      assert.equal(String(url), 'https://api.example.com/clients/activity-options');
      return { status: 200, headers: { getSetCookie: () => [] }, text: async () => '{"version":"QA-ACT","activities":[]}' };
    };
    res = response();
    await handler({ method: 'GET', url: '/api/proxy?route=clients%2Factivity-options', headers: { cookie: 'cbc_admin_session=opaque' } }, res);
    assert.equal(res.code, 200);
    assert.equal(res.headers['Cache-Control'], 'no-store');
    assert.equal(JSON.parse(res.body).version, 'QA-ACT');
    global.fetch = async (url, options) => {
      assert.equal(String(url), 'https://api.example.com/service-requests?page=2');
      assert.equal(options.headers.Cookie, 'cbc_admin_session=opaque');
      return { status: 200, headers: { getSetCookie: () => [] }, text: async () => '{"items":[],"hasNext":false}' };
    };
    res = response();
    await handler({ method: 'GET', url: '/api/proxy?route=service-requests&page=2', headers: { cookie: 'cbc_admin_session=opaque' } }, res);
    assert.equal(res.code, 200);
    assert.deepEqual(JSON.parse(res.body).items, []);
    res = response();
    await handler({ method: 'POST', url: '/api/service-requests', headers: {} }, res);
    assert.equal(res.code, 403);
    res = response();
    await handler({ method: 'POST', url: '/api/service-requests/options', headers: { 'x-crm-request': '1' } }, res);
    assert.equal(res.code, 404);
    res = response();
    await handler({ method: 'GET', url: '/api/proxy?route=https://attacker.example', headers: {} }, res);
    assert.equal(res.code, 404);
    global.fetch = async () => { throw new Error('offline'); };
    res = response();
    await handler({ method: 'GET', url: '/api/clients', headers: {} }, res);
    assert.equal(res.code, 502);
  } finally {
    global.fetch = previousFetch;
    if (previousBackend === undefined) delete process.env.BACKEND_URL;
    else process.env.BACKEND_URL = previousBackend;
  }
});

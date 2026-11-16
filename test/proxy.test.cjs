const { test } = require('node:test');
const assert = require('node:assert/strict');
const handler = require('../api/[...path].js');

function response() {
  return { headers: {}, code: null, body: null, setHeader(key, value) { this.headers[key] = value; }, status(code) { this.code = code; return this; }, json(data) { this.body = data; }, send(data) { this.body = data; } };
}

test('CRM proxy validates routes, requires explicit writes and forwards private cookies', async () => {
  const previousBackend = process.env.BACKEND_URL;
  const previousFetch = global.fetch;
  try {
    delete process.env.BACKEND_URL;
    let res = response();
    await handler({ method: 'GET', url: '/api/clients', headers: {} }, res);
    assert.equal(res.code, 503);
    process.env.BACKEND_URL = 'https://api.example.com';
    res = response();
    await handler({ method: 'GET', url: '/api/other', headers: {} }, res);
    assert.equal(res.code, 404);
    res = response();
    await handler({ method: 'POST', url: '/api/auth/login', headers: {} }, res);
    assert.equal(res.code, 403);
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

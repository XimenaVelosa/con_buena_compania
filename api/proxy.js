// Same-origin proxy. BACKEND_URL may override the verified production backend.
// Passwords and session tokens never appear in public configuration or browser storage.
module.exports = async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  const backend = process.env.BACKEND_URL || 'https://con-buena-compania-backend.vercel.app';
  const requestUrl = new URL(request.url, 'https://crm.local');
  const route = requestUrl.searchParams.get('route') || (typeof request.query?.route === 'string' ? request.query.route : '');
  const path = route ? `/${route}` : requestUrl.pathname.replace(/^\/api/, '');
  if (!/^\/(?:auth\/(?:login|logout|session)|clients(?:\/(?:privacy-notice|activity-options|[a-f0-9-]{36}))?)$/.test(path) || !['GET', 'POST'].includes(request.method)) {
    response.status(404).json({ message: 'Ruta no disponible.' }); return;
  }
  if (request.method === 'POST' && request.headers['x-crm-request'] !== '1') {
    response.status(403).json({ message: 'Solicitud no autorizada.' }); return;
  }
  try {
    const base = new URL(backend.endsWith('/') ? backend : `${backend}/`);
    if (base.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(base.hostname)) throw new Error('Invalid backend protocol');
    const headers = { 'Content-Type': 'application/json', 'X-CRM-Request': '1' };
    if (request.headers.cookie) headers.Cookie = request.headers.cookie;
    if (request.headers.origin) headers.Origin = request.headers.origin;
    const upstream = await fetch(new URL(path.slice(1), base), {
      method: request.method, headers, redirect: 'error', signal: AbortSignal.timeout(20000),
      ...(request.method === 'POST' ? { body: typeof request.body === 'string' ? request.body : JSON.stringify(request.body || {}) } : {}),
    });
    const cookies = upstream.headers.getSetCookie();
    if (cookies.length) response.setHeader('Set-Cookie', cookies);
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.status(upstream.status).send(await upstream.text());
  } catch {
    response.status(502).json({ message: 'No pudimos conectar con el sistema. Vuelve a intentar en unos momentos.' });
  }
};

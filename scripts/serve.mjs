import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const assets = { '/': 'text/html', '/index.html': 'text/html', '/styles.css': 'text/css', '/crm.css': 'text/css', '/app.js': 'text/javascript', '/crm.js': 'text/javascript', '/emergency-contacts.js': 'text/javascript', '/config.js': 'text/javascript', '/brand-logo.png': 'image/png' };
const root = new URL('../', import.meta.url);
const port = Number(process.env.PORT || 4173);
createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (!assets[path]) { res.writeHead(404).end(); return; }
  try {
    const file = path === '/' ? 'index.html' : path.slice(1);
    const data = await readFile(fileURLToPath(new URL(file, root)));
    res.writeHead(200, { 'Content-Type': `${assets[path]}${path.endsWith('.png') ? '' : '; charset=utf-8'}`, 'Cache-Control': 'no-store' });
    res.end(data);
  } catch { res.writeHead(500).end(); }
}).listen(port, '127.0.0.1', () => console.log(`CRM local: http://127.0.0.1:${port}`));

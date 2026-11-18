import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const assets = {
  '/': 'text/html', '/index.html': 'text/html', '/crm': 'text/html', '/crm/': 'text/html', '/crm.html': 'text/html',
  '/landing.css': 'text/css', '/landing.js': 'text/javascript', '/styles.css': 'text/css', '/crm.css': 'text/css',
  '/app.js': 'text/javascript', '/crm.js': 'text/javascript', '/emergency-contacts.js': 'text/javascript', '/activities.js': 'text/javascript', '/privacy-consent.js': 'text/javascript', '/config.js': 'text/javascript', '/brand-logo.png': 'image/png',
  '/images/companionship-hero.jpg': 'image/jpeg', '/images/service-medical.jpg': 'image/jpeg', '/images/service-groceries.jpg': 'image/jpeg', '/images/service-errands.jpg': 'image/jpeg', '/images/service-shopping.jpg': 'image/jpeg', '/images/service-pharmacy.jpg': 'image/jpeg', '/images/service-institutions.jpg': 'image/jpeg', '/images/time-detail.jpg': 'image/jpeg',
  '/fonts/nunito-latin.woff2': 'font/woff2',
};
const root = new URL('../', import.meta.url);
const port = Number(process.env.PORT || 4173);
createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (!assets[path]) { res.writeHead(404).end(); return; }
  try {
    const file = path === '/' ? 'index.html' : ['/crm', '/crm/'].includes(path) ? 'crm.html' : path.slice(1);
    const data = await readFile(fileURLToPath(new URL(file, root)));
    res.writeHead(200, { 'Content-Type': `${assets[path]}${assets[path].startsWith('text/') ? '; charset=utf-8' : ''}`, 'Cache-Control': 'no-store' });
    res.end(data);
  } catch { res.writeHead(500).end(); }
}).listen(port, '127.0.0.1', () => console.log(`Sitio local: http://127.0.0.1:${port} · CRM: http://127.0.0.1:${port}/crm`));

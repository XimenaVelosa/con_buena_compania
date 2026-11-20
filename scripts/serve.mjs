import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const assets = {
  '/': 'text/html', '/index.html': 'text/html', '/crm': 'text/html', '/crm/': 'text/html', '/crm.html': 'text/html',
  '/landing.css': 'text/css', '/landing-videos.js': 'text/javascript', '/landing.js': 'text/javascript', '/styles.css': 'text/css', '/crm.css': 'text/css',
  '/app.js': 'text/javascript', '/crm.js': 'text/javascript', '/emergency-contacts.js': 'text/javascript', '/activities.js': 'text/javascript', '/privacy-consent.js': 'text/javascript', '/config.js': 'text/javascript', '/brand-logo.png': 'image/png',
  '/images/companionship-hero.jpg': 'image/jpeg', '/images/service-medical.jpg': 'image/jpeg', '/images/service-groceries.jpg': 'image/jpeg', '/images/service-errands.jpg': 'image/jpeg', '/images/service-shopping.jpg': 'image/jpeg', '/images/service-pharmacy.jpg': 'image/jpeg', '/images/service-institutions.jpg': 'image/jpeg', '/images/time-detail.jpg': 'image/jpeg',
  '/fonts/nunito-latin.woff2': 'font/woff2',
  '/images/companionship-hero-student.jpg': 'image/jpeg',
  '/service-request.js': 'text/javascript',
};
const root = new URL('../', import.meta.url);
const port = Number(process.env.PORT || 4173);
createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  const videoType = /^\/videos\/[a-zA-Z0-9_-]+\.(mp4|webm)$/.exec(path)?.[1];
  const type = assets[path] || (videoType ? `video/${videoType}` : '');
  if (!type) { res.writeHead(404).end(); return; }
  try {
    const file = path === '/' ? 'index.html' : ['/crm', '/crm/'].includes(path) ? 'crm.html' : path.slice(1);
    const data = await readFile(fileURLToPath(new URL(file, root)));
    res.writeHead(200, { 'Content-Type': `${type}${type.startsWith('text/') ? '; charset=utf-8' : ''}`, 'Cache-Control': 'no-store' });
    res.end(data);
  } catch (error) { res.writeHead(error.code === 'ENOENT' ? 404 : 500).end(); }
}).listen(port, '127.0.0.1', () => console.log(`Sitio local: http://127.0.0.1:${port} · CRM: http://127.0.0.1:${port}/crm`));

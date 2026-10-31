import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = path.join(root, 'public');
const port = Number(process.env.PORT || 4173);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8' };
const server = createServer(async (req, res) => {
  const host = req.headers.host;
  if (![`127.0.0.1:${port}`, `localhost:${port}`].includes(host)) { res.writeHead(403); res.end('Local access only.'); return; }
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'none'");
  try {
    const url = new URL(req.url, `http://${host}`);
    let route = decodeURIComponent(url.pathname);
    if (route === '/local-snapshot') {
      if (req.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(req.headers['sec-fetch-site'])) { res.writeHead(403); res.end(); return; }
      const data = await readFile(path.join(root, '.private', 'workspace.json'));
      res.setHeader('Content-Type', types['.json']); res.writeHead(200); res.end(req.method === 'HEAD' ? undefined : data); return;
    }
    if (route === '/') route = '/index.html';
    const file = path.resolve(publicRoot, `.${route}`);
    if (!file.startsWith(`${publicRoot}${path.sep}`) || route.split('/').some(part => part.startsWith('.'))) { res.writeHead(404); res.end('Not found.'); return; }
    const extension = path.extname(file);
    if (!types[extension]) { res.writeHead(404); res.end('Not found.'); return; }
    const data = await readFile(file); res.setHeader('Content-Type', types[extension]); res.writeHead(200); res.end(req.method === 'HEAD' ? undefined : data);
  } catch { res.writeHead(404); res.end('Not found.'); }
});
server.listen(port, '127.0.0.1', () => console.log(`pick up is ready at http://127.0.0.1:${port}`));
server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? `Port ${port} is in use. Start with a different PORT.` : error.message); process.exitCode = 1; });

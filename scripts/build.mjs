import { cp, mkdir, rm, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const allowed = ['index.html', 'styles.css', 'app.js', 'model.js', 'browser-source.js', 'desktop-source.js', 'walkthrough.html', 'walkthrough.js', 'demo.json', 'favicon.svg', 'fonts'];
// Explicitly copy distributable assets. Never package the repository or private snapshot directory.
const entries = await readdir(path.join(root, 'public'));
if (entries.some(entry => !allowed.includes(entry))) throw new Error('Unexpected public asset: inspect it before adding it to the build allowlist.');
const demo = JSON.parse(await readFile(path.join(root, 'public', 'demo.json'), 'utf8'));
if (demo.id !== 'recall-fictional-demo' || !demo.chats.every(chat => chat.id.startsWith('demo-') && !chat.url)) throw new Error('The public demo must use fictional data without personal chat links.');
await rm(path.join(root, 'dist'), { recursive: true, force: true });
await mkdir(path.join(root, 'dist'), { recursive: true });
for (const name of allowed) await cp(path.join(root, 'public', name), path.join(root, 'dist', name), { recursive: true });
console.log('Built dist/ from public assets only. Private snapshots are excluded.');

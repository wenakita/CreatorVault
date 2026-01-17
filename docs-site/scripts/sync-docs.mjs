import { cp, rm, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const docsSiteRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(docsSiteRoot, '..');

const sourceDocs = path.join(repoRoot, 'docs');
const contentDir = path.join(docsSiteRoot, 'content');
const publicDir = path.join(docsSiteRoot, 'public');
const htmlSource = path.join(sourceDocs, 'html');
const htmlDest = path.join(publicDir, 'docs-html');

await rm(contentDir, { recursive: true, force: true });
await mkdir(contentDir, { recursive: true });
await cp(sourceDocs, contentDir, { recursive: true });
await rm(path.join(contentDir, 'html'), { recursive: true, force: true });

await rm(htmlDest, { recursive: true, force: true });
await mkdir(publicDir, { recursive: true });
await cp(htmlSource, htmlDest, { recursive: true });

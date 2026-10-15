import { mkdir, cp, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'dist');
await mkdir(output, { recursive: true });
for (const directory of ['assets', 'login', 'panel']) {
  await cp(path.join(root, directory), path.join(output, directory), { recursive: true });
}
for (const file of ['index.html', '_redirects', '_routes.json', '_headers']) {
  await copyFile(path.join(root, file), path.join(output, file));
}
console.log('Static site prepared in dist; Pages Functions remain in functions/.');

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const bundlePath = path.resolve(process.cwd(), 'dist-server', 'server.mjs');

if (fs.existsSync(bundlePath)) {
  await import(pathToFileURL(bundlePath).href);
} else {
  const { register } = await import('tsx/esm/api');
  register();
  await import(pathToFileURL(path.resolve(process.cwd(), 'server.app.ts')).href);
}

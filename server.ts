import fs from 'fs';
import path from 'path';

const bundlePath = path.join(process.cwd(), 'dist', 'server.cjs');
if (fs.existsSync(bundlePath) && process.env.npm_lifecycle_event !== 'dev') {
  await import('./dist/server.cjs');
} else {
  await import('./server.impl.ts');
}

import { mkdirSync, copyFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
const require = createRequire(import.meta.url);
const root = dirname(require.resolve('@techstark/opencv-js/package.json'));
mkdirSync('public/vendor/opencv', { recursive: true });
copyFileSync(resolve(root, 'dist/opencv.js'), 'public/vendor/opencv/opencv.js');
copyFileSync(resolve(root, 'LICENSE'), 'public/vendor/opencv/LICENSE');

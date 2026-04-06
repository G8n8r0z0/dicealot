import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const vendor = path.join(root, 'vendor');

fs.mkdirSync(vendor, { recursive: true });
fs.copyFileSync(
  path.join(root, 'node_modules', 'babylonjs', 'babylon.js'),
  path.join(vendor, 'babylon.js')
);
fs.copyFileSync(
  path.join(root, 'node_modules', 'cannon-es', 'dist', 'cannon-es.js'),
  path.join(vendor, 'cannon-es.js')
);
console.log('vendor/babylon.js and vendor/cannon-es.js updated');

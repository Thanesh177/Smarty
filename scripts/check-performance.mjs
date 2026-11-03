import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const root = path.resolve(process.argv[2] || 'dist');
const manifest = JSON.parse(fs.readFileSync(path.join(root, '.vite/manifest.json'), 'utf8'));
const entry = manifest['index.html'];
if (!entry) throw new Error('Modern build entry missing');
const loaded = new Set();
function include(key) {
  if (loaded.has(key)) return;
  const chunk = manifest[key];
  if (!chunk) throw new Error(`Missing manifest dependency: ${key}`);
  loaded.add(key);
  for (const dependency of chunk.imports || []) include(dependency);
}
include('index.html');
// Smarty's safe boot script imports the main application dynamically.
for (const key of entry.dynamicImports || []) include(key);
const files = [...new Set([...loaded].map(key => manifest[key].file))];
const gzipBytes = files.reduce((sum, file) => sum + gzipSync(fs.readFileSync(path.join(root, file))).length, 0);
console.log(`Initial modern JavaScript: ${(gzipBytes / 1024).toFixed(1)} KiB gzip (${files.length} files)`);
const limit = 350 * 1024;
if (gzipBytes > limit) throw new Error('Startup JavaScript exceeds the 350 KiB gzip budget');
for (const screen of ['QuizPage', 'ChatPage', 'TopicRoomsPage', 'PostAiPage']) {
  const key = Object.keys(manifest).find(key => key.endsWith(`/${screen}.jsx`));
  if (!key || !manifest[key].isDynamicEntry || loaded.has(key)) throw new Error(`${screen} is no longer deferred`);
  if (manifest[key].css?.length) throw new Error(`${screen} reintroduces late route styles; preserve the shared theme cascade`);
}

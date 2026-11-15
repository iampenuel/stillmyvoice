// SPDX-License-Identifier: AGPL-3.0-or-later
/** Reproducible local assets; no webcam data, credentials or runtime CDN requests. */
import { createHash } from 'node:crypto';
import { copyFile, cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build } from 'vite';
const root = fileURLToPath(new URL('../', import.meta.url));
const destination = path.join(root, 'public/gaze');
const cache = path.join(root, '.local-cache/gaze-assets');
const modelUrl = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const modelHash = '64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff';
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const packageMeta = async (relative: string) => JSON.parse(await readFile(path.join(root, 'node_modules', relative, 'package.json'), 'utf8')) as { version: string };
if ((await packageMeta('@realeye-io/webcam-eyetracker-light-open')).version !== '1.1.0' || (await packageMeta('@mediapipe/tasks-vision')).version !== '0.10.18') throw new Error('Gaze dependency versions must match the audited pins.');
await mkdir(path.join(destination, 'wasm'), { recursive: true });
await mkdir(cache, { recursive: true });
let model: Uint8Array | undefined;
try { model = new Uint8Array(await readFile(path.join(cache, 'face_landmarker.task'))); } catch { /* First preparation downloads the versioned public model. */ }
if (!model || hash(model) !== modelHash) {
  const response = await fetch(modelUrl, { redirect: 'error', signal: AbortSignal.timeout(45_000) });
  if (!response.ok) throw new Error('Could not download the versioned gaze model.');
  const maximum = 30_000_000;
  if (Number(response.headers.get('content-length')) > maximum) throw new Error('Gaze model response exceeds bound.');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Gaze model response has no body.');
  const chunks: Uint8Array[] = []; let total = 0;
  while (true) { const result = await reader.read(); if (result.done) break; total += result.value.length; if (total > maximum) { await reader.cancel(); throw new Error('Gaze model exceeds bound.'); } chunks.push(result.value); }
  model = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { model.set(chunk, offset); offset += chunk.length; }
  if (hash(model) !== modelHash) throw new Error('Gaze model integrity mismatch.');
  await writeFile(path.join(cache, 'face_landmarker.task'), model);
}
await writeFile(path.join(destination, 'face_landmarker.task'), model);
const assets = [{ file: 'face_landmarker.task', sha256: modelHash, source: modelUrl }];
for (const file of ['vision_wasm_internal.js', 'vision_wasm_internal.wasm', 'vision_wasm_nosimd_internal.js', 'vision_wasm_nosimd_internal.wasm']) {
  const source = path.join(root, 'node_modules/@mediapipe/tasks-vision/wasm', file);
  await copyFile(source, path.join(destination, 'wasm', file));
  assets.push({ file: 'wasm/' + file, sha256: hash(await readFile(source)), source: '@mediapipe/tasks-vision@0.10.18/wasm/' + file });
}
await mkdir(path.join(destination, 'licenses'), { recursive: true });
await copyFile(path.join(root, 'LICENSE'), path.join(destination, 'licenses/SMV-AGPL-3.0.txt'));
await cp(path.join(root, 'docs/licenses'), path.join(destination, 'licenses/dependencies'), { recursive: true });
// MediaPipe 0.10.18 loads its WASM loader through importScripts. An ordinary
// module worker cannot do that; this classic IIFE is separately bundled by Vite.
await build({ configFile: false, root, publicDir: false, logLevel: 'warn', build: {
  outDir: destination, emptyOutDir: false, sourcemap: false, target: 'es2022',
  lib: { entry: path.join(root, 'src/gaze/tracker.worker.ts'), name: 'SMVGazeWorker', formats: ['iife'], fileName: () => 'tracker.worker.js' },
} });
assets.push({ file: 'tracker.worker.js', sha256: hash(await readFile(path.join(destination, 'tracker.worker.js'))), source: 'src/gaze/tracker.worker.ts + audited npm dependencies' });
await writeFile(path.join(destination, 'provenance.json'), JSON.stringify({ realeye: '1.1.0', mediapipe: '0.10.18', assets }, null, 2) + '\n');
console.log('Prepared local gaze worker, model, WASM and license notices. No camera access.');

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, resolveConfig } from 'vite';
import { frontendDemoHeaders, gazeDemoHeaders, publicDemoHeaders, releaseProvenance, releaseInfoHtml, releaseTreeDirty } from '../scripts/frontend-demo-profile.mts';

const root = fileURLToPath(new URL('../', import.meta.url));
const sha = 'a'.repeat(40);
test('local dirty preparation never claims its HEAD is the complete published source', () => {
  const info = releaseProvenance({ gitRevision: sha, dirty: true, vercel: false });
  assert.equal(info.sourceUrl, 'https://github.com/iampenuel/stillmyvoice/tree/' + sha);
  assert.equal(info.publicationVerified, false);
  assert.match(releaseInfoHtml(info), /uncommitted changes/);
  assert.match(releaseInfoHtml(info), /does not represent the complete working tree/);
  assert.match(releaseInfoHtml(info), /Do not deploy/);
});
test('source provenance rejects dirty remote builds, mismatched or malformed revisions', () => {
  assert.throws(() => releaseProvenance({ dirty: false, vercel: true }), /identified committed/);
  assert.throws(() => releaseProvenance({ gitRevision: sha, dirty: true, vercel: true }), /identified committed/);
  assert.throws(() => releaseProvenance({ gitRevision: sha, vercelRevision: 'b'.repeat(40), dirty: false, vercel: true }), /revisions differ/);
  assert.throws(() => releaseProvenance({ gitRevision: '<script>', dirty: false, vercel: false }), /complete Git SHA/);
  const info = releaseProvenance({ vercelRevision: sha, dirty: null, vercel: true });
  assert.equal(info.publicationVerified, false);
  assert.match(releaseInfoHtml(info), /publication has not been verified/);
});

test('one public release SHA supports metadata-free builders without bypassing mismatch or dirty checks', () => {
  const info = releaseProvenance({ releaseRevision: sha, dirty: null, vercel: true });
  assert.equal(info.revision, sha); assert.equal(info.publicationVerified, false);
  assert.equal(info.sourceUrl, 'https://github.com/iampenuel/stillmyvoice/tree/' + sha);
  assert.throws(() => releaseProvenance({ releaseRevision: 'main', dirty: null, vercel: true }), /complete Git SHA/);
  assert.throws(() => releaseProvenance({ releaseRevision: sha, gitRevision: 'b'.repeat(40), dirty: false, vercel: true }), /revisions differ/);
  assert.throws(() => releaseProvenance({ releaseRevision: sha, vercelRevision: 'b'.repeat(40), dirty: null, vercel: true }), /revisions differ/);
  assert.throws(() => releaseProvenance({ releaseRevision: sha, dirty: true, vercel: true }), /working tree is dirty/);
});
test('Vercel public demo permits only same-origin APIs and gaze with explicit camera/microphone permissions', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.equal(config.framework, 'vite'); assert.equal(config.outputDirectory, 'dist');
  assert.equal(config.buildCommand, 'npm run build:public-demo'); assert.equal(config.installCommand, 'npm ci');
  assert.equal(config.git.deploymentEnabled, false);
  assert.deepEqual(config.rewrites, [{ source: '/gaze-experiment', destination: '/gaze-experiment/index.html' }]); assert.deepEqual(config.functions, { 'api/[...route].ts': { maxDuration: 30 } });
  assert.deepEqual(Object.fromEntries(config.headers[0].headers.map((entry: { key: string; value: string }) => [entry.key, entry.value])), publicDemoHeaders);
  assert.match(gazeDemoHeaders['Content-Security-Policy'], /(?:^|; )connect-src 'self';/);
  assert.match(gazeDemoHeaders['Content-Security-Policy'], /(?:^|; )worker-src 'self';/);
  assert.match(gazeDemoHeaders['Content-Security-Policy'], /(?:^|; )script-src 'self' 'wasm-unsafe-eval';/);
  assert.doesNotMatch(gazeDemoHeaders['Content-Security-Policy'], /'unsafe-eval'|https:|\*|blob:/);
  assert.equal(gazeDemoHeaders['Permissions-Policy'], 'camera=(self), microphone=(), geolocation=(), serial=(self)');
  assert.equal(publicDemoHeaders['Permissions-Policy'], 'camera=(self), microphone=(self), geolocation=(), serial=(self)');
  assert.match(publicDemoHeaders['Content-Security-Policy'], /media-src 'self' blob:/);
  assert.doesNotMatch(publicDemoHeaders['Content-Security-Policy'], /'unsafe-eval'|https:|\*/);
  assert.match(frontendDemoHeaders['Content-Security-Policy'], /connect-src 'none'/);
  assert.match(frontendDemoHeaders['Permissions-Policy'], /camera=\(\), microphone=\(\)/);
});
test('default local profile retains its public assets and loopback API proxy', async () => {
  const previous = process.env.VITE_SMV_RELEASE_MODE;
  delete process.env.VITE_SMV_RELEASE_MODE;
  try {
    const resolved = await resolveConfig({ root, mode: 'development', logLevel: 'silent' }, 'serve');
    assert.ok(resolved.publicDir.endsWith('/public')); assert.equal(resolved.appType, 'spa');
    assert.deepEqual(resolved.server.proxy, { '/api': { target: 'http://127.0.0.1:5174', changeOrigin: true } });
  } finally {
    if (previous === undefined) delete process.env.VITE_SMV_RELEASE_MODE; else process.env.VITE_SMV_RELEASE_MODE = previous;
  }
});
test('actual frontend build excludes experimental modules/assets and retains full dependency licenses', async () => {
  const previous = process.env.VITE_SMV_RELEASE_MODE;
  process.env.VITE_SMV_RELEASE_MODE = 'frontend-demo';
  try {
    const resolved = await resolveConfig({ root, mode: 'frontend-demo', logLevel: 'silent' }, 'build');
    assert.equal(resolved.publicDir, ''); assert.equal(resolved.appType, 'mpa');
    assert.deepEqual(resolved.preview.proxy, {}); assert.deepEqual(resolved.preview.headers, frontendDemoHeaders);
    const result = await build({ root, mode: 'frontend-demo', logLevel: 'silent', build: { write: false } });
    const bundles = Array.isArray(result) ? result : [result];
    const files = bundles.flatMap(bundle => 'output' in bundle ? bundle.output : []);
    assert.ok(files.some(file => file.fileName === 'index.html'));
    assert.ok(files.some(file => file.fileName === 'release-info.html'));
    assert.ok(files.some(file => file.fileName === 'LICENSE.txt'));
    assert.ok(!files.some(file => /GazeExperiment|gaze\/|\.wasm$|tracker\.worker|face_landmarker/.test(file.fileName)));
    const modules = files.flatMap(file => file.type === 'chunk' ? Object.keys(file.modules) : []);
    assert.ok(modules.length > 0);
    assert.ok(!modules.some(id => /\/src\/gaze\/|\/node_modules\/(?:@realeye-io|@mediapipe)\//.test(id)));
    for (const name of ['react', 'react-dom', 'scheduler']) {
      const license = files.find(file => file.type === 'asset' && file.fileName === 'licenses/' + name + '-LICENSE.txt');
      assert.ok(license && license.type === 'asset');
      assert.match(String(license.source), /Permission is hereby granted/);
      assert.match(String(license.source), /THE SOFTWARE IS PROVIDED/);
    }
  } finally {
    if (previous === undefined) delete process.env.VITE_SMV_RELEASE_MODE; else process.env.VITE_SMV_RELEASE_MODE = previous;
  }
});

test('builder JSON reformatting is allowed only when every committed setting is identical', () => {
  const original = JSON.stringify({buildCommand:'npm run build:demo',headers:[{key:'Content-Security-Policy',value:"connect-src 'none'"}]});
  const reformatted = JSON.stringify(JSON.parse(original), null, 4) + '\n';
  assert.equal(releaseTreeDirty('',original,reformatted),false);
  assert.equal(releaseTreeDirty(' M vercel.json\n',original,reformatted),false);
  assert.equal(releaseTreeDirty(' M vercel.json',original,JSON.stringify({buildCommand:'npm run build'})),true);
  assert.equal(releaseTreeDirty(' M vercel.json',original,'invalid'),true);
  assert.equal(releaseTreeDirty(' M vercel.json\n M src/App.tsx',original,reformatted),true);
  assert.equal(releaseTreeDirty(' M vercel.json\n?? unexpected.js',original,reformatted),true);
  assert.equal(releaseTreeDirty('M  vercel.json',original,reformatted),true);
});

for (const mode of ['gaze-demo', 'public-demo']) test(mode + ' packages its isolated route and pinned local inference assets without arbitrary public files or an API proxy', async () => {
  const previous = process.env.VITE_SMV_RELEASE_MODE;
  process.env.VITE_SMV_RELEASE_MODE = mode;
  let fixture: string | undefined;
  try {
    // Exercise the same reviewed asset preparation used by the production build.
    // Its only network input is the pinned public model, verified by SHA-256.
    await promisify(execFile)(process.execPath, ['scripts/prepare-gaze-assets.mts'], { cwd: root, timeout: 60_000 });
    fixture = await mkdtemp(path.join(root, 'public', 'smv-excluded-fixture-'));
    await writeFile(path.join(fixture, 'owner-report.txt'), 'Synthetic exclusion fixture; no private data.');
    const resolved = await resolveConfig({ root, mode, logLevel: 'silent' }, 'build');
    assert.equal(resolved.publicDir, ''); assert.equal(resolved.appType, 'mpa');
    assert.deepEqual(resolved.server.proxy, {}); assert.deepEqual(resolved.preview.proxy, {});
    assert.deepEqual(resolved.preview.headers, mode === 'public-demo' ? publicDemoHeaders : gazeDemoHeaders);
    const result = await build({ root, mode, logLevel: 'silent', build: { write: false } });
    const files = (Array.isArray(result) ? result : [result]).flatMap(bundle => 'output' in bundle ? bundle.output : []);
    const asset = (name: string) => {
      const file = files.find(file => file.fileName === name);
      assert.ok(file && file.type === 'asset', 'Missing emitted asset: ' + name);
      return file.source;
    };
    const bytes = (name: string) => { const value = asset(name); return typeof value === 'string' ? Buffer.from(value) : value; };
    assert.equal(String(asset('gaze-experiment/index.html')), String(asset('index.html')));
    for (const match of String(asset('gaze-experiment/index.html')).matchAll(/(?:src|href)="(\/assets\/[^" ]+)"/g)) {
      assert.ok(files.some(file => file.fileName === match[1].slice(1)), 'Broken route asset: ' + match[1]);
    }
    const modules = files.flatMap(file => file.type === 'chunk' ? Object.keys(file.modules) : []);
    assert.ok(modules.some(id => id.endsWith('/src/gaze/GazeExperiment.tsx')));
    assert.ok(modules.some(id => id.endsWith('/src/gaze/GazeSandbox.tsx')));
    assert.ok(!modules.some(id => /\/server\/|\/node_modules\/@google\//.test(id)));
    assert.ok(!files.some(file => /(?:^|\/)(?:api|server|local-reports|\.local-cache|\.env)(?:\/|\.|$)|smv-excluded-fixture-/.test(file.fileName)));
    const manifest = JSON.parse(String(asset('gaze/provenance.json')));
    assert.equal(manifest.realeye, '1.1.0'); assert.equal(manifest.mediapipe, '0.10.18');
    const expectedAssets = ['face_landmarker.task', 'tracker.worker.js', 'wasm/vision_wasm_internal.js', 'wasm/vision_wasm_internal.wasm', 'wasm/vision_wasm_nosimd_internal.js', 'wasm/vision_wasm_nosimd_internal.wasm'];
    assert.deepEqual(manifest.assets.map((entry: {file: string}) => entry.file).sort(), [...expectedAssets].sort());
    for (const entry of manifest.assets) assert.equal(createHash('sha256').update(bytes('gaze/' + entry.file)).digest('hex'), entry.sha256);
    assert.equal(createHash('sha256').update(bytes('gaze/face_landmarker.task')).digest('hex'), '64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff');
    for (const name of ['vision_wasm_internal', 'vision_wasm_nosimd_internal']) {
      assert.deepEqual([...bytes('gaze/wasm/' + name + '.wasm').slice(0, 4)], [0, 97, 115, 109]);
    }
    assert.ok(bytes('gaze/tracker.worker.js').length > 100_000);
    for (const name of ['RealEye-LICENSE.txt', 'RealEye-AGPL.md', 'RealEye-THIRD-PARTY.md', 'RealEye-MODELS.md', 'RealEye-COMMERCIAL.md', 'MediaPipe-Apache-2.0.txt', 'ml-matrix-MIT.txt', 'ml-array-min-LICENSE.txt', 'ml-array-max-LICENSE.txt', 'ml-array-rescale-LICENSE.txt', 'is-any-array-LICENSE.txt']) {
      assert.equal(Buffer.from(bytes('gaze/licenses/dependencies/' + name)).toString(), await readFile(path.join(root, 'docs/licenses', name), 'utf8'));
    }
    assert.match(String(asset('gaze/licenses/SMV-AGPL-3.0.txt')), /GNU AFFERO GENERAL PUBLIC LICENSE/);
    const info = JSON.parse(String(asset('release-info.json')));
    assert.equal(info.mode, mode); assert.equal(info.publicationVerified, false);
    assert.match(String(asset('release-info.html')), /Physical validation is pending/);
    if (mode === 'public-demo') assert.match(String(asset('release-info.html')), /server-authorized demo session and available shared quotas/);
    else assert.match(String(asset('release-info.html')), /Listening, Gemini and ElevenLabs are unavailable/);
  } finally {
    if (fixture) await rm(fixture, { recursive: true, force: true });
    if (previous === undefined) delete process.env.VITE_SMV_RELEASE_MODE; else process.env.VITE_SMV_RELEASE_MODE = previous;
  }
});

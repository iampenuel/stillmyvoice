import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build, resolveConfig } from 'vite';
import { frontendDemoHeaders, releaseProvenance, releaseInfoHtml } from '../scripts/frontend-demo-profile.mts';

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
test('Vercel configuration is static-only, disables automatic deployment, and matches preview security headers', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.equal(config.framework, 'vite'); assert.equal(config.outputDirectory, 'dist');
  assert.equal(config.buildCommand, 'npm run build:demo'); assert.equal(config.installCommand, 'npm ci');
  assert.equal(config.git.deploymentEnabled, false);
  assert.equal(config.rewrites, undefined); assert.equal(config.functions, undefined);
  assert.deepEqual(Object.fromEntries(config.headers[0].headers.map((entry: { key: string; value: string }) => [entry.key, entry.value])), frontendDemoHeaders);
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

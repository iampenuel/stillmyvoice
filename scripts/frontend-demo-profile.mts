// SPDX-License-Identifier: AGPL-3.0-or-later
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

export const frontendDemoHeaders = Object.freeze({
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; media-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), serial=(self)',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
});
export const gazeDemoHeaders = Object.freeze({
  ...frontendDemoHeaders,
  'Content-Security-Policy': "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; media-src 'none'; worker-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'Permissions-Policy': 'camera=(self), microphone=(), geolocation=(), serial=(self)',
});
export const publicDemoHeaders = Object.freeze({
  ...gazeDemoHeaders,
  'Content-Security-Policy': gazeDemoHeaders['Content-Security-Policy'].replace("media-src 'none'", "media-src 'self' blob:"),
  'Permissions-Policy': 'camera=(self), microphone=(self), geolocation=(), serial=(self)',
});
export type PublicReleaseMode = 'frontend-demo' | 'gaze-demo' | 'public-demo';
export const gazeReleaseFiles = Object.freeze([
  'face_landmarker.task', 'tracker.worker.js', 'provenance.json',
  'wasm/vision_wasm_internal.js', 'wasm/vision_wasm_internal.wasm',
  'wasm/vision_wasm_nosimd_internal.js', 'wasm/vision_wasm_nosimd_internal.wasm',
  'licenses/SMV-AGPL-3.0.txt',
]);
export type ReleaseProvenance = Readonly<{ revision: string | null; dirty: boolean | null; sourceUrl: string | null; publicationVerified: false }>;
export function releaseProvenance(input: { gitRevision?: string; vercelRevision?: string; releaseRevision?: string; dirty: boolean | null; vercel: boolean }): ReleaseProvenance {
  const revisions = [input.gitRevision, input.vercelRevision, input.releaseRevision];
  for (const revision of revisions) {
    if (revision !== undefined && !/^[a-f0-9]{40}$/.test(revision)) throw Error('Release revision must be a complete Git SHA.');
  }
  if (new Set(revisions.filter(revision => revision !== undefined)).size > 1) throw Error('Local and deployment source revisions differ.');
  const revision = input.vercelRevision ?? input.gitRevision ?? input.releaseRevision ?? null;
  if (input.vercel && !revision) throw Error('Vercel frontend builds require an identified committed source revision: Git metadata is absent. Set only the approved public SMV_RELEASE_COMMIT_SHA.');
  if (input.vercel && input.dirty === true) throw Error('Vercel frontend builds require an identified committed source revision: the working tree is dirty.');
  return Object.freeze({ revision, dirty: input.dirty, sourceUrl: revision ? 'https://github.com/iampenuel/stillmyvoice/tree/' + revision : null, publicationVerified: false });
}
/** Vercel may reserialize its JSON config. Only an exact parsed-value match is harmless. */
export function releaseTreeDirty(status: string, committedConfig?: string, currentConfig?: string): boolean {
  const changes = status.split('\n').filter(line => line.trim());
  if (!changes.length) return false;
  if (changes.length !== 1 || changes[0] !== ' M vercel.json' || committedConfig === undefined || currentConfig === undefined) return true;
  try { return !isDeepStrictEqual(JSON.parse(committedConfig), JSON.parse(currentConfig)); } catch { return true; }
}
function provenance(): ReleaseProvenance {
  const cwd = fileURLToPath(new URL('../', import.meta.url));
  let gitRevision: string | undefined, dirty: boolean | null = null;
  try {
    gitRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const status = execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trimEnd();
    dirty = status.length > 0;
    if (process.env.VERCEL === '1' && status === ' M vercel.json') {
      const committed = execFileSync('git', ['show', 'HEAD:vercel.json'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      const current = readFileSync(new URL('../vercel.json', import.meta.url), 'utf8');
      dirty = releaseTreeDirty(status, committed, current);
      if (dirty) {
        const before = JSON.parse(committed), after = JSON.parse(current);
        const changedKeys = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(key => !isDeepStrictEqual(before[key], after[key]));
        console.error('SMV builder changed configuration keys: ' + JSON.stringify(changedKeys));
      }
    }
    // Paths only; never print file contents, environment values or credentials.
    if (process.env.VERCEL === '1' && dirty) console.error('SMV build changed paths: ' + JSON.stringify(status.split('\n').slice(0, 20)));
  } catch { /* Git metadata can be absent in an immutable Vercel Git build. */ }
  // This single public SHA can be supplied without exposing Vercel's broader system variables.
  // It must be updated to the exact approved gitSource SHA for each manual release.
  return releaseProvenance({ gitRevision, dirty, vercelRevision: process.env.VERCEL_GIT_COMMIT_SHA || undefined,
    releaseRevision: process.env.SMV_RELEASE_COMMIT_SHA || undefined, vercel: process.env.VERCEL === '1' });
}
export function releaseInfoHtml(info: ReleaseProvenance, mode: PublicReleaseMode = 'frontend-demo'): string {
  const source = info.sourceUrl ? '<a href="' + info.sourceUrl + '">Source at ' + info.revision + '</a>' : 'Source revision is unavailable.';
  const warning = info.dirty === true
    ? 'Local preparation build contains uncommitted changes. The linked commit does not represent the complete working tree. Do not deploy this artifact.'
    : 'Source publication has not been verified by this build. Verify that the exact linked source is public before authorizing deployment.';
  return '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SMV source and license</title><body>'
    + '<main><h1>SMV frontend demo — source and license</h1><p>' + warning + '</p><p>' + source + '</p>'
    + (mode === 'public-demo' ? '<p>Composition and separately approved browser speech are available without Demo access. Gemini, ElevenLabs and consent-based Listening require a server-authorized demo session and available shared quotas. Camera inference stays on your device.</p>' : '<p>This build supports local composition, physical-switch input and separately approved browser speech. Listening, Gemini and ElevenLabs are unavailable on this public site.</p>')
    + (mode !== 'frontend-demo' ? '<p><a href="/gaze-experiment">Optional eye gaze experiment</a>: camera off by default, local inference only. Physical validation is pending; gaze cannot select or speak in the communication workspace.</p><p><a href="/gaze/licenses/dependencies/RealEye-AGPL.md">RealEye license</a> · <a href="/gaze/provenance.json">Pinned asset provenance</a></p>' : '<p>The isolated gaze experiment is unavailable in this build.</p>')
    + '<p><a href="/LICENSE.txt">SMV: AGPL-3.0-or-later</a> · <a href="/THIRD_PARTY_NOTICES.md">Third-party notices</a></p>'
    + '<p>Bundled dependencies: <a href="/licenses/react-LICENSE.txt">React license</a> · <a href="/licenses/react-dom-LICENSE.txt">React DOM license</a> · <a href="/licenses/scheduler-LICENSE.txt">Scheduler license</a></p>'
    + '<p>Publication, deployment and DNS changes require separate owner authorization. This page is preparation evidence, not a deployment claim.</p><p><a href="/">Return to SMV</a></p></main></body></html>\n';
}
/** Demo artifacts are allowlisted; local gaze assets and worker chunks cannot leak into this profile. */
export function frontendDemoAssets(mode: PublicReleaseMode = 'frontend-demo'): Plugin {
  return { name: 'smv-frontend-demo-assets', apply: 'build', enforce: 'post', async generateBundle(_options, bundle) {
    for (const [name, output] of Object.entries(bundle)) {
      if (mode !== 'frontend-demo') continue;
      if (/(?:^|\/)gaze(?:\/|[-.])|GazeExperiment|tracker\.worker|face_landmarker|\.wasm$/i.test(name)) throw Error('Experimental asset entered frontend demo.');
      if (output.type === 'chunk' && Object.keys(output.modules).some(id => /\/src\/gaze\/|\/node_modules\/(?:@realeye-io|@mediapipe)\//.test(id))) throw Error('Experimental module entered frontend demo.');
    }
    const info = provenance();
    for (const [filename, relative] of [
      ['LICENSE.txt', '../LICENSE'], ['THIRD_PARTY_NOTICES.md', '../THIRD_PARTY_NOTICES.md'],
      ['licenses/react-LICENSE.txt', '../node_modules/react/LICENSE'],
      ['licenses/react-dom-LICENSE.txt', '../node_modules/react-dom/LICENSE'],
      ['licenses/scheduler-LICENSE.txt', '../node_modules/scheduler/LICENSE'],
    ]) this.emitFile({ type: 'asset', fileName: filename, source: await readFile(new URL(relative, import.meta.url), 'utf8') });
    if (mode !== 'frontend-demo') {
      const manifest = JSON.parse(await readFile(new URL('../public/gaze/provenance.json', import.meta.url), 'utf8')) as { realeye: string; mediapipe: string; assets: {file: string; sha256: string}[] };
      if (manifest.realeye !== '1.1.0' || manifest.mediapipe !== '0.10.18') throw Error('Unreviewed gaze asset versions.');
      const dependencyLicenses = ['RealEye-LICENSE.txt', 'RealEye-MODELS.md', 'RealEye-COMMERCIAL.md', 'RealEye-THIRD-PARTY.md', 'RealEye-AGPL.md', 'MediaPipe-Apache-2.0.txt', 'ml-matrix-MIT.txt', 'ml-array-min-LICENSE.txt', 'ml-array-max-LICENSE.txt', 'ml-array-rescale-LICENSE.txt', 'is-any-array-LICENSE.txt'];
      for (const filename of [...gazeReleaseFiles, ...dependencyLicenses.map(name => 'licenses/dependencies/' + name)]) {
        const bytes = await readFile(new URL('../public/gaze/' + filename, import.meta.url));
        const entry = manifest.assets.find(asset => asset.file === filename);
        if (!filename.startsWith('licenses/') && filename !== 'provenance.json' && (!entry || createHash('sha256').update(bytes).digest('hex') !== entry.sha256)) throw Error('Gaze release asset integrity mismatch: ' + filename);
        this.emitFile({ type: 'asset', fileName: 'gaze/' + filename, source: bytes });
      }
      const html = bundle['index.html'];
      if (!html || html.type !== 'asset') throw Error('Gaze release requires the main HTML entry.');
      this.emitFile({ type: 'asset', fileName: 'gaze-experiment/index.html', source: html.source });
    }
    this.emitFile({ type: 'asset', fileName: 'release-info.html', source: releaseInfoHtml(info, mode) });
    this.emitFile({ type: 'asset', fileName: 'release-info.json', source: JSON.stringify({ mode, ...info }, null, 2) + '\n' });
  } };
}

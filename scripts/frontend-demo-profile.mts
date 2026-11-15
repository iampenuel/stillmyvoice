// SPDX-License-Identifier: AGPL-3.0-or-later
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

export const frontendDemoHeaders = Object.freeze({
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; media-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), serial=(self)',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
});
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
function provenance(): ReleaseProvenance {
  const cwd = fileURLToPath(new URL('../', import.meta.url));
  let gitRevision: string | undefined, dirty: boolean | null = null;
  try {
    gitRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().length > 0;
  } catch { /* Git metadata can be absent in an immutable Vercel Git build. */ }
  // This single public SHA can be supplied without exposing Vercel's broader system variables.
  // It must be updated to the exact approved gitSource SHA for each manual release.
  return releaseProvenance({ gitRevision, dirty, vercelRevision: process.env.VERCEL_GIT_COMMIT_SHA || undefined,
    releaseRevision: process.env.SMV_RELEASE_COMMIT_SHA || undefined, vercel: process.env.VERCEL === '1' });
}
export function releaseInfoHtml(info: ReleaseProvenance): string {
  const source = info.sourceUrl ? '<a href="' + info.sourceUrl + '">Source at ' + info.revision + '</a>' : 'Source revision is unavailable.';
  const warning = info.dirty === true
    ? 'Local preparation build contains uncommitted changes. The linked commit does not represent the complete working tree. Do not deploy this artifact.'
    : 'Source publication has not been verified by this build. Verify that the exact linked source is public before authorizing deployment.';
  return '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SMV source and license</title><body>'
    + '<main><h1>SMV frontend demo — source and license</h1><p>' + warning + '</p><p>' + source + '</p>'
    + '<p>This build supports local composition, physical-switch input and separately approved browser speech. Listening, Gemini, ElevenLabs and the isolated gaze experiment are unavailable.</p>'
    + '<p><a href="/LICENSE.txt">SMV: AGPL-3.0-or-later</a> · <a href="/THIRD_PARTY_NOTICES.md">Third-party notices</a></p>'
    + '<p>Bundled dependencies: <a href="/licenses/react-LICENSE.txt">React license</a> · <a href="/licenses/react-dom-LICENSE.txt">React DOM license</a> · <a href="/licenses/scheduler-LICENSE.txt">Scheduler license</a></p>'
    + '<p>Publication, deployment and DNS changes require separate owner authorization. This page is preparation evidence, not a deployment claim.</p><p><a href="/">Return to SMV</a></p></main></body></html>\n';
}
/** Demo artifacts are allowlisted; local gaze assets and worker chunks cannot leak into this profile. */
export function frontendDemoAssets(): Plugin {
  return { name: 'smv-frontend-demo-assets', apply: 'build', async generateBundle(_options, bundle) {
    for (const [name, output] of Object.entries(bundle)) {
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
    this.emitFile({ type: 'asset', fileName: 'release-info.html', source: releaseInfoHtml(info) });
    this.emitFile({ type: 'asset', fileName: 'release-info.json', source: JSON.stringify({ mode: 'frontend-demo', ...info }, null, 2) + '\n' });
  } };
}

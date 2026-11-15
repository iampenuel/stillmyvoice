/** ACCESS-02 offline exact-text comparison. No hardware, network, audio or browser. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as current from '../src/communication/model.mts';

const baselineCommit = '18b92a6';
const repository = fileURLToPath(new URL('../', import.meta.url));
const baselineSource = execFileSync('git', ['show', `${baselineCommit}:src/communication/model.mts`], { cwd: repository, encoding: 'utf8' });
// Load the exact accepted historical model, resolving its existing pure contracts
// against this repository. Only a uniquely named temporary module is created.
const temporary = mkdtempSync(join(tmpdir(), 'smv-keyboard-baseline-'));
const modulePath = join(temporary, 'model.mts');
let baseline: typeof current;
try {
  writeFileSync(modulePath, baselineSource.replace(/from '(\.\/[^']+)'/g, (_, relative: string) => `from '${new URL(relative, new URL('../src/communication/model.mts', import.meta.url)).href}'`));
  baseline = await import(pathToFileURL(modulePath).href);
} finally {
  unlinkSync(modulePath); rmdirSync(temporary);
}

const groups = ['abcde', 'fghij', 'klmno', 'pqrst', 'uvwxyz'];
const fixtures = ['help', 'headache', 'belly weak today', 'please do not move', 'please reposition me'];
function run(lib: typeof current, text: string) {
  let state = lib.initialModel('fictional-visible-keyboard');
  if (lib === current) assert.equal((state as current.Model & { alphabetMode?: string }).alphabetMode, 'visible', 'The new condition must actually use the visible experiment');
  let selections = 0, scanAdvances = 0;
  const trace: { action: string; advances: number }[] = [];
  function select(action: string) {
    const advances = lib.inputView(state).targets.indexOf(action);
    assert.ok(advances >= 0, `Missing ${action} in ${state.screen.name}:${state.screen.value ?? ''}`);
    selections++; scanAdvances += advances; trace.push({ action, advances });
    const next = lib.choose(state, action, state.uiRevision);
    assert.notEqual(next, state, 'Every requested action must be accepted');
    state = next;
    assert.equal(state.authorization, null, 'Spelling must not authorize audio');
  }
  select('spell');
  for (const letter of text) {
    if (letter === ' ') select('char: ');
    else {
      const group = groups.find(value => value.includes(letter));
      assert.ok(group);
      select(`row:${group}`); select(`char:${letter}`);
    }
  }
  select('done');
  assert.equal(state.draft, text);
  assert.equal(state.screen.name, 'compose');
  assert.equal(trace.length, selections);
  assert.equal(trace.reduce((total, action) => total + action.advances, 0), scanAdvances);
  return { selections, scanAdvances, exactDraft: state.draft,
    observedPhysicalCycles: null, totalEntryTimeMs: null, observedWrongSelections: null,
    observedCorrections: null, observedRecoveryActions: null,
    ...(process.argv.includes('--trace') ? { trace } : {}),
  };
}
console.log(JSON.stringify({
  evidence: 'Executed deterministic model routes, not physical performance or visual acceptance.',
  baselineCommit,
  baselineModelSha256: createHash('sha256').update(baselineSource).digest('hex'),
  currentModelSha256: createHash('sha256').update(readFileSync(new URL('../src/communication/model.mts', import.meta.url))).digest('hex'),
  assumptions: 'Same exact lowercase fictional text, empty draft, AI disabled, existing five alphabetical row groups, Spell and Done included. Actual enabled target order and configured starting target; no missed targets. Current default is the visible experiment; historical baseline uses range selection. No inferred timing, physical events, review or speech.',
  rows: fixtures.map(text => ({ text, acceptedRanges: run(baseline, text), visibleExperiment: run(current, text) })),
}, null, 2));

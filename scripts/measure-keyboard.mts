/** Offline keyboard policy comparison; the application model is never modified. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { choose, initialModel, inputView } from '../src/communication/model.mts';

const rows = ['abcde', 'fghij', 'klmno', 'pqrst', 'uvwxyz'];
const fixtures = ['bed', 'feed', 'school', 'book', 'help', 'please', 'reposition', 'need', 'not', 'belly hurts weak today'];
function measure(text: string, remainWithinGroup: boolean) {
  let state = initialModel('fictional-keyboard-measure');
  let selections = 0, scanAdvances = 0;
  const trace: { action: string; advances: number; view: string }[] = [];
  function select(action: string) {
    const beforeRow = state.screen.value;
    const advances = inputView(state).targets.indexOf(action);
    assert.ok(advances >= 0, `Unavailable action ${action} in ${state.screen.name}:${beforeRow}`);
    selections++; scanAdvances += advances;
    trace.push({ action, advances, view: `${state.screen.name}:${beforeRow ?? ''}` });
    state = choose(state, action, state.uiRevision);
    if (remainWithinGroup && /^char:[a-z]$/.test(action)) {
      assert.ok(beforeRow && rows.includes(beforeRow));
      // Counterfactual ONLY: after a completed letter choice, stay in that group,
      // restarting at its first target. No application/input source is changed.
      state = { ...state, screen: { name: 'keyboard', value: beforeRow }, focusId: null };
    }
    assert.equal(state.authorization, null);
  }
  select('spell');
  for (const letter of text) {
    if (letter === ' ') {
      if (state.screen.value !== 'rows') select('row:rows');
      select('char: ');
      continue;
    }
    const wanted = rows.find(row => row.includes(letter));
    assert.ok(wanted, 'Fixtures contain lowercase English letters and spaces only');
    if (state.screen.value !== wanted) {
      if (state.screen.value !== 'rows') select('row:rows');
      select(`row:${wanted}`);
    }
    select(`char:${letter}`);
  }
  if (state.screen.value !== 'rows') select('row:rows');
  select('done');
  assert.equal(state.draft, text);
  assert.equal(state.screen.name, 'compose');
  return { selections, scanAdvances, exactDraft: state.draft, ...(process.argv.includes('--trace') ? { trace } : {}) };
}
console.log(JSON.stringify({
  evidence: 'Automated current-model traversal versus a hypothetical post-letter screen override; not physical performance or implemented behavior.',
  modelSha256: createHash('sha256').update(readFileSync(new URL('../src/communication/model.mts', import.meta.url))).digest('hex'),
  assumptions: 'Empty draft; AI disabled equally; fixed alphabet groups and existing Back to rows/Space/Done controls. Include Spell and Done. Current policy resets to groups with its existing last-group focus. Hypothetical policy retains letter group, restarting at first letter after each choice; existing Back to rows resets to first group. No missed targets, physical durations, review/speech, or measured times.',
  rows: fixtures.map(text => ({ text, current: measure(text, false), remainWithinGroup: measure(text, true) })),
}, null, 2));

/** Offline route accounting only. Does not open hardware, call a provider, or play audio. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { choose, finishExpansion, initialModel, inputView, presented, type Model } from '../src/communication/model.mts';
import type { CommunicationContext, ExpansionResult } from '../src/communication/expansion-contract.mts';
import { knownAmbiguity, validateExpansion, validateExpansionRequest } from '../server/expansion.mts';

type Phase = 'composition' | 'expansion' | 'clarification' | 'approval' | 'context';
type Count = { selections: number; scanAdvances: number };
type Task = { id: string; target: string; keywords: string; clarification?: string };
const tasks: Task[] = [
  { id: 'comfort', target: 'Please reposition me.', keywords: 'please reposition me' },
  { id: 'longer-care', target: 'My belly hurts, and I feel weak today.', keywords: 'belly hurts weak today' },
  { id: 'clarification-request', target: 'Please repeat the last question.', keywords: 'please repeat last question' },
  { id: 'education-work', target: 'I need more time to finish my assignment.', keywords: 'i need more time finish my assignment' },
  { id: 'negation', target: 'I do not want to be repositioned.', keywords: 'do not want repositioned' },
  { id: 'ambiguous', target: 'My belly hurts daily, and I feel weak.', keywords: 'belly weak daily hurt', clarification: 'Belly pain' },
];
const candidate = (text: string): ExpansionResult => ({ status: 'candidate', candidate: text, unresolvedCues: [], clarificationQuestion: '', clarificationChoices: [] });
const clarification: ExpansionResult = { status: 'clarify', candidate: '', unresolvedCues: ['daily'], clarificationQuestion: 'Which happens daily?', clarificationChoices: ['Belly pain', 'Weakness', 'Both', 'Keep my words'] };
const alphabetRows = ['abcde', 'fghij', 'klmno', 'pqrst', 'uvwxyz'];

function runner(expansionAvailable = true) {
  let state: Model = initialModel('fictional-intent-measure');
  // Shared session setup is explicit and outside the measured message task.
  if (state.screen.name === 'context') state = choose(state, 'context-set:general', state.uiRevision);
  assert.equal(state.screen.name, 'compose');
  // Identical prepared voice. Baseline excludes disabled AI targets; no real provider runs.
  state.settings.voice = 'fixture-voice';
  state.cloud.consent = expansionAvailable;
  state.cloud.gemini = expansionAvailable;
  const counts: Record<Phase, Count> = Object.fromEntries(['composition', 'expansion', 'clarification', 'approval', 'context'].map(key => [key, { selections: 0, scanAdvances: 0 }])) as Record<Phase, Count>;
  const trace: { action: string; phase: Phase; screen: string; advances: number }[] = [];
  let simulatedExpansionResponses = 0, deterministicClarificationResponses = 0;
  function select(action: string, phase: Phase = 'composition') {
    const index = inputView(state).targets.indexOf(action);
    assert.ok(index >= 0, `Missing/disabled ${action} on ${state.screen.name}:${state.screen.value ?? ''}`);
    assert.equal(state.authorization, null, 'Authorization must not precede the fresh final Speak selection');
    counts[phase].selections++;
    counts[phase].scanAdvances += index;
    trace.push({ action, phase, screen: state.screen.name, advances: index });
    const next = choose(state, action, state.uiRevision);
    assert.notEqual(next, state, `Selection did not transition: ${action}`);
    state = next;
    if (action !== 'speak') assert.equal(state.authorization, null, `Unexpected authorization after ${action}`);
  }
  function spell(text: string) {
    select('spell');
    for (const original of text) {
      const letter = original.toLowerCase();
      if (original !== letter) {
        select('row:editing'); select('upper'); select('row:rows');
      }
      if (letter === ' ') select('char: ');
      else if (/[a-z]/.test(letter)) {
        const row = alphabetRows.find(value => value.includes(letter));
        assert.ok(row, `Unsupported letter ${original}`);
        select(`row:${row}`); select(`char:${letter}`);
      } else if (".,?!'".includes(letter)) {
        select('row:editing'); select('row:punctuation'); select("row:.,?!'"); select(`char:${letter}`);
      } else throw Error(`Unsupported fixture character: ${original}`);
    }
    assert.equal(state.draft, text, 'Actual keyboard route must enter the exact fixture');
  }
  function respond(result: ExpansionResult) {
    const request = state.expansion.request;
    assert.ok(request, 'A deliberate selection must create each request');
    validateExpansionRequest(request);
    const checked = validateExpansion(result, request);
    assert.deepEqual(checked, result, 'Every supplied fixture must survive the real server validation/clarification path');
    if (knownAmbiguity(request)) deterministicClarificationResponses++;
    const original = state.draft;
    state = finishExpansion(state, request, checked);
    simulatedExpansionResponses++;
    assert.equal(state.draft, original, 'Response alone must preserve the original keywords');
    assert.equal(state.authorization, null, 'Response must not authorize speech');
  }
  function approve(exact: string) {
    assert.equal(state.screen.name, 'review');
    assert.ok(state.review);
    const pages = state.review.pages.length;
    for (let page = 0; page < pages; page++) {
      // Simulates the UI's full-page visibility acknowledgement; it does not measure reading.
      state = presented(state, state.revision, page, state.review!.pages[page]);
      assert.equal(state.authorization, null, 'Reading review must remain silent');
      if (page + 1 < pages) select('next', 'approval');
    }
    select('speak', 'approval');
    assert.equal(state.authorization?.text, exact, 'Both routes must authorize identical full wording');
    assert.equal(state.authorization?.preview, false);
  }
  function result() {
    return {
      selections: Object.values(counts).reduce((sum, value) => sum + value.selections, 0),
      scanAdvances: Object.values(counts).reduce((sum, value) => sum + value.scanAdvances, 0),
      phases: counts,
      simulatedExpansionResponses, deterministicClarificationResponses,
      simulatedGeminiResponses: simulatedExpansionResponses - deterministicClarificationResponses,
      exactAuthorizedText: state.authorization?.text ?? null,
      // Null means unmeasured, not zero.
      physicalSelectionsObserved: null, compositionTimeMs: null, timeToAudibleSpeechMs: null,
      providerLatencyMs: null, observedMeaningErrorRate: null, unintendedAudibleSpeechEvents: null,
      unexpectedModelAuthorizations: 0,
      ...(process.argv.includes('--trace') ? { trace } : {}),
    };
  }
  return { select, spell, respond, approve, result, state: () => state };
}

function baseline(task: Task) {
  const route = runner(false);
  route.spell(task.target);
  route.select('done');
  route.select('review', 'approval');
  route.approve(task.target);
  return route.result();
}
function assisted(task: Task, rejectOnce = false) {
  const route = runner();
  route.spell(task.keywords);
  route.select('expand', 'expansion');
  if (task.clarification) {
    route.respond(clarification);
    route.select(`clarify-expansion:${clarification.clarificationChoices.indexOf(task.clarification)}`, 'clarification');
    assert.equal(route.state().expansion.request?.clarification, task.clarification);
  }
  if (rejectOnce) {
    route.respond(candidate('please reposition me.'));
    // Reject different capitalization, which the server permits, for the exact target.
    // This measures a deliberate stylistic retry, not a model meaning-error rate.
    route.select('retry-expansion', 'expansion');
  }
  route.respond(candidate(task.target));
  route.select('accept-expansion', 'approval');
  route.approve(task.target);
  return { ...route.result(), clarificationSelections: task.clarification ? 1 : 0, rejectedFixtureCandidates: rejectOnce ? 1 : 0, spellingCorrections: 0 };
}
function contextSetup(context: CommunicationContext) {
  const route = runner();
  route.select('context', 'context');
  route.select(`context-set:${context}`, 'context');
  assert.equal(route.state().context, context);
  return { context, ...route.result().phases.context };
}
const rows = tasks.map(task => ({ ...task, baseline: baseline(task), assisted: assisted(task) }));
const quickPhrase = runner();
quickPhrase.select('phrases'); quickPhrase.select('phrase:2'); quickPhrase.select('review', 'approval'); quickPhrase.approve(tasks[0].target);
const modelSha256 = createHash('sha256').update(readFileSync(new URL('../src/communication/model.mts', import.meta.url))).digest('hex');
const validatorSha256 = createHash('sha256').update(readFileSync(new URL('../server/expansion.mts', import.meta.url))).digest('hex');
console.log(JSON.stringify({
  evidence: 'Automated deterministic model traversal with scripted provider fixtures; not hardware, browser, provider-performance or AAC-user evidence.',
  modelSha256, validatorSha256,
  assumptions: 'General is explicitly selected as session setup outside the counted task. Start with an empty draft, a prepared voice and released/armed input. Baseline has AI disabled; assisted has cloud demo gates ready. Both routes use the same fixed letter groups, exact target capitalization/punctuation and General context. Each fresh view starts at inputView initial target; no targets are missed. Setup, Resume, reading, physical press durations, synchronization, network and playback are unmeasured. Each simulated choose stands for one deliberate complete cycle but is not a physical event.',
  rows,
  contextSetup: ['home', 'healthcare', 'community', 'education_work'].map(value => contextSetup(value as CommunicationContext)),
  existingComfortPhraseRoute: quickPhrase.result(),
  oneRejectedCandidateSensitivity: assisted(tasks[0], true),
}, null, 2));

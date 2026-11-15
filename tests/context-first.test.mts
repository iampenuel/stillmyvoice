import test from 'node:test';
import assert from 'node:assert/strict';
import { initialModel, choose, choices, choiceSections, contextPhrases, inputView, interrupt, finishExpansion, presented, type Model } from '../src/communication/model.mts';
import { contextOptions, type CommunicationContext, type ExpansionResult } from '../src/communication/expansion-contract.mts';
import { InputCoordinator } from '../src/communication/input-coordinator.mts';

const step = (model: Model, id: string) => {
  assert.ok(choices(model).some(choice => choice.id === id && !choice.disabled), `${id} must be enabled on ${model.screen.name}`);
  return choose(model, id, model.uiRevision);
};
const enter = (context: CommunicationContext = 'general') => step(initialModel('context-test'), `context-set:${context}`);

test('fresh context screen has the owner order, General and direct silent entry to the same workspace', () => {
  const initial = initialModel('fresh-session');
  assert.equal(initial.screen.name, 'context');
  assert.deepEqual(choices(initial).map(choice => choice.label), ['Home', 'Healthcare', 'Community', 'Education & Work', 'General', 'Back']);
  assert.deepEqual(inputView(initial).targets, ['context-set:home', 'context-set:healthcare', 'context-set:community', 'context-set:education_work', 'context-set:general', 'back']);
  assert.equal(choices(initial).find(choice => choice.id === 'context-set:general')?.detail, 'No specific context');
  assert.equal(choices(initial).some(choice => choice.id === 'back'), true);
  for (const { id } of contextOptions) {
    const model = step(initial, `context-set:${id}`);
    assert.equal(model.context, id); assert.equal(model.screen.name, 'compose');
    assert.deepEqual(model.stack, []); assert.equal(model.draft, ''); assert.equal(model.authorization, null);
    assert.deepEqual(choiceSections(model).primary.map(choice => choice.id), ['phrases', 'spell', 'listen', 'expand']);
    assert.deepEqual(choiceSections(model).navigation.map(choice => choice.id), ['context', 'review', 'more']);
  }
});

test('context changes vocabulary while shared Stop, Help, categories and ordinary spelling remain available', () => {
  const representative: Record<CommunicationContext, string> = {
    home: 'I need some rest.', healthcare: 'I am uncomfortable.', community: "I'd like to join.",
    education_work: 'I would like to contribute.', general: 'Please reposition me.',
  };
  for (const { id } of contextOptions) {
    const home = enter(id), phrases = step(home, 'phrases');
    const options = choices(phrases).filter(choice => choice.id.startsWith('phrase:'));
    assert.equal(options.length, 6);
    assert.deepEqual(options.map(choice => choice.label), contextPhrases[id]);
    assert.ok(options.some(choice => choice.label === representative[id]));
    assert.equal(options[0].label, 'Please stop.'); assert.equal(options[1].label, 'I need help.');
    const selected = step(phrases, options.find(choice => choice.label === representative[id])!.id);
    assert.equal(selected.draft, representative[id]); assert.equal(selected.authorization, null);
    assert.equal(selected.screen.name, 'compose'); assert.equal(selected.context, id);
    assert.ok(choices(phrases).some(choice => choice.id === 'all-categories' && !choice.disabled));
    assert.equal(step(home, 'spell').screen.name, 'keyboard');
  }
});

test('changing context and recovering focus preserve exact draft, context, settings and session', () => {
  let model = enter('home');
  model.draft = 'Please do not move my left arm.'; model.revision = 7;
  model.undo = ['Please move my left arm.']; model.settings.voice = 'chosen-voice';
  model.listenedContext = 'A fictional partner question.';
  const original = structuredClone(model);
  model = step(step(model, 'context'), 'context-set:healthcare');
  assert.equal(model.screen.name, 'compose'); assert.equal(model.context, 'healthcare');
  assert.equal(model.draft, original.draft); assert.equal(model.revision, original.revision);
  assert.deepEqual(model.undo, original.undo); assert.deepEqual(model.settings, original.settings);
  assert.equal(model.session, original.session); assert.equal(model.listenedContext, original.listenedContext);
  assert.equal(model.authorization, null);
  model = step(interrupt(model, 'Focus lost — communication preserved'), 'resume');
  assert.equal(model.screen.name, 'compose'); assert.equal(model.context, 'healthcare');
  assert.equal(model.draft, original.draft); assert.equal(model.authorization, null);
  model = step(step(step(model, 'more'), 'clear'), 'confirm-clear');
  assert.equal(model.screen.name, 'compose'); assert.equal(model.context, 'healthcare'); assert.equal(model.draft, '');
});

test('main Listen is direct and deliberate; unavailable Expand stays visible with an accurate reason and no scan target', () => {
  let model = enter();
  const expansion = () => choices(model).find(choice => choice.id === 'expand')!;
  assert.equal(expansion().disabled, true); assert.equal(expansion().detail, 'Add a few words first.');
  assert.equal(inputView(model).targets.includes('expand'), false);
  const listening = step(model, 'listen');
  assert.equal(listening.screen.name, 'listening'); assert.equal(listening.listen.phase, 'consent');
  assert.equal(listening.listen.session, null); assert.equal(listening.authorization, null);
  model.draft = 'not ready';
  assert.match(expansion().detail!, /Companion setup/);
  model.cloud.consent = true; model.cloud.geminiReason = 'Local Gemini request limit reached.';
  assert.equal(expansion().detail, model.cloud.geminiReason); assert.equal(expansion().disabled, true);
  model.cloud.gemini = true;
  assert.equal(expansion().disabled, false); assert.ok(inputView(model).targets.includes('expand'));
  assert.equal(expansion().detail, 'Optional wording suggestion.');
  assert.deepEqual(choiceSections(model).primary.map(choice => choice.id), ['phrases', 'spell', 'listen', 'expand']);
});

test('Use this wording enters silent review and still needs fresh exact-message approval', () => {
  let model = enter('healthcare'); model.draft = 'not ready'; model.settings.voice = 'test-voice';
  model.cloud.consent = true; model.cloud.gemini = true;
  model = step(model, 'expand'); const request = model.expansion.request!;
  const result: ExpansionResult = { status: 'candidate', candidate: 'I am not ready.', unresolvedCues: [], clarificationQuestion: '', clarificationChoices: [] };
  model = finishExpansion(model, request, result);
  assert.equal(model.draft, 'not ready'); assert.equal(model.authorization, null);
  assert.equal(choices(model).find(choice => choice.id === 'accept-expansion')?.label, 'Use this wording');
  assert.equal(choices(model).find(choice => choice.id === 'edit-expansion')?.label, 'Edit');
  assert.ok(choices(model).some(choice => choice.label === 'Keep my words'));
  assert.ok(choices(model).some(choice => choice.label === 'Back'));
  const oldView = model.uiRevision;
  model = step(model, 'accept-expansion');
  assert.equal(model.draft, result.candidate); assert.equal(model.screen.name, 'review'); assert.equal(model.authorization, null);
  assert.equal(choose(model, 'speak', model.uiRevision), model);
  model = presented(model, model.revision, 0);
  assert.equal(choose(model, 'speak', oldView), model);
  model = step(model, 'speak'); assert.equal(model.authorization?.text, result.candidate);
  assert.equal(model.context, 'healthcare');
});

test('a complete context switch cycle cannot also choose a phrase or repeat during a hold', () => {
  let model = initialModel('context-cycle'), accepted = 0, serial = 0;
  const controller = new InputCoordinator(inputView(model), {
    changed: () => {}, interrupted: () => {}, selected: selection => {
      accepted++; model = choose(model, selection.targetId, selection.revision); controller.setView(inputView(model));
    },
  }, undefined, () => true, () => `context-${++serial}`, async () => {});
  controller.simulate(); controller.tick();
  assert.equal(controller.state.view?.targets[controller.state.index], 'context-set:healthcare');
  controller.down(); for (let i = 0; i < 12; i++) { controller.tick(); controller.down(); }
  assert.equal(model.screen.name, 'context'); assert.equal(accepted, 0);
  controller.up(); assert.equal(model.screen.name, 'compose'); assert.equal(model.context, 'healthcare'); assert.equal(accepted, 1);
  controller.up(); assert.equal(accepted, 1); assert.equal(model.draft, '');
  controller.down(); controller.up(); assert.equal(model.screen.name, 'phrases'); assert.equal(accepted, 2);
  assert.equal(model.draft, ''); assert.equal(model.authorization, null); controller.stop('done', false);
});

test('context selection has a separate semantic state and leaves descriptions clean',()=>{
 const initial=initialModel('selected-context');
 assert.ok(choices(initial).filter(c=>c.id.startsWith('context-set:')).every(c=>c.selected===false));
 let m=step(step(initial,'context-set:healthcare'),'context');
 for(const option of contextOptions) {
  const choice=choices(m).find(c=>c.id===`context-set:${option.id}`)!;
  assert.equal(choice.detail,option.description);assert.equal(choice.selected,option.id==='healthcare');
 }
 assert.deepEqual(choiceSections(m).navigation.map(c=>c.id),['context-set:general','back']);
 assert.equal(m.authorization,null);
});

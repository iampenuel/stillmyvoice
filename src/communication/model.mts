import { contextOptions, type CommunicationContext, type ExpansionRequest, type ExpansionResult } from './expansion-contract.mts';
import { initialCloud, PREVIEW_TEXT, type CloudState, type AssistRequest, type Suggestion } from './cloud-contract.mts';
/** Authorship and navigation only. This module cannot generate input or play audio. */
export type Voice = Readonly<{ id: string; name: string; lang: string; local: boolean }>;
export type Authorization = Readonly<{
  id: string; text: string; revision: number; voice: string; rate: number;
  provider: 'browser' | 'elevenlabs'; preview: boolean;
}>;
export type Choice = Readonly<{ id: string; label: string; detail?: string; disabled?: boolean; selected?: boolean }>;
export type Screen = {
  name: 'compose' | 'categories' | 'phrases' | 'keyboard' | 'repair' | 'review' | 'more'
    | 'neutral-replies' | 'listening' | 'context' | 'expansion' | 'settings' | 'values' | 'voices' | 'premium-voices' | 'voice-detail' | 'assist' | 'assist-context' | 'suggestions' | 'reader' | 'clear' | 'paused' | 'speaking' | 'complete' | 'speech-error';
  value?: string; page?: number;
};
type Repair = { start: number; end: number; revision: number; buffer: string; undo: string[]; upper: boolean; deleteRequested: boolean };
export type Model = {
  draft: string; revision: number; uiRevision: number; undo: string[];
  screen: Screen; stack: Screen[]; notice: string; focusId: string | null;
  provenance: 'Your words' | 'Your edited wording' | 'Suggestion selected';
  repair: Repair | null; upper: boolean;
  review: { revision: number; pages: string[]; seen: number[] } | null;
  settings: { pace: number; size: number; voice: string; rate: number; provider: 'browser' | 'elevenlabs'; systemVoice?: string };
  cloud: CloudState; assistance: { request: AssistRequest | null; revision: number; state: 'idle' | 'loading' | 'ready' | 'failed'; items: Suggestion[]; error: string };
  context: CommunicationContext; expansion: ExpansionState; alphabetMode: 'visible' | 'grouped'; listenedContext: string; listen: ListeningState;
  voices: Voice[]; authorization: Authorization | null;
  speech: 'Not spoken' | 'Awaiting approval' | 'Preparing' | 'Speaking' | 'Stopped' | 'Playback finished' | 'Speech failed';
  lastPlayed: string | null; speechPreview?: boolean; serial: number; session: string;
};
export type ListeningState = { phase: 'consent' | 'ready' | 'requesting' | 'recording' | 'processing' | 'transcript' | 'error'; session: string | null; transcript: string; error: string };
const initialListening = (): ListeningState => ({ phase: 'consent', session: null, transcript: '', error: '' });
export const alphabetRows = ['abcde', 'fghij', 'klmno', 'pqrst', 'uvwxyz'] as const;
const neutralReplies = ['Yes.', 'No.', 'Please repeat that.'] as const;
export type ExpansionState = { request: ExpansionRequest | null; source: string; revision: number; result: ExpansionResult | null; state: 'idle' | 'loading' | 'ready' | 'failed'; error: string; answer: string; editing: boolean; buffer: string; undo: string[] };
const initialExpansion = (): ExpansionState => ({ request: null, source: '', revision: 0, result: null, state: 'idle', error: '', answer: '', editing: false, buffer: '', undo: [] });
const editingText = (s: Model) => s.expansion.editing ? s.expansion.buffer : s.repair?.buffer ?? s.draft;
const canExpand = (s: Model) => !!s.draft.trim() && s.cloud.consent && s.cloud.gemini;
const expansionHint = (s: Model) => !s.draft.trim() ? 'Add a few words first.'
  : !s.cloud.consent ? 'Enable fictional cloud demo in Companion setup.'
  : !s.cloud.gemini ? s.cloud.geminiReason || 'Gemini is unavailable. You can still spell and use phrases.'
  : 'Optional wording suggestion.';
export const phrases: Record<string, readonly string[]> = {
  Essentials: ['I need help.', 'Please stop.', 'Yes.', 'No.'],
  Comfort: ['Please reposition me.', 'I am not ready.', 'Please give me a moment.'],
  Clarification: ['Please repeat that.', 'That is not what I meant.', 'Please ask one question at a time.'],
  Conversation: ['Hello.', 'Thank you.', 'I have something to say.', 'Please wait while I write.'],
};
export const quickPhrases = ['Please stop.', 'I need help.', 'Please reposition me.', 'I am not ready.', 'Please repeat that.', 'That is not what I meant.'] as const;
/** Initial fictional vocabulary, never a diagnosis or a restriction on spelling. */
export const contextPhrases: Record<CommunicationContext, readonly string[]> = {
  home: ['Please stop.', 'I need help.', 'Please help me.', 'I need some rest.', 'Can we talk?', 'Please give me a moment.'],
  healthcare: ['Please stop.', 'I need help.', 'Please repeat that.', 'I am uncomfortable.', 'I have a question.', 'That is not what I meant.'],
  community: ['Please stop.', 'I need help.', 'How are you?', 'I have something to say.', "I'd like to join.", 'Could you give me a moment?'],
  education_work: ['Please stop.', 'I need help.', 'I have a question.', 'Please explain that again.', 'I would like to contribute.', 'I need more time.'],
  general: quickPhrases,
};
const phraseList = (category: string, context: CommunicationContext) => category === 'Quick phrases' ? contextPhrases[context] : phrases[category];
const c = (id: string, label: string, disabled = false, detail?: string): Choice => ({ id, label, disabled, detail });
const speechAvailable = (s: Model) => !!s.settings.voice && (s.settings.provider === 'browser' || (s.cloud.consent && s.cloud.elevenlabs && s.cloud.voices.some(v => v.id === s.settings.voice && v.available)));
export const candidateVoice = (s: Model) => s.screen.name === 'voice-detail' ? s.cloud.voices.find(v => v.id === s.screen.value) : undefined;
const candidateAvailable = (s: Model) => !!candidateVoice(s)?.available && s.cloud.consent && s.cloud.elevenlabs;
const back = () => c('back', 'Back');
const more = () => c('more', 'More controls');
export function initialModel(session: string): Model {
  return { draft: '', revision: 0, uiRevision: 0, undo: [], screen: { name: 'context' }, stack: [], notice: '', focusId: null,
    provenance: 'Your words', repair: null, upper: false, review: null, authorization: null, speech: 'Not spoken',
    context: 'general', expansion: initialExpansion(), alphabetMode: 'visible', listenedContext: '', listen: initialListening(), lastPlayed: null, serial: 0, session, voices: [], cloud: initialCloud(), assistance: { request: null, revision: 0, state: 'idle', items: [], error: '' },
    settings: { pace: 1600, size: 100, voice: '', rate: 1, provider: 'browser' } };
}
/** The exact enabled targets rendered by the UI, with its requested starting target. */
export function inputView(model: Model) {
  const sections = choiceSections(model);
  const targets = [...sections.primary, ...sections.navigation].filter(x => !x.disabled).map(x => x.id);
  const start = model.focusId ? Math.max(0, targets.indexOf(model.focusId)) : 0;
  return { id: model.screen.name, revision: model.uiRevision, targets: [...targets.slice(start), ...targets.slice(0, start)] };
}
const navigationIds = new Set(['back', 'more', 'review', 'done', 'resume', 'stop', 'pause', 'all-categories', 'row:navigation', 'row:rows', 'char: ', 'erase', 'context', 'neutral-replies', 'context-set:general', 'keyboard-layout']);
export function choiceSections(model: Model) {
  const list = choices(model);
  const overview = model.screen.name === 'keyboard' && (model.screen.value ?? 'rows') === 'rows' && !model.repair && !model.expansion.editing;
  const navigation = (id: string) => navigationIds.has(id) || (overview && id === 'row:editing');
  return { primary: list.filter(x => !navigation(x.id)), navigation: list.filter(x => navigation(x.id)) };
}
export function words(text: string) {
  return [...text.matchAll(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)]
    .map(m => ({ text: m[0], start: m.index, end: m.index + m[0].length }));
}
export function choices(s: Model): Choice[] {
  const screen = s.screen, page = screen.page ?? 0;
  switch (screen.name) {
    case 'compose': return [c('phrases', 'Phrases'), c('spell', 'Spell'), c('listen', 'Listen'),
      c('expand', 'Expand my words', !canExpand(s), expansionHint(s)), c('context', 'Change context', false, contextOptions.find(option => option.id === s.context)?.name ?? 'General'),
      ...(!s.draft.trim() && s.listenedContext ? [c('neutral-replies', 'Neutral replies', false, 'Fixed options · no inferred answer')] : []),
      c('review', 'Review message', !s.draft.trim()), more()];
    case 'neutral-replies': return [...neutralReplies.map((text, i) => c(`neutral:${i}`, text)), back()];
    case 'listening': return [...(s.listen.phase === 'consent' ? [c('listen-consent', 'Speaker agrees · Continue', !s.cloud.consent)] : s.listen.phase === 'ready' ? [c('listen-start', 'Start recording', !s.cloud.consent)] : s.listen.phase === 'recording' ? [c('listen-stop', 'Stop recording')] : s.listen.phase === 'transcript' ? [c('listen-accept', 'Use as conversation context'), c('listen-retry', 'Record again')] : s.listen.phase === 'error' ? [c('listen-retry', 'Try again')] : []), c('listen-cancel', 'Cancel listening')];
    case 'context': return [...contextOptions.map(option => ({ ...c(`context-set:${option.id}`, option.name, false, option.description), selected: !!s.stack.length && s.context === option.id })), back()];
    case 'expansion': return [...(s.expansion.result?.status === 'candidate' ? [c('accept-expansion', 'Use this wording'), c('edit-expansion', 'Edit')] : []),
      ...(s.expansion.result?.status === 'clarify' ? s.expansion.result.clarificationChoices.filter(text => text !== 'Keep my words').map((text, i) => c(`clarify-expansion:${i}`, text)) : []),
      c('keep-words', 'Keep my words'), ...(s.expansion.result?.status !== 'candidate' ? [c('continue-spelling', 'Continue spelling')] : []), ...(s.expansion.state !== 'loading' && s.expansion.result?.status !== 'candidate' ? [c('retry-expansion', 'Try another', !canExpand(s))] : []), back()];
    case 'categories': return [...Object.keys(phrases).map(x => c(`category:${x}`, x)), back(), more()];
    case 'phrases': return [...phraseList(screen.value!, s.context)!.map((x, i) => c(`phrase:${i}`, x)),
      ...(screen.value === 'Quick phrases' ? [c('all-categories', 'All categories')] : []), back(), more()];
    case 'repair': {
      const list = words(s.draft);
      return [...list.slice(page * 5, page * 5 + 5).map((x, i) => c(`word:${page * 5 + i}`, x.text, false, `Word ${page * 5 + i + 1}`)),
        ...(list.length > 5 ? [c('next', 'Next words', (page + 1) * 5 >= list.length), c('previous', 'Previous words', page === 0)] : []),
        c('spell', 'Add more wording'), back(), more()];
    }
    case 'keyboard': {
      const row = screen.value ?? 'rows';
      if (row === 'rows') return [c('row:abcde', 'A–E'), c('row:fghij', 'F–J'), c('row:klmno', 'K–O'),
        c('row:pqrst', 'P–T'), c('row:uvwxyz', 'U–Z'), c('row:editing', !s.repair && !s.expansion.editing ? 'Editing' : 'Editing and controls'),
        ...(s.repair ? [c('prefix:not', 'Add “do not ” before this word', false, `Stages: do not ${s.draft.slice(s.repair.start, s.repair.end)}`)] : []),
        c('done', s.expansion.editing ? 'Save candidate' : s.repair ? 'Apply correction' : 'Done', s.expansion.editing ? !s.expansion.buffer.trim() : !!s.repair && !s.repair.buffer && !s.repair.deleteRequested),
        c('char: ', 'Space'), c('erase', 'Backspace', !editingText(s)),
        ...(!s.repair && !s.expansion.editing ? [c('expand', 'Expand my words', !canExpand(s)), c('keyboard-layout', s.alphabetMode === 'visible' ? 'Use grouped keyboard' : 'Use visible alphabet'), c('review', 'Review message', !s.draft.trim()), back()] : [])];
      if (row === 'numbers') return [c('row:01234', '0–4'), c('row:56789', '5–9'), c('row:editing', 'Space and editing'), c('row:navigation', 'Navigation'), c('row:rows', 'Letters')];
      if (row === 'punctuation') return [c("row:.,?!'", 'Period, comma, question, exclamation, apostrophe'), c('row:-:;/()', 'Dash, colon, semicolon, slash, parentheses'), c('row:editing', 'Space and editing'), c('row:navigation', 'Navigation'), c('row:rows', 'Letters')];
      if (row === 'editing') return [c('char: ', 'Space'), c('erase', 'Backspace', !editingText(s)),
        c('undo', 'Undo', !(s.expansion.editing ? s.expansion.undo.length : s.repair ? s.repair.undo.length : s.undo.length)),
        c('upper', 'Uppercase next', false, (s.repair?.upper ?? s.upper) ? 'On' : 'Off'),
        c('row:numbers', 'Numbers'), c('row:punctuation', 'Punctuation'),
        ...(s.repair ? [c('delete-word', 'Delete selected word')] : []), back(), c('pause', 'Pause scanning'), c('more', 'More controls', s.expansion.editing), c('row:rows', 'Back to rows')];
      if (row === 'navigation') return [c('done', s.expansion.editing ? 'Save candidate' : s.repair ? 'Apply correction' : 'Done', s.expansion.editing ? !s.expansion.buffer.trim() : !!s.repair && !s.repair.buffer && !s.repair.deleteRequested),
        back(), c('pause', 'Pause scanning'), c('more', 'More controls', s.expansion.editing), c('row:rows', 'Back to rows')];
      return [...Array.from(row).map(x => c(`char:${x}`, (s.repair?.upper ?? s.upper) ? x.toUpperCase() : x)), c('row:rows', 'Back to rows')];
    }
    case 'review': {
      const complete = s.review?.revision === s.revision && s.review.seen.length === s.review.pages.length;
      return [...(s.review && s.review.pages.length > 1 ? [c('next', 'Next part', page + 1 >= s.review.pages.length), c('previous', 'Previous part', page === 0)] : []),
        c('speak', s.lastPlayed === s.draft ? 'Speak again' : 'Speak exactly this', !complete || !speechAvailable(s),
          !complete ? 'Read every part before speaking.' : !speechAvailable(s) ? 'Choose an available voice in Settings.' : 'A separate selection authorizes the full message.'),
        ...(s.settings.provider === 'elevenlabs' && !speechAvailable(s) ? [c('fallback', 'Speak using system voice', !s.voices.length, 'Review again before approval.')] : []), c('edit', 'Make changes'), back(), more()];
    }
    case 'more': return [c('home', 'Your message', !!s.repair || s.expansion.editing, s.repair || s.expansion.editing ? 'Finish or cancel the correction first.' : undefined), c('undo', 'Undo', !(s.expansion.editing ? s.expansion.undo.length : s.repair ? s.repair.undo.length : s.undo.length)),
      c('listen', 'Listen', false, 'Optional partner question · fictional demo'), c('reader', 'Read message', !s.draft), c('assist', 'Suggestions', false, 'Optional wording help'), c('settings', 'Settings'), c('clear', 'New message', !s.draft), c('pause', 'Pause scanning'), back()];
    case 'settings': return [c('value:pace', 'Scan pace', false, `${s.settings.pace / 1000} seconds`),
      c('value:size', 'Text size', false, `${s.settings.size}%`), c('voices', 'Voice', false, (s.settings.provider === 'elevenlabs' ? s.cloud.voices : s.voices).find(x => x.id === s.settings.voice)?.name ?? 'Choose a voice'),
      c('value:rate', 'Speech rate', false, `${s.settings.rate}×`), c('preview', 'Preview voice', !speechAvailable(s)), back(), more()];
    case 'values': return [...(screen.value === 'pace' ? [800, 1200, 1600, 2000, 3000] : screen.value === 'size' ? [100, 125, 150, 200] : s.settings.provider === 'elevenlabs' ? [0.75, 1, 1.2] : [0.75, 1, 1.25])
      .map(x => c(`set:${x}`, screen.value === 'pace' ? `${x / 1000} seconds` : screen.value === 'size' ? `${x}%` : `${x}×`)), back()];
    case 'voices': return [c('premium-voices', 'ElevenLabs voices', false, 'Six selected voices'), ...s.voices.slice(page * 5, page * 5 + 5).map((x, i) => c(`voice:${i + page * 5}`, x.name, false, (s.settings.provider === 'browser' && s.settings.voice === x.id ? 'Selected · ' : '') + `${x.lang} · ${x.local ? 'Device voice — offline not verified' : 'May use network'}`)),
      c('next', 'Next voices', (page + 1) * 5 >= s.voices.length), c('previous', 'Previous voices', page === 0), back()];
    case 'premium-voices': return [...s.cloud.voices.map((v, i) => c(`premium:${i}`, v.name, false,
      `${s.settings.provider === 'elevenlabs' && s.settings.voice === v.id ? 'Selected · ' : ''}${v.group} · ${v.description} · ${!v.available ? v.reason : !s.cloud.consent ? 'Enable fictional cloud demo in Companion setup' : !s.cloud.elevenlabs ? s.cloud.elevenReason : 'Ready for deliberate preview'}`)),
      c('voices', 'System voices'), back()];
    case 'voice-detail': return [c('preview', 'Preview voice', !candidateAvailable(s)),
      c('use-voice', 'Use this voice', !candidateAvailable(s)), c('back-to-voices', 'Back to voices')];
    case 'assist': return [c('assist-context', 'Suggest a reply', !s.cloud.gemini || !s.cloud.consent, 'Choose a fictional question'),
      c('assist-spelling', 'Check spelling', !s.cloud.gemini || !s.cloud.consent || !s.draft.trim()),
      c('assist-wording', 'Suggest clearer wording', !s.cloud.gemini || !s.cloud.consent || !s.draft.trim()),
      c('spell', 'Continue spelling'), c('phrases', 'Choose a phrase'), back()];
    case 'assist-context': return fictionalContexts.map((text, i) => c(`context:${i}`, text)).concat([back()]);
    case 'suggestions': return [...s.assistance.items.map((item, i) => c(`suggestion:${i}`, item.text, false, s.draft ? 'Optional suggestion · replaces draft; Undo is available' : 'Optional suggestion · editable before review')),
      c('reject-suggestions', s.assistance.state === 'loading' ? 'Cancel request' : 'Reject all'), c('spell', 'Continue spelling'), c('phrases', 'Choose a phrase')];
    case 'reader': return [c('next', 'Next part', !s.review || page + 1 >= s.review.pages.length), c('previous', 'Previous part', page === 0), back(), c('pause', 'Pause scanning')];
    case 'clear': return [c('back', 'Keep message'), c('confirm-clear', 'Clear message')];
    case 'paused': return [c('resume', 'Resume scanning')];
    case 'speaking': return [c('stop', s.authorization?.preview ? 'Stop preview' : 'Stop speaking')];
    case 'complete': return [c('review', 'Review again'), c('edit', 'Edit wording'), c('clear', 'New message')];
    case 'speech-error': return [...(s.settings.provider === 'elevenlabs' ? [c('fallback', 'Speak using system voice', !s.voices.length, 'Review again, then approve with a fresh cycle.')] : []), c('review', 'Back to review'), c('voices', 'Choose voice'), more()];
  }
}
export function title(s: Model): string {
  const names: Record<Screen['name'], string> = { compose: 'Make your message', categories: 'Choose a category', phrases: s.screen.value === 'Quick phrases' && s.context !== 'general' ? `${contextOptions.find(option => option.id === s.context)?.name ?? 'Your'} phrases` : s.screen.value ?? 'Phrases',
    'neutral-replies': 'Neutral replies', listening: 'Listening', context: 'Communication context', expansion: s.expansion.result?.status === 'clarify' ? 'One clarification' : 'Inspect expanded wording', keyboard: s.expansion.editing ? 'Edit candidate only' : s.repair ? 'Correct this word' : 'Spell your message', repair: 'Choose a word to correct', review: 'Review before speaking', more: 'More controls',
    settings: 'Your settings', values: `Choose ${s.screen.value}`, voices: 'System voices', 'premium-voices': 'ElevenLabs voices', 'voice-detail': candidateVoice(s)?.name ?? 'Voice unavailable', assist: 'Optional suggestions', 'assist-context': 'Fictional conversation', suggestions: 'Suggestions', reader: 'Read your message', clear: 'Start a new message?',
    paused: 'Scanning paused', speaking: s.authorization?.preview ? 'Voice preview' : 'Your approved message', complete: 'Message playback ended', 'speech-error': 'Speech stopped' };
  return names[s.screen.name];
}
function go(s: Model, screen: Screen) { s.stack = [...s.stack.slice(-31), s.screen]; s.screen = screen; }
function pop(s: Model) {
  s.screen = s.stack.pop() ?? { name: 'compose' };
  if ((s.screen.name === 'review' || s.screen.name === 'reader') && (!s.review || s.review.revision !== s.revision)) {
    s.screen.page = 0;
    s.review = { revision: s.revision, pages: paginate(s.draft, Math.max(36, Math.floor(18000 / s.settings.size))), seen: [] };
  }
}
function home(s: Model) { s.screen = { name: 'compose' }; s.stack = []; s.repair = null; s.focusId = s.draft ? 'review' : 'phrases'; }
function editDraft(s: Model, text: string) {
  if (text === s.draft) return;
  if (text.length > 4096) { s.notice = 'Message limit reached (4,096 characters). Your existing words are kept.'; return; }
  s.undo = [...s.undo.slice(-49), s.draft]; s.draft = text; s.revision++; s.review = null;
  s.authorization = null; s.expansion.request = null; s.speech = 'Not spoken'; s.speechPreview = false; s.provenance = 'Your edited wording';
}
function editBuffer(s: Model, text: string) {
  if (s.expansion.editing) { if (text.length <= 600) { s.expansion.undo = [...s.expansion.undo.slice(-49), s.expansion.buffer]; s.expansion.buffer = text; } return; }
  if (!s.repair) return editDraft(s, text);
  if (text.length > 4096) { s.notice = 'Correction is too long.'; return; }
  s.repair.undo = [...s.repair.undo.slice(-49), s.repair.buffer]; s.repair.buffer = text;
  s.repair.deleteRequested = false;
}
/** Conservative provisional pages. The UI must also confirm the whole current page is visible. */
export function paginate(text: string, limit = 180): string[] {
  if (!text) return [''];
  const out: string[] = [];
  for (let at = 0; at < text.length;) {
    let end = Math.min(at + limit, text.length);
    if (end < text.length && /[\uD800-\uDBFF]/.test(text[end - 1])) end--;
    if (end < text.length) { const space = text.lastIndexOf(' ', end); if (space > at + limit / 2) end = space + 1; }
    out.push(text.slice(at, end)); at = end;
  }
  return out;
}
function startReview(s: Model, name: 'review' | 'reader' = 'review') {
  s.review = { revision: s.revision, pages: paginate(s.draft, Math.max(36, Math.floor(18000 / s.settings.size))), seen: [] };
  if (name === 'review') s.speech = 'Awaiting approval';
  go(s, { name, page: 0 });
}
/** Called only after the exact complete page has rendered visibly. Never moves a target. */
export function presented(s: Model, revision: number, page: number, exactPage = s.review?.pages[page]): Model {
  if (s.screen.name !== 'review' || !s.review || s.review.revision !== revision || s.revision !== revision
    || (s.screen.page ?? 0) !== page || s.review.seen.includes(page) || s.review.pages[page] !== exactPage) return s;
  // Enabling Speak changes the target set and must go through a fresh input view.
  return { ...s, uiRevision: s.uiRevision + 1, review: { ...s.review, seen: [...s.review.seen, page] } };
}
export function choose(before: Model, id: string, viewRevision: number): Model {
  if (before.uiRevision !== viewRevision || !choices(before).some(x => x.id === id && !x.disabled)) return before;
  const s = structuredClone(before); s.uiRevision++; s.notice = ''; s.focusId = null;
  const page = s.screen.page ?? 0;
  if (id === 'back') {
    if (s.screen.name === 'keyboard' && s.expansion.editing) { s.expansion.editing = false; pop(s); }
    else if (s.screen.name === 'keyboard') { s.repair = null; home(s); }
    else pop(s);
  } else if (id === 'more') go(s, { name: 'more' });
  else if (id === 'phrases') go(s, { name: 'phrases', value: 'Quick phrases' });
  else if (id === 'all-categories') go(s, { name: 'categories' });
  else if (id === 'home') home(s);
  else if (id.startsWith('category:')) go(s, { name: 'phrases', value: id.slice(9) });
  else if (id.startsWith('phrase:')) { editDraft(s, s.draft + phraseList(s.screen.value!, s.context)![Number(id.slice(7))]); s.provenance = 'Your words'; home(s); }
  else if (id === 'spell') { s.repair = null; go(s, { name: 'keyboard', value: 'rows' }); }
  else if (id === 'review') startReview(s);
  else if (id === 'listen') { s.listen = initialListening(); go(s, { name: 'listening' }); }
  else if (id === 'neutral-replies') go(s, { name: 'neutral-replies' });
  else if (id.startsWith('neutral:')) { editDraft(s, neutralReplies[Number(id.slice(8))]); s.provenance = 'Your words'; startReview(s); }
  else if (id === 'listen-consent') s.listen.phase = 'ready';
  else if (id === 'listen-start') { s.listen = { ...initialListening(), phase: 'requesting', session: `${s.session}:listen:${++s.serial}` }; }
  else if (id === 'listen-stop') s.listen.phase = 'processing';
  else if (id === 'listen-cancel') { s.listen = initialListening(); pop(s); }
  else if (id === 'listen-retry') s.listen = initialListening();
  else if (id === 'listen-accept') { s.listenedContext = s.listen.transcript; s.listen = initialListening(); s.expansion = initialExpansion(); home(s); s.notice = 'Conversation context accepted. Your words are unchanged.'; }
  else if (id === 'keyboard-layout') s.alphabetMode = s.alphabetMode === 'visible' ? 'grouped' : 'visible';
  else if (id === 'context') go(s, { name: 'context' });
  else if (id.startsWith('context-set:')) { s.context = id.slice(12) as CommunicationContext; s.expansion = initialExpansion(); home(s); }
  else if (id === 'continue-spelling') { s.expansion = initialExpansion(); home(s); go(s, { name: 'keyboard', value: 'rows' }); }
  else if (id === 'expand' || id === 'retry-expansion' || id.startsWith('clarify-expansion:')) {
    const clarification = id.startsWith('clarify-expansion:') ? s.expansion.result?.clarificationChoices.filter(text => text !== 'Keep my words')[Number(id.slice(18))] ?? '' : id === 'retry-expansion' ? s.expansion.answer : '';
    if (id.startsWith('clarify-expansion:') && !['Belly pain','Weakness','Both'].includes(clarification)) {
      if (!clarification || s.expansion.source !== s.draft || s.expansion.revision !== s.revision) return before;
      // Stage the exact validated interpretation, with no second model call,
      // draft replacement or speech authorization.
      s.expansion.result = { status:'candidate', candidate:clarification, unresolvedCues:[], clarificationQuestion:'', clarificationChoices:[] };
      s.expansion.request = null; s.expansion.answer = ''; s.focusId = 'accept-expansion';
      return s;
    }
    if (!canExpand(s)) return before;
    s.expansion = { ...initialExpansion(), source: s.draft, revision: s.revision, state: 'loading', answer: clarification,
      request: { id: `${s.session}:${++s.serial}`, text: s.draft, context: s.context, clarification, transcript: s.listenedContext, synthetic: true } };
    if (s.screen.name !== 'expansion') go(s, { name: 'expansion' });
  } else if (id === 'keep-words') { s.expansion = initialExpansion(); home(s); }
  else if (id === 'accept-expansion') {
    const text = s.expansion.result?.candidate;
    if (!text?.trim() || s.expansion.source !== s.draft || s.expansion.revision !== s.revision) return before;
    editDraft(s, text); s.provenance = 'Suggestion selected'; startReview(s);
  } else if (id === 'edit-expansion') {
    if (s.expansion.result?.status !== 'candidate') return before;
    s.expansion.editing = true; s.expansion.buffer = s.expansion.result.candidate; s.expansion.undo = [];
    go(s, { name: 'keyboard', value: 'rows' });
  }
  else if (id === 'assist') go(s, { name: 'assist' });
  else if (id === 'assist-context') go(s, { name: 'assist-context' });
  else if (id === 'assist-spelling' || id === 'assist-wording' || id.startsWith('context:')) {
    if (!s.cloud.consent || !s.cloud.gemini) return before;
    const kind = id === 'assist-spelling' ? 'spelling_correction' : id === 'assist-wording' ? 'wording_alternative' : 'contextual_response';
    s.assistance = { request: { id: `${s.session}:${++s.serial}`, text: s.draft, context: id.startsWith('context:') ? fictionalContexts[Number(id.slice(8))] : '', kind, synthetic: true },
      revision: s.revision, state: 'loading', items: [], error: '' };
    go(s, { name: 'suggestions' });
  } else if (id.startsWith('suggestion:')) {
    const selected = s.assistance.items[Number(id.slice(11))];
    if (!selected || s.assistance.revision !== s.revision) return before;
    editDraft(s, selected.text); s.provenance = 'Suggestion selected'; s.assistance.request = null; s.assistance.items = []; home(s);
  } else if (id === 'reject-suggestions') { s.assistance.request = null; s.assistance.items = []; s.assistance.state = 'idle'; home(s); }
  else if (id === 'reader') startReview(s, 'reader');
  else if (id === 'edit') go(s, { name: 'repair', page: 0 });
  else if (id.startsWith('word:')) {
    const word = words(s.draft)[Number(id.slice(5))];
    if (word) { s.repair = { ...word, revision: s.revision, buffer: '', undo: [], upper: false, deleteRequested: false }; go(s, { name: 'keyboard', value: 'rows' }); }
  } else if (id === 'prefix:not' && s.repair) {
    editBuffer(s, 'do not ' + s.draft.slice(s.repair.start, s.repair.end));
    s.screen = { name: 'keyboard', value: 'navigation' };
    s.notice = 'Replacement staged. Apply correction changes the selected word; Back keeps your original message.';
  } else if (id.startsWith('row:')) s.screen = { name: 'keyboard', value: id.slice(4) };
  else if (id.startsWith('char:')) {
    let value = id.slice(5); if (s.repair?.upper ?? s.upper) value = value.toUpperCase();
    editBuffer(s, editingText(s) + value);
    if (s.repair) s.repair.upper = false; else s.upper = false;
    s.focusId = `row:${s.screen.value}`;
    s.screen = { name: 'keyboard', value: 'rows' };
  } else if (id === 'erase') editBuffer(s, Array.from(editingText(s)).slice(0, -1).join(''));
  else if (id === 'upper') { if (s.repair) s.repair.upper = !s.repair.upper; else s.upper = !s.upper; }
  else if (id === 'undo') {
    if (s.expansion.editing) s.expansion.buffer = s.expansion.undo.pop() ?? s.expansion.buffer;
    else if (s.repair) { s.repair.buffer = s.repair.undo.pop() ?? s.repair.buffer; s.repair.deleteRequested = false; }
    else { const old = s.undo.pop(); if (old !== undefined) { s.draft = old; s.revision++; s.review = null; s.authorization = null; s.speech = 'Not spoken'; } }
  } else if (id === 'delete-word' && s.repair) {
    editBuffer(s, ''); s.repair.deleteRequested = true; s.screen = { name: 'keyboard', value: 'navigation' };
    s.notice = 'Deletion is staged. Choose Apply correction to remove this word, or Back to keep it.';
  } else if (id === 'done') {
    if (s.expansion.editing && s.expansion.result) {
      s.expansion.result = { ...s.expansion.result, candidate: s.expansion.buffer }; s.expansion.editing = false; pop(s);
    } else {
    if (s.repair && s.repair.revision === s.revision) {
      const r = s.repair;
      // Delete is a deliberate action; never infer deletion from an empty correction.
      editDraft(s, s.draft.slice(0, r.start) + r.buffer + s.draft.slice(r.end));
    }
    home(s);
    }
  } else if (id === 'next') s.screen.page = page + 1;
  else if (id === 'previous') s.screen.page = page - 1;
  else if (id === 'clear') go(s, { name: 'clear' });
  else if (id === 'confirm-clear') { editDraft(s, ''); home(s); }
  else if (id === 'pause') go(s, { name: 'paused' });
  else if (id === 'resume') pop(s);
  else if (id === 'settings') go(s, { name: 'settings' });
  else if (id.startsWith('value:')) go(s, { name: 'values', value: id.slice(6) });
  else if (id.startsWith('set:')) {
    const key = s.screen.value as 'pace' | 'size' | 'rate'; s.settings[key] = Number(id.slice(4));
    if (key === 'size') s.review = null;
    pop(s);
    if (key === 'size') { go(s, { name: 'paused' }); s.notice = 'Text size changed. Resume when ready.'; }
  } else if (id === 'premium-voices') go(s, { name: 'premium-voices' });
  else if (id === 'voices') go(s, { name: 'voices', page: 0 });
  else if (id.startsWith('voice:')) { s.settings.voice = s.voices[Number(id.slice(6))].id; s.settings.systemVoice = s.settings.voice; s.settings.provider = 'browser'; pop(s); }
  else if (id.startsWith('premium:')) {
    const voice = s.cloud.voices[Number(id.slice(8))];
    if (!voice) return before;
    s.authorization = null; s.speechPreview = false; s.speech = s.draft && s.lastPlayed === s.draft ? 'Playback finished' : 'Not spoken';
    go(s, { name: 'voice-detail', value: voice.id });
  } else if (id === 'back-to-voices') { pop(s); }
  else if (id === 'use-voice') {
    const voice = candidateVoice(s);
    if (!voice?.available || !s.cloud.elevenlabs || !s.cloud.consent) return before;
    if (s.settings.provider === 'browser') s.settings.systemVoice = s.settings.voice;
    s.settings.provider = 'elevenlabs'; s.settings.voice = voice.id;
    const rateAdjusted = ![0.75, 1, 1.2].includes(s.settings.rate);
    if (rateAdjusted) s.settings.rate = 1;
    home(s); s.notice = `${voice.name} selected.${rateAdjusted ? ' Speech rate set to 1×.' : ''}`;
  } else if (id === 'fallback') {
    s.settings.provider = 'browser'; s.settings.voice = s.voices.find(v => v.id === s.settings.systemVoice)?.id ?? s.voices[0]?.id ?? '';
    startReview(s); s.notice = 'System voice selected. Review and approve again.';
  }
  else if (id === 'speak' || id === 'preview') {
    const candidate = id === 'preview' ? candidateVoice(s) : undefined;
    s.speechPreview = id === 'preview';
    s.authorization = Object.freeze({ id: `${s.session}:${++s.serial}`, text: id === 'preview' ? PREVIEW_TEXT : s.draft,
      revision: s.revision, voice: candidate?.id ?? s.settings.voice,
      rate: candidate && ![0.75, 1, 1.2].includes(s.settings.rate) ? 1 : s.settings.rate,
      provider: candidate ? 'elevenlabs' : s.settings.provider, preview: id === 'preview' });
    s.speech = 'Preparing'; go(s, { name: 'speaking' });
  } else if (id === 'stop') { s.authorization = null; s.speech = 'Stopped'; pop(s); }
  if (s.screen.name !== 'suggestions') s.assistance.request = null;
  if (s.screen.name !== 'expansion') s.expansion.request = null;
  if (s.screen.name !== 'listening' && s.listen.session) s.listen = initialListening();
  return s;
}
export function speechEvent(before: Model, id: string, event: 'start' | 'end' | 'error'): Model {
  if (before.authorization?.id !== id) return before;
  if (event === 'start') return { ...before, speech: 'Speaking' };
  const s = structuredClone(before), preview = s.authorization!.preview;
  s.authorization = null; s.uiRevision++;
  s.speech = event === 'end' ? 'Playback finished' : 'Speech failed';
  if (event === 'end' && !preview) s.lastPlayed = before.authorization!.text;
  if (preview) pop(s);
  else s.screen = { name: event === 'end' ? 'complete' : 'speech-error' };
  return s;
}
/** An interruption is never navigation, a release, a resume or speech approval. */
export function interrupt(before: Model, reason: string): Model {
  const s = structuredClone(before); s.uiRevision++; s.notice = reason;
  if (s.listen?.session) s.listen = { ...initialListening(), phase: 'error', error: 'Listening stopped. Your words are kept.' };
  if (s.expansion?.request) { s.expansion.request = null; s.expansion.state = 'failed'; s.expansion.error = 'Request canceled. Your words are kept.'; }
  if (s.assistance?.request) { s.assistance.request = null; s.assistance.state = 'failed'; s.assistance.error = 'Request canceled. Your words are kept.'; }
  if (reason.startsWith('Layout changed')) s.review = null;
  if (s.authorization) { s.authorization = null; s.speech = 'Stopped'; pop(s); }
  if (s.screen.name !== 'paused') go(s, { name: 'paused' });
  return s;
}
/** Fast refresh may retain React state while replacing controllers. Authored
 * state may survive; an old playback permission must never cross that boundary. */
export function retireRuntimeAuthorization(before: Model): Model {
  return before.authorization || before.assistance?.request || before.expansion?.request || before.listen?.session ? interrupt(before, 'Workspace restarted — speech approval canceled') : before;
}

export const fictionalContexts = ['Are you uncomfortable?', 'Would you like to change position?', 'Can I help?'] as const;
/** Upgrade retained development state without clearing an existing private draft. */
export function withCloudDefaults(before: Model): Model {
  return before.cloud && before.assistance && before.expansion && before.context && before.listen && before.alphabetMode && before.listenedContext !== undefined ? before : { ...before, alphabetMode: before.alphabetMode ?? 'visible', listenedContext: before.listenedContext ?? '', listen: before.listen ?? initialListening(), context: before.context ?? 'general', expansion: before.expansion ?? initialExpansion(), cloud: before.cloud ?? initialCloud(), assistance: before.assistance ?? { request: null, revision: before.revision, state: 'idle', items: [], error: '' } };
}
export function finishAssistance(before: Model, request: AssistRequest, items: Suggestion[], error = ''): Model {
  if (before.screen.name !== 'suggestions' || before.assistance.request?.id !== request.id || before.revision !== before.assistance.revision
    || before.draft !== request.text || !before.cloud.consent) return before;
  return { ...before, uiRevision: before.uiRevision + 1, assistance: { ...before.assistance, request: null, state: error ? 'failed' : 'ready', items: error ? [] : items, error } };
}

export function finishExpansion(before: Model, request: ExpansionRequest, result: ExpansionResult | null, error = ''): Model {
  if (before.screen.name !== 'expansion' || before.expansion.request?.id !== request.id || before.revision !== before.expansion.revision
    || before.draft !== request.text || before.context !== request.context || before.listenedContext !== (request.transcript ?? '') || !before.cloud.consent) return before;
  return { ...before, uiRevision: before.uiRevision + 1, expansion: { ...before.expansion, request: null, state: error ? 'failed' : 'ready', result: error ? null : result, error } };
}

export function listeningEvent(before: Model, id: string, event: 'recording' | 'processing' | 'transcript' | 'error', text = ''): Model {
  if (before.screen.name !== 'listening' || before.listen.session !== id) return before;
  if (event === 'recording' && before.listen.phase !== 'requesting') return before;
  if (event === 'processing' && before.listen.phase !== 'recording') return before;
  if (event === 'transcript' && (before.listen.phase !== 'processing' || !text.trim() || text.length > 1000)) return before;
  return { ...before, uiRevision: before.uiRevision + 1, listen: { ...before.listen, phase: event, transcript: event === 'transcript' ? text : before.listen.transcript, error: event === 'error' ? text : '', session: event === 'error' ? null : id } };
}

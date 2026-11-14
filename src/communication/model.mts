/** Authorship and navigation only. This module cannot generate input or play audio. */
export type Voice = Readonly<{ id: string; name: string; lang: string; local: boolean }>;
export type Authorization = Readonly<{
  id: string; text: string; revision: number; voice: string; rate: number;
  provider: 'browser' | 'elevenlabs'; preview: boolean;
}>;
export type Choice = Readonly<{ id: string; label: string; detail?: string; disabled?: boolean }>;
export type Screen = {
  name: 'compose' | 'categories' | 'phrases' | 'keyboard' | 'repair' | 'review' | 'more'
    | 'settings' | 'values' | 'voices' | 'reader' | 'clear' | 'paused' | 'speaking' | 'complete' | 'speech-error';
  value?: string; page?: number;
};
type Repair = { start: number; end: number; revision: number; buffer: string; undo: string[]; upper: boolean; deleteRequested: boolean };
export type Model = {
  draft: string; revision: number; uiRevision: number; undo: string[];
  screen: Screen; stack: Screen[]; notice: string; focusId: string | null;
  provenance: 'Your words' | 'Your edited wording' | 'Suggestion selected';
  repair: Repair | null; upper: boolean;
  review: { revision: number; pages: string[]; seen: number[] } | null;
  settings: { pace: number; size: number; voice: string; rate: number; provider: 'browser' | 'elevenlabs' };
  voices: Voice[]; authorization: Authorization | null;
  speech: 'Not spoken' | 'Awaiting approval' | 'Preparing' | 'Speaking' | 'Stopped' | 'Playback finished' | 'Speech failed';
  lastPlayed: string | null; serial: number; session: string;
};
export const phrases: Record<string, readonly string[]> = {
  Essentials: ['I need help.', 'Please stop.', 'Yes.', 'No.'],
  Comfort: ['Please reposition me.', 'I am not ready.', 'Please give me a moment.'],
  Clarification: ['Please repeat that.', 'That is not what I meant.', 'Please ask one question at a time.'],
  Conversation: ['Hello.', 'Thank you.', 'I have something to say.', 'Please wait while I write.'],
};
export const quickPhrases = ['Please stop.', 'I need help.', 'Please reposition me.', 'I am not ready.', 'Please repeat that.', 'That is not what I meant.'] as const;
const phraseList = (category: string) => category === 'Quick phrases' ? quickPhrases : phrases[category];
const c = (id: string, label: string, disabled = false, detail?: string): Choice => ({ id, label, disabled, detail });
const back = () => c('back', 'Back');
const more = () => c('more', 'More controls');
export function initialModel(session: string): Model {
  return { draft: '', revision: 0, uiRevision: 0, undo: [], screen: { name: 'compose' }, stack: [], notice: '', focusId: null,
    provenance: 'Your words', repair: null, upper: false, review: null, authorization: null, speech: 'Not spoken',
    lastPlayed: null, serial: 0, session, voices: [],
    settings: { pace: 1600, size: 100, voice: '', rate: 1, provider: 'browser' } };
}
/** The exact enabled targets rendered by the UI, with its requested starting target. */
export function inputView(model: Model) {
  const sections = choiceSections(model);
  const targets = [...sections.primary, ...sections.navigation].filter(x => !x.disabled).map(x => x.id);
  const start = model.focusId ? Math.max(0, targets.indexOf(model.focusId)) : 0;
  return { id: model.screen.name, revision: model.uiRevision, targets: [...targets.slice(start), ...targets.slice(0, start)] };
}
const navigationIds = new Set(['back', 'more', 'review', 'done', 'resume', 'stop', 'pause', 'all-categories', 'row:navigation', 'row:rows', 'char: ', 'erase']);
export function choiceSections(model: Model) {
  const list = choices(model);
  return { primary: list.filter(x => !navigationIds.has(x.id)), navigation: list.filter(x => navigationIds.has(x.id)) };
}
export function words(text: string) {
  return [...text.matchAll(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)]
    .map(m => ({ text: m[0], start: m.index, end: m.index + m[0].length }));
}
export function choices(s: Model): Choice[] {
  const screen = s.screen, page = screen.page ?? 0;
  switch (screen.name) {
    case 'compose': return [c('phrases', 'Phrases'), c('spell', 'Spell'),
      c('assist', 'Get suggestions', true, 'Cloud assistance is not configured.'),
      c('review', 'Review message', !s.draft.trim()), more()];
    case 'categories': return [...Object.keys(phrases).map(x => c(`category:${x}`, x)), back(), more()];
    case 'phrases': return [...phraseList(screen.value!)!.map((x, i) => c(`phrase:${i}`, x)),
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
        c('row:pqrst', 'P–T'), c('row:uvwxyz', 'U–Z'), c('row:editing', 'Editing and controls'),
        ...(s.repair ? [c('prefix:not', 'Add “do not ” before this word', false, `Stages: do not ${s.draft.slice(s.repair.start, s.repair.end)}`)] : []),
        c('done', s.repair ? 'Apply correction' : 'Done', !!s.repair && !s.repair.buffer && !s.repair.deleteRequested),
        c('char: ', 'Space'), c('erase', 'Backspace', !(s.repair?.buffer ?? s.draft))];
      if (row === 'numbers') return [c('row:01234', '0–4'), c('row:56789', '5–9'), c('row:editing', 'Space and editing'), c('row:navigation', 'Navigation'), c('row:rows', 'Letters')];
      if (row === 'punctuation') return [c("row:.,?!'", 'Period, comma, question, exclamation, apostrophe'), c('row:-:;/()', 'Dash, colon, semicolon, slash, parentheses'), c('row:editing', 'Space and editing'), c('row:navigation', 'Navigation'), c('row:rows', 'Letters')];
      if (row === 'editing') return [c('char: ', 'Space'), c('erase', 'Backspace', !(s.repair?.buffer ?? s.draft)),
        c('undo', 'Undo', !(s.repair ? s.repair.undo.length : s.undo.length)),
        c('upper', 'Uppercase next', false, (s.repair?.upper ?? s.upper) ? 'On' : 'Off'),
        c('row:numbers', 'Numbers'), c('row:punctuation', 'Punctuation'),
        ...(s.repair ? [c('delete-word', 'Delete selected word')] : []), back(), c('pause', 'Pause scanning'), more(), c('row:rows', 'Back to rows')];
      if (row === 'navigation') return [c('done', s.repair ? 'Apply correction' : 'Done', !!s.repair && !s.repair.buffer && !s.repair.deleteRequested),
        back(), c('pause', 'Pause scanning'), more(), c('row:rows', 'Back to rows')];
      return [...Array.from(row).map(x => c(`char:${x}`, (s.repair?.upper ?? s.upper) ? x.toUpperCase() : x)), c('row:rows', 'Back to rows')];
    }
    case 'review': {
      const complete = s.review?.revision === s.revision && s.review.seen.length === s.review.pages.length;
      return [...(s.review && s.review.pages.length > 1 ? [c('next', 'Next part', page + 1 >= s.review.pages.length), c('previous', 'Previous part', page === 0)] : []),
        c('speak', s.lastPlayed === s.draft ? 'Speak again' : 'Speak exactly this', !complete || !s.settings.voice,
          !complete ? 'Read every part before speaking.' : !s.settings.voice ? 'Choose an available voice in Settings.' : 'A separate selection authorizes the full message.'),
        c('edit', 'Make changes'), back(), more()];
    }
    case 'more': return [c('home', 'Your message', !!s.repair, s.repair ? 'Finish or cancel the correction first.' : undefined), c('undo', 'Undo', !(s.repair ? s.repair.undo.length : s.undo.length)),
      c('reader', 'Read message', !s.draft), c('settings', 'Settings'), c('clear', 'New message', !s.draft), c('pause', 'Pause scanning'), back()];
    case 'settings': return [c('value:pace', 'Scan pace', false, `${s.settings.pace / 1000} seconds`),
      c('value:size', 'Text size', false, `${s.settings.size}%`), c('voices', 'Voice', false, s.voices.find(x => x.id === s.settings.voice)?.name ?? 'Choose a voice'),
      c('value:rate', 'Speech rate', false, `${s.settings.rate}×`), c('preview', 'Preview voice', !s.settings.voice), back(), more()];
    case 'values': return [...(screen.value === 'pace' ? [800, 1200, 1600, 2000, 3000] : screen.value === 'size' ? [100, 125, 150, 200] : [0.75, 1, 1.25])
      .map(x => c(`set:${x}`, screen.value === 'pace' ? `${x / 1000} seconds` : screen.value === 'size' ? `${x}%` : `${x}×`)), back()];
    case 'voices': return [...s.voices.slice(page * 5, page * 5 + 5).map((x, i) => c(`voice:${i + page * 5}`, x.name, false, `${x.lang} · ${x.local ? 'Device voice — offline not verified' : 'May use network'}`)),
      c('next', 'Next voices', (page + 1) * 5 >= s.voices.length), c('previous', 'Previous voices', page === 0), back()];
    case 'reader': return [c('next', 'Next part', !s.review || page + 1 >= s.review.pages.length), c('previous', 'Previous part', page === 0), back(), c('pause', 'Pause scanning')];
    case 'clear': return [c('back', 'Keep message'), c('confirm-clear', 'Clear message')];
    case 'paused': return [c('resume', 'Resume scanning')];
    case 'speaking': return [c('stop', s.authorization?.preview ? 'Stop preview' : 'Stop speaking')];
    case 'complete': return [c('review', 'Review again'), c('edit', 'Edit wording'), c('clear', 'New message')];
    case 'speech-error': return [c('review', 'Back to review'), c('voices', 'Choose voice'), more()];
  }
}
export function title(s: Model): string {
  const names: Record<Screen['name'], string> = { compose: 'Make your message', categories: 'Choose a category', phrases: s.screen.value ?? 'Phrases',
    keyboard: s.repair ? 'Correct this word' : 'Spell your message', repair: 'Choose a word to correct', review: 'Review before speaking', more: 'More controls',
    settings: 'Your settings', values: `Choose ${s.screen.value}`, voices: 'Choose a voice', reader: 'Read your message', clear: 'Start a new message?',
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
  s.authorization = null; s.speech = 'Not spoken'; s.provenance = 'Your edited wording';
}
function editBuffer(s: Model, text: string) {
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
    if (s.screen.name === 'keyboard') { s.repair = null; home(s); }
    else pop(s);
  } else if (id === 'more') go(s, { name: 'more' });
  else if (id === 'phrases') go(s, { name: 'phrases', value: 'Quick phrases' });
  else if (id === 'all-categories') go(s, { name: 'categories' });
  else if (id === 'home') home(s);
  else if (id.startsWith('category:')) go(s, { name: 'phrases', value: id.slice(9) });
  else if (id.startsWith('phrase:')) { editDraft(s, s.draft + phraseList(s.screen.value!)![Number(id.slice(7))]); s.provenance = 'Your words'; home(s); }
  else if (id === 'spell') { s.repair = null; go(s, { name: 'keyboard', value: 'rows' }); }
  else if (id === 'review') startReview(s);
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
    editBuffer(s, (s.repair?.buffer ?? s.draft) + value);
    if (s.repair) s.repair.upper = false; else s.upper = false;
    s.focusId = `row:${s.screen.value}`;
    s.screen = { name: 'keyboard', value: 'rows' };
  } else if (id === 'erase') editBuffer(s, Array.from(s.repair?.buffer ?? s.draft).slice(0, -1).join(''));
  else if (id === 'upper') { if (s.repair) s.repair.upper = !s.repair.upper; else s.upper = !s.upper; }
  else if (id === 'undo') {
    if (s.repair) { s.repair.buffer = s.repair.undo.pop() ?? s.repair.buffer; s.repair.deleteRequested = false; }
    else { const old = s.undo.pop(); if (old !== undefined) { s.draft = old; s.revision++; s.review = null; s.authorization = null; s.speech = 'Not spoken'; } }
  } else if (id === 'delete-word' && s.repair) {
    editBuffer(s, ''); s.repair.deleteRequested = true; s.screen = { name: 'keyboard', value: 'navigation' };
    s.notice = 'Deletion is staged. Choose Apply correction to remove this word, or Back to keep it.';
  } else if (id === 'done') {
    if (s.repair && s.repair.revision === s.revision) {
      const r = s.repair;
      // Delete is a deliberate action; never infer deletion from an empty correction.
      editDraft(s, s.draft.slice(0, r.start) + r.buffer + s.draft.slice(r.end));
    }
    home(s);
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
  } else if (id === 'voices') go(s, { name: 'voices', page: 0 });
  else if (id.startsWith('voice:')) { s.settings.voice = s.voices[Number(id.slice(6))].id; pop(s); }
  else if (id === 'speak' || id === 'preview') {
    s.authorization = Object.freeze({ id: `${s.session}:${++s.serial}`, text: id === 'preview' ? 'This is the selected voice.' : s.draft,
      revision: s.revision, voice: s.settings.voice, rate: s.settings.rate, provider: s.settings.provider, preview: id === 'preview' });
    s.speech = 'Preparing'; go(s, { name: 'speaking' });
  } else if (id === 'stop') { s.authorization = null; s.speech = 'Stopped'; pop(s); }
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
  if (reason.startsWith('Layout changed')) s.review = null;
  if (s.authorization) { s.authorization = null; s.speech = 'Stopped'; pop(s); }
  if (s.screen.name !== 'paused') go(s, { name: 'paused' });
  return s;
}
/** Fast refresh may retain React state while replacing controllers. Authored
 * state may survive; an old playback permission must never cross that boundary. */
export function retireRuntimeAuthorization(before: Model): Model {
  return before.authorization ? interrupt(before, 'Workspace restarted — speech approval canceled') : before;
}

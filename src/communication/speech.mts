import type { Authorization, Voice } from './model.mts';
export interface SpeechEngine {
  voices(): Voice[];
  speak(auth: Authorization, event: (event: 'start' | 'end' | 'error') => void): void;
  cancel(): void;
}
/** Routing is fixed by the immutable approval, never by an async provider response. */
export function routeSpeechEngine(local: SpeechEngine, premium: SpeechEngine): SpeechEngine {
  return { voices: () => local.voices(), cancel: () => { local.cancel(); premium.cancel(); },
    speak: (auth, event) => (auth.provider === 'browser' ? local : premium).speak(auth, event) };
}
/** One-use authorization guard. Late callbacks can neither restart nor complete a newer operation. */
export class SpeechController {
  private active: string | null = null;
  private consumed = new Set<string>();
  private engine: SpeechEngine;
  constructor(engine: SpeechEngine) { this.engine = engine; }
  start(auth: Authorization, valid: () => boolean, event: (event: 'start' | 'end' | 'error') => void): boolean {
    if (this.consumed.has(auth.id) || !valid()) return false;
    this.cancel(); this.consumed.add(auth.id); this.active = auth.id;
    try {
      this.engine.speak(auth, next => {
        if (this.active !== auth.id) return;
        if (!valid()) { this.cancel(); return; }
        if (next !== 'start') this.active = null;
        event(next);
      });
    } catch { if (this.active === auth.id) { this.active = null; event('error'); } }
    return true;
  }
  cancel() { this.active = null; this.engine.cancel(); }
}
export function browserSpeechEngine(synth: SpeechSynthesis, makeUtterance = (text: string) => new SpeechSynthesisUtterance(text)): SpeechEngine {
  return {
    voices: () => synth.getVoices().map(v => ({ id: v.voiceURI, name: v.name, lang: v.lang, local: v.localService })),
    cancel: () => synth.cancel(),
    speak: (auth, event) => {
      if (auth.provider !== 'browser') throw Error('Provider unavailable');
      const voice = synth.getVoices().find(v => v.voiceURI === auth.voice);
      if (!voice) throw Error('Selected voice unavailable');
      const utterance = makeUtterance(auth.text);
      utterance.voice = voice; utterance.lang = voice.lang; utterance.rate = auth.rate;
      utterance.onstart = () => event('start'); utterance.onend = () => event('end'); utterance.onerror = () => event('error');
      synth.speak(utterance);
    },
  };
}

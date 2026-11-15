import type { Authorization } from './model.mts';
import type { SpeechEngine } from './speech.mts';
type Player = Pick<HTMLAudioElement, 'src' | 'onplaying' | 'onended' | 'onerror' | 'play' | 'pause' | 'load'>;
type Dependencies = { request: (auth: Authorization, signal: AbortSignal) => Promise<Blob>;
  player: () => Player; url: (blob: Blob) => string; revoke: (url: string) => void };
/** No auto retry, queue or local fallback. A new approval is required after failure. */
export function premiumSpeechEngine(deps: Dependencies): SpeechEngine {
  let generation = 0, abort: AbortController | null = null, player: Player | null = null, url: string | null = null;
  const cancel = () => {
    generation++; abort?.abort(); abort = null;
    if (player) { player.onplaying = null; player.onended = null; player.onerror = null; player.pause(); player.src = ''; player.load(); player = null; }
    if (url) { deps.revoke(url); url = null; }
  };
  return { voices: () => [], cancel, speak: (auth, event) => {
    cancel(); const current = generation; const controller = new AbortController(); abort = controller;
    void (async () => {
      try {
        const blob = await deps.request(auth, controller.signal);
        if (current !== generation || controller.signal.aborted) return;
        url = deps.url(blob); player = deps.player(); player.src = url;
        player.onplaying = () => { if (current === generation) event('start'); };
        player.onended = () => { if (current === generation) { cancel(); event('end'); } };
        player.onerror = () => { if (current === generation) { cancel(); event('error'); } };
        await player.play();
      } catch {
        if (current === generation) { cancel(); event('error'); }
      }
    })();
  } };
}
export function browserPremiumSpeechEngine(): SpeechEngine {
  return premiumSpeechEngine({
    player: () => new Audio(), url: blob => URL.createObjectURL(blob), revoke: url => URL.revokeObjectURL(url),
    request: async (authorization, signal) => {
      const response = await fetch('/api/speech', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorization, cloudConsent: true }), signal: AbortSignal.any([signal, AbortSignal.timeout(14_000)]) });
      if (!response.ok || !response.headers.get('content-type')?.startsWith('audio/')) throw Error('Premium speech unavailable');
      const reader = response.body?.getReader(); if (!reader) throw Error('Empty audio');
      let size = 0; const parts: Uint8Array<ArrayBuffer>[] = [];
      try {
        while (true) { const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.length;
          if (size > 8 * 1024 * 1024) throw Error('Audio too large'); parts.push(new Uint8Array(chunk.value)); }
        if (!size) throw Error('Empty audio'); return new Blob(parts, { type: 'audio/mpeg' });
      } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
    },
  });
}

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { choices, choose, initialModel, inputView, interrupt, presented, speechEvent, title, type Model } from './communication/model.mts';
import { InputCoordinator } from './communication/input-coordinator.mts';
import { browserSpeechEngine, SpeechController } from './communication/speech.mts';
import { measureReviewPages } from './communication/review-layout.mts';
import { recoveryMessage } from './communication/recovery.mts';
import type { SerialChooser } from './input/web-serial-adapter.mts';
import type { SwitchState } from './input/switch-machine.mts';

const active = () => document.hasFocus() && document.visibilityState === 'visible';
export function App() {
  const [model, render] = useState(() => initialModel(crypto.randomUUID()));
  const current = useRef(model);
  const coordinator = useRef<InputCoordinator | null>(null);
  const speech = useRef<SpeechController | null>(null);
  const [input, setInput] = useState<SwitchState | null>(null);
  const [status, setStatus] = useState('Not connected');
  const [verified, setVerified] = useState(false);
  const [counts, setCounts] = useState({ hardware: 0, simulation: 0, companion: 0 });
  const [log, setLog] = useState<string[]>([]);
  const message = useRef<HTMLParagraphElement>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const simButton = useRef<HTMLButtonElement>(null);
  const setup = useRef<HTMLDetailsElement>(null);
  const simulationSource = useRef<string | null>(null);
  const voiceUpdate = useRef<(() => void) | null>(null);
  const startPending = useRef<(() => void) | null>(null);
  const commit = (next: Model) => { current.current = next; render(next); };
  const record = (entry: string) => setLog(old => [...old.slice(-239), `${Math.round(performance.now())} ms · ${entry}`]);
  const cancel = (reason: string) => {
    speech.current?.cancel(); simulationSource.current = null;
    commit(interrupt(current.current, reason)); record(reason);
  };

  useEffect(() => {
    const controller = new InputCoordinator(inputView(current.current), {
      changed: (next, detail) => { setInput(next); setStatus(detail); },
      selected: (selection, source) => {
        const before = current.current;
        if (selection.viewId !== before.screen.name || selection.revision !== before.uiRevision) return;
        const next = choose(before, selection.targetId, selection.revision);
        if (next === before) return;
        if (!next.authorization) speech.current?.cancel();
        setCounts(old => ({ ...old, [source]: old[source] + 1 }));
        record(`${source} selection accepted · ${selection.viewId}:${selection.revision} · cycle ${selection.ordinal}`);
        commit(next);
      },
      interrupted: reason => cancel(reason),
      diagnostic: record,
    });
    coordinator.current = controller;
    const synth = window.speechSynthesis;
    if (synth) {
      const engine = browserSpeechEngine(synth);
      speech.current = new SpeechController(engine);
      const voicesChanged = () => {
        if (controller.state.phase === 'held' || current.current.authorization) return;
        const voices = engine.voices();
        const before = current.current;
        if (JSON.stringify(before.voices) === JSON.stringify(voices)) return;
        const voice = before.settings.voice || voices.find(v => v.local && v.lang.startsWith('en'))?.id || voices[0]?.id || '';
        commit({ ...before, voices, uiRevision: before.uiRevision + 1, settings: { ...before.settings, voice } });
      };
      voiceUpdate.current = voicesChanged;
      synth.addEventListener('voiceschanged', voicesChanged); voicesChanged();
    }
    const blur = () => {
      // The native permission picker can temporarily blur before port opening.
      // The accepted adapter guards opening and every post-open focus loss.
      if (controller.state.connected || controller.mode === 'simulation' || current.current.authorization) controller.stop('Focus lost — reconnect or resume explicitly');
    };
    const visibility = () => { if (document.visibilityState !== 'visible') controller.stop('Page hidden — input and speech stopped'); };
    let dimensions = `${window.innerWidth}:${window.innerHeight}:${window.visualViewport?.scale ?? 1}`;
    const resize = () => {
      const next = `${window.innerWidth}:${window.innerHeight}:${window.visualViewport?.scale ?? 1}`;
      // visualViewport width also changes when a scrollbar appears. That is not
      // a zoom/window change; reacting to it would make long/short views oscillate.
      if (next === dimensions) return;
      dimensions = next;
      if (controller.mode !== 'none' || current.current.authorization) controller.stop('Layout changed — input and speech stopped');
      else if (current.current.review) cancel('Layout changed — review again before speaking');
    };
    const unload = () => controller.stop('Page unloaded');
    window.addEventListener('blur', blur); window.addEventListener('resize', resize); window.addEventListener('pagehide', unload);
    document.addEventListener('visibilitychange', visibility);
    window.visualViewport?.addEventListener('resize', resize);
    return () => {
      controller.stop('Workspace closed', false); speech.current?.cancel();
      window.removeEventListener('blur', blur); window.removeEventListener('resize', resize); window.removeEventListener('pagehide', unload);
      document.removeEventListener('visibilitychange', visibility); window.visualViewport?.removeEventListener('resize', resize);
      if (synth && voiceUpdate.current) synth.removeEventListener('voiceschanged', voiceUpdate.current);
      coordinator.current = null;
    };
  }, []);

  useLayoutEffect(() => { coordinator.current?.setView(inputView(model)); }, [model.uiRevision]);
  useLayoutEffect(() => {
    if ((model.screen.name !== 'review' && model.screen.name !== 'reader') || !message.current || !model.review) return;
    const pages = measureReviewPages(model.draft, message.current);
    if (JSON.stringify(pages) !== JSON.stringify(model.review.pages)) {
      commit({ ...current.current, uiRevision: current.current.uiRevision + 1, screen: { ...model.screen, page: 0 },
        review: { revision: model.revision, pages, seen: [] } });
    }
    message.current.scrollIntoView({ block: 'center', behavior: 'instant' });
  }, [model.screen.name, model.screen.page, model.revision, model.settings.size]);
  const target = input?.view?.targets[input.index];
  const scanning = input?.phase === 'armed' && input.connected && input.active;
  const held = input?.phase === 'held';
  useLayoutEffect(() => {
    if (!(scanning || held) || !target) return;
    const element = buttons.current.get(target);
    if (element) {
      const rect = element.getBoundingClientRect();
      if (rect.top < 12 || rect.bottom > window.innerHeight - 12) element.scrollIntoView({ block: 'center', behavior: 'instant' });
    }
  }, [target, scanning, held, model.uiRevision]);

  useEffect(() => {
    if (!scanning || choices(current.current).filter(x => !x.disabled).length < 2) return;
    const controller = coordinator.current, epoch = input!.epoch;
    const delay = model.settings.pace * (input!.index === 0 ? 1.5 : 1);
    const timer = setTimeout(() => { if (controller?.state.epoch === epoch) controller.tick(); }, delay);
    return () => clearTimeout(timer);
  }, [scanning, input?.epoch, input?.index, model.settings.pace]);

  useEffect(() => {
    voiceUpdate.current?.();
    if (model.screen.name !== 'review' || held || !message.current || !model.review) return;
    const revision = model.revision, page = model.screen.page ?? 0, exactPage = model.review.pages[page];
    const visible = () => {
      if (!active() || coordinator.current?.state.phase === 'held') return;
      const element = message.current;
      if (!element) return;
      const rect = element.getBoundingClientRect();
      if (rect.top >= 0 && rect.left >= 0 && rect.bottom <= window.innerHeight && rect.right <= window.innerWidth
        && element.scrollHeight <= element.clientHeight + 1) commit(presented(current.current, revision, page, exactPage));
    };
    const observer = new IntersectionObserver(visible, { threshold: 1 }); observer.observe(message.current);
    const frame = requestAnimationFrame(visible); window.addEventListener('focus', visible);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); window.removeEventListener('focus', visible); };
  }, [model.screen.name, model.screen.page, model.revision, model.settings.size, model.review?.pages, held]);

  useEffect(() => {
    const auth = model.authorization;
    if (!auth) { speech.current?.cancel(); return; }
    const controller = coordinator.current;
    const start = () => {
      const latest = current.current;
      if (!active() || latest.authorization?.id !== auth.id || latest.screen.name !== 'speaking') return;
      // The physical path needs a fresh, released Stop target before any audio.
      if (controller?.mode !== 'none' && (controller?.state.phase !== 'armed' || controller?.state.view?.revision !== latest.uiRevision)) return;
      const stopButton = buttons.current.get('stop');
      if (!stopButton) return;
      stopButton.scrollIntoView({ block: 'nearest', behavior: 'instant' });
      const rect = stopButton.getBoundingClientRect();
      if (rect.top < 0 || rect.bottom > window.innerHeight) return;
      if (!speech.current) { commit(speechEvent(latest, auth.id, 'error')); return; }
      speech.current.start(auth, () => active() && current.current.authorization?.id === auth.id
        && current.current.revision === auth.revision, event => {
          commit(speechEvent(current.current, auth.id, event)); record(`Speech ${event} · no message text logged`);
        });
    };
    startPending.current = start; start();
    const timeout = setTimeout(() => {
      if (current.current.authorization?.id === auth.id && current.current.speech === 'Preparing') {
        speech.current?.cancel(); commit(speechEvent(current.current, auth.id, 'error'));
      }
    }, 8000);
    return () => { clearTimeout(timeout); startPending.current = null; };
  }, [model.authorization?.id]);
  useEffect(() => { if (scanning) startPending.current?.(); }, [scanning, input?.epoch]);

  function companion(id: string) {
    const before = current.current;
    coordinator.current?.stop('Companion controls — physical input paused', false);
    simulationSource.current = null; speech.current?.cancel();
    const next = choose(before, id, before.uiRevision);
    if (next !== before) { setCounts(old => ({ ...old, companion: old.companion + 1 })); commit(next); }
  }
  function simulationDown(source: string) {
    if (simulationSource.current) return;
    simulationSource.current = source; coordinator.current?.down();
  }
  function simulationUp(source: string) {
    if (simulationSource.current !== source) return;
    simulationSource.current = null; coordinator.current?.up();
  }
  const displayed = (model.screen.name === 'review' || model.screen.name === 'reader') && model.review
    ? model.review.pages[model.screen.page ?? 0] : model.draft;
  const list = choices(model);
  const recovery = recoveryMessage(status, !!input?.connected, !!coordinator.current?.busy, input?.phase);
  return <main style={{ '--text-scale': model.settings.size / 100 } as CSSProperties}
    onPointerDownCapture={event => {
      if (event.target !== simButton.current && coordinator.current?.mode !== 'none') {
        coordinator.current?.stop('Companion pointer — physical scanning paused', false);
        if (current.current.authorization) {
          speech.current?.cancel();
          commit({ ...current.current, authorization: null, speech: 'Stopped' });
        }
      }
    }}
    onKeyDownCapture={event => {
      if (event.key === 'Tab' && coordinator.current?.mode !== 'none') coordinator.current?.stop('Keyboard navigation — scan paused');
    }}>
    <header className="masthead"><div className="wordmark" aria-label="SMV — Still My Voice">SMV</div>
      <div><p className="product-name">Still My Voice</p><p className="tagline">Communication, on your terms.</p></div>
      <span className="prototype">Non-clinical prototype</span></header>
    <div className="status-strip" aria-label="Input status"><span>{coordinator.current?.mode === 'simulation' ? 'Simulation' : coordinator.current?.mode === 'hardware' ? 'Physical switch' : 'Input paused'}</span>
      <span>{held ? 'Held · release to choose' : scanning ? model.screen.name === 'paused' ? 'Ready to resume' : 'Scanning' : recovery.label}</span>
      <span>{input?.pressed === null || !input ? 'Awaiting synchronization' : input.pressed ? 'Pressed' : 'Released'}</span></div>
    <div className="communication-workspace">
      <section className="message-panel" aria-labelledby="message-title">
        <div className="panel-heading"><h1 id="message-title">Your message</h1><span className="provenance">{model.provenance}</span></div>
        {(model.screen.name === 'review' || model.screen.name === 'reader') && model.review ?
          <p className="page-label">Part {(model.screen.page ?? 0) + 1} of {model.review.pages.length} · Exact wording</p> : null}
        <p ref={message} className={`message-text${model.draft ? '' : ' placeholder'}`} data-testid="message-text">{displayed || 'Your words will appear here.'}</p>
        {model.repair ? <div className="correction"><p>Replacing: <strong>{model.draft.slice(model.repair.start, model.repair.end)}</strong></p>
          <p>New wording: <span className="exact">{model.repair.buffer || '(nothing entered)'}</span></p><p>Only this occurrence changes when you choose Apply correction.</p></div> : null}
        <p className="speech-state" aria-live="polite">{model.speech}</p>
        {model.lastPlayed !== null && model.speech !== 'Playback finished' ? <p className="small">A previous message was played. Speaking again requires new approval.</p> : null}
        <p className="small">Your draft stays in this tab’s memory. Reloading or closing the page clears it.</p>
        {model.screen.name === 'review' ? <p className="small">Read every part, then make a separate selection on “Speak exactly this.” Playback completion does not confirm that someone heard it.</p> : null}
      </section>
      <section className="interaction-panel" aria-labelledby="interaction-title">
        <h2 id="interaction-title" aria-live="polite">{model.screen.name === 'paused' ? 'Communication paused' : title(model)}</h2>
        {model.screen.name === 'paused' && !scanning ? <div className="notice" role="status"><p>{recovery.guidance}</p>
          <button type="button" onClick={() => { if (setup.current) { setup.current.open = true; setup.current.scrollIntoView({ block: 'nearest', behavior: 'instant' }); } }}>Open Companion setup</button></div>
          : model.notice && model.screen.name !== 'paused' ? <p className="notice" role="status">{model.notice}</p> : null}
        <div className="choices">{list.map(option => {
          const selected = (scanning || held) && target === option.id && input?.view?.revision === model.uiRevision;
          return <div className="target-envelope" key={option.id} data-scan={selected} data-held={selected && held}>
            <button ref={element => { if (element) buttons.current.set(option.id, element); else buttons.current.delete(option.id); }}
              type="button" disabled={option.disabled} onClick={() => companion(option.id)}
              onPointerDown={() => { if (coordinator.current?.state.phase === 'held') coordinator.current.stop('Companion pointer interrupted a hold', false); }}
              onKeyDown={event => { if (event.key === 'Tab' && coordinator.current?.mode !== 'none') coordinator.current?.stop('Keyboard navigation — scan paused'); }}>
              <span className="choice-label">{option.id === 'resume' && !scanning ? 'Return to message' : option.label}</span>{option.id === 'resume' && !scanning ? <span className="choice-detail">Companion control. This does not reconnect the switch.</span> : option.detail ? <span className="choice-detail">{option.detail}</span> : null}
              <span className="scan-label" aria-hidden="true">{selected && held ? 'Release to choose' : selected ? 'Scan focus' : '\u00a0'}</span>
            </button></div>;
        })}</div>
      </section>
    </div>
    <details ref={setup} className="setup"><summary>Companion setup and input diagnostics</summary>
      <p>Mouse and keyboard controls pause physical scanning. Browser port permission may require companion assistance.</p>
      <p>{status} · {speech.current ? `${model.voices.length} browser voices discovered` : 'Browser speech unavailable'}</p>
      <p>For this verified USB attachment: Pico /dev/cu.usbmodem103 is CDC2 data interface 3. Recheck OS interface ancestry after reattachment; the console port is not suitable.</p>
      <label><input type="checkbox" checked={verified} disabled={coordinator.current?.mode === 'hardware' || coordinator.current?.busy} onChange={e => setVerified(e.target.checked)} /> I will choose the independently verified dedicated CDC2 data port.</label>
      <div className="controls"><button type="button" disabled={!('serial' in navigator) || !verified || coordinator.current?.busy || coordinator.current?.mode === 'hardware'} onClick={() => {
        const controller = coordinator.current;
        if (!controller) return;
        void controller.connect((navigator as Navigator & { serial: SerialChooser }).serial, async port => {
          const info = port.getInfo(); return verified && info.usbVendorId === 0x239a && info.usbProductId === 0x80f4;
        });
      }}>Connect Pico</button>
        <button type="button" onClick={() => coordinator.current?.stop('Explicit disconnect')}>Pause / disconnect Pico</button></div>
      <h3>Local simulation — not hardware evidence</h3>
      <div className="controls"><button type="button" disabled={coordinator.current?.mode === 'hardware' || coordinator.current?.busy} onClick={() => {
        coordinator.current?.simulate(); simButton.current?.focus();
      }}>Start simulation</button>
        <button ref={simButton} type="button" disabled={coordinator.current?.mode !== 'simulation'}
          onPointerDown={e => { if (e.button === 0) { e.currentTarget.setPointerCapture(e.pointerId); simulationDown(`pointer:${e.pointerId}`); } }}
          onPointerUp={e => simulationUp(`pointer:${e.pointerId}`)} onPointerCancel={() => coordinator.current?.stop('Simulation pointer cancelled')}
          onLostPointerCapture={() => { if (simulationSource.current) coordinator.current?.stop('Simulation capture lost'); }}
          onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!e.repeat) simulationDown(`key:${e.key}`); } }}
          onKeyUp={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); simulationUp(`key:${e.key}`); } }}
          onBlur={() => { if (simulationSource.current) coordinator.current?.stop('Simulation focus lost'); }}>Simulated switch · hold, then release</button></div>
      <p>Accepted actions: physical {counts.hardware} · simulated {counts.simulation} · companion {counts.companion}</p>
      <details><summary>Recent lifecycle events — no message text</summary><ol className="log">{log.map((entry, i) => <li key={i}>{entry}</li>)}</ol></details>
    </details>
    <footer>SMV · Still My Voice · Communication, on your terms.</footer>
  </main>;
}

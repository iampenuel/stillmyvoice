import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { choices, choiceSections, choose, initialModel, inputView, interrupt, presented, retireRuntimeAuthorization, withCloudDefaults, speechEvent, title, candidateVoice, alphabetRows, type Model, type Choice } from './communication/model.mts';
import { InputCoordinator } from './communication/input-coordinator.mts';
import { browserSpeechEngine, routeSpeechEngine, SpeechController } from './communication/speech.mts';
import { measureReviewPages } from './communication/review-layout.mts';
import { recoveryMessage } from './communication/recovery.mts';
import { ListeningRuntime } from './communication/ListeningRuntime';
import { CloudRuntime } from './communication/CloudRuntime';
import { browserPremiumSpeechEngine } from './communication/premium-speech.mts';
import { ChoiceButton } from './communication/ChoiceButton';
import { fullyVisible, revealInPanel } from './communication/view-layout.mts';
import type { SerialChooser } from './input/web-serial-adapter.mts';
import type { SwitchState } from './input/switch-machine.mts';

const active = () => document.hasFocus() && document.visibilityState === 'visible';
export function App() {
  const [storedModel, render] = useState(() => initialModel(crypto.randomUUID()));
  const model = withCloudDefaults(storedModel);
  const current = useRef(model);
  current.current = model;
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
  const setup = useRef<HTMLDialogElement>(null);
  const [companionOpen, setCompanionOpen] = useState(false);
  const [pageActivity, setPageActivity] = useState(() => ({ focused: document.hasFocus(), visible: document.visibilityState === 'visible' }));
  const choiceRegion = useRef<HTMLDivElement>(null);
  const messageRegion = useRef<HTMLDivElement>(null);
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
    const retired = retireRuntimeAuthorization(current.current);
    if (retired !== current.current) commit(retired);
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
      targetVisible: id => {
        const button = buttons.current.get(id);
        return !!button && !!choiceRegion.current && !setup.current?.open
          && controller.state.view?.revision === current.current.uiRevision
          && button.parentElement?.dataset.scan === 'true' && fullyVisible(button, choiceRegion.current);
      },
    });
    coordinator.current = controller;
    const synth = window.speechSynthesis;
    if (synth) {
      const engine = browserSpeechEngine(synth);
      speech.current = new SpeechController(routeSpeechEngine(engine, browserPremiumSpeechEngine()));
      const voicesChanged = () => {
        if (controller.state.phase === 'held' || current.current.authorization) return;
        const voices = engine.voices();
        const before = current.current;
        if (JSON.stringify(before.voices) === JSON.stringify(voices)) return;
        const voice = (before.settings.provider === 'browser' ? before.settings.voice : before.settings.systemVoice) || voices.find(v => v.local && v.lang.startsWith('en'))?.id || voices[0]?.id || '';
        commit({ ...before, voices, uiRevision: before.uiRevision + 1, settings: { ...before.settings, systemVoice: voice, voice: before.settings.provider === 'browser' ? voice : before.settings.voice } });
      };
      voiceUpdate.current = voicesChanged;
      synth.addEventListener('voiceschanged', voicesChanged); voicesChanged();
    }
    const blur = () => {
      // The native permission picker can temporarily blur before port opening.
      // The accepted adapter guards opening and every post-open focus loss.
      if (controller.state.connected || controller.mode === 'simulation' || current.current.authorization || current.current.assistance.request || current.current.expansion.request || current.current.listen.session) controller.suspend('Focus lost — communication preserved');
    };
    const focus = () => { if (active() && !setup.current?.open) void controller.foreground(); };
    const visibility = () => { if (document.visibilityState !== 'visible') controller.suspend('Page hidden — communication preserved'); else focus(); };
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
    let lastActivity = '';
    const checkActivity = () => {
      const focused = document.hasFocus(), visible = document.visibilityState === 'visible';
      const key = focused + ':' + visible;
      if (key !== lastActivity) {
        lastActivity = key; setPageActivity({ focused, visible }); record('Browser page · focused ' + focused + ' · visible ' + visible);
        if (focused && visible && !setup.current?.open) void controller.foreground();
      }
      // Some browser-chrome transitions do not deliver a window blur. This also
      // covers companion-approved pending/playing speech without a serial poll.
      if (!(focused && visible) && (controller.state.connected || controller.mode === 'simulation' || current.current.authorization || current.current.assistance.request || current.current.expansion.request || current.current.listen.session)) controller.suspend('Inactive page — communication preserved');
    };
    const activityTimer = setInterval(checkActivity, 25); checkActivity();
    window.addEventListener('blur', blur); window.addEventListener('focus', focus); window.addEventListener('resize', resize); window.addEventListener('pagehide', unload);
    document.addEventListener('visibilitychange', visibility);
    window.visualViewport?.addEventListener('resize', resize);
    return () => {
      controller.stop('Workspace closed', false); speech.current?.cancel();
      clearInterval(activityTimer);
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); window.removeEventListener('resize', resize); window.removeEventListener('pagehide', unload);
      document.removeEventListener('visibilitychange', visibility); window.visualViewport?.removeEventListener('resize', resize);
      if (synth && voiceUpdate.current) synth.removeEventListener('voiceschanged', voiceUpdate.current);
      coordinator.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    coordinator.current?.setView(inputView(model));
    // Only a new view resets panel position; scan ticks and held captures do not.
    if (choiceRegion.current) choiceRegion.current.scrollTop = 0;
  }, [model.uiRevision]);
  useLayoutEffect(() => {
    if ((model.screen.name !== 'review' && model.screen.name !== 'reader') || !message.current || !model.review) return;
    const pages = measureReviewPages(model.draft, message.current);
    if (JSON.stringify(pages) !== JSON.stringify(model.review.pages)) {
      commit({ ...current.current, uiRevision: current.current.uiRevision + 1, screen: { ...model.screen, page: 0 },
        review: { revision: model.revision, pages, seen: [] } });
    }
    if (messageRegion.current) { messageRegion.current.scrollTop = 0; revealInPanel(message.current, messageRegion.current); }
  }, [model.screen.name, model.screen.page, model.revision, model.settings.size]);
  const target = input?.view?.targets[input.index];
  const scanning = input?.phase === 'armed' && input.connected && input.active;
  const held = input?.phase === 'held';
  useLayoutEffect(() => {
    if (!(scanning || held) || !target) return;
    const element = buttons.current.get(target);
    if (element && choiceRegion.current) revealInPanel(element, choiceRegion.current);
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
      if (!active() || setup.current?.open || coordinator.current?.busy || coordinator.current?.state.phase === 'held') return;
      const element = message.current;
      if (!element) return;
      if (messageRegion.current && fullyVisible(element, messageRegion.current)
        && element.scrollHeight <= element.clientHeight + 1) commit(presented(current.current, revision, page, exactPage));
    };
    const observer = new IntersectionObserver(visible, { threshold: 1 }); observer.observe(message.current);
    const frame = requestAnimationFrame(visible); window.addEventListener('focus', visible);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); window.removeEventListener('focus', visible); };
  }, [model.screen.name, model.screen.page, model.revision, model.settings.size, model.review?.pages, held, scanning, companionOpen]);

  useEffect(() => {
    const auth = model.authorization;
    if (!auth) { speech.current?.cancel(); return; }
    const controller = coordinator.current;
    const start = () => {
      const latest = current.current;
      if (!active() || setup.current?.open || latest.authorization?.id !== auth.id || latest.screen.name !== 'speaking') return;
      // The physical path needs a fresh, released Stop target before any audio.
      if (controller?.mode !== 'none' && (controller?.state.phase !== 'armed' || controller?.state.view?.revision !== latest.uiRevision)) return;
      const stopButton = buttons.current.get('stop');
      if (!stopButton || !choiceRegion.current) return;
      revealInPanel(stopButton, choiceRegion.current);
      if (!fullyVisible(stopButton, choiceRegion.current)) return;
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
    }, auth.provider === 'elevenlabs' ? 16000 : 8000);
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
  const sections = choiceSections(model);
  const alphabet = model.alphabetMode === 'visible' && model.screen.name === 'keyboard' && (model.screen.value === 'rows' || alphabetRows.some(row => row === model.screen.value));
  const voiceCandidate = candidateVoice(model);
  const playbackStatus = model.speechPreview ? ({ Preparing: 'Preparing voice preview', Speaking: 'Playing voice preview',
    Stopped: 'Voice preview stopped', 'Playback finished': 'Voice preview finished', 'Speech failed': 'Voice preview failed' } as Record<string, string>)[model.speech] ?? model.speech : model.speech;
  const recovery = recoveryMessage(status, !!input?.connected, !!coordinator.current?.busy, input?.phase);
  const openSetup = () => {
    coordinator.current?.stop('Companion setup opened');
    speech.current?.cancel(); setCompanionOpen(true); setup.current?.showModal();
  };
  const renderChoice = (option: Choice) => {
    const selected = !!((scanning || held) && target === option.id && input?.view?.revision === model.uiRevision);
    const shown = option.id === 'resume' && !(scanning || held)
      ? { ...option, label: 'Return to message', detail: 'Companion control. This does not reconnect the switch.' } : option;
    return <ChoiceButton key={option.id} option={shown} selected={selected} held={held}
      register={element => { if (element) buttons.current.set(option.id, element); else buttons.current.delete(option.id); }}
      activate={() => companion(option.id)} />;
  };
  return <main data-large-text={model.settings.size >= 150} data-page-focused={pageActivity.focused} data-page-visible={pageActivity.visible} style={{ '--text-scale': model.settings.size / 100 } as CSSProperties}
    onPointerDownCapture={event => {
      if (event.target !== simButton.current && coordinator.current?.mode !== 'none') {
        coordinator.current?.stop('Companion pointer — physical scanning paused', false);
        if (current.current.authorization) {
          speech.current?.cancel();
          commit({ ...current.current, authorization: null, speech: 'Stopped' });
        }
      }
    }}
    onWheelCapture={() => { if (coordinator.current?.mode !== 'none') coordinator.current?.stop('Manual scrolling — communication paused'); }}
    onKeyDownCapture={event => {
      if (event.key === 'Tab' && coordinator.current?.mode !== 'none') coordinator.current?.stop('Keyboard navigation — scan paused');
    }}>
    <ListeningRuntime model={model} current={current} commit={commit} canUpdate={() => coordinator.current?.state.phase !== 'held' && !coordinator.current?.busy && !current.current.authorization} />
    <CloudRuntime model={model} current={current} commit={commit} canUpdate={() => coordinator.current?.state.phase !== 'held' && !coordinator.current?.busy && !current.current.authorization} />
    <header className="masthead"><div className="wordmark" aria-label="SMV — Still My Voice">SMV</div>
      <div><p className="product-name">Still My Voice</p><p className="tagline">Communication, on your terms.</p></div>
      <span className="prototype">Non-clinical prototype</span></header>
    <div className="status-strip" aria-label="Input status">
      <span className="input-mode">{coordinator.current?.mode === 'simulation' ? 'Simulation' : coordinator.current?.mode === 'hardware' ? 'Physical switch' : 'Input paused'}</span>
      <span>{held ? 'Held · release to choose' : scanning ? model.screen.name === 'paused' ? 'Ready to resume' : 'Scanning' : recovery.label}</span>
      <span className="input-position">{input?.pressed === null || !input ? 'Awaiting synchronization' : input.pressed ? 'Pressed' : 'Released'}</span>
    </div>
    <div className="communication-workspace">
      <section className="message-panel" aria-labelledby="message-title">
        <div className="panel-heading"><h1 id="message-title">Your message</h1><span className="provenance">{model.provenance}</span>
          {(model.screen.name === 'review' || model.screen.name === 'reader') && model.review
            ? <p className="page-label">Part {(model.screen.page ?? 0) + 1} of {model.review.pages.length} · Exact wording</p> : null}
        </div>
        <div ref={messageRegion} className="message-content" tabIndex={0} aria-label="Message reading area">
          <p ref={message} className={'message-text' + (model.draft ? '' : ' placeholder')} data-testid="message-text">{displayed || 'Your words will appear here.'}</p>
          {model.expansion.editing ? <div className="correction"><p>Editing candidate only · Your words are unchanged</p><p className="replacement exact">{model.expansion.buffer || 'Choose letters.'}</p></div> : null}
          {model.repair ? <div className="correction"><p>Selected word: <strong>{model.draft.slice(model.repair.start, model.repair.end)}</strong></p>
            <p className="replacement-label">Replacement</p><p className="replacement exact">{model.repair.buffer || 'Choose letters or a shortcut.'}</p>
            <p className="small">Your message changes only when you choose Apply correction.</p></div> : null}
        </div>
        <div className="message-footer">
          <p className="speech-state" aria-live="polite">{model.expansion.editing ? 'Candidate not applied' : model.repair ? 'Correction not applied' : playbackStatus}</p>
          {model.screen.name === 'review' ? <p className="small">Review every part. A new selection on Speak approves the exact full message.</p>
            : model.lastPlayed !== null && model.speech !== 'Playback finished' ? <p className="small">Previously played. New approval is required to speak again.</p> : null}
        </div>
      </section>
      <section className="interaction-panel" aria-labelledby="interaction-title">
        <div className="panel-heading"><h2 id="interaction-title" aria-live="polite">{model.screen.name === 'paused' ? 'Communication paused' : title(model)}</h2>
          <span className="panel-caption">{voiceCandidate ? voiceCandidate.description : model.screen.name === 'review' ? 'Your approval, your words.' : model.screen.name === 'speaking' ? 'Stop speaking cancels playback.' : 'One press and release to choose.'}</span>
        </div>
        <div ref={choiceRegion} className="interaction-scroll" data-keyboard-overview={model.screen.name === 'keyboard' && (model.screen.value ?? 'rows') === 'rows' && !model.repair && !model.expansion.editing} data-keyboard-letters={model.screen.name === 'keyboard' && !model.repair && !model.expansion.editing && /^(abcde|fghij|klmno|pqrst|uvwxyz)$/.test(model.screen.value ?? '')} tabIndex={0} aria-label="Communication choices">
          {model.screen.name === 'paused' && !(scanning || held) ? <div className="recovery-row" role="status"><p>{recovery.guidance}</p>
            {recovery.setup ? <button type="button" className="compact-control" onClick={openSetup}>Companion setup</button> : null}</div>
            : model.notice && model.screen.name !== 'paused' ? <p className="notice" role="status">{model.notice}</p> : null}
          {model.screen.name === 'assist' ? <p className="notice">{!model.cloud.consent ? 'Fictional demo only. A companion can enable cloud use in setup.' : !model.cloud.gemini ? model.cloud.geminiReason : 'Optional Gemini suggestions. Nothing changes until you choose.'}</p> : null}
          {model.screen.name === 'neutral-replies' ? <p className="notice">Fixed replies. No answer has been inferred from the conversation.</p> : null}
          {model.screen.name === 'expansion' ? <div className="notice" role="status">{model.expansion.state === 'loading' ? 'Expanding your words… Your original words are kept.' : model.expansion.error || (model.expansion.result?.status === 'candidate' ? <><p>Proposed wording · Check the meaning</p><p className="exact">{model.expansion.result.candidate}</p></> : model.expansion.result?.status === 'clarify' ? model.expansion.result.clarificationQuestion : 'Please add a few more words or keep your wording.')}</div> : null}
          {model.screen.name === 'suggestions' ? <p className="notice" role="status">{model.assistance.state === 'loading' ? 'Preparing suggestions… Your words are kept.' : model.assistance.error || (model.assistance.items.length ? 'Suggestions may be wrong. Choose only wording you intend.' : 'No reliable suggestions. Continue with your own wording.')}</p> : null}
          {model.screen.name === 'speech-error' ? <p className="notice" role="status">Speech could not finish. Your message is kept.</p> : null}
          {voiceCandidate && (!voiceCandidate.available || !model.cloud.consent || !model.cloud.elevenlabs) ? <p className="notice" role="status">{!voiceCandidate.available ? voiceCandidate.reason : !model.cloud.consent ? 'Enable fictional cloud demo in Companion setup to preview or use this voice.' : model.cloud.elevenReason}</p> : null}
          {model.screen.name === 'listening' ? <div className="notice" role="status">{!model.cloud.consent ? 'Enable fictional cloud demo in Companion setup. ' : null}{model.listen.phase === 'consent' ? 'Fictional conversation only. Ask the speaker to agree. Audio is sent to ElevenLabs for transcription; nothing changes your message.' : model.listen.phase === 'ready' ? 'Microphone permission may need companion help. Record up to 20 seconds.' : model.listen.phase === 'requesting' ? 'Waiting for microphone permission…' : model.listen.phase === 'recording' ? 'Recording · maximum 20 seconds. Stop when finished.' : model.listen.phase === 'processing' ? 'Recording stopped. Preparing transcript…' : model.listen.phase === 'transcript' ? <><p>Partner’s words · Check before accepting</p><p className="exact">{model.listen.transcript}</p></> : model.listen.error}</div> : null}
          {alphabet ? <div className="alphabet-surface" aria-label="Visible alphabetical keyboard">
            {alphabetRows.map(row => {
              const rowStage = model.screen.value === 'rows', activeRow = model.screen.value === row;
              const id = `row:${row}`, selected = !!((scanning || held) && target === id && input?.view?.revision === model.uiRevision);
              return <div className="alphabet-row" key={row}>
                {rowStage ? <div className="target-envelope" data-scan={selected} data-held={selected && held} data-choice={id}><button type="button" aria-label={`Row ${row.toUpperCase().split('').join(' ')}`} ref={element => { if (element) buttons.current.set(id, element); else buttons.current.delete(id); }} onClick={() => companion(id)}><span className="alphabet-cells">{Array.from(row).map(char => <span key={char}>{char.toUpperCase()}</span>)}</span></button></div>
                : <div className="alphabet-cells">{Array.from(row).map(char => {
                  const letterId = `char:${char}`, letterSelected = !!((scanning || held) && target === letterId && input?.view?.revision === model.uiRevision);
                  return activeRow ? <div key={char} className="target-envelope" data-scan={letterSelected} data-held={letterSelected && held} data-choice={letterId}><button type="button" aria-label={char.toUpperCase()} ref={element => { if (element) buttons.current.set(letterId, element); else buttons.current.delete(letterId); }} onClick={() => companion(letterId)}>{char.toUpperCase()}</button></div> : <span className="alphabet-inactive" key={char}>{char.toUpperCase()}</span>;
                })}</div>}
              </div>;
            })}
            <p className="scan-label" aria-hidden="true">{held ? 'Release to choose' : model.screen.value === 'rows' ? 'Choose a row, then a letter' : 'Choose a letter · Other rows remain visible'}</p>
          </div> : null}
          <div className="choices" data-grid={model.screen.name === 'phrases' || model.screen.name === 'keyboard' || model.screen.name === 'repair' || model.screen.name === 'context'}>
            {sections.primary.filter(option => !alphabet || !(option.id.startsWith('char:') || alphabetRows.some(row => option.id === `row:${row}`))).map(renderChoice)}
          </div>
          {sections.navigation.length ? <div className="navigation-choices">{sections.navigation.map(renderChoice)}</div> : null}
        </div>
      </section>
    </div>
    <footer><p>Draft kept in this tab. Reloading clears it.</p><button type="button" className="setup-trigger" onClick={openSetup}>Companion setup</button>
      {coordinator.current?.mode === 'simulation' ? <button ref={simButton} type="button" className="simulation-switch"
        onPointerDown={e => { if (e.button === 0) { e.currentTarget.setPointerCapture(e.pointerId); simulationDown('pointer:' + e.pointerId); } }}
        onPointerUp={e => simulationUp('pointer:' + e.pointerId)} onPointerCancel={() => coordinator.current?.stop('Simulation pointer cancelled')}
        onLostPointerCapture={() => { if (simulationSource.current) coordinator.current?.stop('Simulation capture lost'); }}
        onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!e.repeat) simulationDown('key:' + e.key); } }}
        onKeyUp={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); simulationUp('key:' + e.key); } }}
        onBlur={() => { if (simulationSource.current) coordinator.current?.stop('Simulation focus lost'); }}>Simulated switch · hold, then release</button> : null}
    </footer>
    <dialog ref={setup} className="setup" aria-labelledby="setup-title" onClose={() => setCompanionOpen(false)}>
      <div className="setup-heading"><h2 id="setup-title">Companion setup</h2><button type="button" onClick={() => setup.current?.close()}>Done</button></div>
      <p>Setup pauses input and speech. Close this panel before using the switch. Browser port permission may require companion assistance.</p>
      <p className="technical-status">{status} · {speech.current ? model.voices.length + ' browser voices discovered' : 'Browser speech unavailable'}</p>
      <p>Browser page: {pageActivity.focused ? 'focused' : 'not focused'} · {pageActivity.visible ? 'visible' : 'hidden'}</p>
      <p>Verified attachment: Pico /dev/cu.usbmodem103 is CDC2 data interface 3. Recheck OS ancestry after reattachment; do not use the console port.</p>
      <label><input type="checkbox" checked={verified} disabled={coordinator.current?.mode === 'hardware' || coordinator.current?.busy} onChange={e => setVerified(e.target.checked)} /> I will choose the independently verified dedicated CDC2 data port.</label>
      <div className="controls"><button type="button" disabled={!('serial' in navigator) || !verified || coordinator.current?.busy || coordinator.current?.mode === 'hardware'} onClick={() => {
        const controller = coordinator.current;
        if (!controller) return;
        setup.current?.close();
        void controller.connect((navigator as Navigator & { serial: SerialChooser }).serial, async port => {
          const info = port.getInfo(); return verified && info.usbVendorId === 0x239a && info.usbProductId === 0x80f4;
        });
      }}>Connect Pico</button>
        <button type="button" onClick={() => coordinator.current?.stop('Explicit disconnect')}>Pause / disconnect Pico</button></div>
      <h3>Optional cloud demo</h3>
      <label><input type="checkbox" checked={model.cloud.consent} onChange={event => {
        speech.current?.cancel(); const before = current.current;
        commit({ ...before, uiRevision: before.uiRevision + 1, authorization: null,
          cloud: { ...before.cloud, consent: event.target.checked }, listen: { ...before.listen, session: null, phase: 'consent' }, expansion: { ...before.expansion, request: null }, assistance: { ...before.assistance, request: null, items: [] } });
      }} /> I am using fictional content and permit deliberate speech/suggestion requests to ElevenLabs and Google. No real private communication.</label>
      <p>ElevenLabs: {model.cloud.elevenReason}. Gemini: {model.cloud.geminiReason}. Selecting a voice or suggestion never starts speech.</p>
      <button type="button" onClick={() => { const before = current.current; commit({ ...before, cloud: { ...before.cloud, refresh: (before.cloud.refresh ?? 0) + 1 } }); }}>Refresh cloud status</button>
      <h3>Local simulation</h3><p>Simulation uses the same selection safeguards. It is not physical test evidence.</p>
      <button type="button" disabled={coordinator.current?.mode === 'hardware' || coordinator.current?.busy} onClick={() => {
        setup.current?.close(); coordinator.current?.simulate(); requestAnimationFrame(() => simButton.current?.focus());
      }}>Start simulation</button>
      <p className="evidence-counts">Accepted actions: physical {counts.hardware} · simulated {counts.simulation} · companion {counts.companion}</p>
      <details><summary>Lifecycle diagnostics — no message text</summary><ol className="log">{log.map((entry, i) => <li key={i}>{entry}</li>)}</ol></details>
    </dialog>
  </main>;
}

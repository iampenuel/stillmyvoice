// SPDX-License-Identifier: AGPL-3.0-or-later
import { useEffect, useRef, useState } from 'react';
import { browserEnvironment, requestSerialAdapter, type SerialChooser } from '../input/web-serial-adapter.mts';
import { GazeSandboxController, type SandboxSnapshot, type SandboxTargetId } from './gaze-sandbox.mts';
import type { GazeRegion } from './gaze-logic.mts';
import './gaze-sandbox.css';

type Connection = Awaited<ReturnType<typeof requestSerialAdapter>>;
export type GazeSandboxGaze = {
  active: boolean;
  candidate: { targetId: SandboxTargetId; validUntilMs: number } | null;
  trackingValid: boolean;
  trackingValidUntilMs: number;
};
export type GazeSandboxTarget = GazeRegion & { readonly id: SandboxTargetId };
export type GazeSandboxProps = GazeSandboxGaze & {
  readGaze?: () => GazeSandboxGaze;
  onTargets: (targets: readonly GazeSandboxTarget[]) => void;
};
const actions: readonly { id: SandboxTargetId; title: string; detail: string }[] = [
  { id: 'phrases', title: 'Phrases', detail: 'Open fictional phrase examples' },
  { id: 'spell', title: 'Spell', detail: 'Open the alphabet preview' },
  { id: 'back', title: 'Back', detail: 'Return to the sandbox start' },
  { id: 'scroll', title: 'Scroll', detail: 'Move the preview down one step' },
];
const sameTargets = (a: readonly GazeRegion[], b: readonly GazeRegion[]) => a.length === b.length && a.every((r, i) =>
  r.id === b[i]?.id && (['left', 'top', 'width', 'height'] as const).every(key => Math.abs(r[key] - b[i][key]) <= 0.5));
const labelFor = (id: string | null) => actions.find(action => action.id === id)?.title ?? 'None';

/** Physical-only actions in a fictional sandbox; no communication, speech or camera authority. */
export function GazeSandbox(props: GazeSandboxProps) {
  const latest = useRef(props); latest.current = props;
  const controller = useRef<GazeSandboxController | null>(null);
  if (!controller.current) controller.current = new GazeSandboxController(crypto.randomUUID());
  const runtime = useRef({ mounted: false, generation: 0, epochEstablished: false, connecting: false,
    connection: null as Connection | null, flight: null as Promise<Connection> | null,
    closing: Promise.resolve(), targets: [] as GazeSandboxTarget[], snapshotKey: '' });
  const targets = useRef(new Map<SandboxTargetId, HTMLDivElement>());
  const preview = useRef<HTMLDivElement>(null);
  const verifiedRef = useRef(false);
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [state, setState] = useState<SandboxSnapshot>(() => controller.current!.snapshot());
  const [status, setStatus] = useState('Not connected. Verify the dedicated CDC2 data port before connecting.');
  const [page, setPage] = useState<'home' | 'phrases' | 'spell'>('home');
  const [feedback, setFeedback] = useState('No physical action has been accepted.');
  const [history, setHistory] = useState<string[]>([]);

  const publish = () => {
    const snapshot = controller.current!.snapshot();
    const key = JSON.stringify(snapshot);
    if (runtime.current.mounted && key !== runtime.current.snapshotKey) {
      runtime.current.snapshotKey = key; setState(snapshot);
    }
    return snapshot;
  };
  const retire = (reason: string) => {
    const r = runtime.current;
    r.generation++; r.epochEstablished = false; r.connecting = false;
    const connection = r.connection, flight = r.flight, previous = r.closing;
    r.connection = null; r.flight = null;
    connection?.stop(reason);
    r.closing = (async () => {
      await previous;
      if (connection) await connection.closed;
      if (flight) {
        try { const opened = await flight; opened.stop(reason); await opened.closed; } catch { /* adapter owns failed-open cleanup */ }
      }
      if (connection || flight) await new Promise(resolve => setTimeout(resolve, 200));
    })();
    if (r.mounted) { setBusy(false); setConnected(false); setStatus(reason + ' Connect again for a fresh switch synchronization.'); }
  };
  const pause = (reason: string) => { controller.current!.pause(reason); retire(reason); publish(); };
  const invalidate = (reason: string) => { controller.current!.invalidate(reason); retire(reason); publish(); };
  const currentGaze = () => latest.current.readGaze?.() ?? latest.current;
  const observeGaze = (now: number) => {
    const current = currentGaze();
    return controller.current!.updateGaze({
      candidate: current.active && current.trackingValid ? current.candidate : null,
      trackingValid: current.active && current.trackingValid,
      trackingValidUntilMs: current.active ? current.trackingValidUntilMs : 0,
    }, now);
  };
  const ensureSafe = (snapshot: SandboxSnapshot) => {
    if (snapshot.requiresReconnect && runtime.current.epochEstablished && (runtime.current.connection || runtime.current.flight || runtime.current.connecting)) {
      retire(snapshot.reason ?? 'Input paused.');
    }
    publish();
  };
  const readTargets = (): GazeSandboxTarget[] => actions.map(action => {
    const box = targets.current.get(action.id)?.getBoundingClientRect();
    return { id: action.id, left: box?.left ?? 0, top: box?.top ?? 0, width: box?.width ?? 0, height: box?.height ?? 0 };
  });
  const fullyVisible = (id: string) => {
    const element = targets.current.get(id as SandboxTargetId), box = element?.getBoundingClientRect();
    if (!element || !box || box.width <= 0 || box.height <= 0 || box.left < 0 || box.top < 0 || box.right > innerWidth || box.bottom > innerHeight) return false;
    // A modal/top-layer surface can cover unchanged rectangles; its pixels cannot be selected through.
    const atCenter = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return atCenter !== null && element.contains(atCenter);
  };
  const reportTargets = () => {
    const r = runtime.current, next = readTargets();
    if (sameTargets(r.targets, next)) return;
    const hadTargets = r.targets.length > 0;
    r.targets = next;
    if (hadTargets && (r.connection || r.flight || r.connecting)) invalidate('Target positions changed.');
    latest.current.onTargets(next);
  };
  const activate = (target: SandboxTargetId) => {
    let detail: string;
    if (target === 'scroll') {
      const element = preview.current;
      const previous = element?.scrollTop ?? 0;
      if (element) element.scrollTop = Math.min(previous + 80, Math.max(0, element.scrollHeight - element.clientHeight));
      const distance = Math.round((element?.scrollTop ?? previous) - previous);
      detail = distance ? 'Scroll: preview moved ' + distance + ' pixels.' : 'Scroll: preview is at the bottom.';
    } else {
      setPage(target === 'back' ? 'home' : target);
      if (preview.current) preview.current.scrollTop = 0;
      detail = target === 'back' ? 'Back: sandbox start restored.' : labelFor(target) + ': fictional preview opened.';
    }
    setFeedback(detail);
    setHistory(previous => [...previous.slice(-7), detail]);
  };

  async function connect() {
    const r = runtime.current, serial = (navigator as Navigator & { serial?: SerialChooser }).serial;
    if (!serial || !verifiedRef.current || r.connecting || r.connection) return;
    if (controller.current!.snapshot().mode === 'gaze' && !currentGaze().active) return;
    if (actions.some(action => !fullyVisible(action.id))) { setStatus('Keep all four targets fully visible before connecting.'); return; }
    const generation = ++r.generation;
    r.epochEstablished = false; r.connecting = true; setBusy(true); setStatus('Choose the independently verified CDC2 data port.');
    // The native chooser is invoked directly in this explicit companion gesture.
    const chosen = serial.requestPort({ filters: [{ usbVendorId: 0x239a, usbProductId: 0x80f4 }] });
    try {
      const port = await chosen, info = port.getInfo();
      if (generation !== r.generation || !r.mounted) return;
      if (!verifiedRef.current || info.usbVendorId !== 0x239a || info.usbProductId !== 0x80f4) throw Error('Dedicated CDC2 selection was not verified.');
      await r.closing;
      if (generation !== r.generation || !r.mounted) return;
      const environment = browserEnvironment();
      const flight = requestSerialAdapter({ requestPort: async () => port }, async candidate =>
        candidate === port && generation === r.generation && verifiedRef.current, {
        epoch: instance => {
          if (generation !== r.generation || !r.mounted) throw Error('Retired connection.');
          if (controller.current!.snapshot().mode === 'gaze' && !currentGaze().active) throw Error('Camera is no longer calibrated.');
          r.epochEstablished = true;
          const epoch = controller.current!.connect(instance, performance.now());
          observeGaze(performance.now()); publish(); return epoch;
        },
        input: message => {
          if (generation !== r.generation || !r.mounted) return;
          // Read current DOM geometry before consuming a queued physical edge.
          // A reflow can precede ResizeObserver or the periodic geometry check.
          reportTargets();
          if (generation !== r.generation || !r.mounted) return;
          if (controller.current!.snapshot().mode === 'gaze' && !currentGaze().active) { invalidate('Camera is no longer calibrated.'); return; }
          const before = observeGaze(performance.now());
          if (before.requiresReconnect) { ensureSafe(before); return; }
          if ((message.type === 'down' || message.type === 'up') && !fullyVisible(before.heldTarget ?? before.focusTarget ?? '')) {
            invalidate('The current switch target is not fully visible.'); return;
          }
          const result = controller.current!.input(message, performance.now());
          if (result.selection && !result.state.requiresReconnect) activate(result.selection.targetId as SandboxTargetId);
          if (result.state.input.epoch !== message.epoch && !result.state.requiresReconnect) invalidate('Switch input synchronization changed.');
          else ensureSafe(result.state);
        },
        cancelled: reason => {
          if (generation !== r.generation || !r.mounted) return;
          controller.current!.invalidate(reason); retire(reason); publish();
        },
        waitingForFocus: () => { if (generation === r.generation && r.mounted) setStatus('Waiting for page focus; input is blocked.'); },
      }, { ...environment, active: () => generation === r.generation && r.mounted && environment.active() });
      r.flight = flight;
      const connection = await flight;
      if (generation !== r.generation || !r.mounted) { connection.stop('Retired connection.'); await connection.closed; return; }
      r.flight = null; r.connection = connection; r.connecting = false;
      setBusy(false); setConnected(true); setStatus('Physical switch connected. Only a fresh valid press-and-release can act.'); publish();
    } catch (error) {
      if (generation === r.generation && r.mounted) {
        controller.current!.invalidate('Connection failed.');
        retire(error instanceof Error ? error.message : 'Connection failed.'); publish();
      }
    }
  }

  useEffect(() => {
    const r = runtime.current; r.mounted = true;
    reportTargets();
    const observer = new ResizeObserver(reportTargets);
    for (const element of targets.current.values()) observer.observe(element);
    observer.observe(document.documentElement);
    const changed = () => reportTargets();
    const hidden = () => { if (document.visibilityState !== 'visible') pause('Page hidden.'); };
    const blurred = () => { if (r.connection || r.epochEstablished) pause('Page focus lost.'); };
    const exiting = () => pause('Sandbox exited.');
    window.addEventListener('resize', changed); window.addEventListener('scroll', changed, true);
    window.visualViewport?.addEventListener('resize', changed); window.visualViewport?.addEventListener('scroll', changed);
    window.addEventListener('blur', blurred); window.addEventListener('pagehide', exiting); document.addEventListener('visibilitychange', hidden);
    const timer = setInterval(() => {
      reportTargets();
      if (!document.hasFocus() || document.visibilityState !== 'visible') return;
      // The controller enforces scan cadence; polling only expires stale proposals promptly.
      if (controller.current!.snapshot().mode === 'gaze' && !currentGaze().active && (r.connection || r.flight || r.connecting)) { invalidate('Camera is no longer calibrated.'); return; }
      const updated = observeGaze(performance.now());
      if (updated.heldTarget && !fullyVisible(updated.heldTarget)) { invalidate('Captured target became obscured.'); return; }
      ensureSafe(controller.current!.tick(performance.now()));
    }, 50);
    publish();
    return () => {
      r.mounted = false; clearInterval(timer); observer.disconnect();
      window.removeEventListener('resize', changed); window.removeEventListener('scroll', changed, true);
      window.visualViewport?.removeEventListener('resize', changed); window.visualViewport?.removeEventListener('scroll', changed);
      window.removeEventListener('blur', blurred); window.removeEventListener('pagehide', exiting); document.removeEventListener('visibilitychange', hidden);
      controller.current!.invalidate('Sandbox unmounted.'); retire('Sandbox unmounted.');
    };
    // All live proposal/callback values are read from refs; one transport owner per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const gazeMode = state.mode === 'gaze';
  const inputLabel = state.input.phase === 'held' ? 'Held: ' + labelFor(state.heldTarget)
    : state.input.phase === 'needs-sync' ? state.input.pressed ? 'Release switch to synchronize' : 'Awaiting switch synchronization'
    : gazeMode && !state.focusTarget ? 'Waiting for a fresh gaze candidate' : 'Released';
  return <section className="gaze-sandbox" aria-labelledby="gaze-sandbox-title">
    <div className="gaze-sandbox-heading"><h2 id="gaze-sandbox-title">Physical switch sandbox</h2><p>Looking only proposes. These four actions never speak.</p></div>
    <div className="gaze-sandbox-controls">
      <label>Selection mode <select value={state.mode} disabled={busy} onChange={event => {
        controller.current!.setMode(event.target.value === 'switch-only' ? 'switch-only' : 'gaze');
        retire('Selection mode changed.'); publish();
      }}><option value="gaze">Gaze + physical switch</option><option value="switch-only">Switch-only scan</option></select></label>
      <label className="gaze-sandbox-port-check"><input type="checkbox" checked={verified} disabled={busy || connected}
        onChange={event => { verifiedRef.current = event.target.checked; setVerified(event.target.checked); }} />I will choose verified /dev/cu.usbmodem103: CDC2 data, interface 3.</label>
      <button type="button" disabled={!verified || busy || connected || !('serial' in navigator) || (gazeMode && !props.active)} onClick={() => void connect()}>{busy ? 'Connecting…' : 'Connect Pico'}</button>
      <button type="button" disabled={!busy && !connected} onClick={() => pause('Switch paused.')} >Pause / disconnect</button>
    </div>
    <p className="gaze-sandbox-status">{status} {connected ? inputLabel + '.' : ''} {gazeMode && !props.active ? 'Start and calibrate the camera to use gaze, or explicitly choose switch-only scanning.' : ''}</p>
    <div className="gaze-sandbox-targets" role="group" aria-label="Physical switch actions; no mouse or keyboard activation">
      {actions.map(action => <div key={action.id} ref={element => { if (element) targets.current.set(action.id, element); else targets.current.delete(action.id); }}
        className="gaze-sandbox-target" role="group" aria-labelledby={'gaze-action-' + action.id}
        data-sandbox-target={action.id} data-candidate={gazeMode && state.candidateTarget === action.id}
        data-scan={state.focusTarget === action.id} data-held={state.heldTarget === action.id}>
        <span id={'gaze-action-' + action.id} className="gaze-sandbox-title">{action.title}</span><span className="gaze-sandbox-detail">{action.detail}</span>
        <span className="gaze-sandbox-target-state">{[gazeMode && state.candidateTarget === action.id ? 'Gaze candidate' : '', state.focusTarget === action.id ? 'Switch focus' : '', state.heldTarget === action.id ? 'Held' : ''].filter(Boolean).join(' · ') || '\u00a0'}</span>
      </div>)}
    </div>
    <div className="gaze-sandbox-feedback" role="status" aria-live="polite">{feedback}</div>
    <div ref={preview} className="gaze-sandbox-preview" tabIndex={0} role="region" aria-label="Fictional sandbox preview">
      {page === 'phrases' ? <><strong>Fictional phrase examples</strong><ul>{['Yes.', 'No.', 'Please wait.', 'Please repeat.', 'Thank you.', 'I need a break.'].map(phrase => <li key={phrase}>{phrase}</li>)}</ul></>
        : page === 'spell' ? <><strong>Alphabet preview — no message is composed</strong><p>A B C D E F G</p><p>H I J K L M N</p><p>O P Q R S T U</p><p>V W X Y Z</p></>
          : <><strong>Sandbox start</strong><p>Phrases opens fictional examples.</p><p>Spell opens an alphabet preview.</p><p>Back restores this start view.</p><p>Scroll moves only this bounded preview.</p><p>Every action needs a new physical press-and-release.</p></>}
    </div>
    <details className="gaze-sandbox-history"><summary>Accepted physical actions: {history.length ? state.selections : 0}</summary><ol>{history.map((entry, index) => <li key={index}>{entry}</li>)}</ol><p>Only the latest eight action descriptions are retained in this tab.</p></details>
  </section>;
}

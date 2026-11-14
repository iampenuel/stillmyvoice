import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createSwitchState, reduceSwitch, type Selection } from './input/switch-machine.mts';
import { requestSerialAdapter, type SerialChooser } from './input/web-serial-adapter.mts';

const targets = ['Target one', 'Target two', 'Target three'];
const view = { id: 'diagnostic', revision: 1, targets };
const scanIntervalMs = 1600; // Provisional diagnostic timing, not a validated access setting.

export function App() {
  const [state, setState] = useState(() => createSwitchState(view, crypto.randomUUID()));
  const current = useRef(state);
  const [lastSelection, setLastSelection] = useState<Selection | null>(null);
  const [log, setLog] = useState<{ id: number; text: string }[]>([]);
  const logId = useRef(0);
  const switchButton = useRef<HTMLButtonElement>(null);
  const heldInput = useRef<string | null>(null);
  const focusAfterResume = useRef(false);
  const mode = useRef<'simulation' | 'hardware'>('simulation');
  const adapter = useRef<Awaited<ReturnType<typeof requestSerialAdapter>> | null>(null);
  const [hardware, setHardware] = useState('Not connected');
  const [connecting, setConnecting] = useState(false);
  const [verifiedPort, setVerifiedPort] = useState(false);
  const serialAvailable = 'serial' in navigator;

  const record = useCallback((text: string) => {
    const entry = { id: ++logId.current, text: `${performance.now().toFixed(0)} ms: ${text}` };
    setLog(entries => [...entries.slice(-39), entry]);
  }, []);

  const dispatch = useCallback((event: unknown, detail?: string) => {
    const before = current.current;
    const next = reduceSwitch(before, event);
    current.current = next.state;
    setState(next.state);
    let message: string | null = null;
    if (next.selection) {
      setLastSelection(next.selection);
      message = `${mode.current.toUpperCase()}: ${next.selection.targetId} selected once (${next.selection.ordinal}).`;
    } else if (next.state.capture && !before.capture) {
      message = `${mode.current.toUpperCase()} DOWN: captured ${next.state.capture.targetId}.`;
    } else if (next.state.epoch !== before.epoch) {
      message = `Input cancelled / blocked: ${next.state.reason}.`;
    } else if (next.state.phase === 'armed' && before.phase !== 'armed') {
      message = mode.current === 'hardware' ? 'Hardware released and armed.' : 'Simulator released and armed. No hardware input is connected.';
    }
    if (detail) message = message ? `${message} ${detail}` : detail;
    if (message) record(message);
    return next;
  }, [record]);

  const cancelHeld = useCallback(() => {
    heldInput.current = null;
    if (mode.current === 'hardware') adapter.current?.stop('Input context changed');
    else if (current.current.connected) dispatch({ type: 'fault' });
  }, [dispatch]);

  useEffect(() => {
    const activity = () => {
      const active = document.hasFocus() && document.visibilityState === 'visible';
      if (!active) heldInput.current = null;
      dispatch({ type: 'activity', active });
    };
    window.addEventListener('blur', activity);
    window.addEventListener('focus', activity);
    window.addEventListener('resize', cancelHeld);
    document.addEventListener('visibilitychange', activity);
    activity();
    return () => {
      adapter.current?.stop('Diagnostic unmounted');
      window.removeEventListener('blur', activity);
      window.removeEventListener('focus', activity);
      window.removeEventListener('resize', cancelHeld);
      document.removeEventListener('visibilitychange', activity);
    };
  }, [dispatch, cancelHeld]);

  useEffect(() => {
    if (state.phase !== 'armed') return;
    const epoch = state.epoch;
    const timer = window.setTimeout(() => dispatch({ type: 'tick', epoch }), scanIntervalMs);
    return () => window.clearTimeout(timer);
  }, [dispatch, state.phase, state.epoch, state.index]);

  useLayoutEffect(() => {
    if (focusAfterResume.current && state.connected && state.phase === 'armed') {
      focusAfterResume.current = false;
      switchButton.current?.focus();
    }
  }, [state.connected, state.phase, state.epoch]);

  function resumeSimulation() {
    if (adapter.current || connecting) return;
    if (mode.current !== 'simulation') {
      mode.current = 'simulation';
      const initial = createSwitchState(view, crypto.randomUUID());
      current.current = initial;
      setState(initial);
      setLastSelection(null);
    }
    heldInput.current = null;
    focusAfterResume.current = true;
    dispatch({ type: 'activity', active: document.hasFocus() && document.visibilityState === 'visible' });
    if (!current.current.connected) dispatch({ type: 'connect' });
    // This explicit control synchronizes ONLY the local simulator. It never
    // asserts that the Pico is released, connected, or ready.
    dispatch({ type: 'sync', epoch: current.current.epoch, sequence: 0, pressed: false });
  }

  function press(source: string) {
    if (mode.current !== 'simulation') return;
    if (heldInput.current || current.current.phase !== 'armed') return;
    heldInput.current = source;
    dispatch({ type: 'down', epoch: current.current.epoch, sequence: current.current.lastSequence! + 1 });
  }

  function release(source: string) {
    if (mode.current !== 'simulation') return;
    if (heldInput.current !== source) return;
    heldInput.current = null;
    const captured = current.current.capture;
    if (!captured) return;
    dispatch({ type: 'up', epoch: current.current.epoch, sequence: current.current.lastSequence! + 1,
      downSequence: captured.downSequence });
  }

  async function connectPico() {
    if (!serialAvailable || !verifiedPort || connecting || adapter.current) return;
    heldInput.current = null;
    dispatch({ type: 'disconnect' });
    setConnecting(true);
    setHardware('Choose the verified CDC2 data port');
    let ended = false;
    try {
      const connection = await requestSerialAdapter(
        (navigator as Navigator & { serial: SerialChooser }).serial,
        async port => {
          const info = port.getInfo();
          // Web Serial exposes VID/PID, not interface number or OS device path.
          // The operator verifies the chooser path against the OS USB ancestry.
          return verifiedPort && info.usbVendorId === 0x239a && info.usbProductId === 0x80f4;
        },
        {
          waitingForFocus: () => {
            setHardware('Waiting for page focus — input blocked');
            record('Picker returned before page focus; port remains unopened.');
          },
          epoch: instanceId => {
            const priorCount = mode.current === 'hardware' ? current.current.selections : 0;
            mode.current = 'hardware';
            let fresh = createSwitchState(view, instanceId);
            fresh = reduceSwitch(fresh, { type: 'activity', active: true }).state;
            fresh = reduceSwitch(fresh, { type: 'connect' }).state;
            // Preserve only the visible diagnostic count, never input state.
            fresh = Object.freeze({ ...fresh, selections: priorCount });
            current.current = fresh;
            setState(fresh);
            setLastSelection(null);
            setHardware('Synchronizing — input blocked');
            record(`New hardware session ${instanceId.slice(0, 8)}; awaiting fresh synchronization.`);
            return fresh.epoch;
          },
          input: message => {
            const detail = `V2 ${message.type.toUpperCase()} session=${message.epoch.slice(0, 8)} seq=${message.sequence} tick=${message.tick_ms}`
              + (message.type === 'sync' ? ` pressed=${message.pressed}` : '')
              + (message.type === 'up' ? ` downSequence=${message.downSequence}` : '');
            const next = dispatch(message, detail);
            if (next.state.epoch !== message.epoch) {
              throw Error('Input kernel rejected message');
            }
            setHardware(message.type === 'sync' && message.pressed
              ? 'Connected — release switch to arm' : 'Connected — protocol v2 verified');
          },
          cancelled: reason => {
            ended = true;
            setHardware(`Stopped: ${reason}. Reconnect explicitly to recover.`);
            dispatch({ type: 'disconnect' }, `Transport stopped: ${reason}.`);
          },
        },
      );
      if (ended) await connection.closed;
      else {
        adapter.current = connection;
        void connection.closed.then(() => {
          if (adapter.current === connection) adapter.current = null;
          record('Serial cleanup completed; next connection requires a new session.');
        });
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Serial error';
      record(`Connection attempt failed: ${reason}.`);
      setHardware(`Not connected: ${reason}`);
    } finally { setConnecting(false); }
  }

  const scanning = state.phase === 'armed';
  const held = state.phase === 'held';
  const activeIndex = scanning || held ? state.index : -1;
  return (
    <main onPointerDownCapture={event => {
      if (event.target !== switchButton.current) cancelHeld();
    }} onKeyDownCapture={event => {
      if (event.key === 'Tab' || event.target !== switchButton.current) cancelHeld();
    }}>
      <header>
        <p className="brand">StillMyVoice</p>
        <h1>Input diagnostic</h1>
        <p>Temporary engineering screen · physical input and local simulation are labeled separately.</p>
      </header>

      <section className="connection" aria-label="Connection status">
        <strong>Hardware: {hardware}</strong>
        <span>{serialAvailable ? 'Web Serial is available in this browser.' : 'Web Serial is unavailable in this browser. Use Chrome for later hardware testing.'}</span>
        <span>Choose Pico at /dev/cu.usbmodem103: OS-verified CDC2 data interface 3 for this attachment. Recheck the path after USB reconnection.</span>
        <label><input type="checkbox" checked={verifiedPort} disabled={connecting || (mode.current === 'hardware' && state.connected)}
          onChange={event => setVerifiedPort(event.target.checked)} /> I will select the verified CDC2 data port, not the console.</label>
        <button type="button" disabled={!serialAvailable || !verifiedPort || connecting || (mode.current === 'hardware' && state.connected)} onClick={() => void connectPico()}>
          {connecting ? 'Connecting…' : 'Connect Pico'}
        </button>
        <button type="button" disabled={mode.current !== 'hardware' || !state.connected} onClick={() => adapter.current?.stop('Explicit pause')}>Pause / disconnect Pico</button>
      </section>

      <div className="workspace">
        <section className="result" aria-label="Selection results">
          <h2>Last {mode.current === 'hardware' ? 'physical' : 'simulated'} selection</h2>
          <p className="chosen" aria-live="polite">{lastSelection?.targetId ?? 'No selection yet'}</p>
          <dl>
            <div><dt>Completed selections</dt><dd data-testid="selection-count">{state.selections}</dd></div>
            <div><dt>Input</dt><dd>{state.pressed === null ? 'Unknown / unarmed' : state.pressed ? 'Pressed' : 'Released'}</dd></div>
            <div><dt>Scanner</dt><dd>{held ? 'Held — release to choose' : scanning ? 'Scanning' : 'Paused / awaiting synchronization'}</dd></div>
          </dl>
          <p className="note">Input source: {mode.current}. No speech, AI, microphone, or gaze is active.</p>
        </section>

        <section aria-label="Three stable targets">
          <h2>Scanning targets</h2>
          <ol className="targets">
            {targets.map((target, index) => (
              <li key={target} data-scan={activeIndex === index} data-held={held && activeIndex === index}
                data-selected={lastSelection?.targetId === target} aria-current={activeIndex === index ? 'true' : undefined}>
                <strong>{target}</strong>
                <span>{held && activeIndex === index ? 'Held · release to choose' : activeIndex === index ? 'Scan focus' : '\u00a0'}</span>
                <span className="selection-mark">{lastSelection?.targetId === target ? '✓ Last selected' : '\u00a0'}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <section className="simulation" aria-label="Simulation controls">
        <h2>Local input simulation</h2>
        <p>Start or resume, then hold and release the simulated switch. With that button focused, Space or Enter does the same. Focus loss cancels a pending selection.</p>
        <div className="controls">
          <button type="button" onClick={resumeSimulation} disabled={scanning || held || connecting || (mode.current === 'hardware' && state.connected)}>
            {state.connected ? 'Resume simulation' : 'Start simulation'}
          </button>
          <button ref={switchButton} type="button" className="simulated-switch" disabled={!state.connected || mode.current !== 'simulation'}
            aria-describedby="simulation-help"
            onPointerDown={event => {
              if (event.button !== 0) return;
              event.currentTarget.focus();
              event.currentTarget.setPointerCapture(event.pointerId);
              press(`pointer:${event.pointerId}`);
            }}
            onPointerUp={event => release(`pointer:${event.pointerId}`)}
            onPointerCancel={cancelHeld}
            onLostPointerCapture={() => { if (heldInput.current?.startsWith('pointer:')) cancelHeld(); }}
            onBlur={() => { if (heldInput.current) cancelHeld(); }}
            onKeyDown={event => {
              if (event.key !== ' ' && event.key !== 'Enter') return;
              event.preventDefault();
              if (!event.repeat) press(`key:${event.key}`);
            }}
            onKeyUp={event => {
              if (event.key !== ' ' && event.key !== 'Enter') return;
              event.preventDefault();
              release(`key:${event.key}`);
            }}>Simulated switch · hold, then release</button>
          <button type="button" disabled={!state.connected || mode.current !== 'simulation'} onClick={() => {
            heldInput.current = null;
            dispatch({ type: 'disconnect' });
          }}>Disconnect simulator</button>
        </div>
        <p id="simulation-help" className="note">A hold never repeats. The simulator does not operate the Pico or prove physical integration.</p>
      </section>

      <details open>
        <summary>Bounded event log ({log.length}/40)</summary>
        <ol className="log">{log.map(entry => <li key={entry.id}>{entry.text}</li>)}</ol>
      </details>
    </main>
  );
}

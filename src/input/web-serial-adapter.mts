import { SerialSession, type InputMessage, type Command } from './serial-protocol.mts';

// Structural Web Serial types avoid adding a runtime or type package.
export interface DataPort extends EventTarget {
  getInfo(): { usbVendorId?: number; usbProductId?: number };
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  open(options: { baudRate: number; bufferSize: number; flowControl: 'none' }): Promise<void>;
  setSignals(signals: { dataTerminalReady: boolean }): Promise<void>;
  close(): Promise<void>;
}
export interface SerialChooser {
  requestPort(options: { filters: { usbVendorId: number; usbProductId: number }[] }): Promise<DataPort>;
}
export type Environment = {
  window: EventTarget;
  document: EventTarget;
  visible: () => boolean;
  active: () => boolean;
  now: () => number;
  nonce: () => string;
  every: (callback: () => void, ms: number) => () => void;
  settle: () => Promise<void>;
};
export const browserEnvironment = (): Environment => ({
  window, document,
  visible: () => document.visibilityState === 'visible',
  active: () => document.visibilityState === 'visible' && document.hasFocus(),
  now: () => performance.now(),
  nonce: () => crypto.randomUUID(),
  every: (callback, ms) => { const id = setInterval(callback, ms); return () => clearInterval(id); },
  // Let the firmware observe DTR and discard its previous session's buffers.
  // A missed handshake fails closed; it is never retried within the same epoch.
  settle: () => new Promise(resolve => setTimeout(resolve, 200)),
});
export type AdapterCallbacks = {
  // Initialize the input kernel with this fresh ID; return its derived epoch.
  epoch: (instanceId: string) => string;
  input: (message: InputMessage) => void;
  cancelled: (reason: string) => void;
  waitingForFocus?: () => void;
};

// Chrome's chooser can resolve before document focus is restored. This is a
// pre-open wait only: no port, DTR, epoch, input or scanning exists yet. Hidden
// pages/unload abort, and a short deadline prevents an abandoned attempt from
// opening later. Once open begins, every genuine blur still cancels immediately.
async function waitForPickerFocus(env: Environment, waiting?: () => void) {
  if (!env.visible()) throw Error('Page must be visible');
  if (env.active()) return;
  waiting?.();
  await new Promise<void>((resolve, reject) => {
    const started = env.now();
    let done = false;
    let cancelTimer = () => {};
    const finish = (error?: Error) => {
      if (done) return;
      done = true;
      cancelTimer();
      env.window.removeEventListener('focus', check);
      env.window.removeEventListener('pagehide', unload);
      env.document.removeEventListener('visibilitychange', check);
      if (error) reject(error); else resolve();
    };
    const unload = () => finish(Error('Page unloaded before connection'));
    const check = () => {
      const elapsed = env.now() - started;
      if (!env.visible()) finish(Error('Page hidden before connection'));
      else if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed >= 3000) {
        finish(Error('Focus did not return; focus the diagnostic and click Connect Pico again'));
      } else if (env.active()) finish();
    };
    env.window.addEventListener('focus', check);
    env.window.addEventListener('pagehide', unload);
    env.document.addEventListener('visibilitychange', check);
    cancelTimer = env.every(check, 25);
    check();
  });
}

/** Call directly from a user gesture. No getPorts(), automatic reconnect or guessing
 * interface order. verifySelection must verify the dedicated CDC2 interface using
 * the independently observed USB/interface identity before any open/DTR/write.
 */
export async function requestSerialAdapter(
  serial: SerialChooser,
  verifySelection: (port: DataPort) => Promise<boolean>,
  callbacks: AdapterCallbacks,
  env: Environment = browserEnvironment(),
): Promise<{ stop: (reason?: string) => void; closed: Promise<void> }> {
  // Execute before the first await so the browser can enforce user activation.
  const port = await serial.requestPort({ filters: [{ usbVendorId: 0x239a, usbProductId: 0x80f4 }] });
  if (!await verifySelection(port)) throw Error('Dedicated data interface was not verified');
  await waitForPickerFocus(env, callbacks.waitingForFocus);
  if (!env.active()) throw Error('Page must be focused and visible');

  let stopped = false;
  let opened = false;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let writer: WritableStreamDefaultWriter<Uint8Array> | undefined;
  let session: SerialSession | undefined;
  let cancelTimer = () => {};
  let finish!: () => void;
  const closed = new Promise<void>(resolve => { finish = resolve; });
  let writeChain = Promise.resolve();
  let cleanupStarted = false;
  const cleanup = async () => {
    if (cleanupStarted) return;
    cleanupStarted = true;
    cancelTimer();
    env.window.removeEventListener('blur', blur);
    env.window.removeEventListener('pagehide', pagehide);
    env.document.removeEventListener('visibilitychange', visibility);
    port.removeEventListener('disconnect', disconnected);
    // Retire input before awaiting any driver work. Streams may already be lost.
    await Promise.allSettled([reader?.cancel(), writer?.abort()]);
    try { reader?.releaseLock(); } catch { /* already released */ }
    try { writer?.releaseLock(); } catch { /* already released */ }
    if (opened) {
      try { await port.setSignals({ dataTerminalReady: false }); } catch { /* detached */ }
      try { await port.close(); } catch { /* detached */ }
    }
    finish();
  };
  const stop = (reason = 'Explicit disconnect') => {
    if (stopped) return;
    stopped = true;
    // cancel() can call stop recursively; the guard makes cancellation one-shot.
    session?.cancel(reason);
    try { callbacks.cancelled(reason); }
    finally {
      // During open(), cleanup waits until the resulting port can be closed.
      if (opened) void cleanup();
    }
  };
  const blur = () => stop('Focus lost');
  const pagehide = () => stop('Page unloaded');
  const visibility = () => { if (!env.active()) stop('Visibility lost'); };
  const disconnected = () => stop('Port lost');
  const send = (command: Command) => {
    const payload = new TextEncoder().encode(JSON.stringify(command) + '\n');
    if (payload.length > 256) return stop('Command exceeds firmware frame limit');
    // Web Serial's WritableStream owns partial OS writes. Await a full write and
    // serialize commands; never resend an uncertain prefix or duplicate a frame.
    writeChain = writeChain.then(async () => {
      if (stopped) return;
      if (!writer) throw Error('Missing writer');
      await writer.write(payload);
    }).catch(() => stop('Write failed'));
  };
  env.window.addEventListener('blur', blur);
  env.window.addEventListener('pagehide', pagehide);
  env.document.addEventListener('visibilitychange', visibility);
  port.addEventListener('disconnect', disconnected);
  try {
    await port.open({ baudRate: 115200, bufferSize: 1024, flowControl: 'none' });
    opened = true;
    if (stopped) { await cleanup(); return { stop, closed }; }
    await port.setSignals({ dataTerminalReady: true });
    await env.settle();
    if (stopped || !env.active()) {
      stop('Inactive during connection');
      await cleanup();
      return { stop, closed };
    }
    if (!port.readable || !port.writable) throw Error('Missing serial streams');
    reader = port.readable.getReader();
    writer = port.writable.getWriter();
    const instanceId = env.nonce(); // Independent unpredictable ID for every attempt.
    const epoch = callbacks.epoch(instanceId);
    if (epoch !== instanceId && !epoch.startsWith(instanceId + ':')) throw Error('Epoch must retain fresh connection identity');
    session = new SerialSession(epoch, {
      now: env.now, nonce: env.nonce, send, cancelled: stop,
      input: message => {
        if (!env.active()) stop('Inactive at input delivery');
        else if (!stopped) callbacks.input(message);
      },
    });
    session.start();
    cancelTimer = env.every(() => {
      if (!env.active()) stop('Inactive page');
      else session?.poll();
    }, 25);
    void (async () => {
      try {
        while (!stopped) {
          const result = await reader!.read();
          if (stopped) break;
          if (result.done) { stop('Port stream ended'); break; }
          if (!env.active()) { stop('Inactive at read'); break; }
          session!.receive(result.value);
        }
      } catch { stop('Read failed'); }
    })();
    return { stop, closed };
  } catch (error) {
    stop('Serial setup failed');
    await cleanup();
    throw error;
  }
}

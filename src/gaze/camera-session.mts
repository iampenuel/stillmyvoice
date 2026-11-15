/** Explicit, ephemeral camera ownership. No recording, network, input or speech capability. */
export type CameraPhase = 'off' | 'starting' | 'initializing' | 'ready' | 'unavailable';
export type CameraFailure = 'permission_denied' | 'not_found' | 'in_use' | 'camera_failed'
  | 'interrupted' | 'initialization_failed' | 'initialization_timeout';
export type CameraState = { phase: CameraPhase; error: CameraFailure | null };
export type CameraTrack = {
  readonly readyState?: string;
  stop(): void;
  addEventListener(type: 'ended' | 'mute', listener: () => void): void;
  removeEventListener(type: 'ended' | 'mute', listener: () => void): void;
};
export type CameraStream = { getTracks(): CameraTrack[] };
export type CameraCleanup = () => void | Promise<void>;
export type CameraTimer = { set(callback: () => void, delayMs: number): unknown; clear(handle: unknown): void };
export type CameraDependencies<Stream extends CameraStream> = {
  getStream: () => Promise<Stream>;
  /** Must release partial initialization resources on abort/failure; return final cleanup on success. */
  initialize: (stream: Stream, signal: AbortSignal) => CameraCleanup | Promise<CameraCleanup>;
  onStateChange?: (state: CameraState) => void;
  timeoutMs?: number;
  timer?: CameraTimer;
};
export type CameraSession = { state(): CameraState; start(): Promise<void>; stop(): void };
const defaultTimer: CameraTimer = {
  set: (callback, ms) => setTimeout(callback, ms),
  clear: handle => clearTimeout(handle as ReturnType<typeof setTimeout>),
};
const acquisitionFailure = (error: unknown): CameraFailure => {
  const name = error && typeof error === 'object' && 'name' in error ? error.name : '';
  return name === 'NotAllowedError' || name === 'SecurityError' ? 'permission_denied'
    : name === 'NotFoundError' || name === 'OverconstrainedError' ? 'not_found'
    : name === 'NotReadableError' || name === 'AbortError' ? 'in_use' : 'camera_failed';
};
function dispose(cleanup: CameraCleanup | null) {
  if (!cleanup) return;
  try { void Promise.resolve(cleanup()).catch(() => {}); } catch { /* Camera shutdown still proceeds. */ }
}
function stopTracks(stream: CameraStream) {
  for (const track of stream.getTracks()) {
    try { track.stop(); } catch { /* Attempt every track even if one driver fails. */ }
  }
}
/** Construction never asks for a camera. Only start() acquires a stream.
 * stop() settles start immediately; unresolved permissions/initializers remain retired. */
export function createCameraSession<Stream extends CameraStream>(deps: CameraDependencies<Stream>): CameraSession {
  const timer = deps.timer ?? defaultTimer;
  const timeoutMs = Number.isFinite(deps.timeoutMs) ? Math.min(120_000, Math.max(1, deps.timeoutMs!)) : 45_000;
  type Run = {
    controller: AbortController; stream: Stream | null; cleanup: CameraCleanup | null;
    unlisten: (() => void)[]; timeout: unknown; hasTimeout: boolean;
    done: Promise<void>; settle: () => void;
  };
  let active: Run | null = null;
  let state: CameraState = { phase: 'off', error: null };
  const publish = (next: CameraState) => {
    state = next;
    try { deps.onStateChange?.({ ...next }); } catch { /* A view callback cannot prevent cleanup. */ }
  };
  const clearTimer = (run: Run) => {
    if (run.hasTimeout) timer.clear(run.timeout);
    run.hasTimeout = false;
  };
  const retire = (run: Run, next: CameraState) => {
    if (active !== run) return;
    active = null; // Retire before abort, events or cleanup can re-enter.
    clearTimer(run);
    for (const remove of run.unlisten.splice(0)) remove();
    run.controller.abort();
    if (run.stream) stopTracks(run.stream);
    const cleanup = run.cleanup; run.cleanup = null; run.stream = null;
    dispose(cleanup);
    publish(next); run.settle();
  };
  const fail = (run: Run, error: CameraFailure) => retire(run, { phase: 'unavailable', error });
  const acquire = async (run: Run) => {
    let stream: Stream;
    try { stream = await deps.getStream(); }
    catch (error) { if (active === run) fail(run, acquisitionFailure(error)); return; }
    if (active !== run) { stopTracks(stream); return; }
    run.stream = stream;
    try {
      const tracks = stream.getTracks();
      if (!tracks.length || tracks.some(track => track.readyState === 'ended')) { fail(run, 'interrupted'); return; }
      for (const track of tracks) {
        const interrupted = () => fail(run, 'interrupted');
        for (const kind of ['ended', 'mute'] as const) {
          track.addEventListener(kind, interrupted);
          run.unlisten.push(() => track.removeEventListener(kind, interrupted));
        }
      }
      publish({ phase: 'initializing', error: null });
      if (active !== run) return;
      run.hasTimeout = true;
      run.timeout = timer.set(() => fail(run, 'initialization_timeout'), timeoutMs);
      if (active !== run) return;
      const cleanup = await deps.initialize(stream, run.controller.signal);
      if (active !== run) { dispose(cleanup); return; }
      run.cleanup = cleanup;
      clearTimer(run);
      publish({ phase: 'ready', error: null }); run.settle();
    } catch { if (active === run) fail(run, 'initialization_failed'); }
  };
  return {
    state: () => ({ ...state }),
    start: () => {
      if (active) return active.done; // Repeated activation is not another camera request.
      let settle!: () => void;
      const done = new Promise<void>(resolve => { settle = resolve; });
      const run: Run = { controller: new AbortController(), stream: null, cleanup: null,
        unlisten: [], timeout: null, hasTimeout: false, done, settle };
      active = run; publish({ phase: 'starting', error: null });
      if (active === run) void acquire(run);
      return done;
    },
    stop: () => {
      if (active) retire(active, { phase: 'off', error: null });
      else if (state.phase !== 'off') publish({ phase: 'off', error: null });
    },
  };
}

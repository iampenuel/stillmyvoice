import { RELEASE_CAPABILITIES, requireCloudServices } from '../release-capabilities.mts';
import { normalizePublicRecording } from './public-demo-audio.mts';
/** Ephemeral bounded recording. No storage, network, input or speech capability. */
export type Recording = { blob: Blob; durationMs: number };
type Stream = Pick<MediaStream, 'getTracks'>;
type Recorder = Pick<MediaRecorder, 'start' | 'stop' | 'state' | 'mimeType' | 'ondataavailable' | 'onstop' | 'onerror'>;
type Dependencies = { getStream: (signal: AbortSignal) => Promise<Stream>; recorder: (stream: Stream) => Recorder;
  normalize?: (recording: Recording, signal: AbortSignal) => Promise<Recording>;
  now?: () => number; schedule?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>; clear?: typeof clearTimeout };
export function createRecording(deps: Dependencies, event: (event: 'limit' | 'error') => void) {
  const now = deps.now ?? (() => performance.now()), schedule = deps.schedule ?? setTimeout, clear = deps.clear ?? clearTimeout;
  let generation = 0, stream: Stream | null = null, recorder: Recorder | null = null, started = 0;
  let timer: ReturnType<typeof setTimeout> | null = null, chunks: Blob[] = [], bytes = 0;
  let conversion: AbortController | null = null, acquisition: AbortController | null = null;
  let result: Promise<Recording> | null = null, resolve: ((value: Recording) => void) | null = null, reject: ((reason: Error) => void) | null = null;
  const tracksOff = () => { if (stream) for (const track of stream.getTracks()) { track.onended = null; track.stop(); } stream = null; };
  const cancel = () => {
    generation++; conversion?.abort(); conversion = null; acquisition?.abort(); acquisition = null; if (timer) clear(timer); timer = null;
    if (recorder) { recorder.ondataavailable = null; recorder.onstop = null; recorder.onerror = null; if (recorder.state !== 'inactive') recorder.stop(); }
    recorder = null; tracksOff(); chunks = []; bytes = 0; reject?.(Error('Recording canceled')); resolve = null; reject = null;
  };
  const stop = (): Promise<Recording> => {
    if (!result || !recorder) return Promise.reject(Error('No recording'));
    if (timer) clear(timer); timer = null;
    if (recorder.state !== 'inactive') recorder.stop();
    tracksOff(); return result;
  };
  return {
    async start() {
      cancel(); const token = generation;
      const permission = new AbortController(); acquisition = permission;
      const granted = await deps.getStream(permission.signal);
      if (acquisition === permission) acquisition = null;
      if (token !== generation) { for (const track of granted.getTracks()) track.stop(); throw Error('Recording canceled'); }
      stream = granted;
      try {
        recorder = deps.recorder(granted); const activeRecorder = recorder;
        result = new Promise<Recording>((yes, no) => { resolve = yes; reject = no; }); void result.catch(() => {});
        const fail = () => { if (token !== generation) return; cancel(); event('error'); };
        for (const track of stream.getTracks()) track.onended = fail;
        recorder.onerror = fail;
        recorder.ondataavailable = e => {
          if (token !== generation || !e.data.size) return;
          bytes += e.data.size; if (bytes > 1024 * 1024) { fail(); return; } chunks.push(e.data);
        };
        recorder.onstop = async () => {
          if (token !== generation) return;
          if (timer) clear(timer); timer = null; tracksOff();
          const blob = new Blob(chunks, { type: activeRecorder.mimeType }); chunks = [];
          const durationMs = Math.min(20_000, Math.max(100, Math.round(now() - started)));
          try {
            if (!blob.size) throw Error('No audio captured');
            conversion = new AbortController();
            const captured = { blob, durationMs };
            const recording = deps.normalize ? await deps.normalize(captured, conversion.signal) : captured;
            if (token === generation) resolve?.(recording);
          } catch { if (token === generation) reject?.(Error('Recording conversion unavailable')); }
          finally { if (token === generation) { conversion = null; resolve = null; reject = null; } }
        };
        started = now(); recorder.start(250);
        timer = schedule(() => { if (token === generation) { event('limit'); void stop().catch(() => {}); } }, 20_000);
      } catch { cancel(); throw Error('Microphone recording unavailable'); }
    }, stop, cancel,
  };
}
export class PublicRecordingUnavailableError extends Error {
  constructor(reason: 'access' | 'service' | 'verification' = 'verification') {
    super(reason === 'access' ? 'Demo access is locked or expired on this website. Open Demo access in Companion setup and unlock this address before recording.'
      : reason === 'service' ? 'Demo access is unlocked, but the transcription service is unavailable. Check cloud status in Companion setup.'
      : 'Could not verify Listening availability. Check your connection and Demo access in Companion setup. The microphone stayed off.');
  }
}
/** Check the actual server session immediately before public microphone acquisition. */
export async function acquirePublicRecording(signal: AbortSignal, deps: { fetcher: typeof fetch; getStream: () => Promise<Stream>; now?: () => number }): Promise<Stream> {
  const now = deps.now ?? Date.now;
  // Native Window.fetch must not receive the dependency object as its receiver.
  const { fetcher } = deps;
  let expiresAt: number;
  try {
    signal.throwIfAborted();
    const response = await fetcher('/api/status', { method: 'GET', credentials: 'same-origin', cache: 'no-store',
      signal: AbortSignal.any([signal, AbortSignal.timeout(4000)]) });
    if (response.status === 401 || response.status === 403) throw new PublicRecordingUnavailableError('access');
    if (!response.ok) throw Error();
    const text = await response.text(); signal.throwIfAborted();
    if (text.length > 8192) throw Error();
    const status = JSON.parse(text);
    expiresAt = status?.access?.expiresAt;
    if (status?.access?.authorized !== true || !Number.isSafeInteger(expiresAt) || expiresAt <= now()) throw new PublicRecordingUnavailableError('access');
    if (status?.scribe?.available !== true) throw new PublicRecordingUnavailableError('service');
  } catch (error) { throw error instanceof PublicRecordingUnavailableError ? error : new PublicRecordingUnavailableError(); }
  signal.throwIfAborted();
  const stream = await deps.getStream();
  if (signal.aborted || expiresAt <= now()) {
    for (const track of stream.getTracks()) track.stop();
    signal.throwIfAborted(); throw new PublicRecordingUnavailableError('access');
  }
  return stream;
}
export function browserRecording(event: (event: 'limit' | 'error') => void, cloudAllowed=RELEASE_CAPABILITIES.cloudServices) {
  return createRecording({
    ...(import.meta.env?.VITE_SMV_RELEASE_MODE === 'public-demo' ? { normalize: normalizePublicRecording } : {}),
    getStream: signal => {
      requireCloudServices(cloudAllowed); signal.throwIfAborted();
      const getStream = () => navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      return import.meta.env?.VITE_SMV_RELEASE_MODE === 'public-demo' ? acquirePublicRecording(signal, { fetcher: fetch, getStream }) : getStream();
    },
    recorder: stream => {
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'].find(type => MediaRecorder.isTypeSupported(type));
      if (!mimeType) throw Error('No supported recording format');
      return new MediaRecorder(stream as MediaStream, { mimeType, audioBitsPerSecond: 64_000 });
    },
  }, event);
}

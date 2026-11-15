// SPDX-License-Identifier: AGPL-3.0-or-later
/** Public uploads use an inspectable PCM format; conversion never plays or sends audio. */
export const PUBLIC_AUDIO_SAMPLE_RATE = 16_000;
export const PUBLIC_AUDIO_MAX_SAMPLES = 20 * PUBLIC_AUDIO_SAMPLE_RATE;
type CapturedAudio = { blob: Blob; durationMs: number };
type DecodedAudio = Pick<AudioBuffer, 'sampleRate' | 'length' | 'numberOfChannels' | 'getChannelData'>;
export type DecodePublicAudio = (bytes: ArrayBuffer) => Promise<DecodedAudio>;

/** Canonical RIFF/WAVE, one PCM16 channel, no optional chunks or metadata. */
export function encodePublicWav(samples: Float32Array): Uint8Array {
  if (!samples.length || samples.length > PUBLIC_AUDIO_MAX_SAMPLES) throw Error('Recording exceeds the public audio limit');
  const bytes = new Uint8Array(44 + samples.length * 2), view = new DataView(bytes.buffer);
  const tag = (at: number, value: string) => { for (let i = 0; i < value.length; i++) bytes[at + i] = value.charCodeAt(i); };
  tag(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); tag(8, 'WAVE'); tag(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, PUBLIC_AUDIO_SAMPLE_RATE, true); view.setUint32(28, PUBLIC_AUDIO_SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); tag(36, 'data'); view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    if (!Number.isFinite(samples[i])) throw Error('Recording contains invalid samples');
    const sample = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, Math.round(sample * (sample < 0 ? 32768 : 32767)), true);
  }
  return bytes;
}

const decodeOffline: DecodePublicAudio = bytes => {
  // decodeAudioData resamples to this context's 16 kHz rate. An offline context
  // has no speaker/output device; no source node or audible playback is created.
  if (typeof OfflineAudioContext === 'undefined') throw Error('Public recording conversion is unavailable');
  return new OfflineAudioContext(1, 1, PUBLIC_AUDIO_SAMPLE_RATE).decodeAudioData(bytes);
};

export async function normalizePublicRecording(recording: CapturedAudio, signal: AbortSignal, decode: DecodePublicAudio = decodeOffline): Promise<CapturedAudio> {
  signal.throwIfAborted();
  if (!recording.blob.size || recording.blob.size > 1_048_576) throw Error('Recording exceeds the capture limit');
  const bytes = await recording.blob.arrayBuffer(); signal.throwIfAborted();
  const decoded = await decode(bytes); signal.throwIfAborted();
  if (decoded.sampleRate !== PUBLIC_AUDIO_SAMPLE_RATE || !Number.isSafeInteger(decoded.length) || decoded.length < 1
    || !Number.isSafeInteger(decoded.numberOfChannels) || decoded.numberOfChannels < 1 || decoded.numberOfChannels > 32) throw Error('Unsupported decoded recording');
  // Timer scheduling and codec padding can exceed the capture deadline slightly.
  // Only the first 20 seconds are conveyed; the server independently proves it.
  const count = Math.min(decoded.length, PUBLIC_AUDIO_MAX_SAMPLES), mono = new Float32Array(count);
  for (let channel = 0; channel < decoded.numberOfChannels; channel++) {
    const samples = decoded.getChannelData(channel);
    if (samples.length !== decoded.length) throw Error('Invalid decoded recording');
    for (let i = 0; i < count; i++) {
      if (!Number.isFinite(samples[i])) throw Error('Invalid decoded recording');
      mono[i] += samples[i] / decoded.numberOfChannels;
    }
  }
  signal.throwIfAborted();
  return { blob: new Blob([new Uint8Array(encodePublicWav(mono))], { type: 'audio/wav' }), durationMs: Math.ceil(count * 1000 / PUBLIC_AUDIO_SAMPLE_RATE) };
}

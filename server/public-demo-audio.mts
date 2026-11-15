// SPDX-License-Identifier: AGPL-3.0-or-later
import { ProviderError } from './elevenlabs.mts';
import { validateRecording } from './scribe.mts';

/** Prove billed audio duration from canonical PCM bytes, never client metadata. */
export function validatePublicRecording(value: unknown): ReturnType<typeof validateRecording> {
  const parsed = validateRecording(value), { audio } = parsed;
  const fail = () => { throw new ProviderError('PUBLIC_AUDIO_FORMAT_REQUIRED', 422); };
  if (parsed.request.mimeType !== 'audio/wav' || audio.length < 46 || audio.length > 640_044) fail();
  const view = new DataView(audio.buffer, audio.byteOffset, audio.byteLength);
  const tag = (at: number, expected: string) => [...expected].every((letter, index) => audio[at + index] === letter.charCodeAt(0));
  const dataBytes = audio.length - 44;
  if (!tag(0, 'RIFF') || view.getUint32(4, true) !== audio.length - 8 || !tag(8, 'WAVE') || !tag(12, 'fmt ')
    || view.getUint32(16, true) !== 16 || view.getUint16(20, true) !== 1 || view.getUint16(22, true) !== 1
    || view.getUint32(24, true) !== 16_000 || view.getUint32(28, true) !== 32_000
    || view.getUint16(32, true) !== 2 || view.getUint16(34, true) !== 16 || !tag(36, 'data')
    || view.getUint32(40, true) !== dataBytes || dataBytes % 2 !== 0) fail();
  return { ...parsed, request: { ...parsed.request, durationMs: Math.ceil(dataBytes / 32) } };
}

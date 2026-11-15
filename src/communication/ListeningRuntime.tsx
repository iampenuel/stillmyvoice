import { FRONTEND_CLOUD_UNAVAILABLE, requireCloudServices } from '../release-capabilities.mts';
import { useEffect } from 'react';
import { cloudServicesEnabled, listeningEvent, type Model } from './model.mts';
import { browserRecording } from './recording.mts';
type Props = { model: Model; current: { current: Model }; commit: (model: Model) => void; canUpdate: () => boolean };
const active = () => document.hasFocus() && document.visibilityState === 'visible';
export function ListeningRuntime({ model, current, commit, canUpdate }: Props) {
  const id = model.listen.session;
  useEffect(() => {
    if (!id) return;
    if (!cloudServicesEnabled(model)) {
      let applied=false;
      const unavailable=()=>{if(applied||!canUpdate())return;applied=true;commit(listeningEvent(current.current,id,'error',FRONTEND_CLOUD_UNAVAILABLE));};
      unavailable(); const timer=setInterval(unavailable,100); return()=>clearInterval(timer);
    }
    const controller = new AbortController(); let started = false, uploading = false;
    let pending: { event: 'recording' | 'processing' | 'transcript' | 'error'; text: string } | null = null;
    const valid = () => cloudServicesEnabled(current.current) && !controller.signal.aborted && current.current.listen.session === id && current.current.screen.name === 'listening' && active();
    const publish = (event: 'recording' | 'processing' | 'transcript' | 'error', text = '') => { pending = { event, text }; apply(); };
    const recorder = browserRecording(event => publish(event === 'limit' ? 'processing' : 'error', event === 'error' ? 'Recording stopped. Please try again.' : ''));
    const apply = () => {
      if (pending && valid() && canUpdate()) { const next = pending; pending = null; commit(listeningEvent(current.current, id, next.event, next.text)); }
    };
    const cancel = () => { controller.abort(); recorder.cancel(); pending = null; };
    const inactive = () => { if (!active()) { cancel(); commit(listeningEvent(current.current, id, 'error', 'Recording canceled when the page became inactive.')); } };
    const upload = async () => {
      if (uploading || !started || !valid()) return; uploading = true;
      try {
        const capture = await recorder.stop(); if (!valid()) return;
        const data = new Uint8Array(await capture.blob.arrayBuffer()); let binary = '';
        for (let i = 0; i < data.length; i += 8192) binary += String.fromCharCode(...data.subarray(i, i + 8192));
        if (!valid()) return;
        requireCloudServices();
        const response = await fetch('/api/transcription', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, audioBase64: btoa(binary), mimeType: capture.blob.type, durationMs: capture.durationMs, synthetic: true, recordingConsent: true }),
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) });
        if (!response.ok) throw Error('Transcription unavailable. Your message is unchanged.');
        const body = await response.text(); if (body.length > 8192) throw Error('Invalid transcript.');
        const result = JSON.parse(body);
        if (!result || Object.keys(result).join(',') !== 'text' || typeof result.text !== 'string' || !result.text.trim() || result.text.length > 1000) throw Error('No reliable transcript.');
        if (valid()) publish('transcript', result.text);
      } catch { if (valid()) publish('error', 'Transcription unavailable. Your message is unchanged.'); }
    };
    const timer = setInterval(() => { apply(); if (current.current.listen.phase === 'processing') void upload(); }, 50);
    window.addEventListener('blur', inactive); document.addEventListener('visibilitychange', inactive);
    void (async () => {
      await Promise.resolve();
      if (!valid() || current.current.listen.phase !== 'requesting') return;
      try { await recorder.start(); started = true; if (!valid()) { recorder.cancel(); return; } publish('recording'); }
      catch { if (valid()) publish('error', 'Microphone unavailable or permission denied. Your message is unchanged.'); }
    })();
    return () => { cancel(); clearInterval(timer); window.removeEventListener('blur', inactive); document.removeEventListener('visibilitychange', inactive); };
  }, [id]);
  return null;
}

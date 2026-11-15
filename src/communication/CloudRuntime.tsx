import { requireCloudServices } from '../release-capabilities.mts';
import { useEffect } from 'react';
import { cloudFailure, requestStillCurrent } from './cloud-error.mts';
import { cloudServicesEnabled, finishAssistance, finishExpansion, type Model } from './model.mts';
import { isExpansionResult, type ExpansionResult } from './expansion-contract.mts';
import { approvedVoices, initialCloud, type PremiumVoice, type Suggestion } from './cloud-contract.mts';

type Props = { model: Model; current: { current: Model }; commit: (next: Model) => void; canUpdate: () => boolean };
const active = () => document.hasFocus() && document.visibilityState === 'visible';
async function json(path: string, signal: AbortSignal, body?: unknown) {
  requireCloudServices();
  const response = await fetch(path, { method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal });
  const text = await response.text(); if (text.length > 65536) throw Error('Invalid service response.');
  let result: unknown;
  try { result = JSON.parse(text); } catch { throw Error(response.ok ? 'Invalid service response.' : cloudFailure(response.status, null)); }
  if (!response.ok) throw Error(cloudFailure(response.status, result));
  return result as any;
}
/** Metadata never changes a held view. Suggestions have no input or speech capability. */
export function CloudRuntime({ model, current, commit, canUpdate }: Props) {
  useEffect(() => {
    const controller = new AbortController(); let pending: Partial<Model['cloud']> | null = null;
    const apply = () => {
      if (!pending || controller.signal.aborted || !active() || !canUpdate()) return;
      commit({ ...current.current, uiRevision: current.current.uiRevision + 1, cloud: { ...current.current.cloud, ...pending } }); pending = null;
    };
    void (async () => {
      try {
        if (!cloudServicesEnabled(current.current)) {
          const disabled=initialCloud(false);
          pending={backendEnabled:false,consent:false,elevenlabs:false,gemini:false,elevenReason:disabled.elevenReason,geminiReason:disabled.geminiReason,voices:disabled.voices};
          apply(); return;
        }
        const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]);
        const status = await json('/api/status', signal);
        const cloud = current.current.cloud;
        let voices = cloud.voices;
        if (status.elevenlabs?.metadataAvailable === true) {
          const result = await json('/api/voices', signal, {});
          if (Array.isArray(result.voices) && result.voices.length === 6 && result.voices.every((v: PremiumVoice, i: number) =>
            v.id === approvedVoices[i].id && typeof v.available === 'boolean' && typeof v.reason === 'string')) voices = result.voices;
          else throw Error('Voice collection could not be verified.');
        }
        pending = { elevenlabs: status.elevenlabs?.available === true, gemini: status.gemini?.available === true,
          elevenReason: status.elevenlabs?.available === true ? 'Ready' : 'Account protections need confirmation',
          geminiReason: status.gemini?.available === true ? 'Ready' : 'Free-tier account checks pending', voices };
      } catch { if (!controller.signal.aborted) pending = { elevenlabs: false, gemini: false, elevenReason: 'Voice service unavailable', geminiReason: 'Suggestion service unavailable' }; }
      apply();
    })();
    const timer = setInterval(apply, 100);
    return () => { controller.abort(); clearInterval(timer); };
  }, [model.cloud.refresh]);

  const request = model.assistance.request;
  useEffect(() => {
    if (!request || !cloudServicesEnabled(model)) return;
    const controller = new AbortController();
    let result: { items: Suggestion[]; error: string } | null = null;
    const apply = () => {
      if (!result || controller.signal.aborted || !active() || !canUpdate()) return;
      commit(finishAssistance(current.current, request, result.items, result.error)); result = null;
    };
    const timer = setInterval(apply, 100);
    void (async () => {
      try {
        // Let parent lifecycle retirement run before starting retained work after HMR.
        if (!await requestStillCurrent(controller.signal, request.id, () => current.current.assistance.request?.id)) return;
        if (!cloudServicesEnabled(current.current) || !active() || !current.current.cloud.consent || !current.current.cloud.gemini) throw Error('Request canceled. Your words are kept.');
        const response = await json('/api/suggestions', AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]), request);
        const items: unknown = response.suggestions;
        if (!Array.isArray(items) || items.length > 3 || !items.every(item => item && Object.keys(item).sort().join(',') === 'kind,text'
          && typeof item.text === 'string' && item.text.length > 0 && item.text.length <= 240
          && typeof item.kind === 'string' && item.kind === request.kind)) throw Error('No reliable suggestions. Keep your own wording.');
        if (!controller.signal.aborted) { result = { items: items as Suggestion[], error: '' }; apply(); }
      } catch (error) {
        if (!controller.signal.aborted) { result = { items: [], error: error instanceof Error ? error.message : 'Suggestions unavailable.' }; apply(); }
      }
    })();
    return () => { controller.abort(); clearInterval(timer); };
  }, [request?.id]);
  const expansionRequest = model.expansion.request;
  useEffect(() => {
    if (!expansionRequest || !cloudServicesEnabled(model)) return;
    const controller = new AbortController();
    let pending: { result: ExpansionResult | null; error: string } | null = null;
    const apply = () => {
      if (!pending || controller.signal.aborted || !active() || !canUpdate()) return;
      commit(finishExpansion(current.current, expansionRequest, pending.result, pending.error)); pending = null;
    };
    const timer = setInterval(apply, 100);
    void (async () => {
      try {
        // Retained request state cannot be replayed before parent HMR cleanup retires it.
        if (!await requestStillCurrent(controller.signal, expansionRequest.id, () => current.current.expansion.request?.id)) return;
        if (!cloudServicesEnabled(current.current) || !active() || !current.current.cloud.consent || !current.current.cloud.gemini) throw Error('Request canceled. Your words are kept.');
        const result = await json('/api/expansion', AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]), expansionRequest);
        if (!isExpansionResult(result)) throw Error('Gemini returned an invalid structured response. Your words are kept.');
        if (!controller.signal.aborted) { pending = { result, error: '' }; apply(); }
      } catch (error) {
        if (!controller.signal.aborted) { pending = { result: null, error: error instanceof Error ? error.message : 'Expansion unavailable.' }; apply(); }
      }
    })();
    return () => { controller.abort(); clearInterval(timer); };
  }, [expansionRequest?.id]);
  return null;
}

// SPDX-License-Identifier: AGPL-3.0-or-later
/** Public build capability only. This value never contains credentials. */
export function releaseCapabilities(mode:unknown) {
  const frontendDemo=mode==='frontend-demo'||mode==='gaze-demo';
  return Object.freeze({frontendDemo,cloudServices:!frontendDemo,gazeExperiment:mode!=='frontend-demo'});
}
export const RELEASE_CAPABILITIES=releaseCapabilities(import.meta.env?.VITE_SMV_RELEASE_MODE);
export const PUBLIC_DEMO=import.meta.env?.VITE_SMV_RELEASE_MODE==='public-demo';
export const PUBLIC_RELEASE=PUBLIC_DEMO||RELEASE_CAPABILITIES.frontendDemo;
export const FRONTEND_DEMO=RELEASE_CAPABILITIES.frontendDemo;
export const FRONTEND_CLOUD_UNAVAILABLE='Unavailable in this frontend demo. Use the local SMV setup for Listening, Gemini and ElevenLabs.';
export function requireCloudServices(allowed=RELEASE_CAPABILITIES.cloudServices):void {
  if (!RELEASE_CAPABILITIES.cloudServices || !allowed) throw Error(FRONTEND_CLOUD_UNAVAILABLE);
}

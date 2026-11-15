import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

/** Populated .env flags cannot enable live requests. Independently verified
 * account protections must be supplied through the separate local gate. */
export function serverEnvironment(contents: string, inherited: Record<string, string | undefined> = {}, protections: { metadata?: boolean; elevenlabs?: boolean; gemini?: boolean } = {}) {
  const local = parseEnv(contents);
  if (Object.keys(local).some(name => /^VITE_.*(?:GEMINI|ELEVENLABS|API_KEY)/i.test(name))) {
    throw Error('Provider keys must use server-only names');
  }
  return {
    NODE_ENV: inherited.NODE_ENV,
    GOOGLE_GENAI_USE_VERTEXAI: inherited.GOOGLE_GENAI_USE_VERTEXAI,
    // Carry already-consumed local budget across a controlled diagnostic restart.
    // This is operator state, never an owner .env flag or a billing entitlement.
    SMV_GEMINI_START_REQUESTS: inherited.SMV_GEMINI_START_REQUESTS,
    GEMINI_API_KEY: local.GEMINI_API_KEY ?? inherited.GEMINI_API_KEY,
    ELEVENLABS_API_KEY: local.ELEVENLABS_API_KEY ?? inherited.ELEVENLABS_API_KEY,
    SMV_CLOUD_MODE: protections.elevenlabs || protections.gemini ? 'local-synthetic-demo' : 'disabled',
    SMV_ELEVENLABS_CREDITS_CONFIRMED: protections.elevenlabs === true ? 'true' : 'false',
    SMV_GEMINI_FREE_TIER_CONFIRMED: protections.gemini === true ? 'true' : 'false',
    SMV_METADATA_ALLOWED: protections.metadata === true ? 'true' : 'false',
    SMV_GEMINI_MODEL: 'gemini-3.5-flash-lite',
  };
}
export function loadServerEnvironment() {
  let contents = '';
  try { contents = readFileSync(new URL('../.env', import.meta.url), 'utf8'); }
  catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw Error('Private server configuration could not be read');
  }
  // This separate ignored record is written only after account protections are
  // verified. Owner .env contents cannot enable chargeable operations.
  let protections = { metadata: true, elevenlabs: false, gemini: false };
  try {
    const record = JSON.parse(readFileSync(new URL('../.local-cache/provider-gates.json', import.meta.url), 'utf8'));
    protections = { metadata: true, elevenlabs: record.elevenlabs === true, gemini: record.gemini === true };
  } catch { /* Missing or invalid verification remains disabled. */ }
  return serverEnvironment(contents, process.env, protections);
}

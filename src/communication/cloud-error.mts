/** No raw provider messages, submitted words or credentials reach the interface. */
export function cloudFailure(status: number, payload: unknown): string {
  const data = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload as Record<string, unknown> : {};
  const retry = Number.isInteger(data.retryAfterSeconds) && Number(data.retryAfterSeconds) >= 0 && Number(data.retryAfterSeconds) <= 86400 ? Number(data.retryAfterSeconds) : null;
  switch (data.error) {
    case 'ASSISTANCE_COOLDOWN': return `Please wait ${retry ?? 5} seconds before another wording request. Your words are kept.`;
    case 'ASSISTANCE_BUSY': return 'Another wording request is still running. Your words are kept.';
    case 'ASSISTANCE_SESSION_LIMIT': return 'The local demo allowance of 20 wording requests is used. Continue with your own words.';
    case 'ASSISTANCE_ALREADY_REQUESTED': return 'That wording request was already used. Your words are kept; no duplicate was sent.';
    case 'GEMINI_QUOTA': return `Gemini’s API rate or quota limit was reached.${retry !== null ? ` The provider reports ${retry} seconds before another request.` : ''} Your words are kept.`;
    case 'LOCAL_RATE_LIMIT': return `The local app is receiving requests too quickly.${retry !== null ? ` Wait ${retry} seconds.` : ''} Your words are kept.`;
    case 'INVALID_EXPANSION': return 'Gemini returned an invalid structured response. Your words are kept.';
    case 'GEMINI_UNAVAILABLE': return 'Gemini is temporarily unavailable. Your words are kept.';
    case 'GEMINI_DISABLED': return 'Gemini is unavailable under the current demo safeguards. Your words are kept.';
    case 'GEMINI_CANCELLED_OR_TIMEOUT': return 'The wording request was canceled or timed out. Your words are kept.';
    default: return status === 429 ? 'This request was limited; the cause is unavailable. Your words are kept.' : 'Service unavailable. Your words are kept.';
  }
}
/** Effect setup may be immediately retired by Strict Mode or retained-state HMR.
 * Recheck after that synchronous lifecycle work before submitting anything. */
export async function requestStillCurrent(signal: AbortSignal, id: string, currentId: () => string | undefined): Promise<boolean> {
  await Promise.resolve();
  return !signal.aborted && currentId() === id;
}

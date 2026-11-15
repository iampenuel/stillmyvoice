/** Display copy only. Never changes connection, arming or speech authority. */
export function recoveryMessage(reason: string, connected: boolean, busy: boolean, phase?: string) {
  if (busy) return { label: 'Connecting your switch', guidance: 'Synchronizing your switch…', setup: false };
  if (connected && phase === 'needs-sync') return { label: 'Release switch to arm', guidance: 'Release once. Then use a new cycle to choose.', setup: false };
  if (connected && (phase === 'armed' || phase === 'held')) return { label: 'Switch ready', guidance: '', setup: false };
  if (/Focus lost|Page hidden|Page inactive|Visibility lost|^Inactive/.test(reason)) return {
    label: 'Communication paused', guidance: 'Your message is kept. Return to this window to resume.', setup: false };
  if (/Port lost|Port stream ended/.test(reason)) return { label: 'Switch disconnected', guidance: 'Reconnect your switch. Your message is kept.', setup: true };
  if (/epoch|fault|failed|stale|clock|sequence|heartbeat|framing|frame|stream|unexpected|invalid|malformed|duplicate|unmatched|oversized|flood|rejected/i.test(reason)) {
    return { label: 'Switch connection needs attention', guidance: 'Your message is kept. Restore the connection in setup.', setup: true };
  }
  return { label: 'Communication paused', guidance: 'Connect your switch to resume. Your message is kept.', setup: true };
}

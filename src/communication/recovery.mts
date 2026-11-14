/** Display copy only. Never changes connection, arming or speech authority. */
export function recoveryMessage(reason: string, connected: boolean, busy: boolean, phase?: string) {
  if (busy) return { label: 'Connecting your switch', guidance: 'Please wait. Input is blocked until synchronization finishes.' };
  if (connected && phase === 'needs-sync') return { label: 'Release switch to arm', guidance: 'Release once, then use a new press and release to choose.' };
  if (connected && (phase === 'armed' || phase === 'held')) return { label: 'Switch ready', guidance: '' };
  if (/Focus lost|Page hidden|Page inactive|Visibility lost|^Inactive/.test(reason)) return {
    label: 'Communication paused', guidance: 'Return to this window. Your message is kept. The switch will synchronize again before a fresh Resume selection.' };
  if (/Port lost|Port stream ended/.test(reason)) return { label: 'Switch disconnected', guidance: 'Reconnect the device, then use Companion setup to restore the switch. Your message is kept.' };
  if (/epoch|fault|failed|stale|clock|sequence|heartbeat|framing|frame|stream|unexpected|invalid|malformed|duplicate|unmatched|oversized|flood|rejected/i.test(reason)) {
    return { label: 'Switch connection needs attention', guidance: 'Communication is paused. Your message is kept. A companion can reconnect the switch in setup; technical details are below.' };
  }
  return { label: 'Communication paused', guidance: 'Reconnect your switch in Companion setup to continue scanning. Your message is kept.' };
}

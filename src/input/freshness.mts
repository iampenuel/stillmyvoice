// Clock evidence for the unapproved v2 protocol; not connected to hardware yet.
const period = 2 ** 29;
export type ClockSample = Readonly<{ sent: number; received: number; tick: number }>;
const validTick = (n: number) => Number.isInteger(n) && n >= 0 && n < period;
export function clockSample(sent: number, received: number, tick: number): ClockSample {
  if (!Number.isFinite(sent) || !Number.isFinite(received) || sent < 0
    || received < sent || received - sent > 100 || !validTick(tick)) throw new Error('Invalid clock evidence');
  return Object.freeze({ sent, received, tick });
}
export function eventIsFresh(tick: number, now: number, sample: ClockSample): boolean {
  if (!validTick(tick) || !Number.isFinite(now) || now < sample.received || now - sample.received > 1000) return false;
  const delta = ((tick - sample.tick + period * 1.5) % period) - period / 2;
  // Conservative interval: reject if the oldest plausible event exceeds 250 ms.
  // The 5 ms allowance covers short-term clock uncertainty; trial values only.
  const earliest = sample.sent + delta - 5;
  return earliest <= now && now - earliest <= 250;
}

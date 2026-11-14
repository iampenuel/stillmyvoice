// Clock evidence for protocol v2. Thresholds remain prototype trial settings.
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

export function clockSamplesAgree(previous: ClockSample, next: ClockSample): boolean {
  const delta = ((next.tick - previous.tick + period * 1.5) % period) - period / 2;
  // Each sampled device tick must occur within its host request/response interval.
  // Require overlap, allowing 5 ms short-term drift, rather than silently
  // reanchoring a stopped/jumping device clock and rejuvenating buffered events.
  return next.sent >= previous.received && next.received - previous.received <= 1000
    && previous.sent + delta - 5 <= next.received
    && previous.received + delta + 5 >= next.sent;
}

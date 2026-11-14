import { clockSample, clockSamplesAgree, eventIsFresh, type ClockSample } from './freshness.mts';

type Base = { v: 2; epoch: string; sequence: number; tick_ms: number };
export type InputMessage = Base & (
  | { type: 'sync'; pressed: boolean }
  | { type: 'down' }
  | { type: 'up'; downSequence: number }
);
type Message = InputMessage | (Base & { type: 'pong'; nonce: string }) | (Base & { type: 'fault' });
export type Command = { v: 2; type: 'sync'; epoch: string }
  | { v: 2; type: 'ping'; epoch: string; nonce: string };
const token = /^[A-Za-z0-9:-]{1,128}$/;
const natural = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;

// The firmware emits flat JSON with ASCII tokens, integers and booleans only.
// A deliberately narrow grammar rejects duplicate keys and nested/escaped data.
function parse(line: string): Message {
  if (!line.startsWith('{') || !line.endsWith('}')) throw Error('Invalid JSON frame');
  const fields = line.slice(1, -1).split(',');
  const names = new Set<string>();
  for (const field of fields) {
    const match = /^\s*"([A-Za-z_]+)"\s*:\s*("[A-Za-z0-9:-]+"|0|[1-9][0-9]*|true|false)\s*$/.exec(field);
    if (!match) {
      // Report schema metadata only, never raw bytes or arbitrary field content.
      const name = /^\s*"([A-Za-z_]+)"\s*:/.exec(field)?.[1];
      const known = ['v', 'type', 'epoch', 'sequence', 'tick_ms', 'pressed', 'downSequence', 'nonce'].includes(name ?? '') ? name : 'unknown';
      const value = field.slice(field.indexOf(':') + 1).trim();
      const shape = value === 'null' ? 'null' : /^-?\d+\.\d+(?:[eE][+-]?\d+)?$/.test(value) ? 'decimal number'
        : /^-\d+$/.test(value) ? 'negative integer' : value.startsWith('"') ? 'invalid string' : 'invalid token';
      throw Error(`Malformed field ${known}: ${shape}`);
    }
    if (names.has(match[1])) throw Error('Duplicate protocol field');
    names.add(match[1]);
  }
  const m = JSON.parse(line) as Record<string, unknown>;
  const extra: Record<string, string[]> = { sync: ['pressed'], down: [], up: ['downSequence'], pong: ['nonce'], fault: [] };
  if (typeof m.type !== 'string' || !Object.hasOwn(extra, m.type)) throw Error('Unknown message');
  const expected = ['v', 'type', 'epoch', 'sequence', 'tick_ms', ...extra[m.type]];
  if (names.size !== expected.length || expected.some(k => !names.has(k)) || m.v !== 2
    || typeof m.epoch !== 'string' || !token.test(m.epoch) || !natural(m.sequence)
    || !natural(m.tick_ms) || m.tick_ms >= 2 ** 29
    || (m.type === 'sync' && typeof m.pressed !== 'boolean')
    || (m.type === 'up' && !natural(m.downSequence))
    || (m.type === 'pong' && (typeof m.nonce !== 'string' || !token.test(m.nonce) || m.nonce.length > 64))) {
    throw Error('Invalid protocol fields');
  }
  return m as Message;
}

export type SessionHooks = {
  now: () => number;
  nonce: () => string;
  send: (command: Command) => void;
  input: (message: InputMessage) => void;
  cancelled: (reason: string) => void;
  diagnostic?: (detail: string) => void;
};

/** No selections or speech effects. Cancellation is synchronous and irreversible.
 * Create a new session with a fresh unpredictable epoch after every interruption.
 */
export class SerialSession {
  private line = '';
  private sample: ClockSample | null = null;
  private challenge: { sent: number; nonce: string | null } | null = null;
  private previousTime: number;
  private sequence = 0;
  private phase: 'sync' | 'release' | 'armed' | 'held' = 'sync';
  private down: number | null = null;
  private downTick: number | null = null;
  private stopped = false;
  private started = false;
  readonly epoch: string;
  private hooks: SessionHooks;

  constructor(epoch: string, hooks: SessionHooks) {
    if (!token.test(epoch)) throw Error('Invalid epoch');
    this.epoch = epoch;
    this.hooks = hooks;
    this.previousTime = hooks.now();
  }
  get closed() { return this.stopped; }
  start() {
    if (this.started || this.stopped) return;
    this.started = true;
    const now = this.hooks.now();
    this.previousTime = now;
    this.challenge = { sent: now, nonce: null };
    this.hooks.send({ v: 2, type: 'sync', epoch: this.epoch });
  }
  cancel(reason: string) {
    if (this.stopped) return;
    this.stopped = true;
    this.line = '';
    this.down = null;
    this.downTick = null;
    this.sample = this.challenge = null;
    this.hooks.cancelled(reason);
  }
  private live(now: number) {
    if (!this.started || this.stopped) return false;
    if (!Number.isFinite(now) || now < this.previousTime || now - this.previousTime > 250
      || (this.challenge && now - this.challenge.sent > 100)
      || (this.sample && now - this.sample.received > 1000)) {
      this.cancel('Stale input or clock evidence');
      return false;
    }
    this.previousTime = now;
    return true;
  }
  // Called every 25 ms by the browser adapter and before processing each read.
  poll() {
    const now = this.hooks.now();
    if (!this.live(now)) return;
    if (this.sample && !this.challenge && now - this.sample.received >= 200) {
      const nonce = this.hooks.nonce();
      if (!token.test(nonce) || nonce.length > 64) return this.cancel('Invalid nonce');
      this.challenge = { sent: now, nonce };
      this.hooks.send({ v: 2, type: 'ping', epoch: this.epoch, nonce });
    }
  }
  receive(bytes: Uint8Array) {
    if (!this.live(this.hooks.now())) return;
    if (bytes.length > 8192) return this.cancel('Oversized read');
    try {
      // Validate the whole bounded read before emitting any event from it.
      const messages: Message[] = [];
      for (const byte of bytes) {
        if (byte === 10) {
          messages.push(parse(this.line));
          this.line = '';
          if (messages.length > 32) throw Error('Message flood');
        } else {
          if (byte < 32 || byte > 126 || this.line.length >= 511) throw Error('Invalid bounded framing');
          this.line += String.fromCharCode(byte);
        }
      }
      for (const message of messages) {
        if (this.stopped) break;
        this.accept(message, this.hooks.now());
      }
    } catch (error) { this.cancel(error instanceof Error ? error.message : 'Protocol error'); }
  }
  private accept(m: Message, now: number) {
    if (!this.live(now)) return;
    if (m.epoch !== this.epoch || m.type !== 'pong') {
      this.hooks.diagnostic?.(`RX ${m.type} · epoch ${m.epoch === this.epoch ? 'current' : 'retired'} · sequence ${m.sequence} · tick ${m.tick_ms} · phase ${this.phase}`);
    }
    if (m.epoch !== this.epoch) throw Error('Retired epoch received');
    if (m.type === 'fault') throw Error('Device reported fault');
    if (this.phase === 'sync') {
      if (m.type !== 'sync' || m.sequence !== 0 || !this.challenge || this.challenge.nonce !== null) throw Error('Expected fresh state');
      this.sample = clockSample(this.challenge.sent, now, m.tick_ms);
      this.challenge = null;
      this.phase = m.pressed ? 'release' : 'armed';
      this.hooks.input(m);
      return;
    }
    if (m.type === 'pong') {
      if (!this.challenge || m.nonce !== this.challenge.nonce || m.sequence !== this.sequence) throw Error('Unmatched heartbeat');
      // A second anchor must agree with the existing short-term clock evidence.
      const sample = clockSample(this.challenge.sent, now, m.tick_ms);
      if (!this.sample || !clockSamplesAgree(this.sample, sample)) throw Error('Clock discontinuity');
      this.sample = sample;
      this.challenge = null;
      return; // A heartbeat is never forwarded as input.
    }
    if (!this.sample || !eventIsFresh(m.tick_ms, now, this.sample)) throw Error('Stale or future event');
    if (m.sequence !== this.sequence + 1) throw Error('Nonconsecutive sequence');
    if (m.type === 'sync') {
      if (this.phase !== 'release' || m.pressed) throw Error('Unexpected state snapshot');
      this.phase = 'armed'; // Observed release arms only; it cannot complete a selection.
    } else if (m.type === 'down') {
      if (this.phase !== 'armed') throw Error('Unexpected DOWN');
      this.down = m.sequence;
      this.downTick = m.tick_ms;
      this.phase = 'held';
    } else {
      if (this.phase !== 'held' || m.downSequence !== this.down) throw Error('Unmatched UP');
      const elapsed = (m.tick_ms - this.downTick! + 2 ** 29) % (2 ** 29);
      if (elapsed >= 2 ** 28) throw Error('Reversed event timestamps');
      this.down = null;
      this.downTick = null;
      this.phase = 'armed';
    }
    this.sequence = m.sequence;
    this.hooks.input(m);
  }
}

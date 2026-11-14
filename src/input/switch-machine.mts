/** Pure input logic. These are application events, NOT a Pico wire protocol. */
export type View = Readonly<{ id: string; revision: number; targets: readonly string[] }>;
export type Capture = Readonly<{
  targetId: string; viewId: string; revision: number; epoch: string; downSequence: number;
}>;
export type Selection = Readonly<Capture & { upSequence: number; ordinal: number }>;
export type SwitchState = Readonly<{
  instanceId: string;
  generation: number;
  epoch: string;
  connected: boolean;
  active: boolean;
  view: View | null;
  index: number;
  phase: 'needs-sync' | 'armed' | 'held';
  pressed: boolean | null;
  lastSequence: number | null;
  capture: Capture | null;
  selections: number;
  reason: string | null;
}>;
export type Transition = Readonly<{ state: SwitchState; selection: Selection | null }>;

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const natural = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const identifier = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= 128;

function readView(value: unknown): View | null {
  if (!record(value) || !identifier(value.id) || !natural(value.revision)
    || !Array.isArray(value.targets) || !value.targets.length) return null;
  const targets = Array.from(value.targets);
  if (!targets.every(identifier) || new Set(targets).size !== targets.length) return null;
  return Object.freeze({ id: value.id, revision: value.revision, targets: Object.freeze(targets) });
}

function result(state: SwitchState, selection: Selection | null = null): Transition {
  return Object.freeze({ state: Object.freeze(state), selection: selection && Object.freeze(selection) });
}

/** Supply a fresh instance ID on every page load; never restore input state. */
export function createSwitchState(view: unknown, instanceId: string): SwitchState {
  if (!identifier(instanceId)) throw new Error('A fresh input-instance identifier is required');
  return result({
    instanceId, generation: 0, epoch: `${instanceId}:0`, connected: false, active: false,
    view: readView(view), index: 0, phase: 'needs-sync', pressed: null,
    lastSequence: null, capture: null, selections: 0, reason: 'disconnected',
  }).state;
}

function cancel(state: SwitchState, reason: string, changes: Partial<SwitchState> = {}): Transition {
  const generation = state.generation + 1;
  return result({ ...state, ...changes, generation, epoch: `${state.instanceId}:${generation}`,
    phase: 'needs-sync', pressed: null, lastSequence: null, capture: null, reason });
}

/**
 * Lifecycle events come only from the application. A future transport adapter
 * must establish fresh current-state synchronization for the returned epoch.
 * It must never relabel queued old messages with a new epoch or infer UP.
 */
export function reduceSwitch(state: SwitchState, event: unknown): Transition {
  if (!record(event)) return cancel(state, 'malformed-event');
  switch (event.type) {
    case 'connect':
      return cancel(state, 'synchronize', { connected: true });
    case 'disconnect':
      return cancel(state, 'disconnected', { connected: false });
    case 'activity':
      if (typeof event.active !== 'boolean') return cancel(state, 'malformed-event');
      return event.active === state.active ? result(state)
        : cancel(state, event.active ? 'synchronize' : 'focus-or-visibility-loss', { active: event.active });
    case 'view': {
      // Explicit navigation/revision changes invalidate the old capture first.
      // Passive AI arrivals must remain staged outside this input module.
      const view = readView(event.view);
      return cancel(state, view ? 'view-changed' : 'invalid-view', { view, index: 0 });
    }
    case 'fault':
      return cancel(state, 'input-fault');
    case 'tick':
      // A retired timer callback is inert; a held input never advances scan focus.
      if (event.epoch !== state.epoch || state.phase !== 'armed' || !state.view
        || !state.active || !state.connected) return result(state);
      return result({ ...state, index: (state.index + 1) % state.view.targets.length });
    case 'sync':
    case 'down':
    case 'up':
      break;
    default:
      return cancel(state, 'malformed-event');
  }

  if (typeof event.epoch !== 'string' || !natural(event.sequence)
    || (event.type === 'sync' && typeof event.pressed !== 'boolean')
    || (event.type === 'up' && !natural(event.downSequence))) return cancel(state, 'malformed-event');
  if (event.epoch !== state.epoch) return cancel(state, 'stale-epoch');
  if (!state.connected || !state.active || !state.view) return cancel(state, 'input-unavailable');

  if (event.type === 'sync') {
    // A snapshot is never a release or selection. Only a requested fresh snapshot
    // in needs-sync can establish an armed state; pressed snapshots stay blocked.
    if (state.phase !== 'needs-sync') return cancel(state, 'unexpected-sync');
    if (state.lastSequence !== null && event.sequence <= state.lastSequence) return cancel(state, 'stale-sequence');
    return result({ ...state, lastSequence: event.sequence, pressed: event.pressed as boolean,
      phase: event.pressed ? 'needs-sync' : 'armed', reason: event.pressed ? 'release-required' : null });
  }

  if (state.lastSequence === null || event.sequence !== state.lastSequence + 1) {
    return cancel(state, 'nonconsecutive-sequence');
  }
  if (event.type === 'down') {
    if (state.phase !== 'armed' || state.capture) return cancel(state, 'unexpected-down');
    const capture = Object.freeze({ targetId: state.view.targets[state.index], viewId: state.view.id,
      revision: state.view.revision, epoch: state.epoch, downSequence: event.sequence });
    return result({ ...state, phase: 'held', pressed: true, lastSequence: event.sequence, capture });
  }

  const capture = state.capture;
  if (state.phase !== 'held' || !capture || event.downSequence !== capture.downSequence
    || capture.epoch !== state.epoch || capture.viewId !== state.view.id
    || capture.revision !== state.view.revision || capture.targetId !== state.view.targets[state.index]) {
    return cancel(state, 'unmatched-up');
  }
  const selections = state.selections + 1;
  return result({ ...state, phase: 'armed', pressed: false, lastSequence: event.sequence,
    capture: null, selections, reason: null }, { ...capture, upSequence: event.sequence, ordinal: selections });
}

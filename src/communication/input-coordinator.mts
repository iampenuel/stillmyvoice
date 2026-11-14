import { createSwitchState, reduceSwitch, type SwitchState, type View, type Selection } from '../input/switch-machine.mts';
import { requestSerialAdapter, type DataPort, type SerialChooser, type AdapterCallbacks } from '../input/web-serial-adapter.mts';

type Connection = Awaited<ReturnType<typeof requestSerialAdapter>>;
type Factory = (chooser: SerialChooser, verify: (port: DataPort) => Promise<boolean>, callbacks: AdapterCallbacks) => Promise<Connection>;
/** App navigation coordinator. The accepted kernel, framing and transport are unchanged.
 * A new view closes the old verified port before reopening that SAME port, with a
 * fresh epoch/snapshot. Genuine interruptions never reopen automatically. */
export class InputCoordinator {
  state: SwitchState;
  mode: 'none' | 'hardware' | 'simulation' = 'none';
  status = 'Not connected';
  busy = false;
  private generation = 0;
  private connection: Connection | null = null;
  private flight: Promise<Connection> | null = null;
  private port: DataPort | null = null;
  private held = false;
  private view: View;
  private readonly changed: (state: SwitchState, status: string) => void;
  private readonly selected: (selection: Selection, source: 'hardware' | 'simulation') => void;
  private readonly interrupted: (reason: string) => void;
  private readonly factory: Factory;
  private readonly active: () => boolean;
  private readonly nonce: () => string;
  constructor(view: View, callbacks: {
    changed: (state: SwitchState, status: string) => void;
    selected: (selection: Selection, source: 'hardware' | 'simulation') => void;
    interrupted: (reason: string) => void;
  }, factory: Factory = requestSerialAdapter, active = () => document.hasFocus() && document.visibilityState === 'visible', nonce: () => string = () => crypto.randomUUID()) {
    this.view = view; this.changed = callbacks.changed; this.selected = callbacks.selected;
    this.interrupted = callbacks.interrupted; this.factory = factory; this.active = active; this.nonce = nonce;
    this.state = createSwitchState(view, nonce());
  }
  private publish() { this.changed(this.state, this.status); }
  private fresh(instance: string) {
    let state = createSwitchState(this.view, instance);
    state = reduceSwitch(state, { type: 'activity', active: true }).state;
    state = reduceSwitch(state, { type: 'connect' }).state;
    this.state = state; this.publish(); return state.epoch;
  }
  private dispatch(event: unknown) {
    const next = reduceSwitch(this.state, event); this.state = next.state; this.publish();
    if (next.selection && this.mode !== 'none') this.selected(next.selection, this.mode);
    return next;
  }
  private async retire() {
    const connection = this.connection, flight = this.flight;
    this.connection = null;
    connection?.stop('View retired');
    if (connection) await connection.closed;
    if (flight) {
      try { const pending = await flight; pending.stop('View retired'); await pending.closed; } catch { /* failed open already cleaned */ }
    }
  }
  stop(reason: string, notify = true) {
    this.generation++; this.mode = 'none'; this.busy = false; this.held = false;
    this.status = reason; this.dispatch({ type: 'disconnect' });
    void this.retire();
    if (notify) this.interrupted(reason);
  }
  async connect(chooser: SerialChooser, verify: (port: DataPort) => Promise<boolean>) {
    if (this.busy || this.mode === 'hardware') return;
    const generation = ++this.generation; this.busy = true; this.mode = 'none';
    this.status = 'Choose the verified CDC2 data port'; this.dispatch({ type: 'disconnect' });
    // Invoke the native chooser directly in the initiating gesture.
    const chosen = chooser.requestPort({ filters: [{ usbVendorId: 0x239a, usbProductId: 0x80f4 }] });
    try {
      const port = await chosen;
      if (generation !== this.generation || !await verify(port)) throw Error('Dedicated port not verified');
      await this.retire();
      if (generation !== this.generation) return;
      this.port = port; this.mode = 'hardware';
      await this.open(port, generation);
    } catch (error) {
      if (generation === this.generation) this.stop(error instanceof Error ? error.message : 'Connection failed');
    }
  }
  private async open(port: DataPort, generation: number) {
    if (generation !== this.generation) return;
    this.busy = true; this.status = 'Synchronizing — input blocked'; this.publish();
    const flight = this.factory({ requestPort: async () => port }, async candidate => candidate === port && generation === this.generation, {
      waitingForFocus: () => { if (generation === this.generation) { this.status = 'Waiting for page focus — input blocked'; this.publish(); } },
      epoch: instance => {
        if (generation !== this.generation || !this.active()) throw Error('Retired connection');
        return this.fresh(instance);
      },
      input: message => {
        if (generation !== this.generation) return;
        this.status = message.type === 'sync' && message.pressed ? 'Release switch to arm' : 'Connected — protocol v2 verified';
        const next = this.dispatch(message);
        if (next.state.epoch !== message.epoch) throw Error('Input kernel rejected message');
      },
      cancelled: reason => { if (generation === this.generation) this.stop(reason); },
    });
    this.flight = flight;
    try {
      const connection = await flight;
      if (generation !== this.generation) { connection.stop('Retired connection'); await connection.closed; return; }
      this.connection = connection; this.busy = false; this.publish();
    } catch (error) {
      if (generation === this.generation) this.stop(error instanceof Error ? error.message : 'Connection failed');
    } finally { if (this.flight === flight) this.flight = null; }
  }
  setView(view: View) {
    if (this.view.id === view.id && this.view.revision === view.revision && this.view.targets.join('\0') === view.targets.join('\0')) return;
    this.view = view;
    const mode = this.mode, generation = ++this.generation;
    this.dispatch({ type: 'view', view });
    if (mode === 'simulation') {
      if (!this.active()) return this.stop('Page inactive');
      this.fresh(this.nonce());
      this.dispatch({ type: 'sync', epoch: this.state.epoch, sequence: 0, pressed: this.held });
    } else if (mode === 'hardware' && this.port) {
      const port = this.port; this.status = 'Changing view — input blocked'; this.busy = true; this.publish();
      void this.retire().then(() => {
        if (generation !== this.generation) return;
        if (!this.active()) { this.stop('Page inactive during navigation'); return; }
        void this.open(port, generation);
      });
    }
  }
  simulate() {
    if (this.mode === 'hardware' || this.busy || !this.active()) return;
    this.generation++; this.mode = 'simulation'; this.held = false; this.status = 'Simulation — not physical input';
    this.fresh(this.nonce()); this.dispatch({ type: 'sync', epoch: this.state.epoch, sequence: 0, pressed: false });
  }
  down() {
    if (this.mode !== 'simulation' || this.held || this.state.phase !== 'armed' || !this.active()) return;
    this.held = true; this.dispatch({ type: 'down', epoch: this.state.epoch, sequence: this.state.lastSequence! + 1 });
  }
  up() {
    if (this.mode !== 'simulation' || !this.held || !this.active()) return;
    this.held = false;
    if (this.state.phase === 'needs-sync') this.dispatch({ type: 'sync', epoch: this.state.epoch, sequence: (this.state.lastSequence ?? -1) + 1, pressed: false });
    else if (this.state.capture) this.dispatch({ type: 'up', epoch: this.state.epoch, sequence: this.state.lastSequence! + 1, downSequence: this.state.capture.downSequence });
  }
  tick() { if (this.active()) this.dispatch({ type: 'tick', epoch: this.state.epoch }); else this.stop('Page inactive'); }
}

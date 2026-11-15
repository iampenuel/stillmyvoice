import { createSwitchState, reduceSwitch, type SwitchState, type View, type Selection } from '../input/switch-machine.mts';
import { requestSerialAdapter, type DataPort, type SerialChooser, type AdapterCallbacks } from '../input/web-serial-adapter.mts';

export type GazeNomination = Readonly<{ targetId:string;viewId:string;revision:number;validUntilMs:number }>;
export type GazeInput = Readonly<{ enabled:boolean;candidate:GazeNomination|null }>;
type Connection = Awaited<ReturnType<typeof requestSerialAdapter>>;
type Factory = (chooser: SerialChooser, verify: (port: DataPort) => Promise<boolean>, callbacks: AdapterCallbacks) => Promise<Connection>;
/** App navigation coordinator. The accepted kernel, framing and transport are unchanged.
 * A new view closes the old verified port before reopening that SAME port, with a
 * fresh epoch/snapshot. Temporary inactivity permits one foreground recovery;
 * transport faults, explicit disconnect and page teardown do not. */
export class InputCoordinator {
  state: SwitchState;
  mode: 'none' | 'hardware' | 'simulation' = 'none';
  status = 'Not connected';
  busy = false;
  private generation = 0;
  private connection: Connection | null = null;
  private flight: Promise<Connection> | null = null;
  private closing: Promise<void> = Promise.resolve();
  private port: DataPort | null = null;
  private focusRecoveryPort: DataPort | null = null;
  private held = false;
  private heldGazeUntil:number|null=null;
  private view: View;
  private readonly changed: (state: SwitchState, status: string) => void;
  private readonly selected: (selection: Selection, source: 'hardware' | 'simulation') => void;
  private readonly interrupted: (reason: string) => void;
  private readonly factory: Factory;
  private readonly active: () => boolean;
  private readonly nonce: () => string;
  private readonly disconnectedSettle: () => Promise<void>;
  private readonly diagnostic: (detail: string) => void;
  private readonly gaze: () => GazeInput;
  private readonly now: () => number;
  private readonly targetVisible: (id: string) => boolean;
  constructor(view: View, callbacks: {
    changed: (state: SwitchState, status: string) => void;
    selected: (selection: Selection, source: 'hardware' | 'simulation') => void;
    interrupted: (reason: string) => void;
    diagnostic?: (detail: string) => void;
    gaze?: () => GazeInput;
    now?: () => number;
    targetVisible?: (id: string) => boolean;
  }, factory: Factory = requestSerialAdapter, active = () => document.hasFocus() && document.visibilityState === 'visible', nonce: () => string = () => crypto.randomUUID(),
  disconnectedSettle: () => Promise<void> = () => new Promise(resolve => setTimeout(resolve, 200))) {
    this.view = view; this.changed = callbacks.changed; this.selected = callbacks.selected;
    this.interrupted = callbacks.interrupted; this.factory = factory; this.active = active; this.nonce = nonce;
    this.disconnectedSettle = disconnectedSettle;
    this.diagnostic = callbacks.diagnostic ?? (() => {});
    this.gaze = callbacks.gaze ?? (() => ({enabled:false,candidate:null}));
    this.now = callbacks.now ?? (() => performance.now());
    this.targetVisible = callbacks.targetVisible ?? (() => true);
    this.state = createSwitchState(view, nonce());
  }
  private publish() { this.changed(this.state, this.status); }
  private fresh(instance: string) {
    let state = createSwitchState(this.view, instance);
    state = reduceSwitch(state, { type: 'activity', active: true }).state;
    state = reduceSwitch(state, { type: 'connect' }).state;
    this.state = state; this.publish(); return state.epoch;
  }
  private validGaze(input:GazeInput):GazeNomination|null {
    const c=input.candidate, now=this.now();
    return c && Number.isFinite(now) && Number.isFinite(c.validUntilMs) && c.validUntilMs>=now && c.validUntilMs-now<=350
      && c.viewId===this.view.id && c.revision===this.view.revision && this.view.targets.includes(c.targetId) ? c : null;
  }
  /** Gaze moves focus through kernel ticks only. It never manufactures physical edges. */
  nominate() {
    const gaze=this.gaze(); if(!gaze.enabled || this.mode!=='hardware')return;
    const candidate=this.validGaze(gaze);
    if(this.state.phase==='held') {
      if(!candidate || candidate.targetId!==this.state.capture?.targetId || !this.targetVisible(candidate.targetId) || (this.heldGazeUntil!==null && candidate.validUntilMs-this.heldGazeUntil>350)) this.stop('Gaze target changed during press — selection canceled');
      else this.heldGazeUntil=candidate.validUntilMs;
      return;
    }
    if(!this.active() || this.state.phase!=='armed' || !candidate)return;
    const before=this.state.index;
    for(let steps=0;steps<this.view.targets.length && this.state.view?.targets[this.state.index]!==candidate.targetId;steps++) {
      this.state=reduceSwitch(this.state,{type:'tick',epoch:this.state.epoch}).state;
    }
    if(before!==this.state.index)this.publish();
  }
  private dispatch(event: unknown): ReturnType<typeof reduceSwitch> {
    if(event && typeof event==='object' && 'type' in event && (event.type==='down' || event.type==='up')) {
      const gaze=this.gaze();
      if(!gaze.enabled && this.heldGazeUntil!==null){this.stop('Input mode changed during press');return {state:this.state,selection:null};}
      if(gaze.enabled) {
        const candidate=this.validGaze(gaze), target=this.state.capture?.targetId ?? this.state.view?.targets[this.state.index];
        if(this.mode!=='hardware' || !candidate || candidate.targetId!==target || (this.heldGazeUntil!==null && candidate.validUntilMs-this.heldGazeUntil>350)) {
          this.stop('No matching fresh gaze target — selection canceled'); return {state:this.state,selection:null};
        }
        this.heldGazeUntil=candidate.validUntilMs;
      }
    }
    if (event && typeof event === 'object' && 'type' in event && (event.type === 'down' || event.type === 'up')
      && !this.targetVisible(this.state.view?.targets[this.state.index] ?? '')) {
      this.stop('Current choice is not fully visible'); return { state: this.state, selection: null };
    }
    const next = reduceSwitch(this.state, event); this.state = next.state; if(this.state.phase!=='held')this.heldGazeUntil=null; this.publish();
    if (next.selection && this.mode !== 'none') this.selected(next.selection, this.mode);
    return next;
  }
  private async retire() {
    const connection = this.connection, flight = this.flight;
    this.connection = null;
    connection?.stop('View retired');
    // Retiring a handle does not mean its driver cleanup has completed. Every
    // subsequent view must share this barrier, including updates while no handle
    // is published (e.g. Review presentation enabling Speak during port.close).
    const previous = this.closing;
    this.closing = (async () => {
      await previous;
      if (connection) await connection.closed;
      if (flight) {
        try { const pending = await flight; pending.stop('View retired'); await pending.closed; } catch { /* failed open already cleaned */ }
      }
      // The firmware clears retired queues when it observes DTR low. Port.close
      // returning is a host-driver event, not evidence that its loop saw that edge.
      // Keep DTR low between views; never drain, relabel or accept retired frames.
      if (connection || flight) await this.disconnectedSettle();
    })();
    await this.closing;
  }
  stop(reason: string, notify = true) {
    this.focusRecoveryPort = null;
    this.generation++; this.mode = 'none'; this.busy = false; this.held = false;
    this.status = reason; this.dispatch({ type: 'disconnect' });
    this.diagnostic(`Cancelled · ${reason}`);
    void this.retire();
    if (notify) this.interrupted(reason);
  }
  /** Temporary inactivity retires authority, not authored communication. The
   * verified port object may be reused only for one fresh foreground handshake. */
  suspend(reason: string) {
    if (this.focusRecoveryPort && this.mode === 'none' && !this.busy) return;
    const port = this.mode === 'hardware' ? this.port : this.focusRecoveryPort;
    this.stop(reason);
    this.focusRecoveryPort = port;
  }
  async foreground() {
    const port = this.focusRecoveryPort;
    if (!port || !this.active() || this.busy || this.mode !== 'none') return;
    this.focusRecoveryPort = null; // One attempt. A transport fault never loops.
    const generation = ++this.generation;
    this.mode = 'hardware'; this.busy = true;
    this.status = 'Restoring switch — input blocked'; this.publish();
    await this.retire();
    if (generation !== this.generation) return;
    if (!this.active()) { this.suspend('Page inactive during recovery'); return; }
    await this.open(port, generation);
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
    const context = `connection ${generation} · ${this.view.id}:${this.view.revision}`;
    this.diagnostic(`Opening ${context}`);
    const flight = this.factory({ requestPort: async () => port }, async candidate => candidate === port && generation === this.generation, {
      waitingForFocus: () => { if (generation === this.generation) { this.status = 'Waiting for page focus — input blocked'; this.publish(); } },
      diagnostic: detail => this.diagnostic(`${context} · ${detail}`),
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
      cancelled: reason => {
        if (generation !== this.generation) return;
        if (/^(Focus lost|Visibility lost|Inactive)/.test(reason)) this.suspend(reason);
        else this.stop(reason);
      },
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
    this.diagnostic(`View ${view.id}:${view.revision} · targets ${view.targets.length}`);
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
        if (!this.active()) { this.suspend('Page inactive during navigation'); return; }
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
  tick() { if(this.gaze().enabled){this.nominate();return;} if (this.active()) this.dispatch({ type: 'tick', epoch: this.state.epoch }); else this.suspend('Page inactive'); }
}

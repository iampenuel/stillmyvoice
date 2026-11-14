# SW-02A — communication recovery checkpoint

Status: **PARTIAL**, November 14, 2026. Recovery precedes UI refinement and subsequent gated milestones.

## Evidence and investigation

**Owner-confirmed:** exactly “Please reposition me.” was audible once, only after a NEW physical press/release on Speak; Review entry remained silent. Browser lifecycle evidence showed two completed playbacks, followed by an interruption after a later edit and fresh approval, before that attempted audio. The historical reason “Retired epoch or device fault” did not distinguish a stale frame from a firmware fault. The owner later refreshed deliberately; that was not a connection error. The original fault's cause remains unproven.

The earlier Review failure (“Serial setup failed”) was independently reproduced as two rapid view updates reopening the port before cleanup completed. Commit d01ce3a serialized cleanup. The new safeguard keeps the closed port disconnected for 200 ms before a new session, giving the unchanged firmware loop time to observe DTR low and clear buffers. This mitigates a possible queue-retirement race; it is not physical proof of the historical cause. Rapid view changes share the close/settling barrier; genuine focus loss cancels deferred reopening.

Host diagnostics now distinguish “Retired epoch received” from “Device reported fault” and retain bounded in-memory connection/view revisions, validated frame types, sequence/timestamp metadata and lifecycle events. No draft or raw unvalidated input is logged. Failures still cancel input and speech immediately. The primary UI points an unarmed user to companion setup without claiming switch-only recovery before synchronization.

Multiple SMV tabs existed earlier. Only one was open at this checkpoint; no competing serial session was observed, with one frontend and one API process. This does not establish or exclude historical contention. Fresh diagnostics are needed if the fault recurs; do not refresh a failed repeat before inspection.

During the fresh browser connection check, the first attempt rejected a malformed field before any physical action. After cleanup, a second explicit connection received a valid current-epoch synchronization snapshot, sequence 0, released, and displayed Ready to resume. No restart or board write was needed. The earlier malformed frame was not retained; its contents and relationship to the historical fault are unknown. Future malformed diagnostics identify the field and value shape without logging raw content. This successful synchronization is observed transport evidence, not an edited-message physical pass.

## Implementation and safety

Phrase categories, grouped spelling, occurrence-specific correction, staged deletion, Undo, intentional clear, Pause/Resume, complete review paging, immutable separate authorization, browser voices/preview/rate and stationary Stop exist. Drafts and approvals stay in tab memory. Reducer, freshness calculations, wire format and firmware remain unchanged. Protocol/adapter edits add diagnostics and separate fatal reasons without relaxing validation.

The coordinator retires each view and reopens the same independently verified port after cleanup/settling, with a fresh unpredictable epoch and snapshot. Genuine interruptions require explicit reconnection. No buffered input is relabeled, no release fabricated, and holds do not repeat.

The model cannot play audio. Speak freezes exact text/revision/voice/rate/provider into a one-use authorization. The physical route waits for the new Stop view to be synchronized and released before audio. Stop, focus loss, transport errors and edits revoke approval. Late callbacks cannot replay speech. Entire review pages must be presented before Speak is enabled; presentation is not proof of reading.

## Executed verification

- 72 Node tests passed, including synthetic provider/API/environment/SDK tests with no external provider calls.
- Expanded navigation regression: phrase → review → fresh approval → playback-end event → occurrence-specific negation edit → review → a different fresh authorization. Exact edited text is preserved; stale playback callbacks cannot authorize it.
- Cleanup, pressed reconnect, focus cancellation, strict epochs, timestamp wrap, malformed frames, matching edges and one-use speech regressions pass. TypeScript and production build pass.
- Owner-confirmed basic-path audibility is distinct from observed browser start/end events.
- Live approved v2/boot hashes matched; OS ancestry still identifies CDC2 data interface 3. No competing serial session was observed. No firmware, boot or wiring changes.

## Physical repeat — pending

Keep the intended SMV tab focused. Do not refresh on failure; logs are in-memory.

1. With the switch released, open Companion setup, check the verified dedicated-port box and Connect Pico using the independently verified CDC2 port. Confirm Released / Scanning. Use a fresh Resume cycle if shown.
2. Using the switch: Phrases → Comfort → “Please reposition me.” → Review. Review stays silent. A NEW cycle on Speak exactly this must produce that exact sentence once.
3. After playback: Edit wording → select “reposition”. Enter exactly “do not reposition” in the correction keyboard, using Space and editing for spaces. Navigation → Apply correction. The message must read exactly “Please do not reposition me.” This replaces only that word.
4. Review stays silent again. A NEW Speak cycle must produce the exact edited sentence once, with no transport fault. Stop immediately on unintended selection/audio and report the visible recovery message.
5. Separate follow-ups test Stop during a longer approved utterance, genuine focus loss and held disconnect/reconnect. Returning to chat intentionally loses focus; reconnect explicitly before the next test. Nothing may replay automatically.

Full acceptance also needs long-message paging, Undo, deletion, voice preview, large text/narrow/200%-zoom checks and the broader operator checklist. Permission setup may require companion assistance. Offline audio and accessibility/clinical outcomes are not validated. Provider keys are private but account protections remain unconfirmed; live requests stay disabled. UI stabilization and optional gaze follow recovery.

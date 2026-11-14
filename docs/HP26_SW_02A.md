# SW-02A communication workspace — implementation checkpoint

Status: **PARTIAL**, November 14, 2026. The master implementation directive authorizes SW-02A and the subsequent ordered milestones. This supersedes the historical SW-00/SW-01 stop gates, while preserving the accepted hardware and input boundaries.

Latest physical browser observation: four hardware selections traversed Compose → category → phrase → Review and retained `Please reposition me.`. Entering Review stopped with **Serial setup failed**, before speech. This run does not pass the communication acceptance gate. A deterministic regression reproduced two rapid view updates reopening the port while the previous close was still pending. A shared cleanup promise now serializes retirement; the regression passes. The accepted input/firmware files are unchanged. Repeat physical navigation and actual audible speech remain necessary.

Implemented: phrase categories; grouped alphabet, numbers and punctuation; character editing; occurrence-specific correction; staged deletion; Undo; intentional clear; Pause/Resume; exact full-message paging; separate frozen speech authorization; browser voice discovery, selection, rate, fixed-sample preview and stationary Stop. Drafts and approvals exist only in tab memory. Branding follows [the owner update](BRANDING.md).

The accepted four input modules and firmware sources remain unchanged. `communication/input-coordinator.mts` owns application navigation: it retires the previous view, awaits serial cleanup, and reopens the same independently verified port with a new unpredictable epoch and fresh state snapshot. It never uses port order, relabels buffered input, fabricates a physical release, or reconnects automatically after a genuine interruption. This adds a synchronization delay to each screen transition. Its usability and physical reliability need testing in this workspace, separately from the accepted diagnostic.

The communication model never plays audio. A valid action on Speak creates a unique immutable authorization with exact text, draft revision, voice, rate and provider. Browser speech consumes that authorization once. Stop, focus/visibility/input loss and errors retire it; late callbacks cannot affect a newer request. Speech starts only when the new stationary Stop view has synchronized and is released, or following an explicit companion approval with physical input disconnected. A voice engine's completion event does not prove audibility or comprehension.

Review pages preserve the exact concatenated message. Pages are measured against the actual reading column and viewport. A page becomes reviewed only when its complete text is visibly rendered; changing pagination retires that gate. This records presentation, not that the person read or understood the words. Target changes always retire the old input context.

## Executed verification

- All 48 communication/input tests passed after the close-race and layout-recovery regressions. An additional 17 isolated provider/API/official-SDK tests passed (65 total); all external provider responses in those tests are synthetic. The loopback HTTP test required the execution permission for local port binding.
- TypeScript checking and the production build passed after the viewport/pagination refinements.
- Chrome companion controls: phrase selection → Review preserved `Please reposition me.`; status stayed Not spoken/Awaiting approval until a separate Speak action. The browser then reported Speaking and Playback finished. Actual audibility has **not** been confirmed by the owner.
- Chrome initially exposed a visualViewport scrollbar feedback pause; the guard now compares actual window dimensions and zoom scale. Subsequent phrase/review navigation passed.
- Live Pico hashes match accepted v2/boot hashes, OS ancestry still maps CDC2 interface 3 to the previously verified data path, and no competing serial session was observed before connection setup. No board file was written.

## Pending owner checks and limits

The first physical communication route has been requested: Phrases → Comfort → Please reposition me. → Review → a fresh Speak cycle, with audible exact wording confirmation. Then test spelling, correction, Undo, long-message paging, Stop during a longer utterance, input loss while preparing/speaking, held reconnect and fresh approval after recovery. No new workspace physical pass is claimed yet.

UI polish and narrow/200%-text checks remain in progress. Single-switch operation requires browser permission setup assistance. Voice availability varies; offline playback has not been tested. The prototype has no clinical or accessibility-conformance validation. Cloud providers are not connected at this checkpoint; no provider credits have been consumed. There is no AI, microphone, gaze, automatic speech or production deployment.

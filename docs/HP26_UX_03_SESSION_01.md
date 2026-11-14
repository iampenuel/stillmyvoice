# UX-03 / SESSION-01 — workspace and safe continuity

November 14, 2026. Implemented checkpoint; **owner visual review and new physical lifecycle acceptance remain pending**. No firmware, wiring, accepted input reducer, wire protocol, freshness thresholds, cloud permissions or deployment changes.

## Evidence and diagnosis

The owner reports successful physical navigation, silent review, deliberate speech confirmation, editing a prior message and audible corrected wording. This is positive evidence for that exercised communication flow before this UI checkpoint. It does not establish every interruption or usability scenario. The older combined retired-epoch/device-fault message remains historically ambiguous; the targeted cleanup regression and distinct diagnostics are retained.

The focus behavior was principally **expected safety pause with unnecessarily manual recovery**. Previously `App` called `InputCoordinator.stop()` on window blur and hidden visibility; that retired input, closed the serial reader/writer/port and canceled audio. `interrupt()` preserved draft, correction buffer, history and navigation in the live tab. No temporary-focus draft-loss defect or Vite crash was established. Full reload intentionally clears private in-memory state.

The accepted protocol has frequent heartbeat/freshness checks and treats stalled readers as unsafe. Keeping an armed reader running in a throttled background page is not a supported pause mechanism. This checkpoint retains connection teardown on inactivity, then permits one foreground reopening of the **same already verified port**, after cleanup and the existing DTR-low settling interval. There is no new port inference or automatic permission grant. A new random epoch and device snapshot are mandatory. A held snapshot requires release; that release only arms. A separate fresh Resume cycle restores navigation. Port/protocol errors, explicit disconnect and page teardown never initiate automatic retry.

Source boundaries: `App.tsx` owns window blur/focus, visibility, pagehide, resize, a 25 ms activity fallback, speech cancellation and scan timer cleanup. `input-coordinator.mts` owns serialized retirement, foreground retry and view generations. The existing adapter continues to enforce its bounded permission-picker focus wait and post-open focus/freshness rules. The pre-open chooser is exempt from the App blur shortcut; input remains blocked until active synchronization.

One additional defect was found by code inspection: React development refresh can retain an old speech authorization while replacing its one-use engine. Initialization now retires retained authorization before creating controllers. A focused regression verifies preservation of wording and rejection of late playback callbacks. Actual HMR during playback is not yet physically accepted. Development refresh may reset state when hook structure changes; it is not promised as private draft persistence.

## Visible and interaction changes

- Matching white panels with aligned top/bottom, restrained borders and typography. The left message remains wider and prominent. Desktop uses a bounded grid; each panel handles its own overflow.
- Scan targets are revealed inside the right panel only at ordinary desktop dimensions. Responsive/narrow/large-text layouts reflow with natural page scrolling. Hidden or obscured targets cannot start or complete selection. Scrolling does not change captured target identity.
- Companion diagnostics moved into a secondary setup dialog that stops input/audio before opening. The dialog closes before the serial picker. Ordinary foreground recovery does not require this dialog when the saved port can reopen safely.
- Six useful phrases are available immediately after Phrases. Categories remain available. Stable letter groups retain their locations; Done/Apply, Space and Backspace are directly available on the group screen.
- An explicit correction shortcut stages “do not ” before the selected occurrence. It does not change the draft until Apply correction, and it never authorizes speech. General spelling, correction, rejection and Undo remain available.
- Primary copy distinguishes communication pause, release-to-arm, ready-to-resume and a disconnected/faulted switch. Detailed transport reasons stay in Companion diagnostics. No unarmed control is described as physically operable.

Already-playing local audio, approved-but-not-started audio and queued callbacks all lose authority on genuine inactivity, as before. Returning never replays them. A new complete review and separate approval are required. Pending premium audio has isolated cancellation tests; cloud requests and premium UI use remain disabled.

## Executed verification

- **84 Node tests passed** in the working tree: **65 core/input/communication/UI/lifecycle tests** plus 19 isolated provider/API/SDK fixtures under ongoing provider work. No live provider requests. TypeScript checking, production build and secret scan passed.
- Lifecycle fixtures cover compose/review/unfinished correction preservation, held interruption, release while away, duplicate return notifications, released/pressed fresh synchronization, explicit disconnect/fault behavior, unavailable port without retry loops, stale input/callback rejection, speech authorization retirement and fresh full-page initialization.
- Existing adapter/freshness tests retain malformed input, epoch, matching edges, timestamp wrap, liveness, permission-picker focus and cleanup coverage. Provider fixtures reject late canceled audio before player/URL creation and stop current playback. These are simulations, not actual multi-tab ownership or acoustic tests.
- Actual Chrome UI: phrase → silent Review → staged exact correction → Apply → silent Review; two-part review reconstructed the exact draft and kept Speak disabled until both pages were presented. Companion-triggered local playback started; Stop canceled it and retained the draft. This is engine/UI evidence, not a new owner audibility pass.
- Actual layout measurements: 1440×756 desktop panels both top 151.75, bottom 680, height 528.25; document scroll remained zero. 1280×720 panels also aligned. At 390×844, one-column reflow allowed vertical scrolling without horizontal page overflow. Actual Chrome 200% zoom reflow and reachable review controls were inspected. A native screenshot was used because the browser full-page screenshot was cropped by the capture tool.
- Automatic simulated scan advanced into overflow: the right panel offset changed while document scroll stayed zero. The rendered active target was fully visible. No synthetic input was labeled physical.
- A real Pico connection received protocol-v2 synchronization, released, with Resume as its sole target and **zero physical selections**. Approved live code.py and boot.py hashes matched; no competing serial monitor was found before connection. No board file was written.
- Browser console warning/error collection returned empty. The running local frontend served the current implementation. No server restart or crash was established.

Automation limitation: attempted native address-bar, app and tab switching did not produce an observable focus/visibility transition in the controlled page. The page continued reporting focused/visible. Those attempts are **inconclusive**, not lifecycle passes; no unsafe exception was added. Minimization, real held foreground recovery, disconnect while backgrounded, competing-tab port ownership and HMR during playback need owner/browser follow-up outside the active automation session.

## Reproducible communication baseline

Deterministic model traversal, baseline `d5b5006`, fictional phrases only. Counts include the specified route and final approval; they exclude setup, missed targets, reading, serial delays and recovery. Advances assume each new view starts at its configured initial target. **No elapsed task times were measured.**

| Task | Deliberate selections before → after | Scan advances before → after |
| --- | ---: | ---: |
| Select, review and approve “Please reposition me.” | 5 → 4 | 1 → 2 |
| After playback, edit to “Please do not reposition me.”, review and approve | 40 → 6 | 98 → 7 |
| Spell `help` and return to draft | 11 → 10 | 21 → 23 |
| Replace `left` with `right`, review and approve | 16 → 15 | 28 → 31 |
| Review and approve an already edited message | 2 → 2 | 2 → 2 |

The large reduction is specific to the explicit negation shortcut. General spelling saves one navigation selection but adds some scan waiting in these routes; no general speed or clinical improvement is claimed. Private earlier browser logs showed 513 ms and 479 ms from accepted review action to engine start on two completed playbacks; these are not acoustic latency or isolated composition timings. The owner's elapsed physical task timings were not measured.

Reproduce with Node 24:

```sh
mkdir -p local-reports
git show d5b5006:src/communication/model.mts > local-reports/UX03_BASELINE_MODEL.mts
node scripts/measure-communication.mts
```

## Visual evidence and remaining limits

Private ignored screenshots: before `local-reports/SW02A_RECOVERY_READY.jpg`; after `UX03_REVIEW_DESKTOP.jpg`, `UX03_SCAN_DESKTOP.jpg`, `UX03_LAPTOP.jpg`, `UX03_NARROW.jpg`, `UX03_ZOOM_200_NATIVE.png`. These use fictional text. Build success is not visual acceptance. Owner review is still required.

No accessibility-conformance claim: screen-reader workflow, all browser/OS text settings, physical operation at zoom, every long-word/large-target combination, offline voice availability and prolonged use remain unvalidated. Narrow layouts necessarily scroll. Focus/resize interruptions still require safe rearming. Browser permission or unavailable-port recovery may need a companion. Full reload clears the private draft; no persistent storage was added.

## Owner repeat

Stop on any unintended selection or speech; leave the tab unrefreshed for diagnostics.

1. Use the single SMV Chrome tab. With the switch released: Companion setup → verified-port checkbox → Connect Pico → independently verified CDC2 port. Close setup if necessary. Expect Released / Ready to resume; one fresh cycle selects Resume.
2. Starting from an empty draft, Phrases → “Please reposition me.”. If the fictional message is already present, do not append it again. Switch to Codex or Finder without Pause or refresh; return by selecting Chrome's tab/window chrome. Wording must remain exact, audio silent, and no communication choice should have completed.
3. Expect fresh synchronization and Ready to resume. Use one NEW complete cycle for Resume, then Review. Review remains silent. A NEW Speak cycle must produce exactly “Please reposition me.” once.
4. Repeat an interruption while holding the physical switch: keep holding while leaving and returning. Expect release-to-arm, no action/audio. Release once: no selection. Then a NEW Resume cycle; later speech requires a separate NEW Speak cycle.
5. Repeat with another Chrome tab. Separately test an unplug while backgrounded and full reload while held. USB loss must require explicit reconnection; reload intentionally clears draft/count/approval. A held reconnect release must never select.
6. Check visual balance and target visibility. For the new correction route: Edit wording → `reposition` → Add “do not ” before this word → Apply correction → Review → fresh Speak. Only Apply changes the draft; only Speak authorizes the exact edited sentence.

Record actual counts, wording, observed audio and any failure. These instructions are not a claim that the repeat has passed.

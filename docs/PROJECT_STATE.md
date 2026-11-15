# Project state — visible keyboard and precise quota diagnostics

Latest owner steering: Google AI **Plus**, not Pro; no developer-credit or paid-tier entitlement is inferred. The existing Gemini key and verified free-tier gates remain unchanged. Approved public main now points to **c1da080aa789c4c3ba113c853b88d3a3940a76be**, with its original history. The subsequent quota/keyboard correction is a local checkpoint pending publication approval. No deployment, DNS change or Devpost submission occurred.

The previous generic “Quota reached” notice conflated local cooldown/busy/cap responses with provider quota errors. Its historical exact cause was not retained. The same pre-fix API process had used 2/20 requests; a controlled fictional expansion succeeded (HTTP 200, 842 ms), taking it to 3. A controlled restart preserved those three consumed requests. A new browser expansion returned “I am not ready.” while preserving “not ready” until explicit candidate selection; diagnostics show one attempt, one provider call, zero duplicates and zero provider 429s (total 4/20). New errors distinguish application cooldown, in-flight work, duplicate ID, local allowance and actual Gemini quota. No automatic retry or limit increase was added. [Evidence and exact sanitized error vocabulary](QUOTA_DIAGNOSTICS.md).

All 26 keys now have stable individual outlines, with the same row-then-letter selection contract and target order. The normal spelling footer fits at 1440×756 and 1024×672 without internal or page scrolling; narrow layouts and actual Chrome 200% zoom reflow with vertical page scrolling and no horizontal overflow. 148 automated tests, typecheck and production build pass; a 98-file source/bundle scan found zero credential matches. The preceding 18b92a6 LaSean/intent owner report remains accepted for its exercised flow; the latest response supplied new steering, **not** a new keyboard/microphone/combined physical pass. Gaze remains deferred. Prior checkpoint paragraphs below are historical and superseded where they conflict with this update.

ACCESS-02 update: owner reports the complete 18b92a6 LaSean/intent physical repeat worked. All-letter row-column display with grouped fallback and optional bounded Listening/Scribe transcript review are implemented. 140 tests, typecheck and build pass; live Scribe generated-audio and Gemini transcript-plus-keyword checks succeeded. Actual microphone/combined physical acceptance is pending. See [current ACCESS-02 evidence and script](HP26_ACCESS_02.md). The original accepted input reducer and firmware remain unchanged; gaze is deferred.

Current INTENT-01 work supersedes the historical status paragraphs below. The owner confirmed hearing the exact “Please reposition me.” phrase once after the 96e483b physical repeat; Cecily preview/approved speech are owner-reported passes for that flow. LaSean's Flash v2.5 tuning is explicitly failed, while Flash v2 is fine-tuned. A server-only per-voice Flash v2 assignment preserves its identity; one 27-character live preview returned 22,195 audio bytes in 433 ms, without claiming human audibility. Other five voices retain Flash v2.5. Context and conservative keyword expansion passed live/provider and browser checks; 122 tests/typecheck/build pass after the bounded keyboard fit follow-up. Owner physical intent/LaSean acceptance is pending; see [INTENT-01 evidence](HP26_INTENT_01.md).

HP26-SMV-UX-VOICE-01 update: the owner reports hearing Cecily and successfully selecting the voice, while identifying the hidden Preview action. This confirms that exercised audible voice result, not completion of the remaining exact-phrase/Stop/Gemini acceptance script. A compact staged voice-detail state now offers Preview first, Use this voice, and Back to voices. Only Use changes the saved voice; preview never speaks the draft. Existing input/firmware remain unchanged. [Evidence and repeat script](HP26_UX_VOICE_01.md).

The owner explicitly approved public publication of checkpoint 9983260. It is now verified at https://github.com/iampenuel/stillmyvoice on public main with its original history. The owner reports being registered/checked in, the sole team member, and that 100% of their code was written during the event; this is owner-reported provenance, not an independent originality audit. The voice-detail follow-up remains a local checkpoint pending review.

Current checkpoint update: live ElevenLabs and direct Gemini are now integrated after dashboard account checks. Six exact approved voices are configured; five pass Flash v2.5 metadata checks and LaSean is visibly unavailable because its tuning reports failed. Cecily browser preview and one approved phrase completed; Gemini contextual and negation-preserving spelling calls succeeded. A controlled API outage preserved the draft and required separate system-speech approval. These are developer/browser observations, **not owner physical or audible cloud acceptance**. See [provider evidence, limits and verified IDs](PROVIDER_SETUP.md).

Executed: 93 Node tests, typecheck, production build and source/bundle secret scan passed. Accepted input reducer and firmware are unchanged. Compact recovery/status polish is checkpoint c1a7bc7. The development configuration reload cleared the previous tab draft; normal focus preservation remains distinct from reload. Optional Scribe and gaze are deferred until mandatory acceptance and release readiness. No deployment, DNS change, remote publication or submission has occurred.

The following paragraphs retain earlier checkpoint history; their disabled-provider and pending-implementation statements are superseded by this update.

Current authority: the final consolidated engineering directive, plus master, UX-03 and SESSION-01 November 14 directives. Source remains in the verified external repository. No firmware/wiring, DNS, deployment or public submission changes in this checkpoint. Provider calls remain disabled pending account protections.

**New owner report:** the complete c0d4d27 released-switch focus-return scenario worked as instructed: draft preserved, no unintended action/audio, automatic fresh synchronization without manual reconnect, fresh Resume and separate fresh Speak produced the exact phrase once. This does not extend to the separate held/background USB/reload scenarios. The consolidated directive approves the two-panel design as a strong foundation, with surgical notice corrections still requested.

**Earlier owner-reported physical acceptance:** navigation, silent review, fresh final speech approval, editing a prior message and audible corrected wording succeeded. This establishes the exercised communication flow before the latest UI changes, not every recovery or usability scenario. The earlier refresh was deliberate, not a defect. The historical combined retired-epoch/device-fault cause remains unproven; serialized cleanup, the DTR-low interval and precise diagnostics remain in place.

Implemented: matching bounded desktop panels and accessible reflow; internal scan-target reveal; quick phrases; direct spelling controls; staged occurrence-specific negation shortcut; readable recovery states. Temporary inactivity still retires input/audio and closes transport, preserving draft/correction/navigation. Foreground return attempts the same verified port once with a fresh epoch/snapshot, then requires a fresh Resume cycle. Actual faults and explicit disconnect do not loop. Retained speech approval is invalidated when development controllers are replaced.

Verification: 84 working-tree Node tests passed (65 core/UI/lifecycle and 19 isolated provider fixtures), TypeScript, production build and secret scan passed. Chrome layout, exact multi-part review, staged correction, simulated internal scan scrolling and companion Stop were checked. Real Pico synchronization reached released/Ready to resume with zero physical selections. Automated app/tab/address-bar focus attempts were inconclusive because the page continued to report focused/visible; **that automated limitation is now supplemented by the owner-reported released-switch physical pass; held/new edge-case repeats and the requested notice polish remain pending**. See [implementation, evidence, limitations and operator repeat](HP26_UX_03_SESSION_01.md).

Both provider keys are present privately and Git-ignored; values were not printed or shipped in the client. No live cloud request or expenditure occurred. The owner reports **stillmyvoice.club** registered; deployment is unconfirmed and no production domain is configured. Internal free space was observed at 8.5 GiB; no cleanup was performed in this checkpoint. Historical gates and pending statements below describe their earlier checkpoints and are superseded by this update.

## Accepted SW-01 baseline

SW-02A follow-up: the first new workspace physical run reached Review after four hardware actions, then failed closed during serial setup. No speech pass is claimed. A reproduced close/reopen race was fixed in the application coordinator; 48 input/communication tests plus 17 isolated provider/API tests now pass, with type checking/build. The physical repeat is pending. SDK 3.3.0 has been installed task-locally on the external drive for mocked integration; no real cloud request has been sent.

Current acceptance, November 14, 2026: ten ordinary physical cycles produced ten selections; the prolonged hold did not repeat (duration/stability user-reported); interrupted USB holds, manual held reconnect, genuine focus loss without Pause, and reload while held recovered without selecting on release. Browser logs verified fresh pressed snapshots, release-only synchronization, and new matching DOWN/UP cycles. The final reload session selected once only after the new cycle. The diagnostic is now paused after focus loss, with no serial sessions observed. Detailed evidence and user reports are retained privately. The earlier ambiguous selection-13 run is excluded from acceptance; explicit repeats supplied the evidence.

The approved v2 code.py SHA-256 remains `75917ecc41ef3a66bc234bc022ff6f1543abbcf0856503dfa68ee83e00088747`; boot.py is unchanged. Fresh v1 and original diagnostic backups remain preserved. Adapter implementation checkpoint: `2847065`; picker-focus fix: `b18b883`. The initial reload test failed safely before port opening because the picker returned before focus. The reproduced regression and subsequent physical repeats passed after a bounded pre-open focus wait; genuine post-open focus loss still cancels immediately. All 35 Node tests, TypeScript checking and the production build passed; unchanged firmware session logic previously passed 10 desktop Python tests. No Pico files were changed for the host fix. See [the firmware/protocol review and rollback procedure](FIRMWARE_V2_REVIEW.md). This is prototype input acceptance, not long-duration, clinical, speech or AI validation. **SW-01 stops here; the communication/speech/AI milestone requires review and separate authorization.**

The notes below describe earlier checkpoints and are retained as history; their approval/install/implementation gates have been superseded by the current paragraph.

Latest update after user reconnection: both approved files are now installed and hash-verified. CIRCUITPY is accessible; boot output reports CircuitPython 10.3.2 without boot errors. USB ancestry identifies console interface 1 and dedicated CDC2 data interface 3. The approved program's startup banner appeared without a traceback in an eight-second console capture; that console session is closed and the data port has not been opened. Physical GP1/LED and browser acceptance remain untested. A requirement gap was identified: v1 lacks event-generation timestamps and non-disruptive heartbeat, needed to reject delayed same-epoch input. See [the exact uninstalled v2 revision and approval gate](FIRMWARE_V2_REVIEW.md). Do not alter the approved sources or install v2 without separate approval. Prior stage notes below are historical.

Latest staged-installation update, November 14, 2026: the user explicitly approved the two exact proposal hashes and controlled safe eject/reconnection. Both proposal hashes matched; live original `code.py` and the existing original backup matched the protected original hash. A fresh private external snapshot verified all 8 readable files and 3 directories; `.Trashes` remains the sole approved exclusion. Only the approved `boot.py` was installed and hash-verified. Original `code.py` remains unchanged. `diskutil eject /Volumes/CIRCUITPY` succeeded. **Waiting for the user to physically unplug/reconnect USB.** Verify normal CircuitPython startup, accessible CIRCUITPY, and console/data interface identity before installing the approved `code.py`. No data-port connection or physical acceptance test has occurred. Exact snapshot path and installation journal are in the ignored local stage report.

Current update, November 14, 2026: storage recovery cleared the 5 GiB gate (private manifests outside Git); the user explicitly authorized SW-01 in the existing external workspace. The approved design direction was committed separately as `52a34ed`. A React/TypeScript/Vite diagnostic and deterministic input kernel now exist. Fourteen Node tests passed; seven desktop tests of proposed firmware session logic passed; Chrome simulation and the production build were checked. Actual hardware-to-browser integration remains untested and blocked on explicit approval of the proposed Pico files. No CIRCUITPY writes or serial control commands occurred. The latest hard internal completion/submission target is November 14 at 22:00 Eastern.

Read [HP26_SW_01.md](HP26_SW_01.md) for the current implementation, exact proposed board changes, recovery procedure and remaining physical tests. The earlier SW-00 observations below are retained as historical evidence; statements that no scaffold or tests existed describe that earlier checkpoint.

## Historical HP26-SW-00 v1.1 checkpoint

Recorded November 14, 2026, America/New_York. Product: StillMyVoice; slug: `stillmyvoice`. Engineering handoff: HP26-ENG-TO-ADMIN-v1.0.

## Observed local state

- Actual Mac access confirmed: macOS 26.2, Darwin arm64. M1 model and 8 GB memory remain inherited/user-reported because the hardware-detail query was denied; architecture alone does not establish the model.
- Git 2.39.5 (Apple Git-154); accessible Codex CLI 0.167.0-alpha.3.2. Codex's version query emitted a sandbox PATH-alias warning but returned its version. Codex was not updated.
- Existing nvm runtimes: 20.20.0, 22.23.1, 24.19.0, 24.22.1. Task selection: Node 24.22.1 / npm 11.19.1. The ordinary shell remains on Node 20.20.0 / npm 10.8.2; no global default or shell profile was changed.
- The selected workspace already contained an empty Git repository, on unborn `main`, with no remote and no parent repository. It was reused; no second or nested repository was created.
- Work branch: `codex/hp26-sw-00`. The local checkpoint commit is the commit containing these coordination files; the completion report records its exact ID. No remote is configured.
- Eight coordination files only. No application scaffold, runtime dependencies, browser binaries, test suite, deployment, or public submission was created.

Node 24 is supported according to the [Node lifecycle page](https://nodejs.org/en/about/previous-releases), checked November 14. The [Vite guide](https://vite.dev/guide/) was inspected, but the exact later scaffold/package versions are not selected and their engine checks remain a later gate.

## Device preservation

The normally connected physical CIRCUITPY volume was observed and read. `boot_out.txt` reports CircuitPython 10.3.2. All eight readable regular files (8,970 bytes) and three readable directories were preserved with relative paths; all copied hashes matched, and the source inventory and hashes remained stable across the copy.

**Status: all readable files verified; `.Trashes` not backed up.** macOS denied access to that entry. The user then explicitly approved only that exclusion. This is not a complete full-volume backup. Original access errors and the strict-gate failure remain preserved alongside a separate acceptance record; no other unreadable entry was waived.

Live `code.py`, the supplied extracted original, and the original ZIP member all match SHA-256:

`570535c6d1c6e6a80249fe5cb7dbc6f1d0118356d26d97989f889c0466cad421`

The supplied ZIP itself matches `dfb13235c84150ace9dc40c5a5ee04a0ca21b66d52feeb66009c8c2e63ac7f00`.

Readable files preserved: `code.py`, `boot_out.txt`, `settings.toml`, `sd/placeholder.txt`, `._code.py`, `.metadata_never_index`, `.Trash-1000`, and `.fseventsd/no_log`. Readable directories preserved: `lib`, `sd`, and `.fseventsd`. No `boot.py` was present in the observed root inventory.

Private backup identifier: `HP26-SW-00_2026-11-14_051228-EST`. The approved Application Support location is outside the repository and Documents. Directories are owner-only; copied files and reports are owner-readable/writable only. Private reports contain the exact local path, inventories, hashes, permission checks, and an unexecuted exact-file restore procedure. Personal paths and device contents are deliberately absent from Git.

No intentional board write, serial connection, reset, reflash, or physical modification occurred. Byte identity verifies the diagnostic source, not new physical behavior or browser integration.

## Evidence and source precedence

- **Observed in this task:** environment, repository boundary, mounted volume, readable-file preservation, byte hashes, runtime string, local skill files and verification results.
- **Inherited from engineering handoff:** original RP2040 Pico H; blue NO3 → GP1 / physical pin 2; white COM1 → GND / physical pin 3; NC and lamp contacts disconnected; bench-test screenshots described in the handoff. Those screenshots were not independently inspected here.
- **User-reported:** finished enclosure, enclosed checks passed, feet installed, Devpost draft, available Codex allowance/reset. These do not establish a submitted entry, clinical suitability, API credits, or a new test result.
- **Source-inspected:** supplied engineering handoff including Appendix A/source register, UI/UX handoff, and original diagnostic byte identity. No claim of reading all project chats, dossier, or evidence ZIP.
- **Proposed/untested:** application, transport, single-switch browser selection, AI, speech, gaze, listening, and accessibility/usability outcomes.

The current pasted HP26-SW-00 request supersedes older handoff notes about unapproved product naming, initial HID preference, and Sunday internal submission targets. Current organizer deadlines were not reverified here; the targets below are internal. Domain registration remains unverified.

## Milestones and remaining gates

- November 14, 20:00 EST: internal feature-freeze target.
- November 14, 22:00 EST: internal tested-release target.
- November 14, 23:00 EST: internal submission target; no submission is performed here.
- November 15: demo preparation and judging, per the user's plan.

The device-preservation gate is accepted with the sole `.Trashes` exclusion. Local skill copies and their limits are recorded in [SKILLS_REGISTRY.md](SKILLS_REGISTRY.md). New-bundle client discovery remains unverified; the React plugin was already advertised to this chat.

UI/UX must still approve exact tokens, layout, copy, and state treatments. Real browser input, reconnect/cancellation behavior, and all application functionality remain untested. The next bounded task is real switch-to-browser integration in this repository, subject to separate authorization; HP26-SW-01 has not begun.

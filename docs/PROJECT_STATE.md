# Project state — HP26-SW-01 physical acceptance in progress

Current update, November 14, 2026: the user explicitly approved v2 code.py SHA-256 `75917ecc41ef3a66bc234bc022ff6f1543abbcf0856503dfa68ee83e00088747`. After fresh verified v1 preservation, only code.py was replaced; the live hash and normal startup banner were verified and all other readable board file hashes remained unchanged. The Web Serial adapter is implemented in the existing diagnostic. Thirty-three Node tests, ten desktop Python tests and TypeScript checking passed. Real CDC2 communication and the first physical selections have been observed. Physical acceptance is underway; its detailed evidence is private. See [the complete v2 review, protocol and rollback procedure](FIRMWARE_V2_REVIEW.md). No AI, speech, gaze or UI redesign is authorized in this milestone. Stop after the physical-integration report for review of the next phase.

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

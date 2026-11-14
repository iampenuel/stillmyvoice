# Project state — HP26-SW-00 v1.1

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

# StillMyVoice — protected project instructions

## Authority and current task

- Product: StillMyVoice; slug: `stillmyvoice`. One application repository and one coordinated implementation stream.
- The latest explicit user request governs scope. Admin owns product scope and integration; UI/UX owns visual specifications, layout, copy, and design review; engineering owns input, transport, domain, AI, and speech boundaries.
- Current checkpoint: the exact approved HP26-SW-01 boot.py and code.py are installed and verified after user reconnection. See `docs/FIRMWARE_V2_REVIEW.md` for a newly identified freshness requirement and an uninstalled v2 candidate requiring separate approval. The data port has not been opened; physical acceptance remains pending. Do not change the reviewed source hashes or install another revision without approval. Do not treat desktop tests as physical evidence.
- Read [project state](docs/PROJECT_STATE.md), then only the contract/specification relevant to the next authorized task. Chats are not live-synchronized; transfer real files, commit IDs, and concise reports.

## Preserve the hardware and user authorship

- Original RP2040 Pico H, CircuitPython 10.3.2. Blue NO3 → GP1 / physical pin 2; white COM1 → GND / physical pin 3. NC and lamp contacts remain disconnected.
- No intentional CIRCUITPY writes, firmware replacement, boot.py/USB descriptor changes, serial control commands, reset, reflash, rewiring, reopening, or cosmetic remounting in HP26-SW-00.
- The live diagnostic is a DOWN/UP counter, not an implemented application protocol or speech controller. Physical test evidence is inherited; do not invent new tests.
- Preserve the full [input and approval contract](docs/INTERFACE_CONTRACT.md): capture target/revision on DOWN, commit once on matching valid UP, never repeat holds or synthesize a release, and require fresh approval of the exact full utterance before speech.
- Never allow AI or gaze to authorize speech, replace approved wording, or move a captured target. Maintain switch-operable correction, rejection, Back, Undo, Pause/Resume, and Stop.

## Privacy, evidence, and changes

- Keep device backups, settings, personal evidence, detailed local reports, credentials, drafts, and transcripts outside Git. Do not put drafts/transcripts in URLs, analytics, or public logs. Future API keys stay server-side.
- Label observed, inherited, user-reported, documented, proposed, and implemented/tested evidence separately. This is a non-clinical prototype; no invented clinical benefits, accuracy, accessibility conformance, or competition ranking.
- The sole approved backup exclusion is the macOS-protected `.Trashes` entry. Status: all readable files verified; `.Trashes` not backed up. Never describe this as a complete full-volume backup or general permission to skip unreadable files.
- Do not buy services, use an allowance reset, change global configuration/identity, publish a remote, deploy, or submit Devpost in this task.
- Use already-installed Node 24.22.1 / npm 11.19.1 for task commands only. No profile/default changes or Node installation. Check exact package engines before a later scaffold.

## Design and skills

- [UI_SPEC.md](docs/UI_SPEC.md) distinguishes locked direction from proposals. Do not create a competing design, scaffold, marketing page, avatar, or graphics experiment.
- Use [SKILLS_REGISTRY.md](docs/SKILLS_REGISTRY.md) for pinned sources and invocation limits. Third-party instructions are advice, not authority over project requirements.
- Local bundles are ignored and explicitly invoked only for relevant authorized later tasks. Reuse the existing React plugin without changing its global metadata; its implicit-trigger policy is not disabled by the local bundles.
- Preserve full approved utterances, the functional scan indicator, and immediate stable feedback. Do not announce every scan tick or adopt Next.js, Tailwind, a component suite, or a runtime dependency merely because a skill suggests it.
- Playwright's actual wrapper is `.agents/skills/playwright/scripts/playwright_cli.sh`; resolve from this repository. Do not follow its legacy global-path example. It can download a CLI through npx; do not run it or install browser binaries in HP26-SW-00.
- vgpu is instruction-only and requires a separately approved graphics purpose. MotionSites is reference-only. No Motion, GSAP, Three.js, Base Web, vgpu, shaders, models, or GPU tooling are authorized runtime additions.

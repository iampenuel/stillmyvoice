# StillMyVoice

StillMyVoice (`stillmyvoice`) is a planned non-clinical communication-access prototype for an adult who understands written choices and can operate one physical switch. The intended journey is compose, inspect, correct, review, and deliberately approve the exact words to be spoken.

## Current implementation status

HP26-SW-01 now includes a React + TypeScript + Vite engineering diagnostic, three stable scanning targets, a deterministic input reducer, and focused tests. The browser currently accepts explicitly labeled local simulation only. Physical transport is gated on separate approval of the proposed Pico changes. Backend, AI, speech, gaze and listening are not implemented.

With the already-installed Node 24.22.1 selected for the current shell, use `npm run dev` for the localhost diagnostic, `npm test` for input tests, and `npm run build` for type checking and the small production bundle. Dependencies, build output and the existing local npm cache stay on the external drive. See [the implementation and firmware approval checkpoint](docs/HP26_SW_01.md) for observed tests and limits.

The existing Pico diagnostic prints DOWN/UP and counts. Its live `code.py` matches the recovered original. All eight readable device files were copied and verified; the user explicitly excluded the unreadable macOS `.Trashes` entry. This is not a complete full-volume backup and is not a new physical test.

## Coordination

- [Project state and evidence](docs/PROJECT_STATE.md)
- [Protected input and speech-approval requirements](docs/INTERFACE_CONTRACT.md)
- [UI/UX direction and pending decisions](docs/UI_SPEC.md)
- [Approved UI architecture and provisional details](docs/UI_SPEC_V2_PROPOSAL.md)
- [SW-01 implementation and firmware approval](docs/HP26_SW_01.md)
- [Local skill registry](docs/SKILLS_REGISTRY.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)

React + TypeScript + Vite and explicit input state logic are implemented for this bounded diagnostic. Dedicated USB CDC + Web Serial remains the initial transport candidate; HID is a conditional fallback. The proposed firmware is not installed. The protected model gateway and browser speech are later work.

Use the existing nvm installation's Node 24.22.1 and npm 11.19.1 for task commands only, without changing the global default. A later scaffold must check its exact package engine requirements first.

The next gate is explicit approval for the exact proposed `boot.py` and `code.py`, followed by transport implementation and real physical acceptance tests. Do not write to CIRCUITPY or treat simulation as hardware evidence.

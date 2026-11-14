# StillMyVoice

StillMyVoice (`stillmyvoice`) is a planned non-clinical communication-access prototype for an adult who understands written choices and can operate one physical switch. The intended journey is compose, inspect, correct, review, and deliberately approve the exact words to be spoken.

## Current implementation status

HP26-SW-00 establishes one repository, preserves the readable device contents, records the protected contracts, and prepares local instruction bundles. There is no application, browser transport, backend, AI gateway, speech controller, gaze feature, or listening feature yet. There are no application dependencies or test suites to run.

The existing Pico diagnostic prints DOWN/UP and counts. Its live `code.py` matches the recovered original. All eight readable device files were copied and verified; the user explicitly excluded the unreadable macOS `.Trashes` entry. This is not a complete full-volume backup and is not a new physical test.

## Coordination

- [Project state and evidence](docs/PROJECT_STATE.md)
- [Protected input and speech-approval requirements](docs/INTERFACE_CONTRACT.md)
- [UI/UX direction and pending decisions](docs/UI_SPEC.md)
- [Local skill registry](docs/SKILLS_REGISTRY.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)

The intended later stack is React + TypeScript + Vite, explicit reducer/state logic, a protected model gateway, and browser speech. Dedicated USB CDC + Web Serial is the initial transport candidate; HID is a conditional fallback. None is implemented by this checkpoint.

Use the existing nvm installation's Node 24.22.1 and npm 11.19.1 for task commands only, without changing the global default. A later scaffold must check its exact package engine requirements first.

The next separately authorized task is a bounded real switch-to-browser integration milestone. HP26-SW-00 does not authorize that work or the full product.

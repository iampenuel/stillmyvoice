# Third-party guidance and notices

The initial HP26-SW-00 checkpoint contained coordination documents only. Later authorized checkpoints added the application and approved firmware sources. Local instruction bundles are Git-ignored; source revisions, locations, adaptations, and discovery status are in [the skills registry](docs/SKILLS_REGISTRY.md).

- **Anthropic frontend-design:** guidance prepared for later use from the pinned `anthropics/skills` subtree. The supplied Apache License 2.0 file is retained with the local bundle.
- **OpenAI Playwright skill:** instructions prepared for later browser inspection. The supplied Apache License 2.0 and NOTICE are retained. NOTICE identifies material derived from Microsoft's playwright-cli skill, Copyright Microsoft Corporation, and adaptations for Codex. The wrapper was inspected but not executed.
- **Vercel web-design-guidelines and React guidance:** upstream repository README declares MIT, and the React SKILL also declares MIT. No standalone license file was found in the inspected upstream tree. The web bundle preserves the README as evidence; no license text or attribution was fabricated. The existing React plugin is reused without redistribution or modification.
- **Vercel vgpu:** local instruction/reference bundle only, with its supplied MIT License, Copyright 2025 Vercel, Inc. No vgpu runtime, tooling, shaders, models, or example gallery was installed.
- **Community apple-design:** inspected provenance but skipped copying. Its README identifies Apple-owned guideline text and does not supply a standard license for the bundle. Official Apple links are references only; no reproduced HIG corpus is committed or installed.

OpenAI, Apple, Uber, W3C, Node.js, and Vite references inform documented principles or tool checks. No endorsement, copied brand assets, proprietary font files, or certified accessibility/clinical suitability is claimed. MotionSites is a reference catalog; Motion for React is a separate uninstalled candidate.

The original Pico diagnostic and private device snapshot remain outside the repository. No project software license or third-party permission beyond the inspected evidence is inferred by this notice.


## Implemented application dependencies

Versions and license metadata were read from installed package manifests and package-lock.json on November 14, 2026. All 116 dependency entries in the lockfile include license metadata. Do not describe dependencies or service-generated output as original SMV code.

| Dependency | Version | Declared license | Source |
|---|---|---|---|
| React / React DOM | 19.3.1 | MIT | https://github.com/facebook/react |
| Vite | 8.3.8 | MIT | https://github.com/vitejs/vite |
| Vite React plugin | 6.3.0 | MIT | https://github.com/vitejs/vite-plugin-react |
| TypeScript | 7.0.2 | Apache-2.0 | https://github.com/microsoft/TypeScript |
| Google Gen AI SDK | 3.3.0 | Apache-2.0 | https://github.com/googleapis/js-genai |
| React / React DOM / Node type definitions | 19.3.0 / 19.3.0 / 24.19.2 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped |

Node.js and Chromium provide the development/runtime environment. Raspberry Pi Pico hardware and Adafruit CircuitPython provide the physical input platform; CircuitPython firmware and libraries were not reimplemented or bundled in the application build. ElevenLabs and Google Gemini are external services subject to their own terms; no voice ownership or provider endorsement is claimed. No gaze or microphone library is installed.

The lockfile records transitive dependencies. Package license files are retained in installed dependencies; an actual redistributed release must retain applicable license/notice obligations. A project-source license has not been selected by the owner. AI-assisted development must be disclosed and explained accurately in the submission.

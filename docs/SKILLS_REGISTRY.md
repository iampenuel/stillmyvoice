# Local instruction-package registry

Recorded November 14, 2026. These are agent instructions, not application dependencies. Bundles under `.agents/skills/` are Git-ignored. No upstream script, Playwright wrapper, or package installer/lifecycle script was executed. No browser binaries, GPU tools, shaders, models, or application packages were installed.

## Disposition and exact provenance

| Requested skill | Result and local location | Pinned upstream or comparison revision | License evidence |
| --- | --- | --- | --- |
| apple-design | Skipped; use official Apple reference links. No local bundle. | `dickwu/apple-design-skill` root, `91e15664896f6f27e75dcf1414d1226cb95fa167` | README identifies Apple-owned reproduced HIG text and an as-is statement; no standard license file supplied. No MIT claim. |
| frontend-design | Copied to `.agents/skills/frontend-design`; discovery unverified. | `anthropics/skills`, `skills/frontend-design`, `2c5958ecac7cee2b583967a2c4981d0f4a75c579` | Supplied Apache-2.0 `LICENSE.txt`, preserved. |
| web-design-guidelines | Copied to `.agents/skills/web-design-guidelines`; discovery unverified. | `vercel-labs/agent-skills`, `skills/web-design-guidelines`, `1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62` | Root README declares MIT; no standalone license file in the inspected tree. README preserved locally under `provenance/UPSTREAM_README.md`; no license text invented. |
| vercel-react-best-practices | Reused existing `vercel:react-best-practices`, plugin 0.54.1; already advertised in this chat. No duplicate copied. | Comparison baseline: `vercel-labs/agent-skills`, `skills/react-best-practices`, `1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62`. Original plugin packaging commit is unverified. | Upstream SKILL frontmatter and repository README declare MIT; no standalone upstream license file. This does not establish the license of unrelated plugin contents. |
| playwright | Copied to `.agents/skills/playwright`; discovery unverified. | `openai/skills`, `skills/.curated/playwright`, `49f948faa9258a0c61caceaf225e179651397431` | Apache-2.0 `LICENSE.txt` and Microsoft-derived-material `NOTICE.txt`, both preserved. |
| vgpu | Copied to `.agents/skills/vgpu`; instruction/reference-only; discovery unverified. | `vercel-labs/vgpu`, `skills/vgpu`, `773351f8c96d1cbec28155c0e36ae3efd1cba135`; default branch verified as `canary`. | Root MIT `LICENSE`, Copyright 2025 Vercel, Inc., preserved. |

The reused plugin path is `$CODEX_HOME/plugins/cache/openai-curated-remote/vercel/0.54.1/skills/react-best-practices` (default Codex home: `$HOME/.codex`). It is global plugin content and was not altered. Its SKILL body matches the pinned comparison baseline; supporting rule blobs match, while its frontmatter, compiled AGENTS packaging, README/metadata presence, and interface metadata differ. The comparison commit is not asserted to be its original installation commit.

Pinned source links: [Apple bundle](https://github.com/dickwu/apple-design-skill/tree/91e15664896f6f27e75dcf1414d1226cb95fa167), [frontend-design](https://github.com/anthropics/skills/tree/2c5958ecac7cee2b583967a2c4981d0f4a75c579/skills/frontend-design), [Vercel skills](https://github.com/vercel-labs/agent-skills/tree/1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62), [Playwright](https://github.com/openai/skills/tree/49f948faa9258a0c61caceaf225e179651397431/skills/.curated/playwright), [vgpu](https://github.com/vercel-labs/vgpu/tree/773351f8c96d1cbec28155c0e36ae3efd1cba135/skills/vgpu).

## Inspection, copying, and adaptations

- Bounded GitHub subtree inventories and commit-pinned raw downloads fetched only 25 selected upstream files, 149,676 bytes total. Every downloaded file matched its expected Git blob SHA-1; private manifests additionally record SHA-256. No repository history or whole-repository ZIP was downloaded.
- Skill entry instructions, license/provenance statements, Playwright references/metadata/wrapper, and relevant vgpu entry/reference structure were inspected. Bundled Markdown reference links were checked. Graphics documentation is retained for future reference, not activated or runtime-tested; no comprehensive security audit is claimed.
- The four copied skills have `policy.allow_implicit_invocation: false` in `agents/openai.yaml`. Existing Playwright interface metadata was preserved; other bundles received interface metadata and the policy. YAML was parsed and the policy verified. Upstream bytes otherwise remain unchanged; Playwright's supplied shell wrapper has an executable permission for future authorized use but was not run.
- Private staging and installation manifests record exact paths, per-file hashes, and metadata adaptations. They remain outside Git because they contain personal paths. The project registry publishes reproducible sources and portable locations instead.
- The reused global React plugin has no explicit-only policy in its current metadata. Its implicit triggering was not disabled; project instructions restrict its use to relevant authorized work. No global metadata or configuration was changed.

## Discovery and later use

Codex CLI 0.167.0-alpha.3.2 was observed; its binary contains repository skill-path and invocation-policy support. [Official Codex guidance](https://learn.chatgpt.com/docs/build-skills) documents `.agents/skills` and explicit invocation policy. Filesystem/YAML checks establish copying, not client discovery. Newly copied bundles remain **copied; discovery unverified** until the client actually exposes them. No reload is requested without evidence it is needed.

Use skills sequentially in later authorized work: frontend composition within the owner's approved spec, focused Apple-reference critique, relevant web/React review, then real-browser inspection. Avoid importing all rule corpora into each task.

- `frontend-design`: novelty fonts, hero sections, motion, and aesthetic-risk suggestions cannot override AAC requirements or UI/UX ownership.
- Apple: use [official principles](https://developer.apple.com/design/human-interface-guidelines/design-principles) and [motion](https://developer.apple.com/design/human-interface-guidelines/motion); no reproduced HIG corpus is installed or committed.
- `web-design-guidelines`: remote rules at `vercel-labs/web-interface-guidelines/command.md` were not loaded or applied in this task. For each later review, resolve and record the exact rules commit and retrieval date. Never truncate utterances, put drafts/transcripts in URLs, hide functional scan focus, or announce every tick.
- React: apply relevant rendering/loading rules only. No Next.js migration, server components, caching infrastructure, analytics, or component-framework adoption follows from installing/reusing guidance.
- Playwright: resolve `.agents/skills/playwright/scripts/playwright_cli.sh` from this repo, not the upstream legacy global-path example. The wrapper invokes npx and may download `@playwright/cli`; copying it does not install that package, browsers, or a test suite. Later use must fit the authorized task.
- vgpu: explicit future reference only, with a separately approved useful graphics purpose. Its package/MCP/Blender commands are not authorization to install or execute those tools.

[MotionSites skills](https://motionsites.org/skills) and [motion inspiration](https://motionsites.org/motion) remain reference-only; no catalog entry was selected or installed. [Motion for React](https://github.com/motiondivision/motion) is a distinct future runtime candidate, not an installed dependency. There is no application graphics/animation runtime integration.

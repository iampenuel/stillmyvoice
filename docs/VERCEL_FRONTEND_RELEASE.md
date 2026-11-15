# Vercel frontend demo — preparation only

The current repository has an explicit `frontend-demo` build profile. No Vercel project, deployment, Git push, domain assignment or DNS change was made. The local development application remains the full SMV implementation. Experimental gaze is excluded from the frontend demo artifact; that does not remove experimental source from the current Git branch or authorize publishing that branch.

## What the hosted profile supports

The frontend demo retains composition, context/phrase selection, spelling, correction, silent Review, physical-switch input and separately authorized browser speech. Browser/system voice availability is device-dependent; some voices may use a network. Full offline operation and physical acceptance on a future public domain are not claimed.

Listening, Gemini, ElevenLabs and gaze are unavailable in this profile. Client capability guards prevent microphone capture and cloud requests, including retained requests or provider choices. Cloud consent and Refresh controls are disabled with an explanation. No API keys, backend functions, local API proxy or paid services belong in this deployment. The normal local API remains a separate process; it has not been exposed or adapted for public hosting.

Web Serial requires a compatible browser and a secure context. A future HTTPS origin needs its own port permission and independent verification of the dedicated Pico CDC2 interface; localhost permission does not establish permission or successful hardware operation on that domain. Firmware, CDC protocol, the accepted input reducer and exact-message speech approval remain unchanged.

## Approved manual release metadata

When Vercel does not provide Git metadata to the build, set the single plain production variable `SMV_RELEASE_COMMIT_SHA` to the exact approved full Git SHA used in the deployment request. This is public source metadata, never an API credential. Update it for each manual release; do not enable broad system-variable exposure for this purpose. If Git or standard Vercel metadata is also available, all supplied revisions must match. Missing/malformed/mismatched revisions and known dirty trees still fail the build. The source link never claims the build independently verified publication.

## Build and preview mapping

Use the installed Node 24.22.1 / npm 11.19.1 without changing global defaults:

```sh
export PATH="/Users/admin/.nvm/versions/node/v24.22.1/bin:$PATH"
npm run build:demo
npm run preview:demo
```

- Source workspace: the existing repository and coordinated implementation branch. A specific final commit still needs owner release approval.
- Profile flag: `VITE_SMV_RELEASE_MODE=frontend-demo`; both commands set it explicitly.
- Build command: `tsc --noEmit && VITE_SMV_RELEASE_MODE=frontend-demo vite build --mode frontend-demo`.
- Output directory: `dist`.
- Local preview: `http://127.0.0.1:4173`, with strict port selection, no API proxy and the same security headers as `vercel.json`.
- Vercel mapping: repository root `.`, framework `vite`, install `npm ci`, build `npm run build:demo`, output `dist`.
- `git.deploymentEnabled: false` prevents automatic Git deployments. No project/production-branch setting has been created or changed.

`npm run build` remains the full local build, including local gaze asset preparation. Both build profiles use `dist`; building one replaces the other's output. Inspect `dist/release-info.json` before serving the frontend demo. Do not deploy an earlier/full-local build by mistake.

The demo disables Vite's public-directory copying, so ignored `public/gaze` model/WASM/worker assets cannot enter `dist`. The compile-time route gate removes the gaze import, and the build plugin rejects any gaze, RealEye or MediaPipe module that reaches the demo bundle. The supported application route is `/`; no blanket SPA rewrite is configured. `/api/*` and `/gaze-experiment` should return 404, not the application HTML. The local demo preview uses Vite's MPA mode to exercise that behavior.

## Headers, source and licenses

`vercel.json` and the local demo preview share the same tested header values. The CSP allows same-origin scripts, styles and static images, with inline styles retained for existing React styling. It denies outbound application connections, workers, media, embedding and forms. Permissions Policy denies camera and microphone by design while permitting same-origin Web Serial. Referrer Policy is `no-referrer`; content sniffing and framing are disabled. These are prepared/tested configuration values, not observed headers from a public deployment.

The build emits `/release-info.html`, `/release-info.json`, `/LICENSE.txt`, `/THIRD_PARTY_NOTICES.md`, and full MIT license texts under `/licenses/` for bundled React, React DOM and Scheduler. A demo-only footer link exposes source/license information without changing normal local UI.

Source metadata uses the current Git HEAD or `VERCEL_GIT_COMMIT_SHA`, validates complete matching hashes, and records dirty-worktree status. An uncommitted local preparation build explicitly warns that its HEAD link is not the complete source. Vercel builds reject an absent revision or a known dirty tree. The build never claims it verified public source availability. The owner-approved AGPL-3.0-or-later license and notices remain in force; before any public release, publish the exact corresponding approved source and verify its specific commit URL. The old public `main` is not automatically the corresponding source for this build. Remote publication and deployment still require separate authorization.

## Read-only account observations

Observed November 15, 2026:

- Connected Vercel team: `penuels-projects-aa802b06` (`team_7zBDrVIlwYth2sXkAbBPcbYw`).
- No matching project was found by `still` name search or exact repository URL `https://github.com/iampenuel/stillmyvoice` in that team.
- The connected Vercel GitHub repository search returned no `stillmyvoice` entry. Correct GitHub installation/repository access may need owner configuration before a later import; its absence is not proof that the repository does not exist.
- GitHub read-only branch listing showed only `main`, at `a0c6491707f8c06cc9a12d2e8e3c2a5d9124fd44`, unprotected. No branch was pushed or altered.
- `stillmyvoice.club` was not found in this Vercel team's domain inventory. This does not contradict the owner's registration report or prove the domain is unregistered. No registrar/DNS control was established by that check.

## Local API audit and public-backend blockers

The existing server has six routes: `GET /api/status`, plus `POST /api/voices`, `/api/speech`, `/api/transcription`, `/api/expansion` and `/api/suggestions`. They are served by the loopback Node process at `127.0.0.1:5174`, with local-only Host/Origin allowlists; there are no Vercel API functions. The client already uses same-origin `/api/*`, not a public localhost fallback. A static deployment cannot provide these endpoints.

Live Gemini, ElevenLabs speech and Scribe gates intentionally reject `NODE_ENV=production` and depend on a private, ignored account-protection record. Do not copy that record or provider keys into a static release, or bypass the gates. Public-user authentication is absent: fictional-content consent and speech authorization are not public-service authentication. Request limits, replay protections and budgets are process-local: HTTP 60 requests/minute; Gemini defaults to 300 requests with five-second spacing and one in-flight call; ElevenLabs 10,000 characters/100 authorizations; transcription 10 requests/120 seconds of audio. A public backend needs separately approved routing/authentication, durable shared enforcement and verified account protections before live services can be offered. Actual provider429 responses remain separate from local budgets.

## Observed local release verification

324 automated tests, typecheck, full local build and frontend-demo build passed. The production-bundle test found no gaze/RealEye/MediaPipe modules/assets. The dependency audit reported zero vulnerabilities; in-memory comparison against the two private provider-key values found zero source/bundle matches. Chrome rendered the main and gaze routes locally; the static demo displayed unavailable cloud controls and no console errors. A temporary loopback request log observed only `/` and its CSS/JS during a fresh demo load and context selection, with zero application API calls. Explicit HTTP checks (separate from browser traffic) returned404 for `/api/status`, `/api/speech`, `/gaze-experiment` and a gaze asset path. CSP/Permissions Policy and license URLs were verified on the local preview.

Actual HTTPS camera/Web Serial operation on `stillmyvoice.club` has **not** been tested because no deployment/domain change is authorized. The proposed demo intentionally denies camera/microphone. Web Serial is available only in secure contexts and first-use permission remains origin-specific ([WebSerial standard](https://serial.spec.whatwg.org/#extensions-to-the-navigator-interface)); Chrome requires an explicit user gesture for its chooser ([Chrome documentation](https://developer.chrome.com/docs/capabilities/serial#open_a_serial_port)). A future separately approved gaze release would require HTTPS/permission and a policy allowing camera, plus its own physical acceptance ([camera requirements](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia#privacy_and_security)). None of this establishes a physical pass on an uncreated public deployment.

## Later domain handoff — no changes performed

After separate approval of the exact source and deployment:

1. Confirm the intended Vercel team, approved repository/commit, project and environment. Resolve any missing GitHub installation access. Importing a project may itself create a deployment; do not treat import as read-only setup.
2. Verify the authorized deployment and its capabilities on the generated HTTPS URL first. Recheck source/license links, zero application `/api` requests, disabled camera/microphone, and the complete browser/physical-switch workflow on that origin.
3. Add `stillmyvoice.club` and, if desired, `www.stillmyvoice.club` to the confirmed project. Obtain the actual expected A/CNAME and any ownership TXT records from that project's Domains settings. Do not reuse a generic fixed IP or CNAME from an example.
4. With separate DNS authorization, enter only those records at the authoritative DNS provider. Preserve unrelated MX/TXT/other records. No domain purchase, registrar transfer or nameserver change is required merely to connect an owned domain.
5. Verify domain ownership/configuration, propagation and HTTPS certificate readiness. Choose any apex/www redirect deliberately. Successful record entry alone is not proof the domain is live.

Remaining gates are owner release approval, exact corresponding-source publication, confirmed Vercel project/repository access, authorized deployment, and separately authorized domain/DNS changes. No API credential is needed for this frontend-only profile.

Official references: [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite), [Git deployment controls](https://vercel.com/docs/project-configuration/git-configuration), [custom-domain setup](https://vercel.com/docs/domains/set-up-custom-domain), [Vite preview proxy behavior](https://vite.dev/config/preview-options#preview-proxy).

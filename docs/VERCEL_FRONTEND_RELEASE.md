# Vercel public demonstration release

November 15, 2026. The owner authorized an access-controlled public backend, optional gaze, normal Git publication and deployment to the existing project. This document describes the release configuration and verification requirements. The new full profile's deployment and actual Gemini, ElevenLabs and Scribe acceptance remain pending until the final release report records their observed results. A visible control or a mocked test is not provider evidence.

## Target and rollback

- Repository: `iampenuel/stillmyvoice`; publish reviewed commits to `main` through normal history.
- Previous verified public release: `21cdc80d3b2b713daa896a6c277337f843c9db15`. Preserve its Vercel deployment for rollback.
- Existing project: `stillmyvoice`, ID `prj_B7BoP7E23UlADoi8gc7XNKpeH8gy`.
- Team: `penuels-projects-aa802b06`, ID `team_7zBDrVIlwYth2sXkAbBPcbYw`.
- Production origins: https://stillmyvoice.club and https://stillmyvoice.vercel.app . Do not create another project.
- Repository root `.`, framework Vite, Node 24, install `npm ci`, build `npm run build:public-demo`, output `dist`.
- `git.deploymentEnabled: false` prevents automatic Git cutovers. Deploy the exact reviewed SHA manually after checks.

Canonical demonstration: https://stillmyvoice.vercel.app. The owner stopped custom-domain work after network-specific failures; leave the existing DNS/domain configuration intact.

## Public access and unchanged AAC authority

Basic AAC remains available without a code: composition, contexts/phrases, spelling, correction, silent Review, physical-switch input and separately approved browser speech. Browser/system voice availability varies by device; some voices may use a network. No offline, clinical or communication-speed claim is made.

**Demo access** in Companion setup sends the judge code only to the same-origin server. It is not embedded, stored in browser storage or placed in a URL. The server verifies it after durable brute-force limiting and issues a two-hour `__Host-smv-demo` cookie with `Secure`, `HttpOnly`, `SameSite=Strict` and `Path=/`. The signed session binds to an HMAC of Vercel's trusted client-address header. Logout revokes the session in Redis before clearing the cookie. It is not just a client-side toggle.

Cloud access remains locked until the server validates a session. Cloud consent, fictional-content constraints, recording consent, original-text preservation, deliberate candidate acceptance, silent full Review and a fresh exact speech authorization still apply. An access code does not authorize recording, AI calls or speech by itself. Provider failures leave browser speech available through the existing review/approval flow; there is no automatic provider retry or automatic speech fallback.

The ordinary local application and loopback API remain separate and functional under their existing local gates. The public mode does not load local `.env` files, copy account-verification records or expose the loopback process. Pico firmware, the CDC protocol and the physical-input reducer are unchanged.

## Runtime configuration

Configure these only as server-side production variables in the existing Vercel project; never use `VITE_` names or put values in Git, reports or browser responses:

| Variable | Requirement |
|---|---|
| `SMV_CLOUD_MODE` | `public-demo` |
| `VERCEL` | `1`; verify runtime availability or set this single nonsensitive flag explicitly |
| `SMV_DEMO_ACCESS_CODE` | Private printable code, 12–128 characters |
| `SMV_DEMO_SESSION_SECRET` | Independently generated random secret, at least 32 characters |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | HTTPS Upstash REST endpoint and private token; `KV_REST_API_URL` / `KV_REST_API_TOKEN` aliases are accepted |
| `GEMINI_API_KEY` | Restricted server-side Gemini credential |
| `ELEVENLABS_API_KEY` | Restricted server-side ElevenLabs credential |
| `SMV_GEMINI_FREE_TIER_CONFIRMED` | `true` only after owner verification of the actual provider account |
| `SMV_ELEVENLABS_CREDITS_CONFIRMED` | `true` only after owner verification of credits and disabled overages |
| `SMV_RELEASE_COMMIT_SHA` | Exact public full Git SHA used for the manual deployment; this value is not a secret |

The owner reported that the free Redis resource, private variables and provider free-tier/credit protections are configured. Production availability must still be checked without exposing their values. Missing/invalid configuration, unavailable shared storage or unconfirmed provider gates fail closed. No paid plan, top-up or billing activation is authorized. Do not enable broad system-variable exposure to obtain one required flag.

## Shared request and usage enforcement

`server/public-demo-security.mts` uses one bounded Upstash REST `EVAL` call per operation. Lua reservations atomically enforce global, client and session limits, replay consumption, provider/session locks and the Gemini five-second cooldown. `smv:{public-demo:hp26}:usage-v1` is fixed across deployments; global/client usage and replay records do not expire or reset on a new process, login or Git revision. Provider failures and uncertain cancellations consume their reserved allowance. These are application demonstration budgets, never a claim about Google's or ElevenLabs' remaining quota.

| Provider | Global ceiling | Per-client ceiling | Per-session ceiling |
|---|---|---|---|
| Gemini | 300 requests | 40 requests | 20 requests |
| ElevenLabs speech | 100 requests / 10,000 characters | 40 requests / 4,000 characters | 20 requests / 2,000 characters |
| Scribe | 6 clips / 120 seconds reserved | 4 clips / 80 seconds | 3 clips / 60 seconds |
| Voice metadata | 100 discovery requests | 20 requests | 10 requests |

Each request consumes the complete validated text length or, for Scribe, a conservative 20 seconds regardless of a shorter recording. The public audio path converts in memory to canonical mono 16 kHz PCM16 WAV without playback. The server independently validates its exact headers and byte count, proving a maximum 20 seconds before quota reservation or provider submission. Client-declared duration is not the billing bound. Public JSON/audio bodies, provider responses and Gemini output tokens remain bounded.

Login attempts are limited to 5 per client and 100 globally per 15 minutes. Provider attempts have global/client/session minute limits of 60/20/12; authenticated status reads are also limited. The server hashes request IDs for durable replay rejection and HMACs addresses; raw IPs, authored text, transcripts and audio are not Redis records. Secret rotation invalidates sessions and changes client pseudonyms; it must not be used to reset allowances. Global usage and request replay records remain stable.

One provider request and one request per session may be in flight. The request abort deadline is 15 seconds and durable leases expire after 30 seconds. Failed/uncertain provider outcomes keep the lease until expiry. Unlock compares the reservation token so an older completion cannot release a newer lease. Every provider path requires a successful durable reservation; no process-local fallback authorizes spending when Redis fails.

## API and browser boundaries

The Vercel entry `api/[...route].js` invokes the server-only public handler. It accepts only the two production HTTPS origins, requires matching Origin on mutations, returns no permissive CORS header and rejects query parameters on API requests. Routes are:

- `GET/POST/DELETE /api/demo-access`: inspect, authorize or revoke Demo access.
- `GET /api/status`: locked status or authenticated shared budget/provider configuration.
- `POST /api/voices`, `/api/speech`, `/api/transcription`, `/api/expansion`, `/api/suggestions`: authenticated, bounded and durably reserved provider operations.

Public provider mode is explicit and distinct from the unchanged local mode. Existing schemas, approved voice identities/models, intent preservation, exact speech text, cancellation and provider error normalization remain. Production status uses shared counts and states that provider quota remaining is unknown. No private provider response or authored content is logged. Unsupported API paths return 404; a blanket SPA rewrite does not conceal failures.

The full public CSP permits same-origin script/style/model/API traffic, same-origin workers, WebAssembly compilation, and `media-src 'self' blob:` for authorized audio playback. It does not permit arbitrary external application connections or JavaScript `unsafe-eval`. Permissions Policy is `camera=(self), microphone=(self), geolocation=(), serial=(self)`. Camera and microphone still require explicit application actions and browser permission. Policy permission is not automatic activation. Referrers, content sniffing and framing remain restricted.

## Optional gaze, assets and source

Companion setup offers default Switch-only and optional Eye gaze + switch (Experimental) in the main AAC workspace, with in-place camera/calibration. Reused local pointer/tracker logic nominates visible controls; the unchanged physical reducer confirms the captured target only on matching DOWN/UP. Tracking loss, stale evidence, target/revision/geometry changes and occlusion abstain. No synthetic edges or DOM clicks. Main-app physical accuracy/selection is pending. `/gaze-experiment` remains diagnostic only. Pinned RealEye 1.1.0 and MediaPipe 0.10.18 and all notices remain.

`npm run prepare:gaze` builds the classic worker and copies both WASM variants/loaders and license notices. Its versioned Face Landmarker model is verified against SHA-256 `64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff`. A clean build downloads this public asset when absent; runtime CDN requests are unnecessary. Public-directory copying is disabled and required gaze files are explicitly emitted and integrity-checked. Private caches, reports, credentials and camera data are not artifacts.

Public builds emit the exact source revision in `/release-info.html` and `/release-info.json`, root AGPL text, third-party notices, React/React DOM/Scheduler MIT texts and the complete gaze dependency notices. Main and experiment links expose these to users. Publish and independently verify the exact corresponding source commit. `publicationVerified: false` means the build does not itself verify GitHub availability. Missing/conflicting revisions or known dirty trees block Vercel builds; semantically identical Vercel JSON reformatting is the sole harmless builder exception.

## Build, verification and rollback profiles

Use the existing Node 24.22.1 / npm 11.19.1 without changing global defaults:

```sh
npm ci
npm test
npm run typecheck
npm run build:public-demo
npm run preview:public-demo
```

The static public-profile preview uses port 4175 and matching headers but does **not** emulate Vercel Functions; live API verification requires the actual serverless deployment. `build:gaze-demo` / `preview:gaze-demo` retain the cloud-disabled camera-enabled profile on 4174. `build:demo` / `preview:demo` retain the camera-free, cloud-disabled frontend on 4173. The full local `build` / `dev` / `api` commands remain. All builds replace `dist`; inspect release metadata to avoid deploying the wrong profile. Previous approved production deployments remain the rollback target, not an unverified local artifact.

Before publication, run all tests, typecheck, production build, dependency/credential scans and a clean tracked-source build. Targeted tests already exercised real local Redis Lua atomicity, concurrency, replay, budgets and revocation; they did not contact production providers. New code still needs combined review and final checks.

After deploying the exact reviewed commit, verify READY plus anonymous HTTPS, matching source metadata, license/model/WASM responses and security headers. Verify denied cloud access, code authentication, server-side logout, one actual fictional Gemini result, one separately authorized ElevenLabs response and one consented Scribe transcription. Distinguish generated audio bytes from owner-confirmed audibility. Check real camera activation/cleanup, switch-only recovery and silent Review/separate speech authorization. Record actual results and failures; do not substitute mocks for provider or physical acceptance.

Chrome camera/Web Serial permissions belong to each origin, so localhost permission or earlier hardware acceptance is not a public-origin pass. Devpost remains a separate owner-controlled submission step; source publication and deployment do not submit the entry. Protect the November 15, 8:00 AM Eastern cutoff and stop unrelated development.

The public build explicitly compiles the server dependency graph with `tsconfig.api.json` into ignored `.api-build/` output. The JavaScript Vercel entry imports the emitted ESM handler; this avoids missing `.mjs` dependencies from automatic TypeScript entry conversion. The emitted handler is smoke-tested separately from source tests.

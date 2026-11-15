# HP26-SMV-INTENT-01 — matched route comparison

November 14, 2026. **Automated model traversal with scripted fictional responses**, not a physical-switch study, measured typing speed, live Gemini evaluation, or clinical result.

The six matched tasks required 437 modeled deliberate selections through full spelling and 307 through keyword entry, expansion and approval. These are counts of valid application choices, each intended to require one complete physical press/release in the working application. No physical events were performed by this script. Fewer choices alone do not demonstrate shorter completion time or better usability.

## Reproduce

From this external repository, using the already installed Node 24:

```sh
'/Users/admin/.nvm/versions/node/v24.22.1/bin/node' scripts/measure-intent.mts
```

Add `--trace` for every selected action, screen, phase and scan-advance count. The script uses the real communication model and its enabled `inputView()` targets. Every request and response must pass the real server request validator, candidate validator and deterministic clarification path unchanged. It asserts exact keyboard entry, no authorization before final Speak, preservation of the keywords when a response arrives, and identical full authorized text in both conditions. It neither opens hardware nor calls Gemini/TTS nor plays audio. It emits JSON to stdout and does not write files.

Measured model SHA-256: `bb4c9c15f50fab8da07eb739a388654e563d1d36c7d6c2e36365b56a754a6138`. This is a working-tree measurement; the script prints the current hash so changes can be detected and rerun.

Measured server validator SHA-256: `56e738ab18da8fcfea3c2b65c4cce934ef06917ec885121b01cff879b22c5bb5`. The script prints this hash as well. Fixtures include authored “please” and explicit personal pronouns wherever the validator requires them; these extra keyword-entry actions are included, not assumed away.

## Conditions and accounting

- **Full spelling:** empty draft → Spell → exact complete sentence using the existing fixed letter groups, uppercase and punctuation controls → Done → Review → fresh Speak. AI is disabled, so its disabled targets do not inflate scanning counts.
- **Assisted:** empty draft → Spell → stated lowercase keywords using the same fixed letter groups → Expand directly from the keyboard → clarification when necessary → Review this wording → fresh Speak. Cloud-demo readiness is assumed; the result is an explicit fixture, not a live model success.
- Both use General context, the same prepared system voice, 100% text size and the same exact final sentence, including capitalization and punctuation. No preloaded draft, phrase shortcut or autocomplete is used in either main condition.
- Each selected action increments the selection count. Its index in the model's current target order increments scan advances. This assumes the configured initial target after each fresh view and no missed targets; it is an ideal route, not an observed scan trace.
- All six final sentences fit one review page at this setting. Reading/recognizing the full message takes unmeasured time. The final Speak selection remains separate in every case.
- Device setup, permission, consent, voice setup, Resume, physical hold duration, reading, synchronization, misses, transport, provider latency and playback are not timed or silently counted as zero. The JSON uses `null` for unavailable measurements.

## Exact matched tasks

| Task | Exact target in both conditions | Assisted keywords |
| --- | --- | --- |
| Comfort | Please reposition me. | please reposition me |
| Longer care statement | My belly hurts, and I feel weak today. | belly hurts weak today |
| Clarification request | Please repeat the last question. | please repeat last question |
| Education/work | I need more time to finish my assignment. | i need more time finish my assignment |
| Negation | I do not want to be repositioned. | do not want repositioned |
| Ambiguous cues | My belly hurts daily, and I feel weak. | belly weak daily hurt |

For the last task, the first response asks **Which happens daily?** The route deliberately selects **Belly pain** and only then receives the exact target. The baseline already spells that same intended meaning. The clarification is included in the assisted count. Both responses come from the server's local audited ambiguity template, so this case involves two application responses and **zero Gemini generations**. It does not establish that Gemini detects other ambiguities reliably.

## Executed counts

| Task | Full-spelling selections | Assisted selections | Full-spelling scan advances | Assisted scan advances | Clarification selections | Expansion responses |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Comfort | 49 | 42 | 161 | 151 | 0 | 1 |
| Longer care statement | 83 | 45 | 221 | 114 | 0 | 1 |
| Clarification request | 69 | 55 | 211 | 167 | 0 | 1 |
| Education/work | 84 | 72 | 253 | 223 | 0 | 1 |
| Negation | 69 | 49 | 212 | 155 | 0 | 1 |
| Ambiguous cues | 83 | 44 | 199 | 87 | 1 | 2 |
| **Total** | **437** | **307** | **1,257** | **897** | **1** | **7** |

The assisted composition portions require 39, 42, 52, 69, 46 and 40 selections respectively. Each also includes one deliberate Expand, one Review-this-wording acceptance and one fresh Speak; the last includes the additional clarification. Full spelling includes all actual capital/punctuation and exit/review actions. No whole scanning-loop count or elapsed time is inferred from these target advances. The seven responses comprise five scripted Gemini-style fixtures and two actual local deterministic-template responses; no network request is made.

**Existing phrases can be much cheaper:** the already available “Please reposition me.” quick phrase → Review → Speak takes **4 selections and 2 scan advances**. The main comparison specifically evaluates full spelling, as requested; it does not establish that expansion beats SMV's best existing route for every message. High-value saved phrases should remain available.

## Optional context and rejection costs

The main table has no context-setup cost because both conditions use General. From the empty compose view, choosing another context takes:

| Optional retained context | Additional selections | Additional scan advances |
| --- | ---: | ---: |
| Home | 2 | 2 |
| Healthcare | 2 | 3 |
| Community | 2 | 4 |
| Education & Work | 2 | 5 |

If the same context is retained for `N` messages, its selection cost can be allocated as `2/N` per message for analytical accounting. This is not a measured behavior or timing benefit. Context remains optional and is not a source of personal facts.

The script also executes a separate rejection sensitivity case: comfort keywords receive “please reposition me.” This preserves meaning and passes the validator, but its capitalization differs from the specified exact target. The route deliberately chooses Try another before acceptance. Receiving and approving the correctly capitalized second fixture takes **43 selections and 154 advances**, versus 42 and 151 with the first accepted candidate: **one extra selection, three extra advances and one extra simulated request**. Reading and provider delay remain additional unknown costs. This is a deliberately constructed stylistic rejection, not an observed Gemini error rate. Added urgency such as “now” would be rejected by the server rather than presented as a candidate.

Main fixture routes have zero spelling corrections and zero rejected candidates; one clarification is counted separately. All exact-text and no-premature-authorization assertions passed. Meaning-error rate, unintended audible speech, actual completion time, final-approval-to-audio time and provider latency are **unmeasured**. The fixtures are constructed to have the specified outcomes, so their success cannot estimate model reliability or how often real users would reject wording.

## Evidence boundaries and next measurement

- **Analytical:** assumptions about fresh target starts, no missed scans, optional context amortization and unmeasured reading/setup overhead.
- **Executed automated simulation:** six model routes per condition, optional context routes, the existing phrase alternative and one rejection route. The script checks final exact text and absence of early speech authorization. It does not test the physical reducer or audio stack.
- **Developer browser/live provider:** no evidence generated by this script; keep separate from these counts.
- **Owner physical:** previously reported successful phrase/edited-message speech remains valid for those exercised flows. It is not a measured six-task intent-expansion comparison.
- **Actual AAC-user evaluation:** none performed here. No claims of clinical benefit, accessibility conformance, speed, confidence or frustration reduction follow from this comparison.

For a physical comparison, use these exact fictional goals in both conditions, hold pace/voice/input settings constant, record deliberate cycles and missed targets from existing instrumentation, and record composition, approval, audible onset, clarification, rejection and recovery separately. Alternate condition order to reduce practice bias. Stop on unintended selection or speech. Record failures and unfinished tasks rather than dropping them. Do not retain private authored messages or recordings.

## Related work

Keyword/abbreviation expansion for AAC is established prior work. Cai and colleagues' **SpeakFaster** combines abbreviated text, language models and context for eye-gaze text entry, and reports offline and participant evaluations. SMV's bounded single-switch route count here is a different, much narrower evaluation and does not reproduce those findings or claim invention of the expansion idea. [Cai et al., *Nature Communications* 15, 9449 (2024)](https://www.nature.com/articles/s41467-024-53873-3).

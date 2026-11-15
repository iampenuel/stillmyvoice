# ACCESS-02 — visible alphabet evaluation

November 14, 2026. The owner requested visible letters to reduce the need to translate a desired letter into a range label. That is a design hypothesis to evaluate, not a demonstrated cognitive or speed benefit.

The experimental presentation keeps all A–Z letters visible and preserves the five existing alphabetical groups, their identities and the accepted row-then-letter interaction. It does not adopt a frequency keyboard or QWERTY. Each letter still requires a fresh row selection and a separate fresh letter selection. The prior range presentation remains a reversible fallback. Root/browser acceptance records separately establish whether the rendered grid fits and remains readable.

## Bounded research and resulting choices

- **Individual feature matching:** ASHA describes scanning as indirect selection and identifies rows, columns and quadrants as possible presentation groups. Its guidance emphasizes matching features to individual strengths, needs and preferences. This supports a reversible visible experiment, not a universal keyboard prescription. [ASHA AAC Practice Portal](https://www.asha.org/practice-portal/professional-issues/augmentative-and-alternative-communication/).
- **Model scan cost explicitly:** Venkatagiri's 1999 study compared eight keyboard arrangements using simulated utterances and a program calculating timing and keystrokes. Its results depend on those layouts and assumptions. Use matched messages and actual target paths here; do not transfer its numerical advantages to SMV or treat simulated results as participant measurements. [Efficient keyboard layouts for sequential access](https://www.tandfonline.com/doi/abs/10.1080/07434619912331278625).
- **Measure errors as well as ideal cost:** Scanning Wizard examines switch timing, scan settings and errors, and uses comparable test sentences. Its evaluation distinguishes selection errors from missed or early/late scanning actions and emphasizes configuration for the individual. SMV therefore reports ideal advances separately from physical timings, corrections and missed targets. No study improvement is claimed for SMV. [Scanning Wizard evaluation](https://pmc.ncbi.nlm.nih.gov/articles/PMC5967995/).
- **Alphabetical is not universally superior:** Gormley and Fager's participants preferred QWERTY and had substantial prior familiarity with it; processing-demand findings differed by participant group. Alphabetical remains this owner's requested experimental default, while familiarity and individual preference must be evaluated. [Keyboard preference and visual-cognitive processing](https://pubmed.ncbi.nlm.nih.gov/32955379/).
- **Make group entry and exit clear:** Apple's Switch Control documentation describes highlighted groups, selecting within a group, and explicitly leaving a group. It provides an interaction reference for visible row/letter stages and a dependable exit. SMV does not copy its activation semantics or alter the accepted physical press/release contract. [Apple Switch Control](https://support.apple.com/en-my/guide/mac-help/mh43607/mac).

These are bounded design implications from primary/official sources. They do not establish clinical efficacy, accessibility conformance, a preferred layout for all AAC users, or a validated reduction in cognitive load.

## Reproduction and measurement scope

```sh
'/Users/admin/.nvm/versions/node/v24.22.1/bin/node' scripts/measure-visible-keyboard.mts
```

Add `--trace` to inspect every selection and scan advance. The script loads the exact accepted range model from Git checkpoint `18b92a6`, compares it with the current default visible model, and prints both SHA-256 values. Its unique temporary baseline module is removed after import. The script makes no hardware, microphone, browser, network or speech call.

Both routes start with an empty draft and disabled cloud assistance. They enter the identical lowercase fictional text and include Spell, every row/letter/Space choice and Done. No phrase shortcut, AI expansion or preloaded draft is used. Review and speech are outside this spelling-only comparison.

A selection count is an executed model choice, representing an expected complete physical cycle in the application; it is not an observed physical event. An ideal scan advance is the target index from the model's configured starting target after each fresh view, assuming no missed scans. Both exact final text and absence of speech authorization are asserted.

## Executed results

Executed with the installed Node 24. All five exact-text pairs, trace totals and no-speech-authorization assertions passed.

| Fictional exact text | Accepted range choices | Visible choices | Accepted range scan advances | Visible scan advances |
| --- | ---: | ---: | ---: | ---: |
| help | 10 | 10 | 23 | 26 |
| headache | 18 | 18 | 42 | 48 |
| belly weak today | 32 | 32 | 80 | 89 |
| please do not move | 35 | 35 | 105 | 117 |
| please reposition me | 40 | 40 | 141 | 165 |
| **Total** | **135** | **135** | **391** | **445** |

Accepted range model SHA-256: `0efc072e9dbb6d98bec92e389ee33374f130ce63c3a6a520576d33ac6e1fd042`.

Measured experimental model SHA-256: `b13b6eacb270de1e34ff69e09defb0bebba88f6036040b57e803803387740013`. Rerun when this model changes; these are counts for this exact implementation, not a fixed property of row-column keyboards.

**There is no modeled selection reduction. Ideal scan advances increase in this implementation.** Letter groups and row/letter cycles are unchanged, while the newly reachable mode toggle, Review and Back add targets that scanning crosses when wrapping from a later group to an earlier one. For example, entering the next early-group letter after a later-group letter traverses these additional controls. This cost comes from navigation target order, not from drawing the letters themselves.

The smallest future adjustment is to evaluate placement of secondary controls, especially the layout toggle, within the existing Editing route while preserving a dependable exit and accessible Review. Do not change the accepted letter-selection contract or claim the grid is faster merely because letters are easier to discover. No such optimization is silently included in these results.

## Physical evidence still needed

Entry time, observed switch cycles, wrong selections, corrections and recovery actions remain unmeasured for this matched comparison. The script reports them as `null`, not zero. Earlier owner success belongs to the earlier exercised communication flow and does not validate this keyboard presentation.

Use the five identical fictional texts in both modes with the same scan pace, voice and starting state. Record the full attempt, including errors, missed rows/letters, correction actions and interruptions; alternate mode order where possible. Do not discard unfinished attempts. Check visible row and letter highlights, all letters, Space, Backspace, Expand, Review and a switch-accessible exit. Reading and search effort require owner observation, not inference from a model counter. Stop if unintended input or speech occurs.

If counts or readability worsen, adjust the smallest relevant spacing, target order or exit issue before broader redesign. Keep the accepted mode available. Gaze is outside this evaluation.

# Keyboard return policy — bounded evaluation

November 14, 2026. **Recommendation: retain the current return-to-groups behavior for this checkpoint.** Preserve the alphabetical groups. A simple “stay in the letter group” change reduces choices only when consecutive letters share a group, while making different-group letters, Space and Done require an additional Back-to-rows action. On the requested fictional keyword sequence it increases modeled choices from **43 to 50** and ideal scan advances from **107 to 169**. This is an engineering comparison, not physical usability evidence.

No application, physical-input reducer, firmware or keyboard behavior was changed. Intent-first acceptance remains the immediate priority.

## Reproduce and assumptions

```sh
'/Users/admin/.nvm/versions/node/v24.22.1/bin/node' scripts/measure-keyboard.mts
```

Add `--trace` for each action and counted scan advance. The script reads the actual model and enabled target order. It asserts exact draft text, return to Compose and no speech authorization. Model SHA-256 at measurement: `0efc072e9dbb6d98bec92e389ee33374f130ce63c3a6a520576d33ac6e1fd042`. Counts were rerun after the bounded overview change that puts Editing in navigation; with AI disabled equally, the enabled keyboard order and these counts remain unchanged.

Both conditions begin with an empty draft, AI disabled, and use the same fixed groups A–E, F–J, K–O, P–T, U–Z. Counts include selecting Spell and finishing with Done, plus all necessary group, letter, Back-to-rows and Space actions. They exclude shared setup, Resume, review and speech. Each selected model choice represents an expected deliberate full switch cycle; no physical cycles or elapsed times were observed.

- **Current:** actual model behavior; each letter returns to the group grid and scanning starts from the previously used group.
- **Stay in group, hypothetical:** after the actual model accepts a letter, only the script's local state is overridden to retain that letter group. Its next fresh scan starts at the first letter. Existing Back to rows remains at the end of the group and resets to the first group. Leaving for another group, Space or Done uses that existing control. The application is not modified.
- Scan advances are the chosen target's index from each fresh scan start, assuming no missed targets. Neither physical press duration nor reading/navigation effort is converted into an invented completion time.

The alternative deliberately evaluates the smallest stay-in-group policy using existing controls. Adding local Space/Done, changing Back position, or restarting at a different letter would be separate designs with different counts and would need their own evaluation; these results do not settle all possible keyboards.

## Executed model counts

| Fictional text | Current choices | Stay-in-group choices | Current scan advances | Stay-in-group scan advances |
| --- | ---: | ---: | ---: | ---: |
| bed | 8 | 7 | 15 | 20 |
| feed | 10 | 10 | 27 | 29 |
| school | 14 | 16 | 32 | 49 |
| book | 10 | 10 | 16 | 28 |
| help | 10 | 14 | 23 | 40 |
| please | 14 | 18 | 46 | 52 |
| reposition | 22 | 30 | 73 | 100 |
| need | 10 | 10 | 30 | 33 |
| not | 8 | 9 | 18 | 33 |
| belly hurts weak today | 43 | 50 | 107 | 169 |

These examples cover within-group runs (`bed`), repeated letters (`school`, `book`), group changes (`help`), and the requested multiword sequence. They are a small chosen set, not a frequency-weighted language corpus or representative participant sample; no population-wide percentage is inferred.

`bed` illustrates the tradeoff: staying saves one choice but adds five ideal scan advances because the existing exit is after all five letters. `help` changes group for every letter and adds four choices. For longer mixed text, the extra exits can outweigh saved repeated group entry. A lower choice count alone therefore cannot establish that a policy is faster.

## Decision boundary

Keep the accepted default and stable letter positions now. If a later owner-approved experiment evaluates persistent letter groups, specify the next scan start and exit/Space/Done positions first, then compare exact matched phrases with real switch counts, missed targets, errors, completion time and owner preference. Retain the separate fresh selection for each letter and final speech approval; never infer a held-button repeat or let scrolling change a captured target.

Executed evidence consists of deterministic current routes and script-only hypothetical routes, with exact-text assertions. No browser, provider, owner physical or AAC-user test was performed for this comparison; no clinical or accessibility-conformance claim follows.

## Bounded layout checkpoint

The normal alphabet overview now places A–E, F–J, K–O, P–T, U–Z and Expand my words in three stable two-column rows. Editing, Done, Space and Backspace remain in a separate two-by-two navigation area. Existing target IDs, return-to-groups behavior, final speech approval and input reducer are unchanged. Editing retains punctuation, Undo and review navigation; no QWERTY or dynamic letter ordering was introduced.

Desktop-only compact typography/spacing applies to the ordinary overview and letter groups. At the supported 1024×672 boundary, measured right-panel content height is 339px and scroll height is also 339px: all ten overview controls fit without scrolling; the six-letter U–Z group and Back to rows also fit. At 1440×756 the overview fits with unchanged outer panel proportions. Expand remains in the sixth stable tile even when disabled because keywords or cloud consent are missing. Text-size scaling, narrower windows and 200% zoom retain the existing reflow; compact rules do not apply at mobile/zoomed CSS widths or large-text mode.

Developer screenshots: `local-reports/KEYBOARD_OVERVIEW.jpg`, `KEYBOARD_COMPACT.jpg`, `KEYBOARD_LETTERS_COMPACT.jpg`. These were inspected. No physical keyboard speed or cognitive-load claim follows. Final regression and owner acceptance status are recorded in the intent checkpoint report.

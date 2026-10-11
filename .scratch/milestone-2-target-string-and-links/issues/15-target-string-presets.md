# 15 Target string presets with verified seeds

Status: resolved
Type: task (test-first)
Blocked by: 08, 10
Spec: ../spec.md

## What to build

- Preset files gain a `problem` field (and the four Goldberg presets are given `"problem": "goldberg"`); the preset menu shows only the current problem's presets, and choosing a preset of another problem switches the problem through the restart notice.
- Three target string presets, as plain data files:
  1. **Evolve a word**: the defaults, converging.
  2. **No mutation**: a seed where a letter missing from the initial population can never appear, so the run stalls short of the target.
  3. **Mutation too high**: a seed where the population never settles. Describe it as failing only if a verified seed fails; otherwise claim only what the seed shows.
- Seeds are found by search and each description is verified by a test, as in milestone 1's ticket 21.

## Done when

- A test per preset asserts exactly what its description says for its seed (for example, no mutation: the missing letter's match rate stays 0 for the whole run and the best fitness stalls at a stated value).
- Playwright: loading each preset through the menu shows its description and behaves as stated; the Goldberg presets are unchanged.
- Adding a preset is still only a new file.

## Comments

## Answer

Preset files now carry their problem and options, and there are three target string presets, each description verified against its seed.

- **Format:** the Goldberg files already had `"problem": "goldberg"` (done in ticket 03). The loader now reads the problem from the file, requires valid `options` for a problem that has them (and refuses them for one that has none), and builds the engine problem from them. Adding a preset is still only a new file in `src/ui/presets/`.
- **Menu:** the drawer lists only the running problem's presets. `session.requestPreset(preset)` does the loading: a preset of another problem switches the problem through the same restart notice ("Loading the preset “…” switches to the problem Target string and restarts…"). The drawer cannot offer another problem's preset (the menu is filtered, as the spec says), so that path is tested at the session level, not by clicking.
- **Seeds, found by search (seeds 1–40 for the stall, pm 0.2–0.6 × seeds 1–8 for the failing run):**
  1. **Evolve a word** (the defaults, seed 42): HELLO first appears in generation 65; average 0.42 matches at the start, diversity 0.97 falling to 0.39.
  2. **No mutation** (seed 9): no starting string has an O in position 5, so that position's match rate is 0% in every generation; the population is copies of one string from generation 22 (diversity 0, one distinct string; 2 in generation 21); the best stalls at 3 of 5 (reached in generation 4). Over seeds 1–40 the best never exceeded 3, so "short of HELLO" is typical, not lucky.
  3. **Mutation too high** (pm = 0.5 per gene, seed 3): the best of a generation is below the best so far in 93 of 100 generations; the best so far reaches 3 of 5 in generation 8 and never improves; HELLO is not found; diversity never drops below 0.83. At pm = 0.5 no seed from 1–8 reached 5 of 5 in 100 generations.
- **Something worth knowing:** with the default stop criteria (stagnation window 15), "Run until stop" pauses *Evolve a word* at generation 20 with "no improvement for a while", although HELLO is found 45 generations later. It is only a report and Run again carries on, and the description of the preset now says so. If you would rather the string defaults did not pause that early, the stagnation window for the string problem is the setting to raise (a decision for you, not changed).
- **Tests:** `presets.test.ts` has a test per preset asserting exactly what its text says (the generations, the match rate of position 5 in every generation, no mutation event in any, diversity, best so far), one that the preset text contains the numbers it relies on, one that Evolve a word equals the problem's defaults, plus loader tests (options required, refused, validated). `session-history.test.ts` covers loading a preset of the same and of another problem (notice wording, options, seed, preset name, share link). `e2e/string-presets.spec.ts`: the menu with lesson and look-for text, each preset loaded through the menu and compared with the engine (Evolve a word: pause at 20, HELLO at 65; No mutation: position 5 at 0% for 23 generations, one distinct string at 22, mutation stage all bypasses; Mutation too high: 30 generations equal to the engine, pm 0.5 in the drawer), and the Goldberg presets unchanged.

State: 1000 unit tests, `npm run check` clean, 138 Playwright tests passing.

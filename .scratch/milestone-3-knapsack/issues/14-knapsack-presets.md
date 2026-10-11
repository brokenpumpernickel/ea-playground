# 14 Presets with verified seeds

Status: resolved
Type: task (test-first)
Blocked by: 12, 13
Spec: ../spec.md

## What to build

The five presets of the spec (Evolve a bag, Penalty too small, Penalty too large, Repair: Lamarckian, Repair: Baldwinian), found by search and each verified by a test that asserts exactly what its text says. Penalty too large is dropped, or its text reduced to what a verified seed shows, if no seed demonstrates it. The Lamarckian and Baldwinian presets share instance, seed and parameters, and state only measured differences. Presets carry the instance and the handling as options; the preset menu shows the running problem's presets.

## Done when

- A test per preset asserts its claims for its seed (the cheating bag under a too-small ρ and the reference line exceeded; the run settling on a poor feasible bag; the stated difference between the repairs).
- Playwright: loading each preset through the menu shows its description and behaves as stated; the other problems' presets are unchanged. Adding a preset is still only a new file.

## Comments

## Answer

Five preset files (`src/ui/presets/8-bag-evolve.json`, `9-bag-penalty-too-small.json`, `a-bag-penalty-too-large.json`, `b-bag-repair-lamarckian.json`, `c-bag-repair-baldwinian.json`; the prefixes `8`, `9`, `a`, `b`, `c` keep them in order, since files sort by name), each found by search over seeds 1–200 and each claim in its text asserted by a test (`presets-knapsack.test.ts`, 17 tests) and checked in the browser (`e2e/knapsack-presets.spec.ts`, 6 tests):
1. **Evolve a bag** (the defaults, seed 42): the optimum bag B, C, D, F, G, H, K worth 123 is first found in generation 26, after a longest stretch of 13 generations without improvement; nothing pauses the run before; the decoder never rewrites a chromosome; 191 of 200 seeds find the optimum within 100 generations.
2. **Penalty too small** (ρ = 1, seed 35): the best fitness reaches 135, above the optimum 123; the best bag that fits never reaches 123 and ends at 122; from generation 92 every bag in the population is overweight; the best bag at generation 100 weighs 67, is worth 154 and scores 135; "target reached" never fires.
3. **Penalty too large** (ρ = 50, seed 9). As I told you, a large penalty does not stop the search on this instance, so the text claims only what holds: after 100 generations the best bag that fits is worth 116 and 6 of 8 bags fit; the same seed finds 123 in generation 33 with ρ = 8 and in generation 13 with ρ = 3; over seeds 1–100 ρ = 50 finds 123 in 58 runs and ρ = 3 in 86; every ρ = 50 run still ends with a feasible bag worth at least 112, so "slows the search down but does not stop it". The lesson sentence says the same ("fewer runs find the optimum").
4. **Repair: Lamarckian** and 5. **Repair: Baldwinian** (same instance, seed 19, parameters and ρ, differing only in the method): Lamarckian finds the optimum in generation 25, Baldwinian in generation 5; in generation 10 none of the 8 Lamarckian chromosomes carries more genes than fit (checked in every generation 0–100) while all 8 Baldwinian ones do; the Lamarckian run really rewrote chromosomes (✂) and the Baldwinian never; over seeds 1–100 Lamarckian finds 123 in 96 runs (median generation 15) and Baldwinian in all 100 (median 11). Seed 19 was chosen because its order matches those statistics; I avoided seeds where the order is the opposite, which would mislead.

The browser tests load each preset through the drawer's menu and check the description text, the seed, the engine's population, the generation where "Run until stop" lands (26, 25 and 5), the plot's lines (best fitness 135 against the 123 line, best feasible 122 and 116), the feasible counts and the ✕ marks (none for Lamarckian, on every row for Baldwinian). The other problems' presets are unchanged and each problem's menu lists only its own.

**A bug found on the way, fixed (it dates from milestone 1):** after "Run until stop" had reported a criterion, loading another preset or restarting and pressing it again did *not* stop for the same criterion, because the playback still remembered it as reported for the old run (the second run stopped at generation 55 for stagnation instead of 5 for the target). Playback now has `forgetReports()`, which the session calls on every restart, new seed and configuration change (tests in `playback.test.ts` and `session.test.ts`, the session one failing first with 20 against 10).

Also updated: `string-link.spec.ts` and `run-config-strings.test.ts` now count the five knapsack presets and round-trip the default configuration of every problem.

State: 1230 unit tests, `npm run check` clean, 230 Playwright tests passing.

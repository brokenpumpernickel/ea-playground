# 16 Share links for the target string

Status: resolved
Type: task (test-first)
Blocked by: 04, 14, 15
Spec: ../spec.md

## What to build

Extend the link tests and codec to the new problem: the problem's options (alphabet, target) are part of the configuration, validated by the same rules as the drawer. Cover every preset of both problems, generated string configurations (large alphabets, a space, a 24-letter target, hand-edited string populations) and the new bad-link cases (a target character outside the alphabet, a duplicate symbol, a target that is too long).

## Done when

- Round-trip and run-equality tests for every preset and generated configurations.
- Bad-link cases each give a readable message; a Playwright scenario copies a target-string link and opens it in a fresh page.

## Comments

## Answer

The codec already carried the problem and its options (ticket 03), validated by the same rules as the drawer; this ticket tested it hard on the string problem, and the generated tests found a real gap that is now fixed.

**A bug found and fixed.** A one-letter target with one-point crossover (or a two-letter one with two-point) is accepted by the target string rules, but the engine refuses to cut a chromosome that short, so the first generation threw. The drawer and links now check it (`validate` has a `crossover.operator` error: "One-point crossover needs chromosomes of at least 2 genes, but this problem's have 1. Choose another crossover type, switch crossover off or make the target longer."). In the drawer it sits under the crossover Type, blocks the restart, and the help beside the button points to it; the type select also refuses to apply an operator that does not fit. Uniform crossover, a switched-off crossover and longer targets are unaffected.

**Tests**
- `run-config-strings.test.ts` (13): the link carries problem and options as readable text; round trip and run equality (populations, events, metrics) for every preset of both problems, each with its own problem and options (the old preset round-trip test passed no problem; fixed); the extremes (a 40-symbol alphabet, a 24-letter target, a one-letter target, a space-heavy target, accented letters, emoji); hand-edited string populations with spaces; 200 generated configurations (alphabets of 2–40 symbols, targets of 1–24, every selection method and operator, mode, truncation and stop setting, random and hand-edited populations; run equality on every tenth); and the bad-link cases, each with the drawer's own words: target letter outside the alphabet (with position), repeated symbol (a space is "a space"), target too long, alphabet too long or too short, empty target, missing, mis-shaped or extra options, hand-edited strings of the wrong length or alphabet, and a crossover operator that does not fit. Several problems come together; a good part never survives a bad one. (Options are checked with the structure, so a bad option and a bad probability in one link report the option first; the probability is reported once the structure is sound.)
- `drawer-string.test.ts` gained the operator/length cases, including a test that the engine really does throw.
- `e2e/string-link.spec.ts` (11): the link of every one of the seven presets opens in a fresh page as the same run, equal to the engine for three generations, with the address cleared and no notice; the three bad-option links plus a too-short alphabet open the default with the readable message and none of the bad link's seed; the one-point/one-letter case in a link and in the drawer (error under Type, restart blocked, another type clears it and the run goes on); and a link with accents, emoji and spaces that opens and plays. Copy link then open in a fresh page was already covered by `string-setup.spec.ts` and `problem.spec.ts`.

State: 1015 unit tests, `npm run check` clean, 149 Playwright tests passing.

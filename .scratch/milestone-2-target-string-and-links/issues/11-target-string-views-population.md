# 11 Target string views: population, evaluation, replacement

Status: resolved
Type: task
Blocked by: 01, 08, 09, 10
Spec: ../spec.md

## What to build

Per the mock's chosen design:

- Letter cells in the population table with matching and mismatching positions marked without relying on colour, the matches column ("7 of 11") and fitness, selection weight and probability as before.
- The evaluation view (offspring with matches and fitness) and the replacement view (old population, offspring, next population, elites, truncation discards) with letters and the same match marks.
- The selection views (weight table, wheel, tournaments), mating pool and pairing views work with letters unchanged apart from the cells.
- Descriptions and narration say "matches", not "x".

## Done when

- Playwright against the engine's events for a seeded target-string run: the population table, evaluation rows and replacement lists show exactly the engine's chromosomes, match counts and fitness at every micro-step; a switched-off or truncating configuration still reads correctly.
- Unit tests for the view models with letters (including a space and repeated letters).

## Comments

## Answer

The population, evaluation, replacement, selection, pairing and tournament views now read correctly for the target string, with marking B (the instructor's choice):

- **Marks**: `Bits` compares each cell with the target from a screen-wide context (`target-context.ts`, set once in the app from the running problem; Goldberg has none, so nothing is compared there). Matching positions are filled with a heavy baseline, mismatching ones have a dashed outline; the accessible description says "3 of 5 positions match the target" and the cell group carries `data-matches`. Hatching, cut lines and flip marks combine with the match marks. Explicit `marks` still win.
- **Target row** (`TargetRow.svelte`): the target printed once, with its letters directly over the cell columns (the "target" label hangs to the left so alignment is exact, checked to within 2 px in the browser), in the population table header, the evaluation table header, and above each of the three replacement lists. A space is `␣` everywhere.
- **Sentences** say matches, not x: a problem can declare `scoreText` and `evaluationExplanation`; the target string says "4 of 5 positions match" and "Each finished offspring is compared with the target position by position: the objective is how many positions match, and fitness is the same number." ("Individual 1 (HELLO): 5 of 5 positions match, fitness 5"; "Offspring 2: HZHLO → 3 of 5 positions match → fitness 3 (individual 62)".) Goldberg's sentences are unchanged. The pairing view prints no decoded value for a string.

Evidence: 8 unit tests (`target-marks.test.ts`: match and miss classes, counts in words and data, a space compared and drawn as ␣, hatching and flip marks together with match marks, no comparison without a target, explicit marks winning, the target row) and `e2e/string-views.spec.ts` (6) against the engine's own events for the seeded default run: the population table at generations 1 to 4 and inside the next generation (strings, "n of 5", filled cells = matches, dashed = the rest); the target row aligned with the cells; evaluation one offspring at a time (string, match count, fitness, narration); replacement with no elites and with 2 elites and truncation (λ = 14): next population ids and strings, elites, survivors and discards equal the engine's, the target row above each list, every cell's match count equal to a direct count; selection, pairing and tournament cells; and the narration saying matches, never x. All 958 unit tests, `npm run check` and 112 Playwright tests pass; Goldberg's screens are unchanged (the earlier pixel comparison still applies, and the Goldberg Playwright suite passes untouched).

Not in this ticket: the crossover cards and the mutation view for letters (ticket 12), which also get the target row.

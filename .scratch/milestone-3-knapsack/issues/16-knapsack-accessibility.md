# 16 Accessibility and projector pass for the knapsack

Status: resolved
Type: task
Blocked by: 09, 10, 11, 12
Spec: ../spec.md

## What to build

Apply the pass of milestones 1 and 2 to the new views: names and sentences for chromosomes (the bag, the dropped and skipped items, weight against capacity), real tables, the colour-only audit extended with the new meanings (feasible, infeasible, overflow, skipped, dropped, the feasible line), keyboard-only operation of a full generation, no control without a name with the menu and drawer open, reduced motion, and no overflow in projector mode at 1920×1080 and 1366×768 for every stage, the drawer and the menu, including a 20-item instance. Capture screenshots for ticket 17.

## Done when

- The audit list is extended in this file with each colour-coded meaning and its non-colour carrier.
- Playwright: keyboard-only generation, the accessibility-tree check, reduced motion, no overflow at both sizes with the default and a 20-item instance.
- Screenshots at 1920×1080 (projector mode) and 1366×768 are under `.scratch/milestone-3-knapsack/screenshots/`.

## Comments

## Answer

Everything in "Done when" is in `e2e/knapsack-a11y.spec.ts` (18 tests, all passing) plus 28 screenshots.

### What the pass found and fixed

The tests failed first on layout, not on names: with 12 items the mutation cards, the selection columns and the evaluation table overflowed at 1366×768, and with 20 items nearly everything did. Fixes (all in the views, none in the engine):

- Mutation view: with more than 8 genes (or several symbols) the draws sit under each gene in one card per child instead of beside it (`underEach`).
- Population table: Weight/Prob. columns only when roulette weights exist; parent count inline; `tight` mode (no bars, no optional Value column) when selection columns show or there are more than 14 items; `dense` 18 px cells above 14 items.
- Replacement and pairing views: two columns for long chromosomes; item row and bits share one column grid.
- Summary line keeps its separator as a real text node (`feasible 8 of 8` was running into the previous figure).

### Names and sentences

- Each chromosome has an accessible name from its bag: items in it, weight against capacity, and which genes are 1 but not in the bag (and which Lamarckian repair rewrote to 0).
- The item row is one `role="img"` sentence ("Item A weighs 9 and is worth 4; …"); its cells are `aria-hidden`.
- All population, parents, offspring, replacement and mutation tables are real tables with named columns, for all four methods.

### Colour-only audit, extended

| Meaning | Colour | Carried also by |
|---|---|---|
| Feasible bag | green meter / text | `✓` and "47/48" in the Bag weight cell |
| Over capacity | red meter | `✗ +n` (n = excess), hatched overflow past the capacity mark in the bars |
| Gene is 1, item not in the bag (decoder, Baldwinian) | muted cell | `✕` in a dashed plain cell |
| Gene Lamarckian repair rewrote to 0 | orange outline | `✂`, dotted outline, `data-dropped`, named in the aria-label and the "What happened" column |
| Best feasible so far (penalty) | blue line | ◇ markers, dotted dash, legend entry, aria text of the plot |
| Chosen per item | bar height | printed percentages and item letters under every bar |
| Penalty column | none | its own column header and the formula in the explanation |
| Stacked bag segments | item colours | the item letter inside each segment and the "n items · weight w of c" text |

### Other checks

- Keyboard only, from the problem menu: pick the knapsack, step a full generation through all six stages, with focus visible.
- Problem menu and drawer open: no control without an accessible name (accessibility-tree scan); item weight/value fields are named "Item F weight" etc.
- Reduced motion: every duration/transition/animation on the knapsack screens is 0s/none.
- No horizontal overflow and nothing clipped at 1920×1080 and at 1366×768 in projector mode, for every stage, the drawer and the menu, for each of the four methods with the 12-item default and with a 20-item instance.

### Screenshots

`.scratch/milestone-3-knapsack/screenshots/`: 14 states at `1920-NN-*.png` (projector mode) and the same at `1366-NN-*.png`: decoder start, selection, mutation cards, evaluation, replacement; penalty evaluation overweight; penalty too small at gen 100; Lamarckian evaluation with ✂; Baldwinian population with ✕; Evolve a bag found; problem menu; drawer (penalty); drawer error; twenty items.

### Verification

`npm run check` clean; 1231 unit tests pass; Playwright 264 passed. Two older tests (`app.spec.ts` stepping by micro-step/stage/generation and `presets.spec.ts` no-mutation preset) are flaky only under full-suite load and pass alone; not touched here.

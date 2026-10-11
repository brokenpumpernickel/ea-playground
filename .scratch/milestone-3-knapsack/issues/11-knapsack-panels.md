# 11 Views: chosen per item, the feasible line, and the feasible count

Status: resolved
Type: task
Blocked by: 03, 08
Spec: ../spec.md

## What to build

- The gene-share panel becomes **Chosen per item** for this problem (share of the population with each item's gene set to 1, labelled by item letter), with a printed percentage and the same description as the match-rate strip.
- The fitness plot gains the **best feasible so far** line under the penalty method (a distinct marker and dash, in the legend and in the hidden table); the optimum reference line is the DP value and can be exceeded.
- The stats line says how many of the N individuals are feasible.

## Done when

- Playwright: the chosen-per-item shares equal the population's counts at every generation; the feasible line equals the metrics, and with a small ρ the best fitness line passes the optimum line while the feasible line does not; the line is absent for the other methods and problems.
- Goldberg's and the string problem's panels and plots are unchanged.

## Comments

## Answer

- **Chosen per item** replaces "Share of 1s per gene" for the knapsack (`genePanel: 'chosen'`, `ChosenStrip.svelte`, `chosen-model.ts`): a bar per item for the share of the population whose gene for it is 1, the percentage printed under the bar (13 px), the item's letter under that, and one sentence for screen readers ("Share of the population that packs each item: item A, 50 percent; …"). With more than 14 items the bars are too narrow for "50%", so the figure is printed without its sign in smaller type (checked with 20 items at both sizes).
- **Best feasible so far** as a line of its own in the fitness plot, only when the problem says it can have infeasible individuals (`Problem.mayBeInfeasible`, set for the knapsack under the penalty only): dotted, thicker, with ◇ markers, in the legend ("◇ best feasible so far"), in the description of the plot ("best feasible so far 99", or "none yet"), and in each marker's tooltip. It starts at the first generation that has a feasible bag. With the decoder, either repair and the other problems it is not there (it would coincide with best so far).
- **Stats line:** "… · evaluations 36 · feasible 4 of 12", from the metrics (for the decoder and repairs always "12 of 12").
- The optimum reference line is the DP value and can be exceeded: with ρ = 0 the best-fitness line passes it while the feasible line stays below it, and the status never says the target was reached.

**Tests**
- `knapsack-panels.test.ts` (7): chosen shares equal counts at several generations, the strip's bars, percentages and description, the plot model's feasible line equals the metrics at every generation and is absent unless asked for, only the penalty asks for it, the plot's diamonds and description, nothing when it is not asked for, and "none yet" when no bag is feasible yet.
- `e2e/knapsack-panels.spec.ts` (10): for every method at generations 0–4 the bars and printed percentages equal the engine's counts; the stats line equals the metrics' feasible count (12 of 12 for the decoder); the penalty's feasible line equals the metrics at every generation and is named in the legend and the plot's description; a too-small penalty (ρ = 0, 15 generations) lets the best line pass the 123 line while the feasible line does not; no feasible line for the decoder and Goldberg keeps "Share of 1s per gene" with no "feasible" in its stats line; 12 and 20 items stay inside their panel in normal and projector mode.

State: 1188 unit tests, `npm run check` clean, 209 Playwright tests passing.

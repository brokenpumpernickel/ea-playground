# Milestone 6 mock: the travelling salesperson (throwaway)

Open `index.html` in a browser (buttons at the top choose the screen, instance, operators and layout), or look at `screenshots/`. Everything is hand-made: a seeded mini GA (`tsp.js`) makes the populations, so the lengths, gaps and draws are real numbers of a real run, but nothing here is engine code. `build.mjs` builds the page, `data.mjs` made `tspdata.js` from the TSPLIB files (berlin52, ulysses16 and kroA100 only), `shots.mjs` takes the screenshots.

## Screenshots (1920×1080, projector mode)

| File | What it shows |
|---|---|
| `01-berlin52-route-map`, `03-ulysses16-route-map`, `04-kroA100-route-map`, `05-circle-route-map` | The Route map view (second tab of the stage panel) with its table, the fitness plot with the optimum and nearest-neighbour lines, the diversity plot and the edge-agreement panel |
| `02-berlin52-optimal-overlay` | The optimal tour (TSPLIB's) dashed over the run |
| `06-table-wrapped-berlin52` | Layout A for a long permutation: wrapped rows (does not work: five of twelve individuals visible) |
| `07-ox-berlin52`, `08-ox-ulysses16`, `12-ox-kroA100` | Order crossover cards for 52, 16 and 100 cities |
| `09-pmx-ulysses16`, `11-pmx-berlin52` | Partial-mapped crossover: the mapping, the example chain, the cities that followed it (↻) |
| `10-cx-ulysses16` | Cycle crossover: the cycles and where each city came from |
| `13-mutation-swap`, `14-mutation-inversion`, `15-mutation-insertion` | The three mutations: one draw per individual, the positions drawn, the edges removed and added, the change in length |
| `16-map-crossover-marks`, `16b-…`, `17-map-mutation-marks`, `17b-…` | The stage marks on the map while stepping |
| `18-drawer`, `19-instances`, `20-menu`, `21-dark` | The drawer's TSP section, the instance list, the problem menu, dark theme |

## Decisions to make (recommendations first)

1. **Long permutations in the population table.** (A) wrapped rows: rejected, `06` shows why (a 52-city tour takes three lines, so only five of twelve individuals fit). (B, recommended) **up to 16 cities the whole tour in the cell; above that the first seven and the last three cities with "… 42 more …" and a small thumbnail of the tour**, and the selected individual's canonical route written out in full under the table (cut at 46 cities for 100, with "(54 more)"); the complete route is always in the accessible name and in the hidden table of tours. A thumbnail shows at a glance which tours cross themselves.
2. **Strips in the operator cards.** Cells of 30 px for up to 16 cities, 22 px up to 24, 20 px up to 36, **16 px with two-digit numbers up to 52** (it fits one row at 1920; at 1366×768 the numbers are small, the slice outline and the hatching carry the message), and for more than 60 cities (kroA100) only the cities around the cut points and the ends, with "⋯ k" for the rest. Recommended; the full tours are in the table and the narration.
3. **Route map.** Population's edges on by default (faint, thicker = more individuals use the edge), best tour bold, selected individual orange dotted, optimal tour a toggle. While stepping, the map shows the **child's edges classified** (shared by both parents grey, from A only solid, from B only dashed, new dotted orange, the kept slice ringed) instead of drawing both parents, which would be a hairball; for mutation the removed edges are dashed and crossed out (✕), the added ones bold, the cities at the ends ringed. Recommended.
4. **Fitness plot.** Linear fitness = −length with the optimum and nearest-neighbour lines. For the large instances the interesting part is squeezed at the top (the random start is three times the optimum); the lines' labels collide on kroA100 and need a placement rule; the axis margin must be wider than for the landscape (labels like −26,250). Recommended: keep it linear and consistent, and let the stats lines and the gap carry the detail.
5. **Edge agreement** in place of the allele strip: one bar per edge of the best tour (the share of the population that has it), and the counts printed. Recommended.
6. **What a plain GA reaches**, from the mock's GA (population 12 to 40, OX with inversion or insertion, 300 generations at most; real engine measurements come in the defaults ticket):

   | Instance | Optimum | Best after 40 / 200 generations (population 12) | Gap |
   |---|---|---|---|
   | ulysses16 | 6,859 | 7,263 at generation 40 | 5.9 % (another seed and pm 0.4 reached 7,113, 3.7 %, by generation 60) |
   | berlin52 | 7,542 | 14,004 at generation 200 (13,144 at 300) | 86 % (74 % at 300) |
   | kroA100 | 21,282 | 81,663 at generation 150 | 284 % |

   So the small instances can reach the optimum, berlin52 stays far from it, and 70 to 100 cities is hopeless for a plain GA in a classroom number of generations. Options: (a) keep all nine TSPLIB instances and let the gap be the lesson; (b, **recommended**) keep the instances up to 52 cities (burma14, ulysses16, ulysses22, att48, eil51, berlin52) and drop st70, eil76 and kroA100 from this milestone, saying plainly on screen that a GA alone is weak here; (c) put 2-opt local search (a memetic GA) in scope, which is a larger step and its own milestone.
7. **Nearest-neighbour line** (dashed, labelled) stays unless you veto it: berlin52's is 8,980 (19 % over the optimum), far better than the GA's 14,004, which is itself a lesson.
8. **Own instances show lengths to one decimal; TSPLIB ones are integers**, as published.

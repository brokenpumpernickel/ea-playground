# 01 Throwaway visual mock of the Goldberg screen

Status: claimed
Type: prototype (needs instructor review)
Blocked by: none
Spec: ../spec.md

## What to build

A static HTML/CSS/SVG mock of the Goldberg screen at 1920×1080 with hand-made data for the textbook population (01101, 11000, 01000, 10011). No engine, no framework. Show, as separate mock screens or states:

- The full layout: stage ribbon and transport controls on top, stage view and population table in the main area, fitness and diversity plots and a scrub bar in the bottom strip, collapsed parameter drawer.
- The selection stage (weight table with raw fitness → weight → probability, roulette wheel), mating pool and pairs.
- The crossover stage (cut point, inherited bits per parent, a bypass) and the mutation stage (draws, flipped genes, a bypass).
- The replacement stage (elites, survivors, offspring discarded by truncation).
- Projector mode versus a 1366×768 render.

Use text sizes of roughly 20 px body at 1080p, and give every colour-coded meaning a symbol or pattern.

## Output

- The mock under `.scratch/milestone-1-goldberg/mock/` (it is thrown away afterwards).
- A short list in this file under `## Answer` of what the mock revealed that the engine's events must carry (for example, "the crossover view needs the cut point and both parents' indices").

## Done when

The instructor has reviewed the mock and either approved the layout or listed changes that were made. The event-needs list is complete.

## Answer

**Status of this ticket:** the mock is built and checked; **waiting for the instructor's review** before it can be resolved. It stays `claimed` until then.

### Where it is

- Open `.scratch/milestone-1-goldberg/mock/index.html` in a browser (works from disk, no server). Buttons across the top switch between the seven states and between fit-to-window, 1920×1080, 1366×768, light and dark. Deep links look like `index.html#s=crossover&size=1&theme=dark`.
- Screenshots of every state are in `mock/screenshots/` (1920×1080 light, one dark, one 1366×768).
- All data is hand-made: one generation of the textbook population (01101, 11000, 01000, 10011) at N = 4, with elitism e = 1 and offspring truncation λ = 4 on so each feature appears once. Pair 1 recombines; pair 2 is a bypass; one gene mutates.
- Plot colours come from the dataviz reference palette and were validated (light and dark): blue, orange and aqua for average, best of generation and best so far. Aqua is under 3:1 on the light surface, so those lines also have distinct markers and dashes, and the legend is in the panel header.

### Layout as drawn (1920×1080)

Ribbon and generation counter on top; transport row; population and offspring tables on the left; stage view and a one-line narration of the current event on the right; fitness, diversity and allele plots below; scrub bar along the bottom; a symbol legend under the left tables; the parameter drawer overlays from the right and is closed by default. Body text is 20–22 px, chromosomes 23–27 px monospace, secondary notes and plot ticks 17–18 px.

### What the engine's events must carry

The views need these facts, so the event types must provide them without the UI recomputing anything:

1. **Individual identity and provenance.** A stable id per individual, and for each offspring its origin: parent individuals, the operator, and whether it is a bypass copy ("O3 = copy of A"), mutated, kept or discarded. The new-population view needs the same provenance (elite / from O3).
2. **Selection.** Per spin: spin number, the random number r, and the individual it landed on. Per individual: raw fitness, every weight-chain step's value, final weight, probability, and its interval [lo, hi). A banner event when the chain auto-switched to Shift, with the reason.
3. **Pairing.** Pool slot → individual, pair → two slots, and a "dropped child" note for an odd pool.
4. **Crossover, per pair.** Pair index, both parent individuals, the draw u, the threshold pc, the decision and its reason (recombined / draw failed / crossover switched off), the operator, the cut point(s) or uniform mask, and for each child gene which parent it came from.
5. **Mutation, per offspring, per gene.** The draw u, the threshold pm, whether it flipped; in per-individual mode the individual's draw first and then the chosen genes; the resulting chromosome; and a bypass reason when mutation is switched off.
6. **Evaluation.** Decoded x, objective value and fitness per offspring, plus the running evaluation count.
7. **Replacement.** The elite(s) and the rule that chose them, the offspring ranking with rank and any tie-break, kept or discarded per offspring, and the resulting population with provenance.
8. **Partial state at any micro-step.** The left tables show the offspring "not yet created" and fill in progressively. So the cursor must be able to answer "which offspring exist, with which chromosome and scores, as of micro-step k", and the parent counts as of spin k.
9. **Micro-step counts per stage** (spins, pairs, pairs, individuals, individuals, one) so the ribbon can say "Micro-step 2 of 4".
10. **Narration is derived**, not stored: the sentence under each stage is built from the event, so it can never disagree with it.
11. **Metrics per generation**, including the min–max band and the number of distinct chromosomes, as in ticket 11.

### Findings that need a decision from the instructor

1. **1366×768.** The whole screen scales as one unit, which leaves about 14 px body text. That is fine at laptop distance but not for a projector, and scaling does not give a layout that is really designed for the small size. Decide: accept scale-as-unit for laptops, or build a reflowing layout (for example plots collapsing behind a tab).
2. **Minimum text size.** Primary text is 20–22 px, but notes and plot ticks are 17–18 px to fit. Is 18 px acceptable for secondary text on the projector, or should plots shrink instead?
3. **The scrub bar does not scale.** It is drawn for 10 generations with six stage ticks each. With a limit of 50 to 2,000 generations it needs either zooming to a window around the cursor, or an overview strip plus a detail strip. This is the largest gap the mock exposed.
4. **Plot x-axis.** It is fixed at 0–15 here. Options: fixed to the generation limit (a mostly empty plot early on), or growing with the run. The mock suggests growing, with the recorded range always visible and the cursor marked.
5. **Population table at the cursor.** It shows the generation's starting population and fills the "Parent" column as spins happen. Is that the right thing to show during crossover and mutation, or should the table switch to the offspring once they exist?
6. **Narration bar.** One line under each stage view saying exactly what just happened. Keep it, or is it noise next to the view?
7. **Key bindings** in the mock (← → ⇧→ G Space) are placeholders for ticket 22.
8. **The drawer** needs scrolling at 1080p (the Stop section sits at the bottom edge) and covers the stage view when open. Acceptable for a panel that is closed during demos?

### Not covered by the mock (so not reviewed)

Animation (spin, cut, flip, replacement flow), the tournament view, the per-individual mutation mode, the "mutation switched off" bypass view, the weight-chain editor, long chromosomes (the trap example's 20 bits will not fit the current bit cells), and populations beyond a handful of rows (the table will need scrolling or a compact mode for N up to 500).

### Known imperfections in the mock itself

The elite card's fitness label touches its thick border and the "discarded" badge is tight in the ranked column. The ✂ marker above the cut is rough. None of these affect the layout decisions.

## Comments

# 08 Mutation

Status: resolved
Type: task (test-first)
Blocked by: 03
Spec: ../spec.md

## What to build

Bit-flip mutation as a stage over a list of chromosomes (offspring in the generation loop), in two explicit modes:

- **Per-gene**: one recorded draw per gene.
- **Per-individual**: one recorded draw per individual decides whether it is mutated; if so, the operator then chooses which genes flip (a defined rule, recorded).
- A mutation switch. When off, every chromosome is unchanged and the bypass is recorded.
- Every draw is recorded with its random number and threshold, and each mutated individual records its changed gene positions.

## Tests (write first)

- With fixed random values, the flipped genes are exactly the hand-computed ones in both modes.
- Switch off leaves all chromosomes equal and records the bypass.
- pm = 0 never mutates and pm = 1 flips every gene (per-gene mode).
- Over many seeded draws the observed rate matches pm within a tolerance, in both modes.
- Mutation returns new chromosomes and never edits the input in place.

## Answer

Done test-first (decisions, interface and seams agreed with the instructor beforehand). 156 engine tests pass (27 for this ticket, plus one regression test added to crossover); `npm run check` is clean.

Public interface (`src/engine/index.ts`):

- `mutate(offspring, config, rng)` → `{ mutated, events }`, with `offspring = { offspring, chromosome }[]` (crossover's `Child` fits) and `config = { enabled, mode: 'per-gene' | 'per-individual', probability }`.
- `mutated`: `{ offspring, chromosome, flipped }`, with `flipped` as 1-based gene positions.
- One `MutationEvent` per offspring: `mode`, `decision` (`mutated` / `unchanged` / `bypassed`), `reason: 'switched-off'` when bypassed, `threshold`, `before`, `after`, `flipped`, and then either `geneDraws [{ gene, u, flipped }]` (per-gene) or `individualDraw { u }` plus `chosenGene { gene, r }` when mutated (per-individual).

Decisions made:

- **Per-gene:** one draw per gene, in gene order, always all of them (L per offspring), offspring by offspring. A gene flips when `u < pm`.
- **Per-individual:** one draw `u` per offspring; only when `u < pm`, one more draw picks **exactly one gene**, gene = 1 + floor(r × L), which flips. This is the defined rule the ticket asked for (rather than a conditional per-gene rate, which would blur the per-gene versus per-individual distinction).
- A draw equal to pm never mutates; pm = 0 never mutates; pm = 1 flips every gene (per-gene) or always mutates one gene (per-individual).
- **Switched off draws nothing** and every offspring is a `bypassed` event with reason `switched-off`. This is distinct from `unchanged` (the operator ran and nothing flipped); the mock shows them differently.
- **Fresh arrays always:** the input is never edited, and no returned chromosome is an input array, even for unchanged or bypassed offspring. The events keep **their own copies** of before/after, so nothing done to inputs or outputs later can rewrite the record.
- Probability must be in [0, 1], checked even when switched off. An empty offspring list is fine and draws nothing.
- Tested against the mock's worked example (grid of 20 draws: only offspring 3, gene 2 flips, giving 11011) and statistically: per-gene flip rate matches pm; per-individual mutation rate matches pm, always exactly one flip, spread evenly over the genes.

A defect found in ticket 07 while writing this: crossover's event children shared arrays with the returned offspring, so changing an offspring later would have rewritten the recorded event. Added a failing test first and fixed it; crossover events now hold copies too. (Selection and pairing events contain only numbers, so they were not affected.)

Notes for later tickets:

- The generation loop should pass crossover's `offspring` (chromosomes) to `mutate`, then merge `mutated[k].chromosome` and `flipped` back onto each child by its `offspring` number. The id and the evaluation happen in ticket 09.
- Ticket 16's mutation view reads `geneDraws` / `individualDraw` / `chosenGene`, `decision`, `reason`, `before`, `after` and `flipped`. The mock's "20 draws per generation" note is `L × offspring` in per-gene mode.

## Comments

# 14 UI shell: ribbon, transport, population table

Status: open
Type: task
Blocked by: 01, 12, 13
Spec: ../spec.md

## What to build

The first end-to-end demoable slice, wired to the real engine (Svelte, `src/ui`), following the approved mock:

- The page layout: top ribbon, main area, bottom strip, collapsed drawer placeholder.
- Stage ribbon showing the six stages, the current one highlighted, and the generation number.
- Transport: next micro-step, next stage, next generation, run, pause, run until, tier slider, reset, new seed. The cursor supports all three stepping granularities even though only the generic stage placeholder view exists so far.
- Population table with chromosome, decoded x, objective value, fitness, selection weight and probability side by side, as real table markup.
- A generic stage panel that lists the current stage's events as text, to be replaced stage by stage by tickets 15–17.
- Starts on the default Goldberg configuration (N = 6, one-point crossover, pc = 0.8, per-gene pm = 0.05, no elites, roulette with Identity).

## Done when

- A person can open the app, press "next generation" repeatedly, and watch the population table change; stepping by stage and micro-step moves through the same run.
- A Playwright test steps a seeded run and checks the table against the engine's population.

## Comments

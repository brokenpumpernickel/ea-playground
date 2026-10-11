# 03 Engine: feasibility metrics and feasible-aware stop criteria

Status: resolved
Type: task (test-first)
Blocked by: 02
Spec: ../spec.md

## What to build

- Metrics gain, for problems that report feasibility: the number of feasible individuals, the best feasible fitness of the generation and the best feasible fitness so far (absent or equal to the existing figures when everything is feasible). The original nine metrics, which the golden fixtures record, are unchanged.
- The run state tracks the best feasible fitness so far and the generation it last improved. The stop criteria "target fitness reached" and "stagnation" use it. For a problem where every individual is feasible this is identical to today's behaviour.

## Done when

- Golden runs pass unchanged.
- With a test problem where some individuals are infeasible and score higher than the best feasible one, "target reached" does not fire for them, stagnation counts from the last improvement of the feasible best, and the feasible counts and bests equal a direct count.
- With no infeasible individuals the stop reasons are exactly as before at every generation of a seeded run.

## Comments

## Answer

Golden runs pass unchanged; 1037 unit tests pass and `npm run check` is clean.

- **State:** `RunState.feasibility?: { bestSoFar: number | null; lastImprovement: number }`, present only for a problem that reports feasibility (any individual of the initial population carries a `feasible` flag). It tracks the best fitness among feasible individuals seen so far (null until there is one, offspring that were not kept included, like `bestFitnessSoFar`) and the generation it last improved. For every other problem the state is exactly what it was, with no new key.
- **Stop criteria:** `stopReasons` uses `feasibility` when it is present, otherwise `bestFitnessSoFar` and `lastImprovementGeneration` as before. With no feasible individual yet, "target reached" cannot hold and stagnation counts from generation 0.
- **Metrics:** `GenerationMetrics.feasible?: { count, best, bestSoFar }` (count of feasible individuals in the population, their best fitness or null, and the best feasible so far), present only when feasibility is reported. The original nine fields and `symbolCounts` are unchanged.
- **Tests** (`src/engine/feasibility.test.ts`, 10, red first): counts and bests equal a direct count at every generation of a run that really had infeasible individuals; best feasible so far equals the best feasible ever evaluated and never decreases; a population with no feasible individual gives `{count: 0, best: null, bestSoFar: null}`; the original metrics are equal with and without the flag; Goldberg and a problem that does not report have no `feasibility` or `feasible`; an infeasible individual above the target does not reach it, and stagnation counts from the feasible improvement (hand-built states); on a real run an infeasible winner never makes `target-reached` true while a reachable target does; and when every individual is feasible the stop reasons equal those of the same run without the flag at every generation.

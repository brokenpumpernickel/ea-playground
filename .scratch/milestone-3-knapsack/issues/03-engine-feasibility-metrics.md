# 03 Engine: feasibility metrics and feasible-aware stop criteria

Status: open
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

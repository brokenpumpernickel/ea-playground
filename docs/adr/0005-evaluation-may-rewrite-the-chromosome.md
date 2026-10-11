# Evaluation may rewrite the chromosome

Scoring an offspring can change it. A problem's `evaluate` may return a repaired chromosome next to the scores (Lamarckian repair of an overweight knapsack bag): the engine stores the repaired chromosome as the individual's chromosome, so later crossover, mutation and elitism work from it, and the evaluation event (and the setup event for the initial population) carries `repairedFrom`, the chromosome as mutation (or the user) left it. Replaying a generation's events still reproduces its population exactly, because the individual in the event already holds the repaired chromosome. `Scores` also gains an optional `feasible` flag, absent meaning feasible; both additions are absent for every problem that does not use them, so the individuals and events of existing problems are byte-for-byte what they were (the golden runs recorded before the change guard this).

## Considered Options

- **Repair as a stage of its own between mutation and evaluation**: rejected. It would change the stage list that ADR 0003 shares across algorithms, add a seventh stage to every problem's narration and ribbon, and repair is a property of the problem's constraint, not of the algorithm.
- **Repair inside mutation (and crossover)**: rejected. Repair has to apply to the initial population and to whatever the operators produce, and it needs the problem's data, which the operators deliberately do not see.
- **Keep the chromosome and only score the repaired bag** is Baldwinian repair, which needs no engine change; it is offered alongside Lamarckian repair, not instead of it.

## Consequences

The chromosome in an evaluation event's individual is not always the one mutation produced, so a view that compares "what mutation left" with "what was scored" must read `repairedFrom`. An evaluation that changes chromosomes makes the genotype a function of the problem's constraint data: a problem whose evaluation repairs must do so deterministically, without drawing random numbers (the engine hands it no generator), or seeded runs would stop being reproducible.

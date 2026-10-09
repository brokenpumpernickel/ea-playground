# 03 Engine core: generator, Goldberg problem, population

Status: open
Type: task (test-first)
Blocked by: 02
Spec: ../spec.md

## What to build

The smallest slice of `src/engine` that produces an evaluated initial population:

- A small documented seedable generator (pick the algorithm and record it in the spec's "To decide" list). Never `Math.random`.
- The Goldberg problem: five-bit chromosome, plain-binary decoding to x in [0, 31], objective value x², fitness equal to objective value, known optimum 11111 = 31 (fitness 961).
- Individuals (chromosome, decoded solution, objective value, fitness) per `CONTEXT.md`.
- Initialization from the seeded generator, or from an explicit list of chromosomes (validated for length and alphabet).
- The setup stage that evaluates the initial population, recorded as events.

## Tests (write first)

- Decoding and fitness table for all 32 chromosomes.
- Same seed gives the same initial population; different seeds differ.
- Explicit initialization with the textbook population gives fitness 169, 576, 64, 361.
- Rejects wrong-length or non-binary chromosomes with a clear message.

## Comments

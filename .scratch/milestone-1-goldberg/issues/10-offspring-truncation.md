# 10 Offspring truncation

Status: open
Type: task (test-first)
Blocked by: 09
Spec: ../spec.md

## What to build

The optional offspring-truncation mode in the generation loop:

- λ offspring (default N, freely configurable) are generated and evaluated; the mating pool is then λ parents.
- Replacement keeps the best N − k offspring by fitness, ties in order of generation, with the tie-break recorded.
- Discarded offspring and the reason are recorded as events.
- Off by default, in which case N − k offspring are generated and all survive.

## Tests (write first)

- With truncation on and λ > N − k, exactly N − k offspring survive and they are the best ones; discards are listed.
- Tie-breaks follow the order of generation.
- With truncation off, behaviour is unchanged from ticket 09.
- λ = 2N works; population size is N after every generation.
- Determinism holds with truncation on.

## Comments

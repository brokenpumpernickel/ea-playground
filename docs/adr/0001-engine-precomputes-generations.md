# The engine fully determines each generation up front; the UI is a cursor over run history

The engine draws all random numbers for a generation in a fixed order and records them as stage and micro-step events, rather than drawing lazily when the user clicks. Stepping by micro-step, stage, generation, or continuous playback therefore never changes the outcome of a seeded run, and scrubbing backward is just moving a cursor over the recorded history. The cost is that the engine does more work ahead of what the UI reveals, and a mid-generation change must wait for the next generation boundary (pending parameters).

## Considered Options

- **Lazy evaluation**: each micro-step draws its random numbers when the student advances. Simpler, but results then depend on how the student clicked, so a projector demo and a student's laptop can diverge for the same seed.

## Consequences

- History stores a snapshot at every generation boundary (population, scores, generator state, active parameters). Events are kept only for the generations near the cursor and are regenerated from the nearest snapshot when the user scrubs elsewhere, so scrubbing stays exact for the whole run.
- Scrubbing back and changing a parameter truncates the later generations and continues from that point under the new parameters, after a notice naming what will be discarded. There is no branching timeline.
- Randomness comes from a small documented seedable PRNG, never `Math.random`.

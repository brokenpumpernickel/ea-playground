# 13 Playback controller and tiers

Status: open
Type: task (test-first)
Blocked by: 12
Spec: ../spec.md

## What to build

The playback controller in `src/run`, independent of rendering:

- Four tiers: slow (one micro-step per tick), medium (one stage per tick), fast (one generation per tick, animating only the population view and plots), maximum (no animation, as fast as the engine can run).
- Run, pause, resume, and "run until stop criterion". Pausing freezes at the current event; resuming continues from there.
- A single tier slider value maps to a tier and a tick interval; the controller exposes which parts of the view should animate for the current tier.
- Reduced-motion flag: the controller reports instant transitions while still stepping through the same events.
- Playback never changes a run's results.

## Tests (write first)

- With a fake clock, each tier advances the cursor by the expected unit per tick.
- Pausing mid-stage freezes the cursor, resuming continues, and the final state equals an unpaused run.
- Run-until stops when a stop criterion fires and leaves the run steppable.
- Results at every tier are identical for the same seed.

## Comments

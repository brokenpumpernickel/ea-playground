# 13 Playback controller and tiers

Status: resolved
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

## Answer

Done test-first (decisions, interface and seams agreed with the instructor beforehand). 332 tests pass in total (32 new, in `src/run/playback.test.ts`); `npm run check` and `npm run build` are clean. Three deliberate breakages (never acknowledging reported criteria, checking for stops only after a whole 25-generation batch, pause not cancelling its timer) were each caught, then reverted.

Public interface (`src/run/index.ts`):

- `createPlayback(run, { scheduler, reducedMotion? })` → `Playback`.
- `Scheduler` = `{ setTimeout(callback, delayMs), clearTimeout(handle) }`. **Injected**, because `src/run` has no DOM types; the UI passes the browser's. Tests use `fake-scheduler.ts`, where nothing happens until the test fires a timer.
- `tiers` (also `playback.tiers`): slow / medium / fast / maximum, each with `unit`, `cyclesPerTick`, `intervalMs`, `animate`, `label` for the slider.
- `playback.tier`, `slider` (0–3), `setSlider(n)` (rounds and clamps), `setTier(name)`.
- `status`: `{ playing }`, or `{ playing: false, pausedBecause: 'user' | 'stop-criterion' | 'error', stops?, error? }`.
- `play()`, `pause()`, `toggle()`, `runUntilStop()`, `animate`, `reducedMotion` / `setReducedMotion(on)`, `subscribe(listener)` (returns an unsubscribe function).

Behaviour, as agreed:

- **Tiers:** slow = one micro-step per tick every 1000 ms; medium = one stage (to its end) every 1500 ms; fast = one generation every 500 ms; maximum = up to 25 generations per tick, interval 0. Animation flags: slow animates micro-steps, stages, population and plots; medium drops micro-steps; fast animates only population and plots; maximum animates nothing. The first tick after `play()` is scheduled at 0 ms so Run responds at once.
- **Pausing** cancels the pending tick and leaves the cursor exactly where it is; resuming continues from there, and a paused-and-resumed run equals one that was never paused (tested against `runUntil`, including events). Playing through already recorded generations only moves the cursor (a test counts calls to `step`).
- **Changing tier while playing** reschedules the pending tick at the new tier's interval from that moment, and the next tick does the new unit. Switching from slow to maximum does not wait out the slow interval.
- **Stop criteria:** at the end of a generation where a criterion newly holds, playback pauses with `pausedBecause: 'stop-criterion'` and the new reasons, at every tier. At maximum the pause happens at exactly that generation, not at the end of the 25-generation batch. Pressing play again continues past criteria already reported, and pauses only for a new one (the fake's "huge" after "big"). A criterion that stops holding is forgotten, so it pauses again if it comes back. Manual stepping past a stop is never blocked.
- **`runUntilStop()`** jumps without animation to the end of the first generation where a criterion not already reported holds (reports `condition` or `max-cycles` after 2,000 generations), stops any playback in progress, and leaves no timers.
- **Reduced motion** turns every animation flag off but keeps the pacing (still one micro-step per second at slow); it can be switched while the app runs and subscribers are told.
- **Errors in a step** (for example an unusable weight chain) pause playback with `pausedBecause: 'error'` and the message instead of throwing; playing again after fixing the cause carries on. `runUntilStop()` does not catch errors; the explicit button handler should.
- **No effect on results:** every tier produces the identical run for the same seed.
- Tick intervals are recorded in the spec as tunable defaults.

Notes for later tickets:

- Ticket 14 should create the playback with `{ setTimeout: (f, ms) => window.setTimeout(f, ms), clearTimeout: (h) => window.clearTimeout(h as number) }`, subscribe once, and redraw from `run.view()`. Moves it makes itself (stepping, scrubbing) go through `run` directly; call `playback.pause()` first when a user action needs the run to stand still (for example before confirming a truncation).
- A slider with four labelled stops can use `playback.tiers.map(t => t.label)` and `setSlider`.
- Views decide how to animate; `playback.animate` only says which parts may. Under the maximum tier a view should skip all transitions and just redraw per tick.
- If a tick makes a generation whose step throws, playback pauses at the cursor before the failed move; the run is unchanged.

## Comments

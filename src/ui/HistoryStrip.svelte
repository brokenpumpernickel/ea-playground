<script lang="ts">
  import { layoutsOf, positionAtX, scrubModel } from './scrub-model';
  import type { Session } from './session.svelte';

  let { session }: { session: Session } = $props();

  /** The bar is drawn 1440 px wide inside the 1920-px canvas; pointer positions are scaled back to that. */
  const WIDTH = 1440;

  const model = $derived.by(() => {
    void session.version;
    return scrubModel(session.run, WIDTH);
  });
  const live = $derived(session.atLive);
  let dragging = false;

  const place = (event: PointerEvent) => {
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * WIDTH;
    session.scrubTo(positionAtX(layoutsOf(session.run), WIDTH, x));
  };
  const down = (event: PointerEvent) => {
    dragging = true;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    (event.currentTarget as HTMLElement).focus();
    place(event);
  };
  const move = (event: PointerEvent) => {
    if (dragging) place(event);
  };
  const up = (event: PointerEvent) => {
    dragging = false;
    (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
  };

  const keys: Record<string, () => void> = {
    ArrowLeft: () => session.scrubMicro(-1),
    ArrowDown: () => session.scrubMicro(-1),
    ArrowRight: () => session.scrubMicro(1),
    ArrowUp: () => session.scrubMicro(1),
    PageUp: () => session.scrubGeneration(-1),
    PageDown: () => session.scrubGeneration(1),
    Home: () => session.scrubTo({ cycle: 0, stage: 0, micro: 0 }),
    End: () => session.returnToLive(),
  };
  const key = (event: KeyboardEvent) => {
    const action = keys[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  };
</script>

<footer class="history">
  <div class="title">
    <b>Run history</b>
    <span class="muted">recorded gens 0–{model.lastCycle}</span>
  </div>

  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="scrub"
    role="slider"
    tabindex="0"
    aria-label="Run history: drag or use the arrow keys to move through recorded generations, stages and micro-steps"
    aria-orientation="horizontal"
    aria-valuemin={0}
    aria-valuemax={model.lastCycle}
    aria-valuenow={model.current}
    aria-valuetext={model.valueText}
    data-testid="scrub"
    data-cycle={model.current}
    data-live={live}
    onpointerdown={down}
    onpointermove={move}
    onpointerup={up}
    onpointercancel={up}
    onkeydown={key}
  >
    <svg viewBox="0 0 {WIDTH} 66" width={WIDTH} height="66" aria-hidden="true">
      <rect x="0" y="14" width={WIDTH} height="12" rx="6" class="track" />
      <rect x="0" y="14" width={Math.max(model.thumbX, 6)} height="12" rx="6" class="fill" />
      {#each model.stageTicks as x (x)}<line x1={x} x2={x} y1="14" y2="26" class="stage-tick" />{/each}
      {#each model.cellTicks as x (x)}<line x1={x} x2={x} y1="10" y2="32" class="cell-tick" />{/each}
      {#each model.labels as label (label.generation)}
        <text x={label.x} y="54" text-anchor="middle" class:current={label.current}>gen {label.generation}</text>
      {/each}
      <rect x={model.thumbX - 4} y="6" width="8" height="28" rx="3" class="thumb" data-thumb={model.thumbX} />
    </svg>
  </div>

  <button class="btn live" onclick={() => session.returnToLive()} disabled={live}>Return to live</button>
</footer>

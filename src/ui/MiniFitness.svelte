<script lang="ts">
  import MoveHandle from './MoveHandle.svelte';
  import type { Offset } from './overlay-drag';
  import { miniFitness } from './mini-fitness';
  import type { PlotModel } from './plot-models';

  /**
   * The simplified fitness graph laid over a corner of the focus view (geometry in `mini-fitness.ts`): the three series, the
   * optimum and nearest-neighbour lines with their words, the "now" line, and a marker of a different shape for each series at
   * "now". Its name is the sentence of the full plot, which stays in the page, hidden, with its table.
   */
  let { model, onhide, offset = $bindable({ x: 0, y: 0 }), clear = {} }: { model: PlotModel; onhide: () => void; offset?: Offset; clear?: { top?: number; from?: number; to?: number } } = $props();
  const g = $derived(miniFitness(model));
  const colours = { average: 'var(--s1)', bestSoFar: 'var(--s3)', best: 'var(--s2)' } as const;
</script>

<div class="mini">
  <div class="mh">
    <MoveHandle label="Move the fitness graph" testid="move-graph" bind:offset {clear} />
    <b>Fitness</b>
    <span class="ml"><b>●</b> average <b>■</b> best <b>▲</b> best so far</span>
    <button class="tog" type="button" aria-label="Hide the fitness graph" data-testid="hide-graph" onclick={onhide}><span aria-hidden="true">×</span> hide</button>
  </div>
  <svg viewBox="0 0 {g.width} {g.height}" width={g.width} height={g.height} role="img" aria-label={g.sentence} data-plot="fitness-mini" data-now={model.now}>
    {#each g.lines as l (l.key)}
      <line x1={g.plot.left} x2={g.plot.right} y1={l.y} y2={l.y} stroke="var(--ink2)" stroke-width="1.5" stroke-dasharray={l.key === 'optimum' ? '2 5' : '9 5'} data-line={l.key} />
    {/each}
    {#each g.series as s (s.key)}
      <path d={s.future} fill="none" stroke={colours[s.key]} stroke-width="2" stroke-dasharray={s.dash} opacity=".3" />
      <path d={s.past} fill="none" stroke={colours[s.key]} stroke-width="2.5" stroke-dasharray={s.dash} data-series={s.key} />
    {/each}
    <line x1={g.now.x} x2={g.now.x} y1={g.plot.top - 6} y2={g.plot.bottom} stroke="var(--ink)" stroke-width="2" data-now-line />
    {#each g.series as s (s.key)}
      {#if s.marker === 'square'}
        <rect x={s.at.x - 5} y={s.at.y - 5} width="10" height="10" fill={colours[s.key]} stroke="var(--surface)" stroke-width="2" data-mini={s.key} data-value={s.at.value}><title>{s.label}</title></rect>
      {:else if s.marker === 'triangle'}
        <path d="M{s.at.x},{s.at.y - 7} L{s.at.x + 7},{s.at.y + 5} L{s.at.x - 7},{s.at.y + 5} Z" fill={colours[s.key]} stroke="var(--surface)" stroke-width="2" data-mini={s.key} data-value={s.at.value}><title>{s.label}</title></path>
      {:else}
        <circle cx={s.at.x} cy={s.at.y} r="5" fill={colours[s.key]} stroke="var(--surface)" stroke-width="2" data-mini={s.key} data-value={s.at.value}><title>{s.label}</title></circle>
      {/if}
    {/each}
    <text class="ink mt" x={g.now.x + (g.now.x - g.plot.left < 24 ? 6 : 0)} y={g.plot.top - 10} text-anchor={g.now.x - g.plot.left < 24 ? 'start' : g.plot.right - g.now.x < 24 ? 'end' : 'middle'}>now</text>
    <text class="mt" x={g.plot.left + 2} y={g.yLabels.top.y} aria-hidden="true">{g.yLabels.top.text}</text>
    <text class="mt" x={g.plot.left + 2} y={g.yLabels.bottom.y} aria-hidden="true">{g.yLabels.bottom.text}</text>
    <text class="mt" x={g.plot.left} y={g.height - 5} aria-hidden="true">gen {g.xLabels.left}</text>
    <text class="mt" x={g.plot.right} y={g.height - 5} text-anchor="end" aria-hidden="true">gen {g.xLabels.right}</text>
    {#each g.lines as l (l.key)}
      <text class="mt refl" x={g.plot.right} y={l.labelY} text-anchor="end" data-label={l.key}>{l.text}</text>
    {/each}
  </svg>
</div>

<script lang="ts">
  import { num } from './format';
  import type { PlotModel, PlotPoint } from './plot-models';

  let { model }: { model: PlotModel } = $props();

  const W = 800;
  const H = 188;
  const L = 66;
  const R = 780;
  const T = 28;
  const B = 138;
  const X = (generation: number) => L + ((R - L) * generation) / model.xMax;
  const Y = (value: number) => B - ((B - T) * value) / model.yMax;

  const line = (points: readonly PlotPoint[], pick: (p: PlotPoint) => number) => points.map((p, k) => `${k ? 'L' : 'M'}${X(p.generation)},${Y(pick(p))}`).join(' ');
  const band = (points: readonly PlotPoint[]) =>
    points.length === 0 ? '' : `${line(points, (p) => p.max)} ${[...points].reverse().map((p) => `L${X(p.generation)},${Y(p.min)}`).join(' ')} Z`;

  // the cursor's generation belongs to both halves so the line is unbroken
  const upToNow = $derived(model.points.filter((p) => p.generation <= model.now));
  const fromNow = $derived(model.points.filter((p) => p.generation >= model.now));

  const series = [
    { key: 'average', label: 'average', color: 'var(--s1)', dash: 'none', marker: 'circle', pick: (p: PlotPoint) => p.average },
    { key: 'bestSoFar', label: 'best so far', color: 'var(--s3)', dash: '7 4', marker: 'triangle', pick: (p: PlotPoint) => p.bestSoFar },
    { key: 'best', label: 'best of generation', color: 'var(--s2)', dash: 'none', marker: 'square', pick: (p: PlotPoint) => p.best },
  ] as const;

  const summary = $derived.by(() => {
    const at = model.points[Math.min(model.now, model.points.length - 1)]!;
    return `Fitness by generation, scale 0 to ${num(model.yMax)}. Generation ${at.generation}: average ${num(at.average)}, best of generation ${at.best}, best so far ${at.bestSoFar}.`;
  });
</script>

<svg viewBox="0 0 {W} {H}" width="100%" role="img" aria-label={summary} data-plot="fitness" data-now={model.now}>
  {#each model.yTicks as v (v)}
    <line class="gr" x1={L} x2={R} y1={Y(v)} y2={Y(v)} />
    <text x={L - 8} y={Y(v) + 6} text-anchor="end">{num(v)}</text>
  {/each}
  {#each model.xTicks as g (g)}
    <text x={X(g)} y={B + 22} text-anchor="middle">{num(g)}</text>
  {/each}
  <text x={(L + R) / 2} y={H - 6} text-anchor="middle" style="font-size:16px">generation</text>

  {#if model.optimum !== undefined}
    <line x1={L} x2={R} y1={Y(model.optimum)} y2={Y(model.optimum)} stroke="var(--ink2)" stroke-width="1.5" stroke-dasharray="2 5" data-optimum={model.optimum} />
    <text x={R} y={Y(model.optimum) - 6} text-anchor="end" style="font-size:16px">optimum {num(model.optimum)}</text>
  {/if}

  <path d={band(upToNow)} fill="var(--s1)" opacity=".14" data-series="band" />
  <path d={band(fromNow)} fill="var(--s1)" opacity=".06" data-series="band-future" />

  {#each series as s (s.key)}
    <path d={line(fromNow, s.pick)} fill="none" stroke={s.color} stroke-width="2" stroke-dasharray={s.dash} opacity=".3" />
    <path d={line(upToNow, s.pick)} fill="none" stroke={s.color} stroke-width="2.5" stroke-dasharray={s.dash} data-series={s.key} />
    {#each model.points as p (p.generation)}
      {@const x = X(p.generation)}
      {@const y = Y(s.pick(p))}
      {@const o = p.future ? 0.3 : 1}
      {#if s.marker === 'square'}
        <rect x={x - 5} y={y - 5} width="10" height="10" fill={s.color} stroke="var(--surface)" stroke-width="2" opacity={o} data-series={s.key} data-gen={p.generation} data-value={s.pick(p)} data-future={p.future}><title>generation {p.generation}: {s.label} {num(s.pick(p))}</title></rect>
      {:else if s.marker === 'triangle'}
        <path d="M{x},{y - 7} L{x + 7},{y + 5} L{x - 7},{y + 5} Z" fill={s.color} stroke="var(--surface)" stroke-width="2" opacity={o} data-series={s.key} data-gen={p.generation} data-value={s.pick(p)} data-future={p.future}><title>generation {p.generation}: {s.label} {num(s.pick(p))}</title></path>
      {:else}
        <circle cx={x} cy={y} r="5" fill={s.color} stroke="var(--surface)" stroke-width="2" opacity={o} data-series={s.key} data-gen={p.generation} data-value={s.pick(p)} data-future={p.future}><title>generation {p.generation}: {s.label} {num(s.pick(p))}</title></circle>
      {/if}
    {/each}
  {/each}

  <line x1={X(model.now)} x2={X(model.now)} y1={T} y2={B} stroke="var(--ink)" stroke-width="2" data-now-line />
  <text class="ink" x={X(model.now)} y={T - 8} text-anchor="middle" style="font-weight:700;font-size:16px">now</text>
</svg>

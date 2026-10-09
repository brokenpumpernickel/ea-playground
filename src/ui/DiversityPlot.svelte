<script lang="ts">
  import { num } from './format';
  import type { PlotModel } from './plot-models';

  let { model }: { model: PlotModel } = $props();

  const W = 520;
  const H = 188;
  const L = 56;
  const R = 500;
  const T = 28;
  const B = 138;
  const X = (generation: number) => L + ((R - L) * generation) / model.xMax;
  const Y = (value: number) => B - (B - T) * value;
  const yTicks = [0, 0.5, 1];

  const line = (points: typeof model.points) => points.map((p, k) => `${k ? 'L' : 'M'}${X(p.generation)},${Y(p.diversity)}`).join(' ');
  const upToNow = $derived(model.points.filter((p) => p.generation <= model.now));
  const fromNow = $derived(model.points.filter((p) => p.generation >= model.now));
  const summary = $derived.by(() => {
    const at = model.points[Math.min(model.now, model.points.length - 1)]!;
    return `Diversity by generation, scale 0 to 1. Generation ${at.generation}: ${num(at.diversity)}, ${at.distinct} distinct chromosomes.`;
  });
</script>

<svg viewBox="0 0 {W} {H}" width="100%" role="img" aria-label={summary} data-plot="diversity" data-now={model.now}>
  {#each yTicks as v (v)}
    <line class="gr" x1={L} x2={R} y1={Y(v)} y2={Y(v)} />
    <text x={L - 8} y={Y(v) + 6} text-anchor="end">{num(v)}</text>
  {/each}
  {#each model.xTicks as g (g)}
    <text x={X(g)} y={B + 22} text-anchor="middle">{num(g)}</text>
  {/each}
  <text x={(L + R) / 2} y={H - 6} text-anchor="middle" style="font-size:16px">generation</text>

  <path d={line(fromNow)} fill="none" stroke="var(--s7)" stroke-width="2" opacity=".3" />
  <path d={line(upToNow)} fill="none" stroke="var(--s7)" stroke-width="2.5" data-series="diversity" />
  {#each model.points as p (p.generation)}
    <circle cx={X(p.generation)} cy={Y(p.diversity)} r="5" fill="var(--s7)" stroke="var(--surface)" stroke-width="2" opacity={p.future ? 0.3 : 1} data-series="diversity" data-gen={p.generation} data-value={p.diversity} data-distinct={p.distinct} data-future={p.future}>
      <title>generation {p.generation}: diversity {num(p.diversity)}, {p.distinct} distinct</title>
    </circle>
  {/each}
  <line x1={X(model.now)} x2={X(model.now)} y1={T} y2={B} stroke="var(--ink)" stroke-width="2" data-now-line />
  <text class="ink" x={X(model.now) + (model.now === 0 ? 8 : 0)} y={T - 8} text-anchor={model.now === 0 ? 'start' : 'middle'} style="font-weight:700;font-size:16px">now</text>
</svg>

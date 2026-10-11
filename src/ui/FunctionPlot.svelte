<script lang="ts">
  import { num } from './format';
  import type { LandscapeModel } from './landscape-model';

  let { model }: { model: LandscapeModel } = $props();

  const W = 1000;
  const H = 188;
  const L = 66;
  const R = 970;
  const T = 28;
  const B = 138;
  const X = (x: number) => L + ((R - L) * (x - model.domain[0])) / (model.domain[1] - model.domain[0]);
  const Y = (y: number) => B - ((B - T) * y) / model.yMax;
  const path = $derived(model.curve.map((p, k) => `${k ? 'L' : 'M'}${X(p.x)},${Y(p.y)}`).join(' '));
  const summary = $derived(
    `${model.label} over ${model.domain[0]} to ${model.domain[1]}. ${model.size} individuals at ${model.marks.length} different values: ${model.marks.map((m) => `x = ${m.x}${m.count > 1 ? ` (${m.count} individuals)` : ''}, fitness ${m.fitness}`).join('; ')}.`,
  );
</script>

<svg viewBox="0 0 {W} {H}" width="100%" role="img" aria-label={summary} data-plot="function">
  {#each model.yTicks as v (v)}
    <line class="gr" x1={L} x2={R} y1={Y(v)} y2={Y(v)} />
    <text x={L - 8} y={Y(v) + 6} text-anchor="end">{num(v)}</text>
  {/each}
  {#each model.xTicks as x (x)}
    <text x={X(x)} y={B + 22} text-anchor="middle">{x}</text>
  {/each}
  <text x={R + 8} y={B + 22} style="font-size:16px">x</text>

  <path d={path} fill="none" stroke="var(--ink2)" stroke-width="2.5" data-curve />
  {#each model.curve as p (p.x)}<circle cx={X(p.x)} cy={Y(p.y)} r="2.5" fill="var(--ink2)" opacity=".55" />{/each}

  {#each model.marks as m (m.x)}
    {@const x = X(m.x)}
    {@const y = Y(m.fitness)}
    <g data-mark data-x={m.x} data-fitness={m.fitness} data-count={m.count} data-best={m.best}>
      <title>x = {m.x}, fitness {m.fitness}{m.count > 1 ? `, ${m.count} individuals` : ''}{m.best ? ' (best)' : ''}</title>
      <line x1={x} x2={x} y1={B} y2={y} stroke="var(--s2)" stroke-width={m.best ? 3.5 : 2.5} stroke-dasharray="6 4" />
      <circle cx={x} cy={B} r={m.best ? 8 : 6} fill="var(--s2)" stroke="var(--surface)" stroke-width="2" />
      <path d="M{x},{y - 8} L{x + 8},{y} L{x},{y + 8} L{x - 8},{y} Z" fill="var(--s2)" stroke="var(--ink)" stroke-width={m.best ? 3 : 1.5} />
      <text class="ink" {x} y={y - 14} text-anchor="middle" style="font-weight:700;font-size:16px">{m.count > 1 ? `×${m.count}` : ''}</text>
      <text class="ink" x={x + 10} y={B - 8} style="font-weight:700;font-size:16px">{m.x}</text>
    </g>
  {/each}
</svg>

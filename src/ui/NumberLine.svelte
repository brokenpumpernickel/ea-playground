<script lang="ts">
  import { formatReal } from '../engine';
  import type { LineMark } from './landscape-card-models';

  /**
   * One gene's values on a line: the widened interval BLX-α draws from (dashed band), the interval between the parents (solid
   * band), the parents (circles, A and B above) and the children (triangles, O1 and O2 below; a child cut to a bound has a bar
   * at the line's end). Shapes and labels carry the meaning, not colour. The numbers are in the text beside it, so this is hidden
   * from screen readers.
   */
  let {
    lo,
    hi,
    marks,
    widened,
    parents,
    width = 640,
  }: {
    lo: number;
    hi: number;
    marks: readonly LineMark[];
    widened?: { from: number; to: number };
    parents?: { from: number; to: number };
    width?: number;
  } = $props();

  const X = (fraction: number) => 14 + fraction * (width - 28);
  const ticks = $derived([lo, hi]);
</script>

<svg class="nline" viewBox="0 0 {width} 52" {width} height="52" aria-hidden="true" data-testid="number-line" data-lo={lo} data-hi={hi}>
  <line x1="14" x2={width - 14} y1="26" y2="26" class="axis" />
  {#if widened}<rect class="band wide" x={X(widened.from)} y="19" width={Math.max(0, X(widened.to) - X(widened.from))} height="14" data-band="widened" />{/if}
  {#if parents}<rect class="band par" x={X(parents.from)} y="19" width={Math.max(0, X(parents.to) - X(parents.from))} height="14" data-band="parents" />{/if}
  {#each marks as m (m.label)}
    <g data-mark={m.label} data-fraction={m.fraction} data-clamped={m.clamped ? 'true' : undefined}>
      {#if m.kind === 'parent'}
        <circle class="mk parent" cx={X(m.fraction)} cy="26" r="7" />
        <text class="lab" x={X(m.fraction)} y="11" text-anchor="middle">{m.label}</text>
      {:else}
        <path class="mk child" d="M{X(m.fraction)},14 l8,15 l-16,0 z" />
        <text class="lab" x={X(m.fraction)} y="44" text-anchor="middle">{m.label}</text>
        {#if m.clamped}<line class="clampbar" x1={X(m.fraction)} x2={X(m.fraction)} y1="10" y2="34" />{/if}
      {/if}
    </g>
  {/each}
  {#each ticks as t, k (k)}<text class="tick" x={k === 0 ? 14 : width - 14} y="50" text-anchor={k === 0 ? 'start' : 'end'}>{formatReal([t], 1)}</text>{/each}
</svg>

<script lang="ts">
  import type { DrawnMark, DrawnMarks } from './landscape-marks';

  /**
   * The population drawn over a picture of the landscape (the heatmap or the surface), as an SVG laid over the canvas so every
   * mark is an element with its place in data attributes. An individual is a circle, an elite a diamond, the best a star, a
   * parent a square (with A or B for the pair being made), an offspring a triangle (with an arrow from where a mutated one was),
   * a mark behind a ridge a dashed ring; the selected one has a ring and a cross; earlier generations are fading dots. Shape and
   * label carry the meaning, not colour. The marks are decoration for the sentence and the table that describe the population,
   * so the layer is hidden from screen readers; a click selects, and the heatmap's layer also takes the keyboard.
   */
  let {
    drawn,
    width,
    height,
    selectedId,
    onselect,
    keyboard = false,
    keyLabel = '',
    testid = 'marks',
  }: {
    drawn: DrawnMarks;
    width: number;
    height: number;
    selectedId?: number | undefined;
    onselect?: (id: number | undefined) => void;
    /** Takes the keyboard: left and right arrows select the previous or next individual, Home and End the first and last, Escape clears. */
    keyboard?: boolean;
    keyLabel?: string;
    testid?: string;
  } = $props();

  const ids = $derived(drawn.individuals.map((d) => d.id!));
  const move = (to: number | undefined) => onselect?.(to === selectedId ? undefined : to);
  const keydown = (event: KeyboardEvent) => {
    if (!keyboard || ids.length === 0) return;
    const at = selectedId === undefined ? -1 : ids.indexOf(selectedId);
    let next: number | undefined;
    if (event.key === 'ArrowRight') next = ids[(at + 1) % ids.length];
    else if (event.key === 'ArrowLeft') next = ids[(at <= 0 ? ids.length : at) - 1];
    else if (event.key === 'Home') next = ids[0];
    else if (event.key === 'End') next = ids[ids.length - 1];
    else if (event.key === 'Escape' && selectedId !== undefined) {
      event.preventDefault();
      event.stopPropagation();
      onselect?.(undefined);
      return;
    } else return;
    event.preventDefault();
    event.stopPropagation();
    if (next !== undefined) onselect?.(next);
  };
  const click = (id: number | undefined) => (event: MouseEvent) => {
    event.stopPropagation();
    move(id);
  };

  const star = (cx: number, cy: number, r: number) =>
    Array.from({ length: 10 }, (_, k) => {
      const a = -Math.PI / 2 + (k * Math.PI) / 5;
      const rr = k % 2 ? r * 0.5 : r + 3;
      return `${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`;
    }).join(' ');
  const r = 7;
  const label = (d: DrawnMark) => (d.clamped.length > 0 ? `${d.label} ▮` : d.label);
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<svg
  class="marks"
  viewBox="0 0 {width} {height}"
  {width}
  {height}
  data-testid={testid}
  tabindex={keyboard ? 0 : undefined}
  role={keyboard ? 'group' : undefined}
  aria-label={keyboard ? keyLabel : undefined}
  aria-hidden={keyboard ? undefined : 'true'}
  onkeydown={keydown}
>
  <defs>
    <marker id="arrowhead-{testid}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="arrowhead" /></marker>
  </defs>
  {#each drawn.trails as t (t.generation)}
    <g class="trail" data-generation={t.generation} style="opacity:{t.opacity}">
      {#each t.dots as d, k (k)}<circle cx={d.px} cy={d.py} r="3.4" class="dot" />{/each}
    </g>
  {/each}
  {#each drawn.individuals as d (d.key)}
    <g
      class="mk {d.shape}"
      class:hidden={d.hidden}
      class:selected={d.selected}
      data-marker="individual"
      data-id={d.id}
      data-shape={d.shape}
      data-hidden={d.hidden ? 'true' : undefined}
      data-selected={d.selected ? 'true' : undefined}
      data-x={d.point.x}
      data-y={d.point.y}
      data-px={d.px}
      data-py={d.py}
      onclick={click(d.id)}
      role="presentation"
    >
      {#if d.selected}
        <circle class="ring" cx={d.px} cy={d.py} r={r + 7} />
        <path class="cross" d="M{d.px - r - 13},{d.py} h8 M{d.px + r + 5},{d.py} h8 M{d.px},{d.py - r - 13} v8 M{d.px},{d.py + r + 5} v8" />
      {/if}
      {#if d.hidden}
        <circle class="ghost" cx={d.px} cy={d.py} r={r - 1} />
      {:else if d.shape === 'circle'}
        <circle class="body" cx={d.px} cy={d.py} r={r} />
      {:else if d.shape === 'diamond'}
        <path class="body" d="M{d.px},{d.py - r - 2} L{d.px + r + 2},{d.py} L{d.px},{d.py + r + 2} L{d.px - r - 2},{d.py} z" />
      {:else if d.shape === 'star'}
        <polygon class="body" points={star(d.px, d.py, r)} />
      {:else}
        <rect class="body" x={d.px - r} y={d.py - r} width={2 * r} height={2 * r} />
      {/if}
      {#if d.label}<text class="lab" x={d.px + r + 4} y={d.py - r} text-anchor="start">{d.label}</text>{/if}
    </g>
  {/each}
  {#each drawn.children as c (c.key)}
    <g class="mk triangle" class:current={c.current} data-marker="child" data-offspring={c.offspring} data-shape="triangle" data-x={c.point.x} data-y={c.point.y} data-px={c.px} data-py={c.py} data-clamped={c.clamped.length > 0 ? c.clamped.join(',') : undefined} role="presentation">
      {#if c.arrow}
        <circle class="ghost" cx={c.arrow.px} cy={c.arrow.py} r={r - 1} />
        <line class="arrowline" x1={c.arrow.px} y1={c.arrow.py} x2={c.px} y2={c.py} marker-end="url(#arrowhead-{testid})" data-testid="mutation-arrow" />
      {/if}
      <path class="body" d="M{c.px},{c.py - r - 1} l{r + 1},{2 * r + 1} l{-2 * r - 2},0 z" />
      <text class="lab" x={c.px + r + 4} y={c.py - r} text-anchor="start">{label(c)}</text>
    </g>
  {/each}
</svg>

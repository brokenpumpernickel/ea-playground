<script lang="ts">
  import { untrack } from 'svelte';
  import MatingPool from './MatingPool.svelte';
  import { num } from './format';
  import type { RouletteModel } from './selection-models';

  /** `animate` only says how the latest pin arrives (a sweep along the rim, or at once). It never changes what is shown. */
  let { model, animate }: { model: RouletteModel; animate: boolean } = $props();

  const C = 170;
  const R = 140;
  const point = (turns: number, radius: number): [number, number] => [C + radius * Math.sin(2 * Math.PI * turns), C - radius * Math.cos(2 * Math.PI * turns)];

  const slices = $derived(
    model.rows.map((row, k) => {
      const [x1, y1] = point(row.lo, R);
      const [x2, y2] = point(row.hi, R);
      const large = row.probability > 0.5 ? 1 : 0;
      const mid = (row.lo + row.hi) / 2;
      // wide slices are labelled inside; narrow ones outside; very thin ones are left to the table
      const label = row.probability >= 0.045 ? point(mid, R * 0.62) : row.probability >= 0.015 ? point(mid, R + 16) : null;
      const full = row.probability >= 0.9999;
      return {
        id: row.id,
        shade: (k % 4) + 1,
        landed: row.highlighted,
        label,
        d: full ? `M${C},${C - R} A${R},${R} 0 1 1 ${C},${C + R} A${R},${R} 0 1 1 ${C},${C - R} Z` : `M${C},${C} L${x1},${y1} A${R},${R} 0 ${large} 1 ${x2},${y2} Z`,
      };
    }),
  );

  const revealed = $derived(model.spins.filter((s) => s.revealed));
  const earlier = $derived(revealed.filter((s) => !s.current));
  const latest = $derived(revealed.find((s) => s.current));
  const target = $derived(latest ? latest.r! : 0);

  // The latest pin sweeps from where it was to its new position when animation is on; otherwise it is simply there.
  let shown = $state(untrack(() => target));
  $effect(() => {
    const to = target;
    const from = untrack(() => shown);
    if (!animate || from === to) {
      shown = to;
      return;
    }
    const started = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - started) / 900);
      const eased = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
      shown = from + (to - from) * eased;
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  });

  const total = $derived(model.rows.reduce((sum, r) => sum + (r.shared ?? r.weight), 0));
  const labels = $derived(model.columns.map((c) => c.label).join(' → '));
  const description = $derived(`Roulette wheel: ${model.rows.map((r) => `individual ${r.id} ${(r.probability * 100).toFixed(1)}%`).join(', ')}`);
</script>

<div class="roulette" class:shared={model.sharing !== undefined} class:many={model.spins.length > 16}>
  <figure class="wheelbox">
    <svg role="img" aria-label={description} viewBox="0 0 340 340" width="350" height="350" data-animated={animate ? 'true' : 'false'}>
      {#each slices as slice (slice.id)}
        <path class="slice" d={slice.d} style="fill:var(--seq{slice.shade})" stroke="var(--surface)" stroke-width={slice.landed ? 5 : 3} data-landed={slice.landed ? 'true' : undefined} />
        {#if slice.label}
          <text x={slice.label[0]} y={slice.label[1] + 7} text-anchor="middle" style="font-weight:700;font-size:22px;fill:var(--ink)">{slice.id}</text>
        {/if}
      {/each}
      <circle cx={C} cy={C} r="8" style="fill:var(--ink)" />
      {#each earlier as spin (spin.spin)}
        {@const [x0, y0] = point(spin.r!, R - 26)}
        {@const [x, y] = point(spin.r!, R + 6)}
        <g data-pin={spin.spin}>
          <line x1={x0} y1={y0} x2={x} y2={y} style="stroke:var(--ink)" stroke-width="2" />
          <circle cx={x} cy={y} r="12" style="fill:var(--surface);stroke:var(--ink)" stroke-width="2" />
          <text {x} y={y + 6} text-anchor="middle" style="font-weight:700;font-size:17px;fill:var(--ink)">{spin.spin}</text>
        </g>
      {/each}
      {#if latest}
        {@const [x0, y0] = point(shown, R - 26)}
        {@const [x, y] = point(shown, R + 6)}
        <g data-pin={latest.spin} data-current="true">
          <line x1={x0} y1={y0} x2={x} y2={y} style="stroke:var(--ink)" stroke-width="4" />
          <circle cx={x} cy={y} r="15" style="fill:var(--s2);stroke:var(--ink)" stroke-width="2" />
          <text {x} y={y + 6} text-anchor="middle" style="font-weight:700;font-size:17px;fill:#fff">{latest.spin}</text>
        </g>
      {/if}
    </svg>
    <figcaption>slice size = probability · pins = spins</figcaption>
  </figure>

  <div class="sidecol">
    {#if model.autoSwitch}
      <div class="notice" data-testid="auto-switch"><b>Switched to Shift automatically.</b> {model.autoSwitch}</div>
    {/if}
    {#if model.sharing}
      <div class="formula" data-testid="sharing-formula">raw fitness → <b>{labels}</b> → weight → <b>÷ niche count</b> (fitness sharing, σ = {num(model.sharing.sigma)}, α = {num(model.sharing.alpha)}) → shared weight → probability (shared weight ÷ {num(total)})</div>
    {:else}
      <div class="formula">raw fitness → <b>{labels}</b> → weight → probability (weight ÷ {num(total)})</div>
    {/if}
    <div class="weights">
      <table aria-label="Selection weights and probabilities">
        <thead>
          <tr>
            <th scope="col">Ind.</th>
            <th scope="col" class="num">Fitness</th>
            {#each model.columns as column (column.label)}
              <th scope="col" class="num">{column.label}{#if column.params}<small>{column.params}</small>{/if}</th>
            {/each}
            {#if model.sharing}
              <th scope="col" class="num" data-col="niche count">Niche count</th>
              <th scope="col" class="num" data-col="shared">Shared</th>
            {/if}
            <th scope="col" class="num">Prob.</th>
            <th scope="col">Interval of r</th>
          </tr>
        </thead>
        <tbody>
          {#each model.rows as row (row.id)}
            <tr data-row={row.id} class:hl={row.highlighted} aria-current={row.highlighted ? 'true' : undefined}>
              <td>{row.id}</td>
              <td class="num">{num(row.fitness)}</td>
              {#each row.steps as step, k (k)}<td class="num">{num(step)}</td>{/each}
              {#if model.sharing}
                <td class="num" data-col="niche count">{num(row.count!)}</td>
                <td class="num" data-col="shared">{num(row.shared!)}</td>
              {/if}
              <td class="num">{row.probability.toFixed(3)}</td>
              <td>[{row.lo.toFixed(3)}, {row.hi.toFixed(3)})</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <ol class="chips" data-testid="spin-chips" aria-label="Spins">
      {#each model.spins as spin (spin.spin)}
        <li class="chip" class:cur={spin.current} class:future={!spin.revealed}>
          {#if spin.revealed}{spin.spin}: r = {num(spin.r!)} → {spin.individualId}{:else}{spin.spin}: not drawn{/if}
        </li>
      {/each}
    </ol>
    <MatingPool pool={model.pool} />
  </div>
</div>

<script lang="ts">
  import { formatReal } from '../engine';
  import Bits from './Bits.svelte';
  import { arithmeticLine, blendLine } from './landscape-card-models';
  import { num } from './format';
  import NumberLine from './NumberLine.svelte';
  import type { PairResult } from './variation-models';

  /**
   * The body of a recombined pair of a real-valued landscape under BLX-α or arithmetic crossover: for BLX-α each gene's
   * interval and draws on a number line, for arithmetic the weight λ, the weighted averages and a line per gene; then the
   * children as pairs with a gene cut to a bound marked. Every number is one of the event's numbers or a function of them.
   */
  let { pair, bounds }: { pair: PairResult; bounds: { lo: number; hi: number } } = $props();

  const f3 = (v: number) => formatReal([v], 3);
  const names = ['x', 'y'] as const;
  // the exact numbers of the event, not the rounded text
  const parentA = $derived([...(pair.parentA.values ?? [0, 0])]);
  const parentB = $derived([...(pair.parentB.values ?? [0, 0])]);
  const kids = $derived(pair.children.map((c) => [...(c.values ?? [0, 0])]));
  const arithmetic = $derived(pair.lambda !== undefined && kids.length >= 2 ? arithmeticLine({ lambda: pair.lambda, parentA, parentB, children: [kids[0]!, kids[1]!], bounds }) : undefined);
  const weight = (v: number) => num(v);
  const clampText = (raw: number, value: number) => `▮ clamped to ${f3(value)} (the draw gave ${f3(raw)})`;
</script>

{#if pair.blend}
  <div class="lc-genes" data-testid="blend-card">
    {#each pair.blend as g (g.gene)}
      {@const line = blendLine(g)}
      <div class="lc-gene" data-gene={g.name}>
        <div class="lc-gl"><b>gene {g.name}</b> · A = {f3(g.a)}, B = {f3(g.b)} · d = {f3(g.d)} → interval [{f3(g.from)}, {f3(g.to)}]</div>
        <NumberLine lo={line.lo} hi={line.hi} marks={line.marks} widened={line.widened} parents={line.parents} />
        <div class="lc-gd">
          draws u = {num(g.draws[0])} → <b>O1 {f3(g.values[0])}</b>{#if g.clamped[0]} <span class="clamp">{clampText(g.raw[0], g.values[0])}</span>{/if}
          · u = {num(g.draws[1])} → <b>O2 {f3(g.values[1])}</b>{#if g.clamped[1]} <span class="clamp">{clampText(g.raw[1], g.values[1])}</span>{/if}
        </div>
      </div>
    {/each}
  </div>
{:else if arithmetic}
  <div class="lc-genes" data-testid="arithmetic-card">
    <div class="lc-gl"><b>λ = {num(pair.lambda!)}</b> (the draw after u)</div>
    <table class="lc-tab" aria-label="Arithmetic crossover">
      <thead><tr><th scope="col"></th><th scope="col">x</th><th scope="col">y</th></tr></thead>
      <tbody>
        <tr><th scope="row">Parent A (individual {pair.parentA.id})</th><td>{f3(parentA[0]!)}</td><td>{f3(parentA[1]!)}</td></tr>
        <tr><th scope="row">Parent B (individual {pair.parentB.id})</th><td>{f3(parentB[0]!)}</td><td>{f3(parentB[1]!)}</td></tr>
        <tr class="ch"><th scope="row">O1 = {weight(arithmetic.weights.o1[0])}·A + {weight(arithmetic.weights.o1[1])}·B</th><td>{f3(kids[0]![0]!)}</td><td>{f3(kids[0]![1]!)}</td></tr>
        <tr class="ch"><th scope="row">O2 = {weight(arithmetic.weights.o2[0])}·A + {weight(arithmetic.weights.o2[1])}·B</th><td>{f3(kids[1]![0]!)}</td><td>{f3(kids[1]![1]!)}</td></tr>
      </tbody>
    </table>
    {#each arithmetic.lines as line, i (i)}
      <div class="lc-gene" data-gene={names[i]}>
        <div class="lc-gl"><b>gene {names[i]}</b></div>
        <NumberLine lo={line.lo} hi={line.hi} marks={line.marks} />
      </div>
    {/each}
  </div>
{/if}

<div class="lc-kids" data-testid="children-pairs">
  {#each pair.children as child (child.offspring)}
    <div class="crow" class:dropped={child.discarded} data-child={child.offspring}>
      <span class="who">O{child.offspring}</span>
      <Bits chromosome={child.bits} clamped={child.clamped} />
      {#if child.clamped.length > 0}<span class="badge flip"><span aria-hidden="true">▮</span> {child.clamped.map((g) => `gene ${names[g - 1]}`).join(' and ')} clamped to the bound</span>{/if}
      {#if child.discarded}<span class="badge x"><span aria-hidden="true">✕</span> dropped (odd count)</span>{/if}
    </div>
  {/each}
</div>

<script lang="ts">
  import { formatReal } from '../engine';
  import Bits from './Bits.svelte';
  import { num } from './format';
  import type { MutationModel, MutationRow } from './variation-models';

  /**
   * One offspring of a real-valued landscape under Gaussian mutation: per gene the value before, the draw u that decided
   * whether it mutates (per-gene mode), and for a mutating gene the two uniform draws, z, the step σ × range × z, and the
   * value after with a clamp marked. Every number is one of the event's numbers or a function of them.
   */
  let { row, model }: { row: MutationRow; model: MutationModel } = $props();

  const f3 = (v: number) => formatReal([v], 3);
  const names = ['x', 'y'] as const;
  const pm = $derived(num(model.threshold));
  const sigma = $derived(row.gaussian?.sigma ?? 0);
  const signed = (v: number) => `${v < 0 ? '−' : '+'}${f3(Math.abs(v))}`;
  const z = (v: number) => num(v).replace('-', '−');
  const clampedGenes = $derived((row.gaussian?.genes ?? []).filter((g) => g.clamped).map((g) => g.gene));
</script>

{#if row.revealed && row.gaussian}
  {#if model.mode === 'per-individual' && model.enabled}
    <p class="lc-gd" data-testid="individual-draw">
      {#if row.individualDraw !== undefined}u = {num(row.individualDraw)} {row.chosenGene ? '<' : '≥'} pm {pm}{#if row.chosenGene} → mutated; one more draw r = {num(row.chosenGene.r)} picks gene {names[row.chosenGene.gene - 1]}{:else} → unchanged{/if}{/if}
    </p>
  {/if}
  <table class="lc-tab mt" aria-label={`Gaussian mutation of offspring ${row.offspring}`}>
    <thead>
      <tr><th scope="col">Gene</th><th scope="col">Before</th><th scope="col">Draw</th><th scope="col">Normal draw</th><th scope="col">Step</th><th scope="col">After</th></tr>
    </thead>
    <tbody>
      {#each row.gaussian.genes as g (g.gene)}
        <tr class:hit={g.mutated} data-gene={names[g.gene - 1]}>
          <th scope="row">{names[g.gene - 1]}</th>
          <td class="num">{f3(g.before)}</td>
          <td>
            {#if model.mode === 'per-gene' && g.u !== undefined}u = {num(g.u)} {g.mutated ? '<' : '≥'} pm {pm}
            {:else if g.mutated}chosen
            {:else}<span class="muted">—</span>{/if}
          </td>
          <td>
            {#if g.mutated}u₁ = {num(g.u1!)}, u₂ = {num(g.u2!)} → z = {z(g.z!)}{:else}<span class="muted">no draw for z: this gene is not mutated</span>{/if}
          </td>
          <td>
            {#if g.mutated}σ·range·z = {num(sigma)}·{f3(g.range)}·{z(g.z!)} = <b>{signed(g.step!)}</b>{:else}<span class="muted">—</span>{/if}
          </td>
          <td class="num">
            {#if g.mutated}<b>{f3(g.after)}</b>{#if g.clamped} <span class="clamp"><span aria-hidden="true">▮</span> clamped (raw {f3(g.raw!)})</span>{/if}{:else}{f3(g.after)} <span class="muted">unchanged</span>{/if}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
  <div class="crow res">
    <span class="who sub">result</span>
    <Bits chromosome={row.after!} small flipped={row.flipped} clamped={clampedGenes} />
    {#if row.decision === 'mutated'}
      <span class="badge flip"><span aria-hidden="true">✱</span> {row.flipped.length === 1 ? `gene ${names[row.flipped[0]! - 1]}: ${f3(row.gaussian.genes[row.flipped[0]! - 1]!.before)} → ${f3(row.gaussian.genes[row.flipped[0]! - 1]!.after)}` : 'genes x and y moved'}</span>
    {:else if row.decision === 'bypassed'}<span class="badge bypass"><span aria-hidden="true">⤼</span> bypassed: mutation is off</span>
    {:else}<span class="muted">unchanged</span>{/if}
  </div>
{/if}

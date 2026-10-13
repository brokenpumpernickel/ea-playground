<script lang="ts">
  import { getContext } from 'svelte';
  import Bits from './Bits.svelte';
  import BlockRow from './BlockRow.svelte';
  import { blockContextKey, type BlockGetter } from './block-context';
  import { blockMutation, describeCancel, describeChange } from './block-model';
  import { formatReal } from '../engine';
  import FlipTable from './FlipTable.svelte';
  import { drawText } from './draw-text';
  import { geneList, num } from './format';
  import GaussianCard from './GaussianCard.svelte';
  import { landscapeContextKey, type LandscapeGetter } from './landscape-context';
  import { revealWhenCurrent } from './reveal';
  import TargetRow from './TargetRow.svelte';
  import TourMutationCard from './TourMutationCard.svelte';
  import type { MutationModel, MutationRow } from './variation-models';

  let { model }: { model: MutationModel } = $props();
  const getBlocks = getContext<BlockGetter | undefined>(blockContextKey);
  const blocks = $derived(getBlocks?.());
  const getLand = getContext<LandscapeGetter | undefined>(landscapeContextKey);
  const land = $derived(getLand?.());
  const f3 = (v: number) => formatReal([v], 3);
  const signed = (v: number) => `${v < 0 ? '−' : '+'}${f3(Math.abs(v))}`;
  /** The chromosome the flip table reads: the offspring the cursor is on, or the first one. */
  const flipSource = $derived((model.rows.find((r) => r.current) ?? model.rows[0])?.before);

  const genes = $derived(Array.from({ length: model.geneCount }, (_, k) => k + 1));
  const pm = $derived(num(model.threshold));

  /** A draw under its gene: in full, or shortened where the columns are narrow or crowded (see `drawText`). */
  const layout = $derived({ geneCount: model.geneCount, trapBlocks: blocks !== undefined, landscapeBits: land !== undefined && land.representation !== 'real' });
  const shown = (symbol: string) => (symbol === ' ' ? '␣' : symbol);
  /** With several symbols per gene each change says what the gene became and which draw r chose it. */
  const changed = (c: MutationRow['changes'][number]) => `gene ${c.gene}: ${shown(c.from)} → ${shown(c.to)}`;
  const flipLabel = (row: MutationRow): string => (row.flipped.length === 1 ? `✱ ${changed(row.changes[0]!)}` : `✱ ${geneList(row.flipped)} flipped`);
  /** Letters with a draw under each one, instead of a column per gene. */
  const underEach = $derived(
    model.enabled && (((model.multiSymbol || model.geneCount > 8) && model.mode === 'per-gene') || (land !== undefined && land.representation !== 'real' && model.geneCount > 8 && model.mode === 'per-individual')),
  );
</script>

{#snippet outcome(row: MutationRow)}
  {#if row.decision === 'mutated'}
    <span class="badge flip">
      {#if model.multiSymbol}✱ {#each row.changes as c, k (c.gene)}{#if k > 0} · {/if}<span data-replacement={c.gene}>{changed(c)} <small>(r = {num(c.r!)})</small></span>{/each}
      {:else}{flipLabel(row)}{/if}
    </span>
  {:else if row.decision === 'bypassed'}<span class="badge bypass"><span aria-hidden="true">⤼</span> bypassed: mutation is off</span>
  {:else}<span class="muted">unchanged</span>{/if}
{/snippet}

{#snippet decoded(row: MutationRow)}
  {#if row.points}
    <span class="dec" data-testid="decoded">→ ({f3(row.points.after.x)}, {f3(row.points.after.y)})</span>
    {#if row.decision === 'mutated'}<span class="dec moved" data-testid="moved">moved {f3(row.points.moved)} (x {signed(row.points.dx)}, y {signed(row.points.dy)})</span>{/if}
  {/if}
{/snippet}

{#snippet blockMarks(row: MutationRow)}
  {#if blocks && row.revealed && row.after}
    {@const m = blockMutation(blocks, row.before, row.after)}
    {#each m.changed as c (c.block)}<span class="badge flip" data-testid="block-change"><span aria-hidden="true">✱</span> {describeChange(c)}</span>{/each}
    {#each m.cancelled as c (c.block)}<span class="badge quiet" data-testid="block-cancel">{describeCancel(c)}</span>{/each}
  {/if}
{/snippet}

<div class="mutation">
  <p class="expl">{model.explanation}</p>
  {#if flipSource && !model.tour}<FlipTable chromosome={flipSource} />{/if}
  {#if model.tour}
    <div class="mwrap mcards">
      {#each model.rows as row (row.offspring)}<TourMutationCard {row} {model} />{/each}
    </div>
  {:else if model.real}
    <div class="mwrap mcards">
      {#each model.rows as row (row.offspring)}
        <section use:revealWhenCurrent={row.current} class="card mcard" class:current={row.current} class:pending={!row.revealed} aria-current={row.current ? 'true' : undefined} data-offspring={row.offspring} data-state={row.revealed ? 'revealed' : 'pending'} aria-label={`Offspring ${row.offspring}`}>
          <div class="crow">
            <span class="who">O{row.offspring}</span>
            <Bits chromosome={row.before} small flipped={row.flipped} />
            <span class="muted">{row.revealed ? 'before' : 'not yet drawn'}</span>
          </div>
          <GaussianCard {row} {model} />
        </section>
      {/each}
    </div>
  {:else if underEach}
    <div class="mwrap mcards">
      <div class="crow ctarget"><span class="who"></span><TargetRow /><BlockRow wide /></div>
      {#each model.rows as row (row.offspring)}
        <section use:revealWhenCurrent={row.current} class="card mcard" class:current={row.current} class:pending={!row.revealed} aria-current={row.current ? 'true' : undefined} data-offspring={row.offspring} data-state={row.revealed ? 'revealed' : 'pending'} aria-label={`Offspring ${row.offspring}`}>
          <div class="crow">
            <span class="who">O{row.offspring}</span>
            <Bits chromosome={row.before} small wideColumns flipped={row.flipped} unders={row.geneDraws?.map((d) => ({ text: drawText(d, layout), flag: d.flipped, value: d.u }))} />
            {#if !row.revealed}<span class="muted">not yet drawn</span>{/if}
            {#if row.individualDraw !== undefined}<span class="dec" data-testid="individual-draw">u = {num(row.individualDraw)} {row.chosenGene ? '<' : '≥'} pm {pm}{#if row.chosenGene} · gene {row.chosenGene.gene} chosen (r = {num(row.chosenGene.r)}){/if}</span>{/if}
          </div>
          {#if row.revealed}
            <div class="crow res">
              <span class="who sub">result</span>
              <Bits chromosome={row.after!} small flipped={row.flipped} />
              {@render outcome(row)}
              {@render decoded(row)}
            </div>
            {#if blocks && row.decision === 'mutated'}<div class="crow blockmarks"><span class="who"></span>{@render blockMarks(row)}</div>{/if}
          {/if}
        </section>
      {/each}
    </div>
  {:else}
  <div class="mwrap">
    <table class="mtable" aria-label="Mutation draws">
      <thead>
        <tr>
          <th scope="col">Offspring<TargetRow /></th>
          {#if model.mode === 'per-gene' && model.enabled}
            {#each genes as g (g)}<th scope="col" class="num">gene {g}</th>{/each}
          {:else if model.enabled}
            <th scope="col">Draw u</th>
            <th scope="col">Gene chosen</th>
          {/if}
          <th scope="col">Result</th>
        </tr>
      </thead>
      <tbody>
        {#each model.rows as row (row.offspring)}
          <tr use:revealWhenCurrent={row.current} class:hl={row.current} aria-current={row.current ? 'true' : undefined} data-offspring={row.offspring} data-state={row.revealed ? 'revealed' : 'pending'}>
            <td><span class="who">O{row.offspring}</span> <Bits chromosome={row.before} small /></td>
            {#if model.mode === 'per-gene' && model.enabled}
              {#each genes as g (g)}
                {@const draw = row.geneDraws?.find((d) => d.gene === g)}
                <td class="num draw" class:flipcell={draw?.flipped} data-gene={g}>
                  {#if draw}{num(draw.u)}{#if draw.flipped} <span title="flipped: u is below pm">✱</span>{/if}{:else}<span class="muted">…</span>{/if}
                </td>
              {/each}
            {:else if model.enabled}
              <td class="draw">
                {#if row.individualDraw !== undefined}u = {num(row.individualDraw)} {row.chosenGene ? '<' : '≥'} pm {pm}{:else}<span class="muted">…</span>{/if}
              </td>
              <td class="draw" class:flipcell={row.chosenGene}>
                {#if row.chosenGene}gene {row.chosenGene.gene} (r = {num(row.chosenGene.r)}){:else if row.revealed}<span class="muted">—</span>{:else}<span class="muted">…</span>{/if}
              </td>
            {/if}
            <td class="result">
              {#if !row.revealed}
                <span class="muted">not yet drawn</span>
              {:else}
                <Bits chromosome={row.after!} small flipped={row.flipped} />
                {@render outcome(row)}
                {@render decoded(row)}
                {#if blocks}<div class="blockmarks">{@render blockMarks(row)}</div>{/if}
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  {/if}
</div>

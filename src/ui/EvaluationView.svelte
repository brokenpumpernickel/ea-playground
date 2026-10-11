<script lang="ts">
  import { getContext } from 'svelte';
  import { bagContextKey, type BagGetter } from './bag-context';
  import Bits from './Bits.svelte';
  import CapacityBar from './CapacityBar.svelte';
  import ItemRow from './ItemRow.svelte';
  import TargetRow from './TargetRow.svelte';
  import { revealWhenCurrent } from './reveal';
  import StackedBag from './StackedBag.svelte';
  import type { EvaluationModel } from './outcome-models';

  let { model }: { model: EvaluationModel } = $props();

  // a knapsack draws the bag of the offspring being scored as a bar of its items; before repair, if it was repaired
  const getBag = getContext<BagGetter | undefined>(bagContextKey);
  const bag = $derived(getBag?.());
  const current = $derived(model.rows.find((r) => r.current && r.revealed));
  const currentOutcome = $derived(bag && current ? bag.outcomeOf([...(current.repairedFrom ?? current.bits)].map(Number)) : undefined);
  const repairedWeight = $derived(current?.repairedFrom && bag ? bag.outcomeOf([...current.repairedFrom].map(Number)).weight : undefined);
</script>

<div class="evaluation">
  <p class="expl">{model.explanation}</p>
  <div class="mwrap">
    <table class="mtable etable" aria-label="Evaluation of offspring">
      <thead>
        <tr>
          <th scope="col">Offspring</th>
          <th scope="col">Chromosome<TargetRow /><ItemRow /></th>
          {#if model.explains}<th scope="col" class="why">What happened</th>{/if}
          {#each model.columns as column, c (column.header)}
            <th scope="col" class="num" class:meter={model.rows.some((r) => r.meters?.[c])}>{column.header}{#if column.note}<span class="colnote">{column.note}</span>{/if}</th>
          {/each}
          <th scope="col">Becomes</th>
        </tr>
      </thead>
      <tbody>
        {#each model.rows as row (row.offspring)}
          <tr use:revealWhenCurrent={row.current} class:hl={row.current} aria-current={row.current ? 'true' : undefined} data-offspring={row.offspring} data-state={row.revealed ? 'revealed' : 'pending'}>
            <td><span class="who">O{row.offspring}</span></td>
            <td><Bits chromosome={row.bits} small flipped={row.flipped} dropped={row.dropped ?? []} /></td>
            {#if row.revealed}
              {#if model.explains}<td class="why" data-col="what happened">{row.why?.summary}</td>{/if}
              {#each model.columns as column, c (column.header)}
                <td class="num" class:meter={row.meters?.[c]} class:strong={c === model.columns.length - 1} data-col={column.header.toLowerCase()}>{#if row.meters?.[c]}<CapacityBar value={row.meters[c]!.value} limit={row.meters[c]!.limit} /> {/if}{row.cells?.[c]}</td>
              {/each}
              <td data-col="id">individual {row.id}</td>
            {:else}
              <td class="muted" colspan={model.columns.length + 1 + (model.explains ? 1 : 0)}>not scored yet</td>
            {/if}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  {#if bag && current && currentOutcome}
    <StackedBag {bag} outcome={currentOutcome} label={`Offspring ${current.offspring}`} {...repairedWeight !== undefined ? { was: repairedWeight } : {}} />
  {/if}
</div>

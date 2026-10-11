<script lang="ts">
  import { itemName, type BagOutcome } from '../engine';
  import type { BagInfo } from './bag-context';

  /**
   * One bag drawn as a bar of its items, in order, each as wide as its weight, with the capacity marked and whatever
   * goes over it hatched (only the penalty method allows that). Beside it, in words, what the bar shows.
   */
  let { bag, outcome, label, was }: { bag: BagInfo; outcome: BagOutcome; label: string; was?: number } = $props();

  // where a bag may be overweight the bar holds all the items, so the capacity mark stays put and nothing runs past the end
  const scale = $derived(bag.mayExceed ? Math.max(bag.capacity * 1.5, bag.items.reduce((t, i) => t + i.weight, 0)) : bag.capacity * 1.5);
  const segments = $derived.by(() => {
    let x = 0;
    const out: { item: number; from: number; to: number; over: boolean }[] = [];
    outcome.packed.forEach((packed, i) => {
      if (!packed) return;
      const from = x;
      const to = Math.min(x + bag.items[i]!.weight, scale);
      const inside = Math.min(to, bag.capacity) - from;
      if (inside > 0) out.push({ item: i, from, to: from + inside, over: false });
      const outside = to - Math.max(from, bag.capacity);
      if (outside > 0) out.push({ item: i, from: Math.max(from, bag.capacity), to, over: true });
      x += bag.items[i]!.weight;
    });
    return out;
  });
  const letters = $derived(outcome.packed.flatMap((p, i) => (p ? [itemName(i)] : [])));
</script>

<div class="bagwrap" data-testid="bag-bar" data-weight={outcome.weight} data-capacity={bag.capacity} data-excess={outcome.excess}>
  <span class="lbl">{label}</span>
  <div class="bigbar" aria-hidden="true">
    {#each segments as s (`${s.item}-${s.over}`)}
      <i class="seg" class:ov={s.over} data-item={itemName(s.item)} data-over={s.over ? 'true' : undefined} style="left:{(s.from / scale) * 100}%;width:{((s.to - s.from) / scale) * 100}%"><b>{itemName(s.item)}</b></i>
    {/each}
    <i class="capline" style="left:{(bag.capacity / scale) * 100}%"></i>
    <span class="captxt" style="left:{(bag.capacity / scale) * 100}%">capacity {bag.capacity}</span>
  </div>
  <span class="legend2">
    {letters.length === 0 ? 'nothing packed' : `${letters.length} ${letters.length === 1 ? 'item' : 'items'}`} · weight {outcome.weight} of {bag.capacity}{#if outcome.excess > 0}{' · '}<b>{outcome.excess} over (hatched)</b>{/if}{#if was !== undefined}{' · '}repaired from {was}{/if}
  </span>
</div>

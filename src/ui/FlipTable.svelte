<script lang="ts">
  import { getContext } from 'svelte';
  import { bitsOfInteger, formatReal, integerOfBits } from '../engine';
  import { flipTable, neighbourBits } from './landscape-card-models';
  import { landscapeContextKey, type LandscapeGetter } from './landscape-context';

  /**
   * What flipping each bit of one variable does to its value, for the same value written in plain binary and in Gray code, and
   * how many bits two neighbouring values differ in: the numbers behind "plain binary has cliffs". It reads the first
   * variable (x) of the chromosome it is given. Draws nothing for the real-valued representation and for the other problems.
   */
  let { chromosome }: { chromosome: string } = $props();
  const getLand = getContext<LandscapeGetter | undefined>(landscapeContextKey);
  const land = $derived(getLand?.());
  const ok = $derived(land !== undefined && land.representation !== 'real' && /^[01]+$/.test(chromosome) && chromosome.length === 2 * land.bits);
  const index = $derived(ok && land ? integerOfBits([...chromosome.slice(0, land.bits)].map(Number), land.representation as 'plain' | 'gray') : 0);
  const f3 = (v: number) => formatReal([v], 3);
  const signed = (v: number) => `${v < 0 ? '−' : '+'}${f3(Math.abs(v))}`;
  const codings = [
    { id: 'plain', name: 'Plain binary' },
    { id: 'gray', name: 'Gray code' },
  ] as const;
  /** The largest jump and how often a neighbouring value differs in more than one bit, over every value (a fact about the coding, not about this offspring). */
  const worst = (coding: 'plain' | 'gray') => {
    const n = land!.bits;
    let max = 0;
    for (let v = 0; v < 2 ** n - 1; v++) max = Math.max(max, neighbourBits(v, n, coding));
    return max;
  };
</script>

{#if ok && land}
  <details class="lc-flip" data-testid="flip-table">
    <summary>What does flipping one bit of x do? <span class="muted">the same value in plain binary and in Gray code</span></summary>
    {#each codings as coding (coding.id)}
      {@const rows = flipTable(index, land.bits, coding.id, land.bounds)}
      <div class="lc-flipblock" data-coding={coding.id}>
        <div class="lc-gl"><b>{coding.name}</b>: x = {f3(rows.length > 0 ? rows[0]!.value - rows[0]!.moves : 0)} is
          {#each bitsOfInteger(index, land.bits, coding.id) as bit, k (k)}<span class="bit sm miniflip" aria-hidden="true">{bit}</span>{/each}
          · neighbouring values differ in {neighbourBits(index, land.bits, coding.id)} bit(s) here, in up to {worst(coding.id)} anywhere</div>
        <table class="lc-tab" aria-label={`${coding.name}: what flipping each bit of x does`}>
          <thead><tr><th scope="col">Flip bit</th>{#each rows as r (r.bit)}<th scope="col" class="num">{r.bit}</th>{/each}</tr></thead>
          <tbody>
            <tr><th scope="row">x becomes</th>{#each rows as r (r.bit)}<td class="num">{f3(r.value)}</td>{/each}</tr>
            <tr class="ch"><th scope="row">moves by</th>{#each rows as r (r.bit)}<td class="num" class:big={Math.abs(r.moves) > (land.bounds.hi - land.bounds.lo) / 4}>{signed(r.moves)}</td>{/each}</tr>
          </tbody>
        </table>
      </div>
    {/each}
  </details>
{/if}

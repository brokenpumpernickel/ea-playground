<script lang="ts">
  import type { SpreadPanel } from './spread-model';

  let { panel }: { panel: SpreadPanel } = $props();

  const share = (v: number) => v.toFixed(2);
  const short = (v: number) => share(v).replace(/^0\./, '.');
  const rows = $derived([
    { name: 'x', now: panel.now.x, bar: panel.bar.x, recent: panel.recent.x },
    { name: 'y', now: panel.now.y, bar: panel.bar.y, recent: panel.recent.y },
  ]);
  const first = $derived(panel.recent.generations[0]!);
  const last = $derived(panel.recent.generations[panel.recent.generations.length - 1]!);
  const caption = 'Standard deviation of the population in each variable, as a share of that variable’s range. 0.5 is the most there can be: half of the population on each bound.';
  const description = $derived(`${caption} Generation ${panel.generation}: x ${share(panel.now.x)}, y ${share(panel.now.y)}.`);
</script>

<div class="spread" role="img" aria-label={description} data-testid="spread" title={caption}>
  {#each rows as row (row.name)}
    <div class="srow" data-var={row.name} data-value={row.now}>
      <b class="sname">{row.name}</b>
      <div class="strack"><div class="sfill" style="width:{Math.max(1, Math.round(row.bar * 100))}%"></div></div>
      <b class="sval">{share(row.now)}</b>
    </div>
  {/each}
  <div class="scap">SD ÷ range; a full bar is 0.5, half on each bound</div>
  {#each rows as row (row.name)}
    <div class="shist" data-var={row.name} data-history={row.recent.join(',')}>{row.name}, gens {first}–{last}: {row.recent.map(short).join(' ')}</div>
  {/each}
</div>

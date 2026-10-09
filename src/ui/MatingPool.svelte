<script lang="ts">
  /** The mating pool, one slot per parent in the order selection chose them; a slot stays empty until its parent is chosen. */
  let { pool }: { pool: readonly (number | null)[] } = $props();
</script>

<div class="poolbox">
  <span class="poollabel">Mating pool</span>
  <ol class="poolstrip" data-testid="mating-pool" aria-label="Mating pool, in selection order">
    {#each pool as id, k (k)}
      <li data-id={id ?? ''} class:filled={id !== null}><span class="slotno">slot {k + 1}</span>{id ?? '—'}</li>
    {/each}
  </ol>
</div>

<script lang="ts">
  /**
   * A small bar of a quantity against its limit (the knapsack's weight against its capacity): filled up to the limit,
   * with whatever goes over drawn hatched beyond a tick at the limit. The text beside it says the same, so the bar
   * is hidden from screen readers and never carries the meaning on its own.
   */
  let { value, limit }: { value: number; limit: number } = $props();

  const scale = $derived(limit * 1.5);
  const filled = $derived((Math.min(value, limit) / scale) * 100);
  const over = $derived((Math.max(0, Math.min(value, scale) - limit) / scale) * 100);
</script>

<span class="capbar" aria-hidden="true" data-value={value} data-limit={limit} data-fill={filled} data-over={over}><i class="fill" style="width:{filled}%"></i><i class="over" style="left:{(limit / scale) * 100}%;width:{over}%"></i><i class="cap" style="left:{(limit / scale) * 100}%"></i></span>

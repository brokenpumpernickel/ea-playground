<script lang="ts">
  import type { Session } from './session.svelte';

  let { session }: { session: Session } = $props();
  const cycle = $derived(session.view.position.cycle);
</script>

<footer style="position:absolute;left:0;top:1014px;width:1920px;height:66px;display:flex;align-items:center;gap:18px;padding:0 24px;background:var(--surface);box-shadow:0 -1px 0 var(--hair)">
  <b style="font-size:20px">Run history</b>
  <span class="muted" style="font-size:19px">viewing generation {cycle} · generations 0–{session.lastCycle} recorded</span>
</footer>

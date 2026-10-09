<script lang="ts">
  import ConfirmDialog from './ConfirmDialog.svelte';
  import type { Session } from './session.svelte';

  let { session }: { session: Session } = $props();
</script>

<ConfirmDialog title="Restart the run?" confirmLabel="Restart and apply" onconfirm={() => session.confirmReset()} oncancel={() => session.cancelReset()}>
  <p data-testid="reset-notice">{session.resetNotice}</p>
  <p class="muted">These settings fix the starting population, so they cannot change a run that is already going. Cancel leaves the run exactly as it is.</p>
</ConfirmDialog>

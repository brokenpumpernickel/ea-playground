<script lang="ts">
  import ConfirmDialog from './ConfirmDialog.svelte';
  import type { Session } from './session.svelte';

  let { session }: { session: Session } = $props();
</script>

<ConfirmDialog title="Discard later generations?" confirmLabel="Discard and apply" onconfirm={() => session.confirmChange()} oncancel={() => session.cancelChange()}>
  <p data-testid="discard-notice">{session.discardNotice}</p>
  <p class="muted">The generations stay as they are until you confirm. Cancel leaves the run and its current settings exactly as they are.</p>
</ConfirmDialog>

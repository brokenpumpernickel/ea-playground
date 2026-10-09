<script lang="ts">
  import { onMount } from 'svelte';
  import type { Session } from './session.svelte';

  let { session }: { session: Session } = $props();

  let cancel: HTMLButtonElement | undefined = $state();
  let confirm: HTMLButtonElement | undefined = $state();

  // the safe choice has the focus, and Tab stays inside the dialog while it is open
  onMount(() => cancel?.focus());
  const keydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      session.cancelChange();
    } else if (event.key === 'Tab') {
      const next = event.shiftKey ? (document.activeElement === cancel ? confirm : cancel) : document.activeElement === confirm ? cancel : confirm;
      event.preventDefault();
      next?.focus();
    }
  };
</script>

<div class="scrim">
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="discard-title" aria-describedby="discard-text" tabindex="-1" onkeydown={keydown}>
    <h2 id="discard-title">Discard later generations?</h2>
    <p id="discard-text" data-testid="discard-notice">{session.discardNotice}</p>
    <p class="muted">The generations stay as they are until you confirm. Cancel leaves the run and its current settings exactly as they are.</p>
    <div class="actions">
      <button class="btn" bind:this={cancel} onclick={() => session.cancelChange()}>Cancel</button>
      <button class="btn primary" bind:this={confirm} onclick={() => session.confirmChange()}>Discard and apply</button>
    </div>
  </div>
</div>


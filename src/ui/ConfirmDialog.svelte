<script lang="ts">
  import { onMount, type Snippet } from 'svelte';

  let {
    title,
    confirmLabel,
    onconfirm,
    oncancel,
    children,
  }: { title: string; confirmLabel: string; onconfirm: () => void; oncancel: () => void; children: Snippet } = $props();

  let cancel: HTMLButtonElement | undefined = $state();
  let confirm: HTMLButtonElement | undefined = $state();

  // the safe choice has the focus, and Tab stays inside the dialog while it is open
  onMount(() => cancel?.focus());
  const keydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      oncancel();
    } else if (event.key === 'Tab') {
      const next = event.shiftKey ? (document.activeElement === cancel ? confirm : cancel) : document.activeElement === confirm ? cancel : confirm;
      event.preventDefault();
      next?.focus();
    }
  };
</script>

<div class="scrim">
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dialog-title" aria-describedby="dialog-text" tabindex="-1" onkeydown={keydown}>
    <h2 id="dialog-title">{title}</h2>
    <div id="dialog-text">{@render children()}</div>
    <div class="actions">
      <button class="btn" bind:this={cancel} onclick={oncancel}>Cancel</button>
      <button class="btn primary" bind:this={confirm} onclick={onconfirm}>{confirmLabel}</button>
    </div>
  </div>
</div>

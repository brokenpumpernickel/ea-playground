<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    label,
    id,
    help,
    error,
    pending,
    wide = false,
    children,
  }: {
    label: string;
    /** The id of the control inside, so the label and the message are tied to it. */
    id: string;
    help?: string;
    error?: string;
    /** Set when this setting has been changed and waits for the next generation boundary; the text says from what. */
    pending?: string;
    wide?: boolean;
    children: Snippet;
  } = $props();
</script>

<div class="ctl" class:wide class:bad={error !== undefined} data-field={id}>
  <label for={id}>
    {label}
    {#if pending !== undefined}<span class="tag pend" data-testid="pending-{id}">pending{pending ? ` · ${pending}` : ''}</span>{/if}
  </label>
  <span class="field">{@render children()}</span>
  {#if help}<p class="help" id="{id}-help">{help}</p>{/if}
  {#if error}<p class="err" role="alert" id="{id}-error">{error}</p>{/if}
</div>

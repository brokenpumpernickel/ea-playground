<script lang="ts">
  import { problemEntries } from './problems';
  import type { Session } from './session.svelte';

  let { session }: { session: Session } = $props();

  let open = $state(false);
  let button: HTMLButtonElement | undefined = $state();
  let items: HTMLElement[] = $state([]);

  const current = $derived(session.problemEntry.id);

  function show() {
    open = true;
    // focus the current problem once the list exists
    queueMicrotask(() => items[Math.max(0, problemEntries.findIndex((p) => p.id === current))]?.focus());
  }
  function close(returnFocus = true) {
    open = false;
    if (returnFocus) button?.focus();
  }
  function choose(id: string) {
    close();
    session.requestProblemSwitch(id);
  }
  function move(from: number, by: number) {
    const next = (from + by + problemEntries.length) % problemEntries.length;
    items[next]?.focus();
  }
  function keydown(event: KeyboardEvent, index: number) {
    if (event.key === 'ArrowDown') (event.preventDefault(), move(index, 1));
    else if (event.key === 'ArrowUp') (event.preventDefault(), move(index, -1));
    else if (event.key === 'Home') (event.preventDefault(), items[0]?.focus());
    else if (event.key === 'End') (event.preventDefault(), items[problemEntries.length - 1]?.focus());
    else if (event.key === 'Escape') (event.preventDefault(), event.stopPropagation(), close());
    else if (event.key === 'Tab') close(false);
  }
</script>

<svelte:window onpointerdown={(e) => open && !(e.target as HTMLElement).closest('.problemmenu') && close(false)} />

<div class="problemmenu">
  <h1 class="t" style="margin:0">
    <button
      class="problembtn"
      bind:this={button}
      aria-haspopup="menu"
      aria-expanded={open}
      aria-controls="problem-list"
      data-testid="problem-button"
      onclick={() => (open ? close() : show())}
      onkeydown={(e) => (e.key === 'ArrowDown' && !open ? (e.preventDefault(), show()) : undefined)}
    >{session.problemEntry.name} <span aria-hidden="true">▾</span></button>
  </h1>
  {#if open}
    <ul id="problem-list" role="menu" aria-label="Problem" class="menulist" data-testid="problem-list">
      {#each problemEntries as entry, k (entry.id)}
        <li role="none">
          <button
            role="menuitemradio"
            aria-checked={entry.id === current}
            class="menuitem"
            bind:this={items[k]}
            tabindex="-1"
            data-problem={entry.id}
            onclick={() => choose(entry.id)}
            onkeydown={(e) => keydown(e, k)}
          ><span aria-hidden="true">{entry.id === current ? '✓' : ''}</span> {entry.name}</button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

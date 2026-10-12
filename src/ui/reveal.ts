/**
 * Svelte action: when the element becomes the current one, scroll it into view inside its scrolling container. The scroll
 * waits for a microtask, so that a card that fills with its content in the same update (a tall one, such as the landscape's
 * crossover cards) is measured at its full height.
 */
export function revealWhenCurrent(node: HTMLElement, current: boolean) {
  const show = (on: boolean) => {
    if (on) queueMicrotask(() => node.scrollIntoView({ block: 'nearest' }));
  };
  show(current);
  return { update: show };
}

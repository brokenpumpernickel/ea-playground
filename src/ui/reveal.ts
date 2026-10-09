/** Svelte action: when the element becomes the current one, scroll it into view inside its scrolling container. */
export function revealWhenCurrent(node: HTMLElement, current: boolean) {
  const show = (on: boolean) => {
    if (on) node.scrollIntoView({ block: 'nearest' });
  };
  show(current);
  return { update: show };
}

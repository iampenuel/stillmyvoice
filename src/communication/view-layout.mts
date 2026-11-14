export function revealDelta(top: number, bottom: number, visibleTop: number, visibleBottom: number) {
  if (top < visibleTop) return top - visibleTop;
  if (bottom > visibleBottom) return bottom - visibleBottom;
  return 0;
}
function bounded(container: HTMLElement) {
  return ['auto', 'scroll'].includes(getComputedStyle(container).overflowY);
}
/** Desktop changes only the owning panel's scroll offset. Reflow may scroll the document. */
export function revealInPanel(element: HTMLElement, container: HTMLElement) {
  const r = element.getBoundingClientRect();
  if (bounded(container)) {
    const c = container.getBoundingClientRect();
    container.scrollTop += revealDelta(r.top - 8, r.bottom + 8, c.top, c.bottom);
  } else {
    element.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
  }
}
export function fullyVisible(element: HTMLElement, container: HTMLElement) {
  const r = element.getBoundingClientRect(), c = container.getBoundingClientRect();
  const top = bounded(container) ? Math.max(0, c.top) : 0;
  const bottom = bounded(container) ? Math.min(innerHeight, c.bottom) : innerHeight;
  if (r.width <= 0 || r.height <= 0 || r.top < top || r.bottom > bottom || r.left < 0 || r.right > innerWidth) return false;
  const foreground = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return !!foreground && element.contains(foreground);
}

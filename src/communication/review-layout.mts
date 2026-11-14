/** Fit exact contiguous text to the actual reading column. No ellipses or normalization. */
export function fitReviewPages(text: string, fits: (text: string) => boolean): string[] {
  const chars = Array.from(text), pages: string[] = [];
  if (!chars.length) return [''];
  for (let at = 0; at < chars.length;) {
    let low = 1, high = chars.length - at, best = 0;
    while (low <= high) {
      const count = Math.floor((low + high) / 2);
      if (fits(chars.slice(at, at + count).join(''))) { best = count; low = count + 1; }
      else high = count - 1;
    }
    // If even one glyph cannot fit, display it but the visibility gate remains
    // closed; never silently omit a character or mark it reviewed.
    best = Math.max(1, best);
    let piece = chars.slice(at, at + best).join('');
    const space = piece.lastIndexOf(' ');
    if (at + best < chars.length && space > piece.length / 2) piece = piece.slice(0, space + 1);
    pages.push(piece); at += Array.from(piece).length;
  }
  return pages;
}
export function measureReviewPages(text: string, element: HTMLElement): string[] {
  const style = getComputedStyle(element), probe = document.createElement('p');
  probe.setAttribute('aria-hidden', 'true');
  Object.assign(probe.style, { position: 'absolute', visibility: 'hidden', pointerEvents: 'none', top: '0', left: '0',
    margin: '0', padding: '0', width: `${element.clientWidth}px`, font: style.font, lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' });
  document.body.append(probe);
  const height = Math.max(Number.parseFloat(style.lineHeight), window.innerHeight * 0.4);
  try { return fitReviewPages(text, value => { probe.textContent = value; return probe.scrollHeight <= height && probe.scrollWidth <= probe.clientWidth; }); }
  finally { probe.remove(); }
}

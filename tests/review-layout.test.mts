import test from 'node:test';
import assert from 'node:assert/strict';
import { fitReviewPages } from '../src/communication/review-layout.mts';
test('measured pagination preserves every character, whitespace, and Unicode at narrow widths', () => {
  const text = 'I am not in pain.\nPlease move my left arm, not my right.  🗣️  End.';
  for (const width of [1, 3, 7, 20, 200]) {
    const pages = fitReviewPages(text, value => Array.from(value).length <= width);
    assert.equal(pages.join(''), text); assert.ok(pages.every(page => Array.from(page).length <= width));
  }
});
test('unrenderable text is retained rather than omitted or substituted', () => {
  assert.deepEqual(fitReviewPages('ABC', () => false), ['A', 'B', 'C']);
});

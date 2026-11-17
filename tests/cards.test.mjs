import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newCard, review, dueCards, preview, RATINGS } from '../js/cards.js';

const now = new Date('2026-11-16T18:00:00Z');

test('a new card is due now and survives JSON (IndexedDB) round trips', () => {
  const c = JSON.parse(JSON.stringify(newCard({ id: 'a', kind: 'fix', front: 'I am agree', back: 'I agree', domain: 'daily', now })));
  assert.equal(dueCards([c], now).length, 1);
  const g = JSON.parse(JSON.stringify(review(c, RATINGS[2].id, now)));
  assert.ok(new Date(g.due) > now, 'Good pushes the card into the future');
  assert.equal(dueCards([g], now).length, 0);
});

test('Easy schedules further out than Again', () => {
  const c = newCard({ id: 'b', kind: 'word', front: 'lead time', back: 'time from order to delivery', domain: 'business', now });
  const again = review(c, RATINGS[0].id, now), easy = review(c, RATINGS[3].id, now);
  assert.ok(new Date(easy.due) > new Date(again.due));
  assert.equal(preview(c, now).length, 4);
});

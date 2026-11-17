import { test } from 'node:test';
import assert from 'node:assert/strict';
import { partnerSystem, parseCoach, transcriptText } from '../js/prompts.js';
import { SCENARIOS } from '../js/content.js';

test('every scenario builds a partner prompt with level, recast rule and style', () => {
  for (const s of SCENARIOS) {
    const p = partnerSystem({ scenario: s.id, level: 2, style: ['More business idioms'] });
    assert.match(p, /B1/);
    assert.match(p, /recast/);
    assert.match(p, /More business idioms/);
    assert.match(p, s.mode === 'listen' ? /listening session/ : /role-play/);
  }
});

test('coach JSON is parsed defensively and clamped', () => {
  const raw = '```json\n{"summary":"Good","scores":{"fluency":12,"accuracy":"7","vocab":0},"findings":[{"said":"I am agree","better":"I agree","why":"agree is a verb","fa":"x","key":"agree"},{"said":"x"},{"said":"a","better":"b"},{"said":"c","better":"d"},{"said":"e","better":"f"}],"words":[{"word":"lead time","meaning":"m"}]}\n```';
  const c = parseCoach(raw);
  assert.deepEqual(c.scores, { fluency: 10, accuracy: 7, vocab: 1 });
  assert.equal(c.findings.length, 3);
  assert.equal(c.findings[0].better, 'I agree');
  assert.equal(c.words[0].word, 'lead time');
  assert.equal(parseCoach('no json here'), null);
});

test('transcript labels both speakers', () => {
  const t = transcriptText([{ role: 'model', text: 'Hi' }, { role: 'user', text: 'Hello' }], 'Marco');
  assert.equal(t, 'MARCO: Hi\nFARBOD: Hello');
});

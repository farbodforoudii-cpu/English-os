import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recommend, scoreDomains, nextLevel, pickMode } from '../js/recommend.js';
import { SCENARIOS, CHARACTERS, DOMAINS } from '../js/content.js';

const now = new Date('2026-11-16T18:00:00Z');
const ago = d => new Date(now - d * 86400000).toISOString();

test('content is consistent', () => {
  for (const s of SCENARIOS) {
    assert.ok(CHARACTERS[s.who], `${s.id} character`);
    assert.equal(CHARACTERS[s.who].domain, s.domain, `${s.id} domain matches character`);
    assert.ok(DOMAINS.find(d => d.id === s.domain && d.active), `${s.id} active domain`);
  }
  assert.equal(new Set(SCENARIOS.map(s => s.id)).size, SCENARIOS.length);
});

test('first run starts with everyday role-play at B1', () => {
  const r = recommend({ now });
  assert.equal(r.domain, 'daily');
  assert.equal(r.mode, 'roleplay');
  assert.equal(r.level, 2);
  assert.match(r.why, /haven’t tried/);
});

test('a domain left alone for days rises to the top', () => {
  const sessions = [
    { at: ago(0.2), domain: 'daily', scenario: 'd-week', mode: 'roleplay' },
    { at: ago(1), domain: 'sport', scenario: 's-acl', mode: 'roleplay' },
    { at: ago(1.5), domain: 'tech', scenario: 't-idea', mode: 'roleplay' },
    { at: ago(4), domain: 'business', scenario: 'b-price', mode: 'roleplay' },
  ];
  const r = recommend({ sessions, now });
  assert.equal(r.domain, 'business');
  assert.notEqual(r.scenario, 'b-price', 'least recently used scenario first');
  assert.match(r.why, /4 days/);
});

test('fatigue: not a third session in a row on the same domain', () => {
  const sessions = [
    { at: ago(0.1), domain: 'business', scenario: 'b-price', mode: 'roleplay' },
    { at: ago(0.2), domain: 'business', scenario: 'b-late', mode: 'roleplay' },
  ];
  const top = scoreDomains({ sessions, now })[0];
  assert.notEqual(top.domain, 'business');
});

test('open mistakes pull their domain forward and name the word', () => {
  const sessions = ['daily', 'business', 'sport', 'tech'].map((d, i) => ({ at: ago(1 + i * 0.01), domain: d, scenario: 'x', mode: 'roleplay' }));
  const mistakes = Array.from({ length: 6 }, () => ({ domain: 'sport', open: true, word: 'would rather' }));
  const r = recommend({ sessions, mistakes, now });
  assert.equal(r.domain, 'sport');
  assert.match(r.why, /would rather/);
});

test('level moves with feedback and stays in 1..5', () => {
  assert.equal(nextLevel([{ at: ago(2), feedback: 'harder' }, { at: ago(1), feedback: 'harder' }]), 4);
  assert.equal(nextLevel(Array.from({ length: 9 }, (_, i) => ({ at: ago(i), feedback: 'easier' }))), 1);
  assert.equal(nextLevel([{ at: ago(1), scores: { fluency: 9, accuracy: 9, vocab: 9 } }]), 3);
});

test('a listening session comes every third time, unless disliked', () => {
  const rp = { mode: 'roleplay' };
  assert.equal(pickMode([rp, rp]), 'listen');
  assert.equal(pickMode([{ mode: 'listen' }, rp]), 'roleplay');
  assert.equal(pickMode([{ mode: 'listen' }, rp, rp]), 'listen');
  const no = { mode: 'listen', feedback: 'other' };
  assert.equal(pickMode([no, rp, no, rp, rp]), 'roleplay');
});

test('skip gives another scenario', () => {
  const a = recommend({ now });
  const b = recommend({ now, skip: [a.scenario] });
  assert.notEqual(a.scenario, b.scenario);
});

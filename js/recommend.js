// Daily scenario recommender. Rule-based and explainable on purpose: every pick comes with one reason.
// Pure functions only (no storage, no DOM), so the whole thing is covered by tests.
import { DOMAINS, SCENARIOS, CHARACTERS } from './content.js';

const DAY = 86400000;
const days = (from, to) => (from ? Math.max(0, (to - new Date(from)) / DAY) : 14);

// sessions: [{ at, domain, scenario, mode, feedback?: 'easier'|'same'|'harder'|'other', scores?: {fluency, accuracy, vocab} }]
// mistakes: [{ domain, open: bool }]  cards: [{ domain, due }]
export function scoreDomains({ sessions = [], mistakes = [], cards = [], now = new Date() }) {
  const recent = [...sessions].sort((a, b) => new Date(b.at) - new Date(a.at));
  return DOMAINS.filter(d => d.active).map(d => {
    const last = recent.find(s => s.domain === d.id);
    const gap = Math.min(days(last && last.at, now), 7);
    const open = mistakes.filter(m => m.domain === d.id && m.open).length;
    const due = cards.filter(c => c.domain === d.id && new Date(c.due) <= now).length;
    // Fatigue: the last two sessions were already this domain.
    const tired = recent.slice(0, 2).length === 2 && recent.slice(0, 2).every(s => s.domain === d.id);
    const parts = { gap, open: Math.min(open, 6) * 0.5, due: Math.min(due, 10) * 0.2, base: d.base, tired: tired ? -3 : 0 };
    const score = parts.gap + parts.open + parts.due + parts.base + parts.tired;
    return { domain: d.id, score, parts, open, due, gap: last ? Math.floor(days(last.at, now)) : null };
  }).sort((a, b) => b.score - a.score);
}

// Level 1..5. Starts at 2 (B1); moves with the one-tap feedback and the coach's scores.
export function nextLevel(sessions = [], start = 2) {
  let lvl = start;
  const ordered = [...sessions].sort((a, b) => new Date(a.at) - new Date(b.at));
  for (const s of ordered) {
    if (s.feedback === 'harder') lvl += 1;
    else if (s.feedback === 'easier') lvl -= 1;
    else if (s.scores) {
      const avg = (s.scores.fluency + s.scores.accuracy + s.scores.vocab) / 3;
      if (avg >= 8.5) lvl += 0.5;
      else if (avg <= 4) lvl -= 0.5;
    }
    lvl = Math.max(1, Math.min(5, lvl));
  }
  return Math.round(lvl);
}

// Mode: role-play by default; a listening session every third time, unless listening keeps getting "other style".
export function pickMode(sessions = []) {
  const listen = sessions.filter(s => s.mode === 'listen');
  const disliked = listen.slice(-2).length === 2 && listen.slice(-2).every(s => s.feedback === 'other');
  if (disliked) return 'roleplay';
  const sinceListen = [...sessions].reverse().findIndex(s => s.mode === 'listen');
  return sinceListen === -1 ? (sessions.length >= 2 ? 'listen' : 'roleplay') : sinceListen >= 2 ? 'listen' : 'roleplay';
}

function why(top, mistakeWord) {
  const name = DOMAINS.find(d => d.id === top.domain).name;
  if (top.parts.open >= 1 && mistakeWord) return `You still mix up “${mistakeWord}”. Let’s use it in ${name.toLowerCase()}.`;
  if (top.gap === null) return `You haven’t tried ${name.toLowerCase()} yet.`;
  if (top.gap >= 2) return `${name} has been quiet for ${top.gap} days.`;
  if (top.due >= 3) return `${top.due} ${name.toLowerCase()} cards are due for review.`;
  return `A fresh ${name.toLowerCase()} situation for today.`;
}

// skip: scenario ids to avoid (e.g. after "choose another").
export function recommend({ sessions = [], mistakes = [], cards = [], now = new Date(), skip = [] } = {}) {
  const ranked = scoreDomains({ sessions, mistakes, cards, now });
  const mode = pickMode(sessions);
  const used = id => {
    const s = [...sessions].reverse().find(x => x.scenario === id);
    return s ? new Date(s.at).getTime() : 0;
  };
  for (const top of ranked) {
    let pool = SCENARIOS.filter(s => s.domain === top.domain && !skip.includes(s.id));
    if (!pool.length) continue;
    const sameMode = pool.filter(s => s.mode === mode);
    if (sameMode.length) pool = sameMode;
    // Least recently used first; ties broken by the date so the pick is stable within a day.
    const seed = Math.floor(now.getTime() / DAY);
    pool.sort((a, b) => used(a.id) - used(b.id) || ((hash(a.id) + seed) % 7) - ((hash(b.id) + seed) % 7));
    const sc = pool[0];
    const m = mistakes.find(x => x.domain === top.domain && x.open && x.word);
    return {
      scenario: sc.id, domain: sc.domain, mode: sc.mode, character: sc.who,
      title: sc.title, goal: sc.goal, line: CHARACTERS[sc.who].line,
      level: nextLevel(sessions),
      why: why(top, m && m.word),
    };
  }
  return null;
}

function hash(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }

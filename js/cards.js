// Review cards on FSRS (ts-fsrs, MIT, vendored). A card is born from a coach finding or a new word.
import { fsrs, createEmptyCard, Rating, generatorParameters } from '../vendor/ts-fsrs.min.mjs';

const f = fsrs(generatorParameters({ enable_fuzz: true, request_retention: 0.9 }));
export const RATINGS = [
  { id: Rating.Again, label: 'Again' },
  { id: Rating.Hard, label: 'Hard' },
  { id: Rating.Good, label: 'Good' },
  { id: Rating.Easy, label: 'Easy' },
];

// kind: 'fix' (you said → better) or 'word' (new word / phrase)
export function newCard({ id, kind, front, back, note = '', fa = '', domain, source, now = new Date() }) {
  return { id, kind, front, back, note, fa, domain, source, created: now.toISOString(), srs: toJSON(createEmptyCard(now)), due: now.toISOString() };
}

export function review(card, rating, now = new Date()) {
  const { card: next } = f.next(fromJSON(card.srs), now, rating);
  return { ...card, srs: toJSON(next), due: next.due.toISOString(), last: now.toISOString() };
}

export const dueCards = (cards, now = new Date()) => cards.filter(c => new Date(c.due) <= now).sort((a, b) => new Date(a.due) - new Date(b.due));

// Interval preview for the four buttons ("1m", "2d" …).
export function preview(card, now = new Date()) {
  const r = f.repeat(fromJSON(card.srs), now);
  return RATINGS.map(x => short(r[x.id].card.due - now));
}

function short(ms) {
  const m = ms / 60000;
  if (m < 60) return `${Math.max(1, Math.round(m))}m`;
  if (m < 1440) return `${Math.round(m / 60)}h`;
  if (m < 43200) return `${Math.round(m / 1440)}d`;
  return `${Math.round(m / 43200)}mo`;
}

const toJSON = c => ({ ...c, due: c.due.toISOString(), last_review: c.last_review ? c.last_review.toISOString() : null });
const fromJSON = c => ({ ...c, due: new Date(c.due), last_review: c.last_review ? new Date(c.last_review) : undefined });

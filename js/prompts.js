// Prompts for the two roles: the Conversation Partner (in character) and the Coach (after the session).
// Kept on the phone so they are versioned and tested with the rest of the app.
import { CHARACTERS, LEVELS, scenarioById } from './content.js';

export function partnerSystem({ scenario, level = 2, style = [], minutes = 15 }) {
  const sc = scenarioById(scenario);
  const ch = CHARACTERS[sc.who];
  const lv = LEVELS[Math.max(0, Math.min(4, level - 1))];
  const listen = sc.mode === 'listen'
    ? `This is a listening session. Open with a short spoken briefing or story about the topic (about 90 to 130 words, at the learner's level), then ask one question about it. After that, discuss it together.`
    : `This is a role-play. Stay in the situation; you have your own goals and constraints. Open with one or two natural sentences that set the scene, then let the learner respond.`;
  return [
    `You are ${ch.name}, a ${ch.role}. ${ch.persona}`,
    `You are talking by voice with Farbod, an Iranian sports-science student, fitness coach and entrepreneur who is improving his English (level ${lv.cefr}).`,
    `Situation: ${sc.title}. His goal: ${sc.goal}`,
    listen,
    `How to speak: ${lv.speech}. Reply in 1 to 3 short spoken sentences (never lists, markdown, emojis or stage directions). Ask a follow-up question most turns. React to what he actually said; disagree or push back when your character would. Bring in a new detail now and then so it never feels scripted.`,
    `Corrections: never stop the conversation to teach. If he makes a clear mistake, naturally reuse the correct form in your reply (a recast) and move on. If he is stuck or asks for a word, give him the word briefly and continue.`,
    `If he speaks Persian or mixes languages, answer in simple English and help him say it in English.`,
    `Keep realistic facts: do not invent wrong technical, medical or trade information. If you are not sure, say so like a real person would.`,
    `The session lasts about ${minutes} minutes. Do not ask for his real personal or business data; invented examples are fine.`,
    style.length ? `His personal style rules (follow them): ${style.map(s => `- ${s}`).join(' ')}` : '',
    PARTNER_FORMAT,
  ].filter(Boolean).join('\n');
}

// The partner answers as JSON so the app can show a Persian translation and help him answer, with no extra call.
export const PARTNER_FORMAT = [
  `Output format: return only JSON, no other text:`,
  `{"reply": "what you say out loud, in English", "fa": "natural Persian translation of your reply", "suggestions": [{"en": "a possible answer Farbod could give", "fa": "its Persian meaning"}]}`,
  `"suggestions" has 2 or 3 short, different answers he could say next (for example agree / disagree / ask a question), at his level, using useful words for this situation. Only "reply" is spoken.`,
].join('\n');

// Defensive parse of a partner turn. If the model ignored the format, the whole text is the reply.
export function parsePartner(text) {
  const raw = String(text || '').trim();
  const s = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a >= 0 && b > a) {
    try {
      const d = JSON.parse(s.slice(a, b + 1));
      if (d && typeof d.reply === 'string' && d.reply.trim()) {
        return {
          reply: d.reply.trim(),
          fa: String(d.fa || '').trim(),
          suggestions: (Array.isArray(d.suggestions) ? d.suggestions : []).filter(x => x && x.en).slice(0, 3)
            .map(x => ({ en: String(x.en).trim(), fa: String(x.fa || '').trim() })),
        };
      }
    } catch { /* fall through */ }
  }
  return { reply: raw.replace(/^[{\["]+|[}\]"]+$/g, '').trim(), fa: '', suggestions: [] };
}

// Warm-up before a session: the phrases he will need.
export function prepSystem({ scenario, level = 2 }) {
  const sc = scenarioById(scenario);
  const lv = LEVELS[Math.max(0, Math.min(4, level - 1))];
  return [
    `You prepare an Iranian adult English learner (level ${lv.cefr}) for a spoken conversation.`,
    `Situation: ${sc.title}. His goal: ${sc.goal}`,
    `Give the 5 most useful words or phrases he will need in this exact situation, and one example sentence each that he could actually say. Keep facts correct.`,
    `Return only JSON: {"tip": "one short sentence of advice in Persian for this conversation", "phrases": [{"en": "phrase", "fa": "معنی فارسی", "example": "example sentence he could say", "example_fa": "ترجمهٔ فارسی جمله"}]}`,
  ].join('\n');
}

export function parsePrep(text) {
  const s = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b < a) return null;
  try {
    const d = JSON.parse(s.slice(a, b + 1));
    const phrases = (Array.isArray(d.phrases) ? d.phrases : []).filter(p => p && p.en).slice(0, 6)
      .map(p => ({ en: String(p.en).trim(), fa: String(p.fa || '').trim(), example: String(p.example || '').trim(), example_fa: String(p.example_fa || '').trim() }));
    return phrases.length ? { tip: String(d.tip || '').trim(), phrases } : null;
  } catch { return null; }
}

export const kickoff = scenario => `[The session starts now. Speak first, in character.]`;

export const COACH_SYSTEM = [
  `You are an expert English coach for an Iranian adult learner at about B1 level. You get the transcript of a voice role-play.`,
  `Lines starting with "FARBOD:" are his (speech-to-text, so ignore missing punctuation, capitalisation and obvious transcription noise). Lines starting with the partner's name are the AI partner's.`,
  `Pick at most 3 findings that matter most for real communication: repeated or meaning-changing grammar errors, wrong or unnatural word choice, missing key domain vocabulary. Skip tiny slips.`,
  `Write all explanations in simple English (B1). Also give a short Persian translation of each explanation.`,
  `Return only JSON with this exact shape:`,
  `{"summary": "one or two encouraging but honest sentences",`,
  ` "scores": {"fluency": 1-10, "accuracy": 1-10, "vocab": 1-10},`,
  ` "findings": [{"said": "his exact words", "better": "natural correct version", "why": "short simple explanation", "fa": "توضیح کوتاه فارسی", "key": "the core word or pattern, 1-3 words"}],`,
  ` "words": [{"word": "useful word or phrase from this topic", "meaning": "simple English meaning", "fa": "معنی فارسی", "example": "short example sentence"}]}`,
  `"words" has 2 to 4 items he did not use but needed, or used once uncertainly.`,
].join('\n');

export function transcriptText(turns, partnerName) {
  return turns.map(t => `${t.role === 'user' ? 'FARBOD' : partnerName.toUpperCase()}: ${t.text}`).join('\n');
}

// Defensive parse: models sometimes wrap JSON in fences or add text around it.
export function parseCoach(text) {
  let s = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b < a) return null;
  let d;
  try { d = JSON.parse(s.slice(a, b + 1)); } catch { return null; }
  const n = v => { const x = Number(v); return Math.max(1, Math.min(10, Math.round(v === '' || v == null || !Number.isFinite(x) ? 5 : x))); };
  const str = v => String(v || '').trim();
  return {
    summary: str(d.summary),
    scores: { fluency: n(d.scores?.fluency), accuracy: n(d.scores?.accuracy), vocab: n(d.scores?.vocab) },
    findings: (Array.isArray(d.findings) ? d.findings : []).filter(f => f && f.said && f.better).slice(0, 3)
      .map(f => ({ said: str(f.said), better: str(f.better), why: str(f.why), fa: str(f.fa), key: str(f.key) })),
    words: (Array.isArray(d.words) ? d.words : []).filter(w => w && w.word).slice(0, 4)
      .map(w => ({ word: str(w.word), meaning: str(w.meaning), fa: str(w.fa), example: str(w.example) })),
  };
}

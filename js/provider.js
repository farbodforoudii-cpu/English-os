// Talks to the «lang» Edge Function. Without a pass the app runs in demo mode: same flow, canned lines,
// the phone's own voice, so the interface can be tried and tested without any key.
import { SUPABASE_URL } from './config.js';
import { CHARACTERS, scenarioById } from './content.js';

const URL_ = `${SUPABASE_URL}/functions/v1/lang`;
let pass = '';
let natural = false; // Natural (Gemini) voice is slower; the phone's own voice answers instantly.
export const setPass = p => { pass = String(p || '').trim(); };
export const setNaturalVoice = v => { natural = !!v; };
export const isDemo = () => !pass;

async function call(body, timeout = 45000, retry = 1) {
  try { return await once(body, timeout); }
  catch (e) {
    // One quiet retry for network hiccups (mobile data, VPN switching); never for a wrong pass.
    if (retry > 0 && !e.status) return call(body, timeout, retry - 1);
    throw e;
  }
}
async function once(body, timeout) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(URL_, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-lang-pass': pass }, body: JSON.stringify(body), signal: ctl.signal });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(d.error || r.statusText), { status: r.status });
    return d;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('The server took too long. Try again.');
    if (/failed to fetch|load failed|network/i.test(e.message)) throw new Error('No connection to the server. Check the internet or VPN.');
    if (e.status === 403) throw new Error('The server pass is wrong. Check it in Settings.');
    throw e;
  } finally { clearTimeout(t); }
}

export const ping = () => call({ action: 'ping' }, 15000);

export async function open({ system, scenario }) {
  if (isDemo()) return demoOpen(scenario);
  const voice = CHARACTERS[scenarioById(scenario).who].voice;
  return call({ action: 'open', system, voice, format: 'json', speak: natural }, 30000);
}

// audio: base64 + mime, or text when typed.
export async function turn({ system, messages, audio, mime, text, scenario }) {
  if (isDemo()) return demoTurn(scenario, text, messages);
  const voice = CHARACTERS[scenarioById(scenario).who].voice;
  return call({ action: 'turn', system, messages, audio, mime, text, voice, format: 'json', speak: natural }, 45000, audio ? 0 : 1);
}

export async function coach({ system, transcript }) {
  if (isDemo()) return { json: JSON.stringify(/prepare an Iranian/.test(system) ? DEMO_PREP : DEMO_COACH) };
  return call({ action: 'coach', system, transcript }, 60000);
}

// ---- demo
const wait = ms => new Promise(r => setTimeout(r, ms));
const DEMO_OPEN = {
  marco: 'Ciao Farbod! Good to finally talk. So, you want our extra virgin oil for your first order. What volume are you thinking about?',
  lena: 'Hello Farbod, thanks for making time. I have read your offer. Before we go further, can you tell me where the product is made and what certificates you have?',
  sam: 'Hey Farbod! I saw an interesting case this week and wanted your opinion. How do you usually decide when an athlete is ready to run again after an ACL reconstruction?',
  priya: 'Hi Farbod! I heard you have an idea for an app. Tell me in two sentences: who is it for, and what problem does it solve?',
  maya: 'Hey Farbod! It’s been a while. How was your week? Anything fun, or was it all work?',
};
const DEMO_REPLIES = [
  'Interesting. Can you tell me a bit more about that?',
  'I see what you mean. But why do you think that is the best option?',
  'Okay, that makes sense. And what would you do if it doesn’t work?',
  'Good point. Let me push back a little, though. Isn’t that a bit risky?',
];
const DEMO_HELP = [{ en: 'It was pretty busy, but good.', fa: 'نسبتاً شلوغ بود، ولی خوب.' }, { en: 'Not bad. What about you?', fa: 'بد نبود. تو چطور؟' }, { en: 'Sorry, could you say that again?', fa: 'ببخشید، میشه دوباره بگی؟' }];
const raw = (reply, fa) => JSON.stringify({ reply, fa, suggestions: DEMO_HELP });
async function demoOpen(scenario) {
  await wait(600);
  return { raw: raw(DEMO_OPEN[scenarioById(scenario).who], 'سلام فربد! خیلی وقته ندیدمت. هفته‌ات چطور بود؟ خوش گذشت یا همه‌اش کار بود؟ (ترجمهٔ نمونه در حالت Demo)'), audio: null, demo: true };
}
async function demoTurn(scenario, text, messages) {
  await wait(900);
  const you = text || '(demo mode: your voice is not sent anywhere)';
  const reply = DEMO_REPLIES[messages.filter(m => m.role === 'model').length % DEMO_REPLIES.length];
  return { you, raw: raw(reply, 'ترجمهٔ فارسی این جمله اینجا نشان داده می‌شود (حالت Demo).'), audio: null, demo: true };
}
const DEMO_PREP = {
  tip: 'آرام و کوتاه جواب بده؛ اگر کلمه‌ای یادت نیامد، با کلمه‌های ساده توضیحش بده.',
  phrases: [
    { en: 'How have you been?', fa: 'این مدت چطور بودی؟', example: 'Hi Maya! How have you been?', example_fa: 'سلام مایا! این مدت چطور بودی؟' },
    { en: 'pretty busy', fa: 'نسبتاً شلوغ', example: 'My week was pretty busy with work.', example_fa: 'هفته‌ام با کار نسبتاً شلوغ بود.' },
    { en: 'to catch up', fa: 'از حال هم خبر گرفتن', example: 'It’s nice to catch up with you.', example_fa: 'خوبه که از حال هم خبر می‌گیریم.' },
    { en: 'What about you?', fa: 'تو چطور؟', example: 'I trained a lot. What about you?', example_fa: 'من زیاد تمرین کردم. تو چطور؟' },
    { en: 'the highlight of my week', fa: 'بهترین لحظهٔ هفته‌ام', example: 'The highlight of my week was a new client.', example_fa: 'بهترین اتفاق هفته‌ام یک مشتری جدید بود.' },
  ],
};
const DEMO_COACH = {
  summary: 'Demo feedback. Connect the server in Settings to get real feedback on what you said.',
  scores: { fluency: 6, accuracy: 5, vocab: 6 },
  findings: [
    { said: 'I am agree with you', better: 'I agree with you', why: '“Agree” is a verb, so you don’t need “am”.', fa: '«agree» خودش فعل است و «am» لازم ندارد.', key: 'agree' },
    { said: 'We need more cheap price', better: 'We need a lower price', why: 'We say a price is high or low, not cheap or expensive.', fa: 'برای قیمت از high و low استفاده می‌شود.', key: 'lower price' },
  ],
  words: [
    { word: 'lead time', meaning: 'the time between ordering and receiving goods', fa: 'زمان تحویل', example: 'What is your lead time for 2 tonnes?' },
    { word: 'to meet halfway', meaning: 'to agree to a compromise', fa: 'کوتاه آمدن دو طرف', example: 'Can we meet halfway on the price?' },
  ],
};

// English OS voice proxy. Keys stay here (Supabase secrets), never in the app.
// Free providers only: Groq Whisper (speech → text), Gemini Flash (replies, coach), Gemini TTS (text → speech),
// with Groq's open model as the fallback for replies. Audio is never stored.
//
// Secrets: LANG_PASS (the app's pass, typed once on the phone), GROQ_API_KEY, GEMINI_API_KEY.
// Optional: GEMINI_MODEL, GEMINI_TTS_MODEL, GROQ_MODEL, GROQ_STT_MODEL.
// Deploy with verify_jwt = false: the pass below is the gate.

const env = (k: string, d = '') => Deno.env.get(k) || d;
const GEMINI = 'https://generativelanguage.googleapis.com/v1beta/models';
const GROQ = 'https://api.groq.com/openai/v1';
const M = {
  chat: () => env('GEMINI_MODEL', 'gemini-flash-latest'),
  tts: () => env('GEMINI_TTS_MODEL', 'gemini-2.5-flash-preview-tts'),
  groq: () => env('GROQ_MODEL', 'openai/gpt-oss-120b'),
  stt: () => env('GROQ_STT_MODEL', 'whisper-large-v3-turbo'),
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-lang-pass',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const out = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

function same(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

const b64ToBytes = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
function bytesToB64(u: Uint8Array) {
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
}

type Msg = { role: 'user' | 'model'; text: string };

// ---- speech → text (Groq Whisper)
async function stt(audio: string, mime: string): Promise<string> {
  const ext = mime.includes('mp4') || mime.includes('m4a') || mime.includes('aac') ? 'm4a' : mime.includes('ogg') ? 'ogg' : mime.includes('wav') ? 'wav' : 'webm';
  const fd = new FormData();
  fd.append('file', new Blob([b64ToBytes(audio)], { type: mime }), `turn.${ext}`);
  fd.append('model', M.stt());
  fd.append('language', 'en');
  fd.append('response_format', 'json');
  const r = await fetch(`${GROQ}/audio/transcriptions`, { method: 'POST', headers: { Authorization: `Bearer ${env('GROQ_API_KEY')}` }, body: fd });
  if (!r.ok) throw new Error(`stt ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return String((await r.json()).text || '').trim();
}

// ---- replies (Gemini, then Groq)
async function geminiChat(system: string, messages: Msg[], json: boolean, maxTokens: number, temp: number) {
  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: system }] },
    contents: messages.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
    generationConfig: { temperature: temp, maxOutputTokens: maxTokens, ...(json ? { responseMimeType: 'application/json' } : {}) },
  };
  const r = await fetch(`${GEMINI}/${M.chat()}:generateContent`, {
    method: 'POST', headers: { 'x-goog-api-key': env('GEMINI_API_KEY'), 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`gemini ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const d = await r.json();
  const text = (d.candidates?.[0]?.content?.parts || []).map((p: { text?: string }) => p.text || '').join('').trim();
  if (!text) throw new Error('gemini empty');
  return text;
}

async function groqChat(system: string, messages: Msg[], json: boolean, maxTokens: number, temp: number) {
  const r = await fetch(`${GROQ}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('GROQ_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: M.groq(), temperature: temp, max_completion_tokens: maxTokens,
      messages: [{ role: 'system', content: system }, ...messages.map(m => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.text }))],
      ...(json ? { response_format: { type: 'json_object' } } : {}),
    }),
  });
  if (!r.ok) throw new Error(`groq ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const text = String((await r.json()).choices?.[0]?.message?.content || '').trim();
  if (!text) throw new Error('groq empty');
  return text;
}

async function chat(system: string, messages: Msg[], json = false, maxTokens = 400, temp = json ? 0.3 : 0.9) {
  const errors: string[] = [];
  if (env('GEMINI_API_KEY')) {
    try { return { text: await geminiChat(system, messages, json, maxTokens, temp), provider: 'gemini' }; } catch (e) { errors.push(String(e)); }
  }
  if (env('GROQ_API_KEY')) {
    try { return { text: await groqChat(system, messages, json, maxTokens, temp), provider: 'groq' }; } catch (e) { errors.push(String(e)); }
  }
  throw new Error(errors.join(' | ') || 'no chat provider configured');
}

// ---- text → speech (Gemini TTS). Returns WAV base64, or null so the phone uses its own voice.
function wav(pcm: Uint8Array, rate = 24000) {
  const h = new DataView(new ArrayBuffer(44));
  const w = (o: number, s: string) => [...s].forEach((c, i) => h.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); h.setUint32(4, 36 + pcm.length, true); w(8, 'WAVE'); w(12, 'fmt ');
  h.setUint32(16, 16, true); h.setUint16(20, 1, true); h.setUint16(22, 1, true);
  h.setUint32(24, rate, true); h.setUint32(28, rate * 2, true); h.setUint16(32, 2, true); h.setUint16(34, 16, true);
  w(36, 'data'); h.setUint32(40, pcm.length, true);
  const all = new Uint8Array(44 + pcm.length);
  all.set(new Uint8Array(h.buffer), 0); all.set(pcm, 44);
  return all;
}

async function tts(text: string, voice: string): Promise<string | null> {
  if (!env('GEMINI_API_KEY') || !text) return null;
  try {
    const r = await fetch(`${GEMINI}/${M.tts()}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': env('GEMINI_API_KEY'), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text }] }],
        generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice || 'Kore' } } } },
      }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    const part = d.candidates?.[0]?.content?.parts?.find((p: { inlineData?: { data: string } }) => p.inlineData);
    if (!part) return null;
    const rate = Number(/rate=(\d+)/.exec(part.inlineData.mimeType || '')?.[1] || 24000);
    return bytesToB64(wav(b64ToBytes(part.inlineData.data), rate));
  } catch { return null; }
}

// The partner may answer as JSON (reply + Persian + suggestions). Only the reply is spoken.
function spoken(text: string) {
  const a = text.indexOf('{'), b = text.lastIndexOf('}');
  if (a >= 0 && b > a) {
    try { const d = JSON.parse(text.slice(a, b + 1)); if (d && typeof d.reply === 'string' && d.reply.trim()) return d.reply.trim(); } catch { /* plain */ }
  }
  return text;
}
async function partner(j: Record<string, any>, messages: Msg[]) {
  const json = j.format === 'json';
  const r = await chat(String(j.system || ''), messages, json, json ? 900 : 400, 0.9);
  return { reply: json ? spoken(r.text) : r.text, raw: r.text, provider: r.provider };
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return out(405, { error: 'POST only' });
  if (!same(req.headers.get('x-lang-pass') || '', env('LANG_PASS'))) return out(403, { error: 'bad pass' });
  let j: Record<string, any>;
  try { j = await req.json(); } catch { return out(400, { error: 'bad body' }); }
  const t0 = Date.now();
  try {
    switch (j.action) {
      case 'ping':
        return out(200, { ok: true, stt: !!env('GROQ_API_KEY'), gemini: !!env('GEMINI_API_KEY'), groq: !!env('GROQ_API_KEY') });
      // One round trip per turn: your audio in, the character's words and voice out.
      case 'turn': {
        const you = j.audio ? await stt(j.audio, String(j.mime || 'audio/mp4')) : String(j.text || '').trim();
        if (!you) return out(200, { you: '', reply: '', audio: null, empty: true });
        const messages: Msg[] = [...(j.messages || []), { role: 'user', text: you }];
        const r = await partner(j, messages);
        const audio = j.speak === false ? null : await tts(r.reply, String(j.voice || ''));
        return out(200, { you, reply: r.reply, raw: r.raw, audio, provider: r.provider, ms: Date.now() - t0 });
      }
      // The character speaks first.
      case 'open': {
        const r = await partner(j, [{ role: 'user', text: String(j.kickoff || 'Start the conversation.') }]);
        const audio = j.speak === false ? null : await tts(r.reply, String(j.voice || ''));
        return out(200, { reply: r.reply, raw: r.raw, audio, provider: r.provider, ms: Date.now() - t0 });
      }
      case 'coach': {
        const r = await chat(String(j.system || ''), [{ role: 'user', text: String(j.transcript || '') }], true, 2500);
        return out(200, { json: r.text, provider: r.provider, ms: Date.now() - t0 });
      }
      case 'tts':
        return out(200, { audio: await tts(String(j.text || '').slice(0, 600), String(j.voice || '')) });
      default:
        return out(400, { error: 'unknown action' });
    }
  } catch (e) {
    return out(502, { error: String(e).slice(0, 400) });
  }
});

// Microphone, silence detection and playback. iOS needs one AudioContext unlocked by a tap;
// everything (recording level, the AI's voice) goes through it so the orb can follow the sound.

let ctx = null, stream = null, micNode = null, micAnalyser = null, outAnalyser = null, current = null;

export function unlock() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    outAnalyser = ctx.createAnalyser();
    outAnalyser.fftSize = 512;
    outAnalyser.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  // A silent buffer finishes the unlock on older iOS.
  const b = ctx.createBufferSource(); b.buffer = ctx.createBuffer(1, 1, 22050); b.connect(ctx.destination); b.start(0);
  return ctx;
}

const rms = an => {
  const d = new Float32Array(an.fftSize);
  an.getFloatTimeDomainData(d);
  let s = 0; for (const v of d) s += v * v;
  return Math.sqrt(s / d.length);
};
export const micLevel = () => (micAnalyser ? Math.min(1, rms(micAnalyser) * 6) : 0);
export const outLevel = () => (outAnalyser && current ? Math.min(1, rms(outAnalyser) * 5) : 0);

export async function openMic() {
  if (stream) return;
  if (!navigator.mediaDevices || !window.MediaRecorder) throw new Error('This browser cannot record audio.');
  stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  unlock();
  micNode = ctx.createMediaStreamSource(stream);
  micAnalyser = ctx.createAnalyser();
  micAnalyser.fftSize = 1024;
  micNode.connect(micAnalyser);
}

export function closeMic() {
  if (stream) stream.getTracks().forEach(t => t.stop());
  if (micNode) micNode.disconnect();
  stream = micNode = micAnalyser = null;
}

const MIME = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];

// Records one turn. Ends after ~1.3 s of silence once speech started, on stop(), or at maxMs.
// Resolves { base64, mime, ms } or null when nothing was said.
export function record({ maxMs = 45000, silenceMs = 1300, waitMs = 9000, onSpeech } = {}) {
  const mime = MIME.find(m => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) || '';
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks = [];
  let started = false, quietSince = 0, floor = 0.01, timer, done;
  const t0 = performance.now();
  const p = new Promise(resolve => { done = resolve; });
  rec.ondataavailable = e => e.data && e.data.size && chunks.push(e.data);
  rec.onstop = async () => {
    clearInterval(timer);
    if (!started || !chunks.length) return done(null);
    const blob = new Blob(chunks, { type: rec.mimeType || mime || 'audio/webm' });
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    done({ base64: btoa(s), mime: blob.type, ms: performance.now() - t0 });
  };
  rec.start(250);
  timer = setInterval(() => {
    const v = rms(micAnalyser), now = performance.now();
    if (!started) floor = floor * 0.9 + v * 0.1;
    const speaking = v > Math.max(0.015, floor * 2.5);
    if (speaking) { if (!started) { started = true; onSpeech && onSpeech(); } quietSince = 0; }
    else if (started && !quietSince) quietSince = now;
    if ((started && quietSince && now - quietSince > silenceMs) || now - t0 > maxMs || (!started && now - t0 > waitMs)) stop();
  }, 60);
  function stop(force) { if (force === 'speech') started = true; if (rec.state !== 'inactive') rec.stop(); }
  return { promise: p, stop, cancel: () => { started = false; stop(); } };
}

// Plays a WAV (base64). Resolves when finished or stopped.
export async function play(b64) {
  unlock();
  stopPlayback();
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const buf = await ctx.decodeAudioData(bytes.buffer);
  return new Promise(resolve => {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(outAnalyser);
    src.onended = () => { if (current === src) current = null; resolve(); };
    current = src;
    src.start();
  });
}

// The phone's own voice: used offline, in demo mode, and when the server sends no audio.
let utter = null;
export function speak(text, { rate = 0.95 } = {}) {
  return new Promise(resolve => {
    if (!('speechSynthesis' in window) || !text) return resolve();
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const voices = speechSynthesis.getVoices().filter(v => /^en[-_](US|GB|CA|AU)/i.test(v.lang));
    u.voice = voices.find(v => /premium|enhanced|natural/i.test(v.name)) || voices.find(v => /samantha|daniel|karen|moira/i.test(v.name)) || voices[0] || null;
    u.lang = (u.voice && u.voice.lang) || 'en-US';
    u.rate = rate;
    u.onend = u.onerror = () => { if (utter === u) utter = null; resolve(); };
    utter = u;
    speechSynthesis.speak(u);
  });
}
export const isSpeaking = () => !!current || !!utter;

export function stopPlayback() {
  if (current) { try { current.stop(); } catch { /* already ended */ } current = null; }
  if (utter) { speechSynthesis.cancel(); utter = null; }
}

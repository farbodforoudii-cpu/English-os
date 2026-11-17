// زبان من — English OS. Open → see today's session → tap the orb → talk.
import { db, uid, requestPersistence } from './db.js';
import { recommend } from './recommend.js';
import { CHARACTERS, DOMAINS, LEVELS, scenarioById } from './content.js';
import { partnerSystem, kickoff, COACH_SYSTEM, transcriptText, parseCoach } from './prompts.js';
import { newCard, review, dueCards, preview, RATINGS } from './cards.js';
import * as voice from './voice.js';
import * as api from './provider.js';
import { createOrb } from './orb.js';

const APP_VERSION = 'v1';
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const app = $('#app');

const S = { sessions: [], cards: [], mistakes: [], settings: { minutes: 15, style: [], pass: '' }, days: [], skip: [], orb: null };

async function load() {
  [S.sessions, S.cards, S.mistakes] = await Promise.all([db.all('sessions'), db.all('cards'), db.all('mistakes')]);
  S.settings = { ...S.settings, ...((await db.get('settings')) || {}) };
  S.days = (await db.get('days')) || [];
  api.setPass(S.settings.pass);
}
const saveSettings = () => db.set('settings', S.settings);
async function markDay() {
  const d = new Date().toLocaleDateString('en-CA');
  if (!S.days.includes(d)) { S.days.push(d); S.days = S.days.slice(-400); await db.set('days', S.days); }
}
function streak() {
  const set = new Set(S.days); let n = 0; const d = new Date();
  if (!set.has(d.toLocaleDateString('en-CA'))) d.setDate(d.getDate() - 1);
  while (set.has(d.toLocaleDateString('en-CA'))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
function dayLabel() {
  const d = new Date(), h = d.getHours();
  const part = h < 5 ? 'night' : h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 21 ? 'evening' : 'night';
  return `${d.toLocaleDateString('en-US', { weekday: 'long' })} ${part}`;
}

function mountOrb(el, size) {
  if (S.orb) S.orb.destroy();
  const c = document.createElement('canvas');
  el.appendChild(c);
  S.orb = createOrb(c, { size });
  return S.orb;
}
const orbSize = (k = 1) => Math.round(Math.min(220, window.innerWidth * 0.52, window.innerHeight * 0.26) * k);

// ---------- Home
function home() {
  stopSession();
  const rec = recommend({ sessions: S.sessions, mistakes: S.mistakes, cards: S.cards, skip: S.skip });
  S.rec = rec;
  const due = dueCards(S.cards).length;
  const n = streak();
  const [before, name] = splitTitle(rec.title, CHARACTERS[rec.character].name);
  app.innerHTML = `
  <section class="screen home">
    <div class="top"><span>${dayLabel()}</span><span>${api.isDemo() ? '<span class="badge">Demo</span>' : n ? `${n} day${n > 1 ? 's' : ''}` : ''}</span></div>
    <button class="orb-wrap orb-btn" id="orb" aria-label="Start talking"></button>
    <p class="hint">Touch to start talking</p>
    <h1>${before}${name ? `<em>${esc(name)}</em>` : ''}</h1>
    <p class="meta">${esc(rec.line)} · ${S.settings.minutes} minutes${rec.mode === 'listen' ? ' · listen first' : ''}</p>
    <p class="why">${esc(rec.why)}</p>
    <div class="chips" role="group" aria-label="Session length">
      ${[5, 15, 30].map(m => `<button class="chip" data-min="${m}" aria-pressed="${S.settings.minutes === m}">${m} min</button>`).join('')}
    </div>
    <div class="center"><button class="link" id="another">Something else</button></div>
    <nav class="nav">
      <button data-go="review">Review${due ? ` <b>${due}</b>` : ''}</button>
      <button data-go="progress">Progress</button>
      <button data-go="style">My style</button>
    </nav>
  </section>`;
  mountOrb($('#orb'), orbSize()).set('idle');
  $('#orb').onclick = () => { voice.unlock(); startSession(rec); };
  app.querySelectorAll('.chip').forEach(b => b.onclick = () => { S.settings.minutes = +b.dataset.min; saveSettings(); home(); });
  $('#another').onclick = () => { S.skip.push(rec.scenario); if (S.skip.length > 12) S.skip = []; home(); };
  app.querySelectorAll('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
}
function splitTitle(title, name) {
  const i = title.lastIndexOf(name);
  return i > 0 && i + name.length === title.length ? [esc(title.slice(0, i)), name] : [esc(title), ''];
}
const go = v => ({ home, review: reviewView, progress: progressView, style: styleView, settings: settingsView }[v] || home)();

// ---------- Session
let SES = null;
function stopSession() {
  if (!SES) return;
  SES.ended = true;
  if (SES.rec) SES.rec.cancel();
  voice.stopPlayback();
  voice.closeMic();
  clearInterval(SES.clock);
  SES = null;
}

async function startSession(rec) {
  const sc = scenarioById(rec.scenario), ch = CHARACTERS[sc.who];
  SES = {
    rec: null, ended: false, busy: false, turns: [], started: Date.now(), scenario: sc, ch,
    level: rec.level, minutes: S.settings.minutes, system: partnerSystem({ scenario: sc.id, level: rec.level, style: S.settings.style, minutes: S.settings.minutes }),
  };
  app.innerHTML = `
  <section class="screen session">
    <div class="top"><span>${esc(ch.name)} · ${esc(ch.line)}</span><span id="clock"></span></div>
    <button class="orb-wrap orb-btn" id="orb" aria-label="Talk"></button>
    <p class="hint" id="hint">Connecting…</p>
    <div class="caption"><p class="them" id="them"></p><p class="you" id="you" hidden></p></div>
    <p class="err" id="err" hidden></p>
    <form class="type" id="typeForm" hidden><input id="typeIn" autocomplete="off" placeholder="Type instead…" enterkeyhint="send"><button class="pill" type="submit">Send</button></form>
    <div class="bar"><button class="pill" id="kbd" aria-label="Type instead">Type</button><button class="pill solid" id="end">Finish</button></div>
  </section>`;
  const orb = mountOrb($('#orb'), orbSize(0.85));
  orb.set('think');
  const clock = $('#clock');
  SES.clock = setInterval(() => {
    const left = SES.minutes * 60 - (Date.now() - SES.started) / 1000;
    clock.textContent = left > 0 ? `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}` : 'Time’s up';
  }, 500);
  $('#orb').onclick = onOrbTap;
  $('#end').onclick = finish;
  $('#kbd').onclick = () => { const f = $('#typeForm'); f.hidden = !f.hidden; if (!f.hidden) $('#typeIn').focus(); };
  $('#typeForm').onsubmit = e => { e.preventDefault(); const t = $('#typeIn').value.trim(); if (t) { $('#typeIn').value = ''; sendTurn({ text: t }); } };

  try { await voice.openMic(); } catch (e) { showErr('Microphone is off. Allow it in Settings, or use Type.'); }
  try {
    const r = await api.open({ system: SES.system, scenario: sc.id });
    if (!SES || SES.ended) return;
    SES.turns.push({ role: 'model', text: r.reply });
    await say(r);
    listen();
  } catch (e) { showErr(e.message); hint('Tap the orb to try again'); orb.set('off'); SES.retryOpen = true; }
}

const hint = t => { const h = $('#hint'); if (h) h.textContent = t; };
function showErr(m) { const e = $('#err'); if (e) { e.textContent = m; e.hidden = !m; } }

async function say(r) {
  if (!SES || SES.ended) return;
  $('#them').textContent = r.reply;
  S.orb.set('speak', voice.outLevel);
  hint('Tap to interrupt');
  try {
    if (r.audio) await voice.play(r.audio);
    else {
      // The phone's voice gives no level signal; give the orb a soft pulse instead.
      const t0 = performance.now();
      S.orb.set('speak', () => 0.25 + 0.2 * Math.sin((performance.now() - t0) / 120));
      await voice.speak(r.reply);
    }
  } catch { await voice.speak(r.reply); }
}

async function listen() {
  if (!SES || SES.ended || SES.busy) return;
  if (!$('#typeForm').hidden && document.activeElement === $('#typeIn')) { S.orb.set('idle'); hint('Type your answer'); return; }
  try { await voice.openMic(); } catch { S.orb.set('idle'); hint('Microphone is off · use Type'); return; }
  S.orb.set('listen', voice.micLevel);
  hint('Listening… tap when you are done');
  const ses = SES;
  ses.rec = voice.record({ onSpeech: () => hint('Listening… tap when you are done') });
  const res = await ses.rec.promise;
  ses.rec = null;
  if (SES !== ses || ses.ended) return;
  if (!res) { S.orb.set('idle'); hint('Tap the orb when you are ready'); return; }
  sendTurn({ audio: res.base64, mime: res.mime });
}

async function sendTurn({ audio, mime, text }) {
  if (!SES || SES.busy) return;
  if (SES.rec) { SES.rec.cancel(); SES.rec = null; }
  SES.busy = true;
  showErr('');
  S.orb.set('think');
  hint('…');
  if (text) showYou(text);
  try {
    const messages = [{ role: 'user', text: kickoff(SES.scenario.id) }, ...SES.turns];
    const r = await api.turn({ system: SES.system, messages, audio, mime, text, scenario: SES.scenario.id });
    if (!SES || SES.ended) return;
    SES.busy = false;
    if (r.empty || !r.you) { S.orb.set('idle'); hint('I didn’t catch that · tap and try again'); return; }
    showYou(r.you);
    SES.turns.push({ role: 'user', text: r.you }, { role: 'model', text: r.reply });
    await say(r);
    listen();
  } catch (e) {
    if (!SES) return;
    SES.busy = false;
    showErr(e.message);
    S.orb.set('idle');
    hint('Tap the orb to try again');
  }
}
function showYou(t) { const y = $('#you'); y.textContent = t; y.hidden = false; }

function onOrbTap() {
  voice.unlock();
  if (!SES || SES.busy) return;
  if (SES.retryOpen) { SES.retryOpen = false; return startSession(S.rec); }
  if (voice.isSpeaking()) { voice.stopPlayback(); return; } // say() resolves, then listen() starts
  if (SES.rec) { SES.rec.stop(); return; }
  listen();
}

async function finish() {
  if (!SES) return home();
  const turns = SES.turns.slice(), sc = SES.scenario, ch = SES.ch, level = SES.level, minutes = SES.minutes;
  const said = turns.filter(t => t.role === 'user').length;
  stopSession();
  if (!said) return home();
  app.innerHTML = `<section class="screen center"><div class="top"><span>${esc(ch.name)}</span><span></span></div>
    <div class="orb-wrap" id="orb"></div><p class="hint">Your coach is reading the conversation…</p></section>`;
  mountOrb($('#orb'), 160).set('think');
  let coach = null, err = '';
  try { coach = parseCoach((await api.coach({ system: COACH_SYSTEM, transcript: transcriptText(turns, ch.name) })).json); }
  catch (e) { err = e.message; }
  const now = new Date();
  const ses = { id: uid(), at: now.toISOString(), domain: sc.domain, scenario: sc.id, character: ch.id, mode: sc.mode, level, minutes, turns, coach, scores: coach && coach.scores, feedback: null, demo: api.isDemo() };
  if (!ses.demo) {
    await db.put('sessions', ses); S.sessions.push(ses);
    if (coach) await saveFindings(ses, coach, now);
  }
  await markDay();
  summary(ses, err);
}

async function saveFindings(ses, coach, now) {
  const cards = [], mistakes = [];
  for (const f of coach.findings) {
    cards.push(newCard({ id: uid(), kind: 'fix', front: f.said, back: f.better, note: f.why, fa: f.fa, domain: ses.domain, source: ses.id, now }));
    const key = (f.key || f.better).toLowerCase();
    const old = S.mistakes.find(m => m.key === key);
    mistakes.push(old ? { ...old, count: old.count + 1, open: true, last: now.toISOString() } : { id: uid(), key, word: f.key || f.better, domain: ses.domain, said: f.said, better: f.better, count: 1, open: true, last: now.toISOString() });
  }
  for (const w of coach.words) cards.push(newCard({ id: uid(), kind: 'word', front: w.meaning, back: w.word, note: w.example, fa: w.fa, domain: ses.domain, source: ses.id, now }));
  await db.putMany('cards', cards); S.cards.push(...cards);
  await db.putMany('mistakes', mistakes);
  for (const m of mistakes) { const i = S.mistakes.findIndex(x => x.id === m.id); i >= 0 ? (S.mistakes[i] = m) : S.mistakes.push(m); }
}

function faBlock(fa) {
  return fa ? `<button class="fa-toggle" data-fa>فارسی</button><p class="fa fa-line" hidden>${esc(fa)}</p>` : '';
}
function wireFa(root) {
  root.querySelectorAll('[data-fa]').forEach(b => b.onclick = () => { const p = b.nextElementSibling; p.hidden = !p.hidden; });
}

function summary(ses, err) {
  const c = ses.coach;
  app.innerHTML = `
  <section class="screen">
    <div class="top"><span>${esc(CHARACTERS[ses.character].name)} · done</span><span>${ses.demo ? '<span class="badge">Demo</span>' : ''}</span></div>
    <h2 style="margin-top:18px">${c ? esc(c.summary) : 'Session saved.'}</h2>
    ${err ? `<p class="err" style="text-align:left">${esc(err)} Your conversation is saved; feedback could not be made this time.</p>` : ''}
    ${c ? `<div class="scores">${['fluency', 'accuracy', 'vocab'].map(k => `<div class="score"><b>${c.scores[k]}</b><span>${k === 'vocab' ? 'Vocabulary' : k[0].toUpperCase() + k.slice(1)}</span></div>`).join('')}</div>` : ''}
    ${c && c.findings.length ? `<div class="section"><p class="label">Say it better</p>${c.findings.map(f => `<div class="card"><p class="said">${esc(f.said)}</p><p class="better">${esc(f.better)}</p><p class="small">${esc(f.why)}</p>${faBlock(f.fa)}</div>`).join('')}</div>` : ''}
    ${c && c.words.length ? `<div class="section"><p class="label">Words you needed</p>${c.words.map(w => `<div class="card"><p class="better">${esc(w.word)}</p><p class="small">${esc(w.meaning)}</p><p class="small muted">“${esc(w.example)}”</p>${faBlock(w.fa)}</div>`).join('')}</div>` : ''}
    ${c ? `<p class="small muted" style="margin-top:14px">${c.findings.length + c.words.length} cards added to your review.</p>` : ''}
    <div class="section"><p class="label">How was this session?</p><div class="feedback">
      ${[['easier', 'Too hard'], ['same', 'Just right'], ['harder', 'Too easy'], ['other', 'Different style']].map(([k, l]) => `<button class="chip" data-fb="${k}" aria-pressed="false">${l}</button>`).join('')}
    </div></div>
    <button class="done-btn" id="done">Done</button>
  </section>`;
  wireFa(app);
  app.querySelectorAll('[data-fb]').forEach(b => b.onclick = async () => {
    app.querySelectorAll('[data-fb]').forEach(x => x.setAttribute('aria-pressed', x === b));
    ses.feedback = b.dataset.fb;
    if (!ses.demo) await db.put('sessions', ses);
  });
  $('#done').onclick = () => { S.skip = []; home(); };
}

// ---------- Review (works offline)
function reviewView() {
  stopSession();
  const due = dueCards(S.cards);
  if (!due.length) {
    app.innerHTML = `<section class="screen"><div class="top"><button id="back">‹ Back</button><span></span></div>
      <p class="empty">${S.cards.length ? 'All caught up. New cards come from your sessions.' : 'No cards yet. Finish a session and your coach adds the best ones here.'}</p></section>`;
    $('#back').onclick = home; return;
  }
  const c = due[0];
  const q = c.kind === 'fix' ? `<p class="small">Say it better</p><p class="q said" style="margin-top:8px">${esc(c.front)}</p>` : `<p class="small">Which word or phrase means…</p><p class="q" style="margin-top:8px">${esc(c.front)}</p>`;
  app.innerHTML = `<section class="screen">
    <div class="top"><button id="back">‹ Back</button><span>${due.length} left</span></div>
    <div class="review-card" id="rc">${q}${faBlock(c.kind === 'word' ? c.fa : '')}
      <div class="a" id="ans" hidden><p class="better">${esc(c.back)}</p>${c.note ? `<p class="small">${esc(c.note)}</p>` : ''}${c.kind === 'fix' ? faBlock(c.fa) : ''}</div>
    </div>
    <div class="bar" id="show"><button class="pill" id="hear">Hear it</button><button class="pill solid" id="reveal">Show answer</button></div>
    <div class="rates" id="rates" hidden>${RATINGS.map((r, i) => `<button data-r="${r.id}">${r.label}<small>${preview(c)[i]}</small></button>`).join('')}</div>
  </section>`;
  wireFa(app);
  $('#back').onclick = home;
  $('#hear').onclick = () => voice.speak(c.back);
  $('#reveal').onclick = () => { $('#ans').hidden = false; $('#show').hidden = true; $('#rates').hidden = false; voice.speak(c.back); };
  app.querySelectorAll('[data-r]').forEach(b => b.onclick = async () => {
    const next = review(c, +b.dataset.r);
    await db.put('cards', next);
    S.cards[S.cards.findIndex(x => x.id === c.id)] = next;
    // A fix that is now remembered for days closes its mistake.
    if (c.kind === 'fix' && new Date(next.due) - Date.now() > 3 * 86400000) {
      const m = S.mistakes.find(x => x.better === c.back && x.open);
      if (m) { m.open = false; await db.put('mistakes', m); }
    }
    await markDay();
    reviewView();
  });
}

// ---------- Progress
function progressView() {
  stopSession();
  const real = S.sessions.filter(s => !s.demo).sort((a, b) => new Date(b.at) - new Date(a.at));
  const lvl = recommend({ sessions: S.sessions }).level;
  const learned = S.cards.filter(c => c.srs && c.srs.state === 2).length;
  const byDomain = DOMAINS.filter(d => d.active).map(d => ({ d, n: real.filter(s => s.domain === d.id).length }));
  app.innerHTML = `<section class="screen">
    <div class="top"><button id="back">‹ Back</button><span>${streak()} day streak</span></div>
    <h2 style="margin-top:18px">Speaking at about <em style="font-style:normal;color:var(--gold)">${LEVELS[lvl - 1].cefr}</em></h2>
    <div class="scores"><div class="score"><b>${real.length}</b><span>Sessions</span></div><div class="score"><b>${S.cards.length}</b><span>Cards</span></div><div class="score"><b>${learned}</b><span>Learned</span></div></div>
    <div class="section"><p class="label">Practice by area</p>${byDomain.map(x => `<div class="list-row"><span>${esc(x.d.name)}</span><span class="muted">${x.n}</span></div>`).join('')}</div>
    <div class="section"><p class="label">Recent sessions</p>${real.slice(0, 12).map(s => `<div class="list-row"><span>${esc(scenarioById(s.scenario)?.title || s.scenario)}<br><span class="small muted">${new Date(s.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span></span><span class="muted">${s.scores ? Math.round((s.scores.fluency + s.scores.accuracy + s.scores.vocab) / 3 * 10) / 10 : '–'}</span></div>`).join('') || '<p class="muted small">Nothing yet.</p>'}</div>
  </section>`;
  $('#back').onclick = home;
}

// ---------- My style + settings
function styleView() {
  stopSession();
  app.innerHTML = `<section class="screen">
    <div class="top"><button id="back">‹ Back</button><button id="settings">Settings</button></div>
    <h2 style="margin-top:18px">My style</h2>
    <p class="small">Rules every character and your coach will follow. Write them in English or Persian.</p>
    <div class="section" id="rules">${S.settings.style.map((r, i) => `<div class="list-row"><span>${esc(r)}</span><button data-del="${i}">Remove</button></div>`).join('') || '<p class="muted small">No rules yet. Examples: “Challenge me more”, “Use more business idioms”, “Speak slower”.</p>'}</div>
    <form class="type" id="add" style="margin-top:18px"><input id="rule" class="field" placeholder="Add a rule…" maxlength="160"><button class="pill solid" type="submit">Add</button></form>
  </section>`;
  $('#back').onclick = home;
  $('#settings').onclick = settingsView;
  app.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { S.settings.style.splice(+b.dataset.del, 1); saveSettings(); styleView(); });
  $('#add').onsubmit = e => { e.preventDefault(); const v = $('#rule').value.trim(); if (v) { S.settings.style.push(v); saveSettings(); styleView(); } };
}

function settingsView() {
  app.innerHTML = `<section class="screen">
    <div class="top"><button id="back">‹ Back</button><span>${APP_VERSION}</span></div>
    <h2 style="margin-top:18px">Settings</h2>
    <div class="section"><p class="label">Server pass</p>
      <p class="small">The pass you set as <code>LANG_PASS</code> in Supabase. Without it the app runs in demo mode.</p>
      <form class="type" id="passForm"><input id="pass" class="field" type="password" autocomplete="off" value="${esc(S.settings.pass)}" placeholder="Pass"><button class="pill solid">Save</button></form>
      <p class="small" id="status"></p>
    </div>
    <div class="section"><p class="label">Privacy</p>
      <p class="small">Your voice is turned into text on the server and never stored. Conversations stay on this phone. Free AI services may use what you say to improve their models, so don’t share real business or personal data.</p>
    </div>
    <div class="section"><p class="label">Data</p><button class="pill" id="wipe">Delete everything on this phone</button></div>
  </section>`;
  $('#back').onclick = styleView;
  const st = $('#status');
  $('#passForm').onsubmit = async e => {
    e.preventDefault();
    S.settings.pass = $('#pass').value.trim(); api.setPass(S.settings.pass); await saveSettings();
    if (!S.settings.pass) { st.textContent = 'Demo mode.'; return; }
    st.textContent = 'Checking…';
    try { const p = await api.ping(); st.textContent = `Connected. Speech: ${p.stt ? 'yes' : 'no'} · Gemini: ${p.gemini ? 'yes' : 'no'} · Groq: ${p.groq ? 'yes' : 'no'}`; }
    catch (err) { st.textContent = err.message; }
  };
  $('#wipe').onclick = async () => {
    if (!confirm('Delete all sessions, cards and settings on this phone?')) return;
    await db.wipe(); location.reload();
  };
}

// ---------- Start
(async () => {
  await load();
  home();
  requestPersistence();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
  document.addEventListener('visibilitychange', () => { if (document.hidden && SES) { SES.rec && SES.rec.cancel(); voice.stopPlayback(); } });
})();

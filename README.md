# زبان من — English OS

Personal voice-first English practice (PWA for iPhone / iPad).
Open → see today's session → tap the gold orb → talk. A coach reviews each session and turns mistakes into review cards (FSRS).

- Plain JavaScript, no build step, no CDN. Data stays on the device (IndexedDB).
- Voice server: Supabase Edge Function `supabase/functions/lang` (Groq Whisper, Gemini Flash + TTS, free tiers). Keys live only in Supabase secrets.
- Setup: [docs/SETUP.md](docs/SETUP.md) · Decisions: [docs/DECISION.md](docs/DECISION.md) · Profile: [docs/PROFILE.md](docs/PROFILE.md)

Run locally: `python3 -m http.server` · Tests: `node --test tests/*.test.mjs`

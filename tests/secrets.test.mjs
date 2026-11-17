import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// No API key may ever be committed. The Supabase publishable key is public by design and allowed.
const PATTERNS = [/AIza[0-9A-Za-z_-]{20,}/, /gsk_[0-9A-Za-z]{20,}/, /sk-[0-9A-Za-z_-]{20,}/, /sb_secret_[0-9A-Za-z_-]+/, /service_role[^\n]{0,40}eyJ/];
const SKIP = new Set(['.git', 'node_modules', 'fonts', 'icons', 'vendor', '.claude', 'docs']);

function* files(dir) {
  for (const n of readdirSync(dir)) {
    if (SKIP.has(n)) continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) yield* files(p); else yield p;
  }
}

test('no API keys in the repository', () => {
  for (const f of files('.')) {
    if (f.endsWith('secrets.test.mjs')) continue;
    const s = readFileSync(f, 'utf8');
    for (const re of PATTERNS) assert.ok(!re.test(s), `${f} looks like it contains a key (${re})`);
  }
});

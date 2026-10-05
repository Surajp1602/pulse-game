// Real-browser end-to-end: two phones and a late joiner play a short game against bots through the UI.
//   npm run e2e         (builds, starts the server at 2x speed, drives Chrome via Playwright)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium, devices } from 'playwright';

const OUT = path.resolve('test/e2e/shots');
fs.mkdirSync(OUT, { recursive: true });
const PORT = 4300 + Math.floor(Math.random() * 300);
const BASE = `http://localhost:${PORT}`;
const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = spawn(process.execPath, ['server/index.js'], { env: { ...process.env, PORT: String(PORT), PULSE_SPEED: '2' }, stdio: 'inherit' });
for (let i = 0; i < 60; i++) { try { if ((await fetch(`${BASE}/health`)).ok) break; } catch {} await sleep(200); }

let browser;
try { browser = await chromium.launch({ channel: 'chrome' }); } catch { browser = await chromium.launch(); }
const errors = [];
async function phone(name) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${name}: ${m.text()}`); });
  return page;
}
const shot = (page, name) => page.screenshot({ path: path.join(OUT, `${name}.png`) });

// Plays whatever challenge is on screen, like a person would.
async function playOnce(page, seen) {
  const ch = page.locator('.ch').first();
  if (!(await ch.count())) return;
  const cls = await ch.getAttribute('class');
  const key = `${cls}-${await page.locator('.hud .eyebrow').first().textContent().catch(() => '')}`;
  try {
    if (cls.includes('ch-snap')) {
      const w = page.locator('.snap-word:not(.snapped)').first();
      if (await w.count()) await w.click({ timeout: 300 });
      return;
    }
    if (seen.has(key)) return;
    if (cls.includes('ch-draw')) {
      const pad = page.locator('.pad-draw.go');
      if (await pad.count()) { await pad.click({ timeout: 300 }); seen.add(key); }
      return;
    }
    if (cls.includes('ch-needle')) { await page.locator('.pad-tap').click({ timeout: 300 }); seen.add(key); return; }
    if (cls.includes('ch-closest')) { await page.locator('.closest-actions .btn-primary').click({ timeout: 300 }); seen.add(key); return; }
    if (cls.includes('ch-memory')) {
      const pads = page.locator('.opt-symbol:not([disabled])');
      if ((await pads.count()) === 6) { for (let i = 0; i < 4; i++) await pads.nth(i % 6).click({ timeout: 300 }); seen.add(key); }
      return;
    }
    if (cls.includes('ch-unscramble')) {
      const tiles = page.locator('.tile');
      const n = await tiles.count();
      for (let i = 0; i < n; i++) await tiles.nth(i).click({ timeout: 300 });
      seen.add(key);
      return;
    }
    const opt = page.locator('.ch .opt:not([disabled])').first();
    if (await opt.count()) { await opt.click({ timeout: 300 }); seen.add(key); }
  } catch { /* the round moved on */ }
}

async function playUntil(pages, done, timeout = 240000) {
  const seen = pages.map(() => new Set());
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (await done()) return true;
    await Promise.all(pages.map((p, i) => playOnce(p, seen[i])));
    await sleep(120);
  }
  throw new Error('timed out playing');
}

let failed = false;
const check = (ok, msg) => { log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) failed = true; };

try {
  const host = await phone('host');
  await host.goto(BASE);
  await shot(host, '01-home');
  await host.fill('input[autocomplete="nickname"]', 'Asha');
  await host.click('text=Host a new room');
  await host.waitForSelector('.room-code');
  const code = (await host.locator('.code-big').textContent()).replace(/\s/g, '');
  check(/^[A-Z]{4}$/.test(code), `room created with code ${code}`);

  const guest = await phone('guest');
  await guest.goto(`${BASE}/r/${code}`);
  await guest.fill('input[autocomplete="nickname"]', 'Ben');
  await guest.click('.join-row .btn');
  await guest.waitForSelector('.room-code');
  check(true, 'guest joined via /r/CODE link');

  await host.click('.suggest button:has-text("Add 2 bots")');
  await host.waitForFunction(() => document.querySelectorAll('.seat:not(.empty)').length === 4);
  check(true, 'bot suggestion filled the room to 4');
  await host.click('.seat.empty .seat-btn');
  await host.waitForSelector('.persona-list');
  await shot(host, '02-bot-picker');
  await host.click('.persona:not([disabled]) >> nth=0');
  await host.waitForFunction(() => document.querySelectorAll('.seat:not(.empty)').length === 5);
  check(true, 'bot picker added a chosen persona');
  await host.click('.segmented button:has-text("Short")');
  await shot(host, '03-lobby-host');
  check(await host.locator('text=Start anyway').count() === 1, 'host sees Start anyway while guest is not ready');
  await guest.click("button:has-text(\"I'm ready\")");
  await host.waitForSelector('button:has-text("Start the game")');
  await shot(guest, '04-lobby-guest');
  await host.click('button:has-text("Start the game")');
  await host.waitForSelector('.intro');
  await shot(host, '05-intro');
  check(true, 'game started');

  // Play the first set, reload the guest mid-game, then add a late joiner.
  await host.waitForSelector('.ch');
  await shot(guest, '06-challenge');
  await playUntil([host, guest], async () => (await host.locator('.hud .eyebrow').first().textContent()).includes('03/'));
  await guest.reload();
  await guest.waitForSelector('.hud', { timeout: 15000 });
  check(true, 'guest reloaded mid-game and was put straight back in');

  const late = await phone('late');
  await late.goto(`${BASE}/r/${code}`);
  await late.fill('input[autocomplete="nickname"]', 'Cleo');
  await late.click('.join-row .btn');
  await late.waitForSelector('text=You\'re watching', { timeout: 15000 });
  await shot(late, '07-late-watching');
  check(true, 'late joiner is spectating');

  await playUntil([host, guest], async () => (await host.locator('.setbreak').count()) > 0);
  await shot(host, '08-setbreak');
  await late.waitForFunction(() => !document.body.innerText.includes("You're watching"), null, { timeout: 15000 });
  check(true, 'late joiner seated at the set break');

  await playUntil([host, guest, late], async () => (await host.locator('.win-hero').count()) > 0);
  await sleep(2200);
  await shot(host, '09-results-host');
  await shot(late, '10-results-late');
  const rows = await host.locator('.final-list li').count();
  check(rows === 6, `final standings list everyone (${rows} = 2 humans + late joiner + 3 bots)`);
  check(await host.locator('text=Play again').count() === 1, 'host can play again');
  check(await guest.locator('text=Waiting for the host').count() === 1, 'guest waits for host');

  await host.click('text=Play again');
  await guest.waitForSelector('.room-code');
  check(true, 'play again returns everyone to the lobby');

  // Stage view
  const tv = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await tv.goto(`${BASE}/stage/${code}`);
  await tv.waitForSelector('.stage-lobby');
  await tv.screenshot({ path: path.join(OUT, '11-stage-lobby.png') });
  check(true, 'stage view shows the lobby');

  // Leaving
  await guest.click('text=← Leave');
  await guest.waitForSelector('text=Host a new room');
  await host.waitForFunction(() => document.querySelectorAll('.seat:not(.empty)').length === 5);
  check(true, 'leaving removes the seat in the lobby');
} catch (e) {
  failed = true;
  log('ERROR', e.message);
} finally {
  const real = errors.filter((e) => !/WebSocket|socket\.io|net::ERR/.test(e));
  check(real.length === 0, `no page errors${real.length ? `: ${real.slice(0, 5).join(' | ')}` : ''}`);
  await browser.close();
  server.kill();
  log(failed ? 'E2E FAILED' : 'E2E PASSED', `screenshots in ${path.relative(process.cwd(), OUT)}`);
  process.exit(failed ? 1 : 0);
}

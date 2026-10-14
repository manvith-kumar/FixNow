// Shared helpers for the real-browser scripts (ui-smoke.mjs, ui-extended.mjs).
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function createHarness({ app, api, chrome, shots }) {
  if (!chrome) { console.error('Set CHROME_PATH to a Chrome/Chromium executable.'); process.exit(2); }
  fs.mkdirSync(shots, { recursive: true });
  const results = []; const problems = []; let lastPage = null;
  const browser = await puppeteer.launch({ executablePath: chrome, headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });

  async function newSession(label, { viewport = { width: 1280, height: 900 }, permissions } = {}) {
    const ctx = await browser.createBrowserContext();
    if (permissions) await ctx.overridePermissions(app, permissions);
    const page = await ctx.newPage();
    await page.setViewport(viewport);
    page.on('pageerror', (e) => problems.push(`[${label}] pageerror: ${e.message}\n        ${(e.stack || '').split('\n').slice(1, 4).map((x) => x.trim()).join('\n        ')}`));
    page.on('console', async (m) => {
      if (m.type() !== 'error' || /favicon|Failed to load resource/.test(m.text())) return;
      let stack = ''; try { for (const a of m.args()) { const st = await a.evaluate((v) => (v && v.stack) || ''); if (st) { stack = st.split('\n').slice(0, 4).join(' | '); break; } } } catch { /* ignore */ }
      problems.push(`[${label}] console: ${m.text()}${stack ? ' :: ' + stack : ''}`);
    });
    page.on('requestfailed', (r) => { if (r.failure()?.errorText === 'net::ERR_ABORTED') return; /* navigation/page close aborts in-flight requests: normal */ problems.push(`[${label}] request failed: ${r.method()} ${r.url()} ${r.failure()?.errorText}`); });
    page.on('response', (r) => { if (r.status() >= 500) problems.push(`[${label}] HTTP ${r.status()} ${r.url()}`); });
    page.ctx = ctx;
    return page;
  }
  const go = async (page, p) => { lastPage = page; await page.goto(`${app}${p}`, { waitUntil: 'networkidle0' }); };
  const textOf = (page) => { lastPage = page; return page.evaluate(() => document.body.innerText); };
  async function expectText(page, re, timeout = 8000) {
    const t0 = Date.now(); let t = '';
    while (Date.now() - t0 < timeout) { t = await textOf(page); if (re.test(t)) return t; await sleep(150); }
    throw new Error(`text ${re} not found. Page said: ${t.slice(0, 300).replace(/\n+/g, ' | ')}`);
  }
  async function expectNoText(page, re, settle = 600) { await sleep(settle); const t = await textOf(page); if (re.test(t)) throw new Error(`unexpected text ${re} present`); }
  async function clickButton(page, text, { exact = true, scope } = {}) {
    lastPage = page; const t0 = Date.now();
    while (Date.now() - t0 < 6000) {
      const h = await page.evaluateHandle((txt, ex, sc) => [...((sc && document.querySelector(sc)) || document.querySelector('.modal') || document.querySelector('main') || document).querySelectorAll('button, a.btn')].filter((b) => !b.disabled && b.getAttribute('aria-disabled') !== 'true' && b.offsetParent !== null).find((b) => { const s = b.textContent.trim(); return ex ? s === txt : s.includes(txt); }) ?? null, text, exact, scope);
      const el = h.asElement(); if (el) { await el.click(); return; }
      await sleep(150);
    }
    throw new Error(`button "${text}" not found/enabled`);
  }
  async function field(page, label) {
    const t0 = Date.now();
    while (Date.now() - t0 < 5000) {
      const h = await page.evaluateHandle((l) => { const scope = document.querySelector('.modal') ?? document; const lab = [...scope.querySelectorAll('label')].find((x) => x.textContent.replace('*', '').trim().toLowerCase().startsWith(l.toLowerCase())); return lab ? document.getElementById(lab.htmlFor) : null; }, label);
      const el = h.asElement(); if (el) return el; await sleep(150);
    }
    throw new Error(`field "${label}" not found`);
  }
  /** Replace the field's content (select-all with the keyboard, then type) and verify it holds exactly the typed value. */
  const fill = async (page, label, value) => {
    const el = await field(page, label); await el.focus();
    await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control');
    await page.keyboard.press('Backspace'); await el.type(value);
    const kind = await el.evaluate((e) => (e.tagName === 'TEXTAREA' ? 'text' : e.type));
    if (['text', 'email', 'password', 'tel', 'search', 'url'].includes(kind)) { const got = await el.evaluate((e) => e.value); if (got !== value) throw new Error(`fill("${label}") expected "${value}" but the field holds "${got}"`); }
  };
  /** Same as fill(), for inputs addressed by a CSS selector (e.g. aria-label based line-item inputs). */
  const fillSelector = async (page, selector, value) => {
    const el = await page.waitForSelector(selector, { timeout: 5000 }); await el.focus();
    await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control'); await page.keyboard.press('Backspace'); await el.type(value);
    const got = await el.evaluate((e) => e.value); if (got !== value) throw new Error(`fillSelector(${selector}) expected "${value}" but holds "${got}"`);
  };
  async function choose(page, label, optionText) {
    const el = await field(page, label);
    const val = await el.evaluate((s, t) => [...s.options].find((o) => o.textContent.includes(t))?.value, optionText);
    if (val === undefined) throw new Error(`option "${optionText}" not in "${label}"`); await el.select(val);
  }
  const shot = (page, name) => page.screenshot({ path: path.join(shots, `${name}.png`) });
  async function login(page, email, password = 'Password@123') {
    await go(page, '/login'); await fill(page, 'Email', email); await fill(page, 'Password', password); await clickButton(page, 'Log in');
    await page.waitForFunction(() => /^\/(customer|technician|admin)/.test(location.pathname), { timeout: 8000 });
  }
  async function step(name, fn) {
    try { await fn(); results.push([name, true]); console.log(`  ok   ${name}`); }
    catch (e) {
      results.push([name, false, e.message]); console.log(`  FAIL ${name}: ${e.message}`);
      if (lastPage) { try { await lastPage.screenshot({ path: path.join(shots, 'FAILURE.png'), fullPage: true }); console.log('  page text at failure: ' + (await lastPage.evaluate(() => document.body.innerText)).replace(/\n+/g, ' | ').slice(0, 1200)); } catch { /* ignore */ } }
      throw e;
    }
  }
  async function finish() {
    await browser.close();
    const failed = results.filter((r) => !r[1]);
    console.log(`\n${results.length - failed.length}/${results.length} UI steps passed`);
    if (problems.length) { console.log('\nBrowser errors/warnings observed:'); [...new Set(problems)].forEach((p) => console.log('  - ' + p)); }
    console.log(`Screenshots: ${shots}`);
    process.exit(failed.length || problems.length ? 1 : 0);
  }
  return { browser, newSession, go, textOf, expectText, expectNoText, clickButton, field, fill, fillSelector, choose, shot, login, step, finish, problems, results };
}

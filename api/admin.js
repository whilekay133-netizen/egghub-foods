import { readPrices, validPrice, PRICE_FILE, ADMIN_FILE, readJson, writeJson, hasStorage, hashPassword, checkHash,
  limited, ipOf, sameOrigin, safeEqual, json, makeSession, checkSession, setCookie, failCount, recordFail, clearFails } from '../lib/shared.js';

const MIN_NEW = 12;              // new passwords must be at least 12 characters
const MAX_FAILS_PER_HOUR = 15;   // across ALL visitors; after this, sign-in is locked for up to an hour

export default async function handler(req, res) {
  res.setHeader('X-Robots-Tag', 'noindex');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return json(res, 405, { error: 'Method not allowed' }); }
  // Only our own page may call this: same origin + custom header (forces a CORS preflight from any other site)
  if (!sameOrigin(req) || req.headers['x-egghub-admin'] !== '1') return json(res, 403, { error: 'Forbidden' });
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) return json(res, 415, { error: 'Unsupported' });
  if (!hasStorage()) return json(res, 503, { error: 'Not available.' });

  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const action = typeof body.action === 'string' ? body.action : '';
  const ip = ipOf(req);
  let rec;
  try { rec = await readJson(ADMIN_FILE); } catch (e) { console.error('admin read', e.message); return json(res, 500, { error: 'Try again.' }); }

  // Public password creation is disabled. A password can only be (re)created by someone who
  // knows ADMIN_SETUP_CODE, which exists only in Vercel settings and is normally NOT set.
  if (action === 'setup') {
    const code = process.env.ADMIN_SETUP_CODE;
    if (rec || !code || code.length < 16) return json(res, 403, { error: 'Password creation is disabled.' });
    if (limited('setup:' + ip, 5, 15 * 60 * 1000)) return json(res, 429, { error: 'Too many attempts.' });
    if (typeof body.code !== 'string' || !safeEqual(body.code, code)) { await new Promise((r) => setTimeout(r, 800)); return json(res, 401, { error: 'Wrong setup code.' }); }
    if (typeof body.password !== 'string' || body.password.length < MIN_NEW || body.password.length > 200) return json(res, 400, { error: `Use at least ${MIN_NEW} characters.` });
    rec = { ...hashPassword(body.password), createdAt: new Date().toISOString() };
    await writeJson(ADMIN_FILE, rec);
    setCookie(res, makeSession(rec), 7200);
    return json(res, 200, { ok: true, prices: await readPrices() });
  }

  if (action === 'status') {
    if (!rec) return json(res, 200, { loggedIn: false, locked: true });
    const ok = checkSession(req, rec);
    return json(res, 200, ok ? { loggedIn: true, prices: await readPrices(), email: !!process.env.GMAIL_APP_PASSWORD } : { loggedIn: false });
  }

  if (action === 'logout') { setCookie(res, '', 0); return json(res, 200, { ok: true }); }

  if (!rec) return json(res, 403, { error: 'Admin is locked.' });

  if (action === 'login') {
    if (limited('adm:' + ip, 6, 15 * 60 * 1000)) return json(res, 429, { error: 'Too many attempts. Wait 15 minutes.' });
    const fails = await failCount();
    if (fails.length >= MAX_FAILS_PER_HOUR) return json(res, 429, { error: 'Sign-in is temporarily locked after too many wrong passwords. Try again later.' });
    const pw = typeof body.password === 'string' && body.password.length <= 200 ? body.password : '';
    if (!checkHash(pw, rec)) { await recordFail(fails); await new Promise((r) => setTimeout(r, 800)); return json(res, 401, { error: 'Wrong password.' }); }
    if (fails.length) await clearFails();
    setCookie(res, makeSession(rec), 7200);
    return json(res, 200, { ok: true, prices: await readPrices(), email: !!process.env.GMAIL_APP_PASSWORD, weak: pw.length < MIN_NEW });
  }

  // Everything below requires a valid signed session cookie
  if (!checkSession(req, rec)) return json(res, 401, { error: 'Please sign in again.' });

  if (action === 'save') {
    const big = Number(body.big), medium = Number(body.medium);
    if (!validPrice(big) || !validPrice(medium)) return json(res, 400, { error: 'Prices must be whole numbers between 1,000 and 50,000.' });
    const data = { big, medium, updatedAt: new Date().toISOString() };
    await writeJson(PRICE_FILE, data);
    return json(res, 200, { ok: true, prices: data });
  }

  if (action === 'change') {
    if (limited('chg:' + ip, 5, 15 * 60 * 1000)) return json(res, 429, { error: 'Too many attempts.' });
    if (typeof body.current !== 'string' || !checkHash(body.current, rec)) { await new Promise((r) => setTimeout(r, 800)); return json(res, 401, { error: 'Current password is wrong.' }); }
    const np = body.newPassword;
    if (typeof np !== 'string' || np.length < MIN_NEW || np.length > 200) return json(res, 400, { error: `New password needs at least ${MIN_NEW} characters.` });
    if (np === body.current) return json(res, 400, { error: 'Choose a different password.' });
    const nrec = { ...hashPassword(np), createdAt: new Date().toISOString() };
    await writeJson(ADMIN_FILE, nrec);            // old sessions stop working automatically
    setCookie(res, makeSession(nrec), 7200);
    return json(res, 200, { ok: true });
  }
  return json(res, 400, { error: 'Unknown action' });
}

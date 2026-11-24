import { readPrices, validPrice, PRICE_FILE, ADMIN_FILE, readJson, writeJson, hasStorage, hashPassword, checkHash, limited, ipOf, sameOrigin, safeEqual, json } from '../lib/shared.js';

const MIN = 8;
const okPw = (p) => typeof p === 'string' && p.length >= MIN && p.length <= 200;

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return json(res, 405, { error: 'Method not allowed' }); }
  if (!sameOrigin(req)) return json(res, 403, { error: 'Forbidden' });
  if (!hasStorage()) return json(res, 503, { error: 'Storage is not connected to this project yet.' });

  const body = typeof req.body === 'object' && req.body ? req.body : {};
  const ip = ipOf(req);
  const envPass = process.env.ADMIN_PASSWORD;
  let rec;
  try { rec = await readJson(ADMIN_FILE); } catch (e) { console.error('admin read', e.message); return json(res, 500, { error: 'Could not reach storage. Try again.' }); }
  const needsSetup = !envPass && !rec;

  if (body.action === 'status') return json(res, 200, { setup: needsSetup });

  if (body.action === 'setup') {
    if (!needsSetup) return json(res, 409, { error: 'A password already exists. Please sign in.' });
    if (limited('setup:' + ip, 5, 15 * 60 * 1000)) return json(res, 429, { error: 'Too many attempts. Wait a few minutes.' });
    if (!okPw(body.password)) return json(res, 400, { error: `Use at least ${MIN} characters.` });
    await writeJson(ADMIN_FILE, { ...hashPassword(body.password), createdAt: new Date().toISOString() });
    return json(res, 200, { ok: true, prices: await readPrices(), email: !!process.env.GMAIL_APP_PASSWORD });
  }

  if (needsSetup) return json(res, 409, { error: 'Create your admin password first.', setup: true });
  if (limited('adm:' + ip, 8, 15 * 60 * 1000)) return json(res, 429, { error: 'Too many attempts. Wait 15 minutes and try again.' });
  const pw = typeof body.password === 'string' && body.password.length <= 200 ? body.password : '';
  const good = envPass ? safeEqual(pw, envPass) : checkHash(pw, rec);
  if (!good) { await new Promise((r) => setTimeout(r, 600)); return json(res, 401, { error: 'Wrong password.' }); }

  if (body.action === 'login') return json(res, 200, { ok: true, prices: await readPrices(), email: !!process.env.GMAIL_APP_PASSWORD });

  if (body.action === 'save') {
    const big = Number(body.big), medium = Number(body.medium);
    if (!validPrice(big) || !validPrice(medium)) return json(res, 400, { error: 'Prices must be whole numbers between 1,000 and 50,000.' });
    const data = { big, medium, updatedAt: new Date().toISOString() };
    await writeJson(PRICE_FILE, data);
    return json(res, 200, { ok: true, prices: data });
  }

  if (body.action === 'change') {
    if (envPass) return json(res, 400, { error: 'This password is set in Vercel settings and must be changed there.' });
    if (!okPw(body.newPassword)) return json(res, 400, { error: `New password needs at least ${MIN} characters.` });
    await writeJson(ADMIN_FILE, { ...hashPassword(body.newPassword), createdAt: new Date().toISOString() });
    return json(res, 200, { ok: true });
  }
  return json(res, 400, { error: 'Unknown action' });
}

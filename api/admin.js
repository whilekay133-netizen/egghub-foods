import { put } from '@vercel/blob';
import { readPrices, validPrice, PRICE_FILE, limited, ipOf, sameOrigin, safeEqual, json } from '../lib/shared.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return json(res, 405, { error: 'Method not allowed' }); }
  if (!sameOrigin(req)) return json(res, 403, { error: 'Forbidden' });
  const pass = process.env.ADMIN_PASSWORD;
  if (!pass || pass.length < 10) return json(res, 503, { error: 'Admin is not set up yet. Add ADMIN_PASSWORD (10+ characters) in Vercel.' });

  const ip = ipOf(req);
  if (limited('adm:' + ip, 8, 15 * 60 * 1000)) return json(res, 429, { error: 'Too many attempts. Wait 15 minutes and try again.' });

  const body = typeof req.body === 'object' && req.body ? req.body : {};
  if (typeof body.password !== 'string' || body.password.length > 200 || !safeEqual(body.password, pass)) {
    await new Promise((r) => setTimeout(r, 600));
    return json(res, 401, { error: 'Wrong password.' });
  }

  if (body.action === 'login') {
    const p = await readPrices();
    return json(res, 200, { ok: true, prices: p, storage: !!process.env.BLOB_READ_WRITE_TOKEN, email: !!process.env.GMAIL_APP_PASSWORD });
  }

  if (body.action === 'save') {
    if (!process.env.BLOB_READ_WRITE_TOKEN) return json(res, 503, { error: 'Price storage is not connected yet. Connect a Blob store to the project in Vercel.' });
    const big = Number(body.big), medium = Number(body.medium);
    if (!validPrice(big) || !validPrice(medium)) return json(res, 400, { error: 'Prices must be whole numbers between 1,000 and 50,000.' });
    const data = { big, medium, updatedAt: new Date().toISOString() };
    await put(PRICE_FILE, JSON.stringify(data), { access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', cacheControlMaxAge: 60 });
    return json(res, 200, { ok: true, prices: data });
  }
  return json(res, 400, { error: 'Unknown action' });
}

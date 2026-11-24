import { list } from '@vercel/blob';
import crypto from 'node:crypto';

export const DEFAULT_PRICES = { big: 5200, medium: 4800 };
export const PRICE_FILE = 'egghub/prices.json';
export const validPrice = (n) => Number.isInteger(n) && n >= 1000 && n <= 50000;

export async function readPrices() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return { ...DEFAULT_PRICES, source: 'default' };
  try {
    const { blobs } = await list({ prefix: PRICE_FILE, limit: 1 });
    if (!blobs.length) return { ...DEFAULT_PRICES, source: 'default' };
    const r = await fetch(blobs[0].url + '?v=' + Date.parse(blobs[0].uploadedAt), { cache: 'no-store' });
    const p = await r.json();
    if (validPrice(p.big) && validPrice(p.medium)) return { big: p.big, medium: p.medium, updatedAt: p.updatedAt, source: 'admin' };
  } catch (e) { console.error('readPrices', e.message); }
  return { ...DEFAULT_PRICES, source: 'default' };
}

// very small per-instance rate limiter (serverless instances are short-lived; this slows bursts)
const buckets = new Map();
export function limited(key, max, windowMs) {
  const now = Date.now();
  const b = buckets.get(key) || { n: 0, t: now };
  if (now - b.t > windowMs) { b.n = 0; b.t = now; }
  b.n++; buckets.set(key, b);
  if (buckets.size > 5000) buckets.clear();
  return b.n > max;
}
export const ipOf = (req) => String(req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';

export function sameOrigin(req) {
  const o = req.headers.origin;
  if (!o) return true; // non-browser clients still need the password / pass validation
  try { return new URL(o).host === req.headers.host; } catch { return false; }
}

export function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

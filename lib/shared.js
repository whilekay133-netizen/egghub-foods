import { put, get } from '@vercel/blob';
import crypto from 'node:crypto';

export const DEFAULT_PRICES = { big: 5200, medium: 4800 };
export const PRICE_FILE = 'egghub/prices.json';
export const validPrice = (n) => Number.isInteger(n) && n >= 1000 && n <= 50000;

export const ADMIN_FILE = 'egghub/admin.json';
export const hasStorage = () => !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);

// Works with both private and public Blob stores
let accessMode = null;
export async function readJson(pathname) {
  if (!hasStorage()) return null;
  for (const access of accessMode ? [accessMode] : ['private', 'public']) {
    try {
      const r = await get(pathname, { access, useCache: false });
      accessMode = access;
      if (!r || !r.stream) return null;
      return JSON.parse(await new Response(r.stream).text());
    } catch (e) {
      if (/not ?found/i.test(e.name + e.message)) { accessMode = access; return null; }
      if (accessMode) throw e;
    }
  }
  return null;
}
export async function writeJson(pathname, data) {
  const opts = { addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', cacheControlMaxAge: 60 };
  let lastErr;
  for (const access of accessMode ? [accessMode] : ['private', 'public']) {
    try { await put(pathname, JSON.stringify(data), { ...opts, access }); accessMode = access; return; }
    catch (e) { lastErr = e; if (accessMode) break; }
  }
  throw lastErr;
}

export async function readPrices() {
  try {
    const p = await readJson(PRICE_FILE);
    if (p && validPrice(p.big) && validPrice(p.medium)) return { big: p.big, medium: p.medium, updatedAt: p.updatedAt, source: 'admin' };
  } catch (e) { console.error('readPrices', e.message); }
  return { ...DEFAULT_PRICES, source: 'default' };
}

export function hashPassword(pw, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: crypto.scryptSync(String(pw), salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex') };
}
export function checkHash(pw, rec) {
  if (!rec || !rec.salt || !rec.hash) return false;
  const h = Buffer.from(hashPassword(pw, rec.salt).hash, 'hex'), w = Buffer.from(rec.hash, 'hex');
  return h.length === w.length && crypto.timingSafeEqual(h, w);
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

// ---- signed session cookie (key derived from the stored password hash, so changing the password logs everyone out)
export const COOKIE = '__Host-egh_admin';
const SESSION_MS = 2 * 60 * 60 * 1000;
const keyOf = (rec) => crypto.createHash('sha256').update('egh-session|' + rec.salt + '|' + rec.hash).digest();
export function makeSession(rec) {
  const exp = Date.now() + SESSION_MS;
  const nonce = crypto.randomBytes(12).toString('hex');
  const payload = exp + '.' + nonce;
  const sig = crypto.createHmac('sha256', keyOf(rec)).update(payload).digest('hex');
  return payload + '.' + sig;
}
export function checkSession(req, rec) {
  if (!rec) return false;
  const m = String(req.headers.cookie || '').match(/(?:^|;\s*)__Host-egh_admin=([0-9]+\.[0-9a-f]{24}\.[0-9a-f]{64})/);
  if (!m) return false;
  const [exp, nonce, sig] = m[1].split('.');
  if (Number(exp) < Date.now()) return false;
  const want = crypto.createHmac('sha256', keyOf(rec)).update(exp + '.' + nonce).digest();
  const got = Buffer.from(sig, 'hex');
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}
export const setCookie = (res, v, maxAge) => res.setHeader('Set-Cookie', `${COOKIE}=${v}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`);

// ---- lockout that survives across server instances (stored in Blob)
export const LOCK_FILE = 'egghub/lock.json';
export async function failCount() {
  try { const l = await readJson(LOCK_FILE); const since = Date.now() - 60 * 60 * 1000; return (l && Array.isArray(l.f) ? l.f : []).filter((t) => t > since); } catch { return []; }
}
export async function recordFail(list) { try { await writeJson(LOCK_FILE, { f: [...list, Date.now()].slice(-50) }); } catch {} }
export async function clearFails() { try { await writeJson(LOCK_FILE, { f: [] }); } catch {} }

import { readPrices } from '../lib/shared.js';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.statusCode = 405; res.setHeader('Allow', 'GET'); return res.end(); }
  const p = await readPrices();
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=20, stale-while-revalidate=60');
  res.end(JSON.stringify({ big: p.big, medium: p.medium, updatedAt: p.updatedAt || null }));
}

import nodemailer from 'nodemailer';
import { readPrices, limited, ipOf, sameOrigin, json } from '../lib/shared.js';

const OWNER = 'egghubfoods@gmail.com';
const clean = (s, n) => String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ngn = (n) => '₦' + Number(n).toLocaleString('en-NG');

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return json(res, 405, { error: 'Method not allowed' }); }
  if (!sameOrigin(req)) return json(res, 403, { error: 'Forbidden' });
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) return json(res, 415, { error: 'Unsupported' });
  if (!process.env.GMAIL_APP_PASSWORD) return json(res, 503, { error: 'Email sending is not set up yet.' });
  const ip = ipOf(req);
  if (limited('mail:' + ip, 4, 10 * 60 * 1000)) return json(res, 429, { error: 'Too many invoices sent. Please wait a few minutes or use WhatsApp.' });

  const b = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const no = clean(b.no, 20), name = clean(b.name, 60), phone = clean(b.phone, 20).replace(/[^0-9+ ()-]/g, '');
  const email = clean(b.email, 120);
  const size = b.size === 'big' ? 'big' : b.size === 'medium' ? 'medium' : null;
  const qty = Number(b.qty);
  if (!/^EGH-\d{6}-\d{4}$/.test(no) || !name || phone.replace(/\D/g, '').length < 10 || !size || !Number.isInteger(qty) || qty < 1 || qty > 1000)
    return json(res, 400, { error: 'The order details are incomplete.' });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json(res, 400, { error: 'That email address does not look right.' });

  const pdf = typeof b.pdf === 'string' ? b.pdf : '';
  if (pdf.length > 700000) return json(res, 413, { error: 'Invoice file is too large.' });
  const buf = Buffer.from(pdf, 'base64');
  if (buf.length < 500 || buf.subarray(0, 5).toString() !== '%PDF-') return json(res, 400, { error: 'Invoice file is invalid.' });

  // Recalculate with the live prices so a tampered invoice is flagged
  const prices = await readPrices();
  const price = prices[size], total = price * qty;
  const claimed = Number(b.total);
  const mismatch = claimed !== total;
  const item = size === 'big' ? 'Big eggs' : 'Medium eggs';

  const lines = [
    ['Invoice', no], ['Customer', name], ['Phone', phone], ['Email', email || '—'],
    ['Order', `${qty} ${qty === 1 ? 'crate' : 'crates'} of ${item} (30 per crate)`],
    ['Price per crate', ngn(price)], ['Total (checked)', ngn(total)], ['Pickup', 'Mowe'],
  ];
  const html = `<div style="font-family:Arial,sans-serif;color:#0D1126;max-width:520px">
  <div style="background:#1F2CD4;color:#fff;padding:18px 22px;border-radius:12px 12px 0 0;font-size:18px;font-weight:bold">New website order · Egg<span style="color:#FFC53D">hub</span> Foods</div>
  <div style="border:1px solid #e6e8f0;border-top:0;padding:18px 22px;border-radius:0 0 12px 12px">
  ${mismatch ? `<p style="background:#FFF4D6;padding:10px;border-radius:8px;color:#8A5A00"><b>Check this order:</b> the invoice shows ${esc(ngn(claimed || 0))}, but today's price gives ${esc(ngn(total))}.</p>` : ''}
  <table style="width:100%;border-collapse:collapse;font-size:14px">${lines.map(([k, v]) => `<tr><td style="padding:6px 0;color:#5B6078">${k}</td><td style="padding:6px 0;text-align:right;font-weight:bold">${esc(String(v))}</td></tr>`).join('')}</table>
  <p style="font-size:13px;color:#5B6078">The invoice PDF is attached. Reply to the customer on WhatsApp: <a href="https://wa.me/${phone.replace(/\D/g, '').replace(/^0/, '234')}">chat with ${esc(name)}</a>.</p></div></div>`;

  const tx = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.GMAIL_USER || OWNER, pass: process.env.GMAIL_APP_PASSWORD } });
  try {
    await tx.sendMail({
      from: `"Egghub Website" <${process.env.GMAIL_USER || OWNER}>`,
      to: OWNER,
      replyTo: email || undefined,
      subject: `${mismatch ? '⚠ ' : ''}New order ${no} · ${qty} ${qty === 1 ? 'crate' : 'crates'} ${item} · ${ngn(total)}`,
      text: lines.map(([k, v]) => `${k}: ${v}`).join('\n') + (mismatch ? `\n\nCHECK: invoice showed ${ngn(claimed || 0)}` : ''),
      html,
      attachments: [{ filename: `Egghub-Invoice-${no}.pdf`, content: buf, contentType: 'application/pdf' }],
    });
  } catch (e) {
    console.error('sendMail', e.message);
    return json(res, 502, { error: 'Could not send the email right now.' });
  }
  return json(res, 200, { ok: true });
}

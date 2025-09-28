import type { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';

const TOKEN = process.env.REPLICATE_API_TOKEN!;
const H = { 'Authorization': `Token ${TOKEN}` };

export default async (req: VercelRequest, res: VercelResponse) => {
  const id = String(req.query.id);
  const cacheKey = String(req.query.cacheKey || '');
  const rr = await fetch(`https://api.replicate.com/v1/predictions/${id}`, { headers: H }).then(r => r.json());

  if (rr.status === 'succeeded') {
    const out = Array.isArray(rr.output) ? rr.output.at(-1) : rr.output;
    const base = `${req.headers['x-forwarded-proto'] ? 'https' : 'http'}://${req.headers.host}`;
    if (cacheKey) await fetch(`${base}/api/tryon/cache`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: cacheKey, url: out, ttl: 60 * 60 * 48 }) });
    return res.json({ status: 'succeeded', resultUrl: out });
  }
  if (rr.status === 'failed' || rr.error) return res.json({ status: 'failed', error: rr.error || 'failed' });
  res.json({ status: rr.status }); // queued/processing
};

import type { VercelRequest, VercelResponse } from '@vercel/node';
const store = new Map<string, { url: string, exp: number }>();

export default async (req: VercelRequest, res: VercelResponse) => {
  if (req.method === 'GET') {
    const key = String(req.query.key || '');
    const hit = store.get(key);
    if (hit && hit.exp > Date.now()) return res.json({ resultUrl: hit.url });
    return res.json({});
  }
  if (req.method === 'POST') {
    const { key, url, ttl } = req.body || {};
    if (!key || !url) return res.status(400).json({ error: 'missing' });
    store.set(key, { url, exp: Date.now() + (ttl || 172800000) });
    return res.json({ ok: true });
  }
  res.status(405).end();
};

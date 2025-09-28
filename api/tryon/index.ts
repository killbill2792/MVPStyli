import type { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';
import crypto from 'crypto';

const TOKEN = process.env.REPLICATE_API_TOKEN!;
const MODEL = process.env.TRYON_MODEL_ID!;
const H = { 'Authorization': `Token ${TOKEN}`, 'Content-Type': 'application/json' };

const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

export default async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'POST') return res.status(405).end();
  const { userUrl, garmentUrl, garmentId, category } = req.body || {};
  if (!userUrl || !garmentUrl) return res.status(400).json({ error: 'missing urls' });

  // Cache check
  const cacheKey = sha(`${userUrl}|${garmentId || garmentUrl}|${MODEL}`);
  const base = `${req.headers['x-forwarded-proto'] ? 'https' : 'http'}://${req.headers.host}`;
  const cached = await fetch(`${base}/api/tryon/cache?key=${cacheKey}`).then(r => r.json());
  if (cached?.resultUrl) return res.json({ status: 'succeeded', resultUrl: cached.resultUrl, cache: true });

  // Start prediction: cuuupid expects human_img + garm_img
  const body = { version: MODEL, input: { human_img: userUrl, garm_img: garmentUrl, category } };
  const rr = await fetch('https://api.replicate.com/v1/predictions', { method: 'POST', headers: H, body: JSON.stringify(body) }).then(r => r.json());

  if (rr?.id) return res.json({ jobId: rr.id, cacheKey });
  res.status(500).json({ error: rr?.error || 'replicate_start_failed' });
};

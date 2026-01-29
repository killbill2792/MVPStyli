import type { VercelRequest, VercelResponse } from '@vercel/node';

const TOKEN = process.env.REPLICATE_API_TOKEN!;
const H = { 'Authorization': `Token ${TOKEN}` } as any;

// In-memory cache for try-on results (moved from cache.ts to consolidate functions)
const tryonCache = new Map<string, { url: string; exp: number }>();

// Cache helper functions
function getCachedResult(key: string): string | null {
  const hit = tryonCache.get(key);
  if (hit && hit.exp > Date.now()) return hit.url;
  return null;
}

function setCachedResult(key: string, url: string, ttlMs: number = 172800000): void {
  tryonCache.set(key, { url, exp: Date.now() + ttlMs });
}

export default async (req: VercelRequest, res: VercelResponse) => {
  // Handle cache requests (previously in cache.ts)
  if (req.query.id === 'cache') {
    if (req.method === 'GET') {
      const key = String(req.query.key || '');
      const cachedUrl = getCachedResult(key);
      if (cachedUrl) return res.json({ resultUrl: cachedUrl });
      return res.json({});
    }
    if (req.method === 'POST') {
      const { key, url, ttl } = req.body || {};
      if (!key || !url) return res.status(400).json({ error: 'missing' });
      setCachedResult(key, url, ttl || 172800000);
      return res.json({ ok: true });
    }
    return res.status(405).end();
  }

  // Handle regular polling requests
  try {
    const id = String(req.query.id);
    const cacheKey = String(req.query.cacheKey || '');
    
    console.log('Polling Replicate job:', id);
    
    const rr = await fetch(`https://api.replicate.com/v1/predictions/${id}`, { headers: H }).then(r => r.json());
    
    console.log('Replicate job status:', rr.status, rr.error);
    
    if (rr.status === 'succeeded') {
      const out = Array.isArray(rr.output) ? rr.output.at(-1) : rr.output;
      // Store in local cache instead of calling separate endpoint
      if (cacheKey && out) {
        setCachedResult(cacheKey, out, 60 * 60 * 48 * 1000);
      }
      return res.json({ status: 'succeeded', resultUrl: out });
    }
    if (rr.status === 'failed' || rr.error) {
      return res.status(200).json({ status: 'failed', error: rr.error || 'failed' });
    }
    return res.status(200).json({ status: rr.status });
  } catch (e: any) {
    console.error('Polling error:', e);
    return res.status(500).json({ error: e?.message || 'server_error' }); 
  }
};

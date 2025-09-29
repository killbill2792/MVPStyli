import type { VercelRequest, VercelResponse } from '@vercel/node';
const TOKEN = process.env.REPLICATE_API_TOKEN!;
const H = { 'Authorization': `Token ${TOKEN}` } as any;
export default async (req:VercelRequest,res:VercelResponse)=>{
  try{
    const id = String(req.query.id);
    const cacheKey = String(req.query.cacheKey||'');
    
    console.log('Polling Replicate job:', id);
    
    const rr = await fetch(`https://api.replicate.com/v1/predictions/${id}`, { headers: H }).then(r=>r.json());
    
    console.log('Replicate job status:', rr.status, rr.error);
    
    if(rr.status==='succeeded'){
      const out = Array.isArray(rr.output) ? rr.output.at(-1) : rr.output;
      const base = `${req.headers['x-forwarded-proto']?'https':'http'}://${req.headers.host}`;
      if(cacheKey) await fetch(`${base}/api/tryon/cache`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ key: cacheKey, url: out, ttl: 60*60*48 }) });
      return res.json({ status:'succeeded', resultUrl: out });
    }
    if(rr.status==='failed' || rr.error) return res.status(200).json({ status:'failed', error: rr.error || 'failed' });
    return res.status(200).json({ status: rr.status });
  }catch(e:any){ 
    console.error('Polling error:', e);
    return res.status(500).json({ error: e?.message || 'server_error' }); 
  }
};

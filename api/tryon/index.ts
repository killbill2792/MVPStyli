import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
const TOKEN = process.env.REPLICATE_API_TOKEN!;
const MODEL = process.env.TRYON_MODEL_ID!;
const H = { 'Authorization': `Token ${TOKEN}`, 'Content-Type': 'application/json' } as any;
const sha = (s:string)=> crypto.createHash('sha256').update(s).digest('hex');
export default async (req:VercelRequest,res:VercelResponse)=>{
  try{
    if(req.method!=='POST') return res.status(405).json({error:'method_not_allowed'});
    const { userUrl, garmentUrl, garmentId, category } = req.body||{};
    
    console.log('Try-on request:', { userUrl, garmentUrl, garmentId, category });
    
    if(!userUrl || !garmentUrl) return res.status(400).json({error:'missing urls'});
    
    // Validate URLs are not example.com
    if(userUrl.includes('example.com') || garmentUrl.includes('example.com')) {
      console.error('Invalid URLs detected:', { userUrl, garmentUrl });
      return res.status(400).json({error:'invalid_urls'});
    }
    
    const cacheKey = sha(`${userUrl}|${garmentId||garmentUrl}|${MODEL}`);
    const base = `${req.headers['x-forwarded-proto']?'https':'http'}://${req.headers.host}`;
    const cached = await fetch(`${base}/api/tryon/cache?key=${cacheKey}`).then(r=>r.json()).catch(()=>null);
    if(cached?.resultUrl) return res.json({status:'succeeded', resultUrl: cached.resultUrl, cache:true});
    
    // Map category to Replicate's expected values
    const categoryMap = {
      'upper': 'upper_body',
      'lower': 'lower_body', 
      'dress': 'dresses',
      'upper_body': 'upper_body',
      'lower_body': 'lower_body',
      'dresses': 'dresses'
    };
    const mappedCategory = categoryMap[category] || 'upper_body';
    
    const body = { 
      version: MODEL, 
      input: { 
        human_img: userUrl, 
        garm_img: garmentUrl, 
        category: mappedCategory 
      } 
    };
    
    console.log('Sending to Replicate:', body);
    
    const rr = await fetch('https://api.replicate.com/v1/predictions', { 
      method:'POST', 
      headers:H, 
      body: JSON.stringify(body) 
    }).then(r=>r.json());
    
    console.log('Replicate response:', rr);
    
    if(rr?.id) return res.json({ jobId: rr.id, cacheKey });
    return res.status(500).json({ error: rr?.error || 'replicate_start_failed' });
  }catch(e:any){ 
    console.error('Try-on API error:', e);
    return res.status(500).json({ error: e?.message || 'server_error' }); 
  }
};

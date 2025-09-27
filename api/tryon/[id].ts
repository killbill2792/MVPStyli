import type { VercelRequest, VercelResponse } from '@vercel/node';

const REPLICATE_TOKEN = process.env.REPLICATE_API_TOKEN!;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const jobId = String(req.query.id);
  
  if (!jobId) {
    return res.status(400).json({ error: 'Missing job ID' });
  }
  
  try {
    console.log(`[${Date.now()}] Polling try-on job:`, jobId);
    
    // Poll Replicate API
    const replicateResponse = await fetch(`https://api.replicate.com/v1/predictions/${jobId}`, {
      headers: {
        'Authorization': `Token ${REPLICATE_TOKEN}`,
      }
    });
    
    if (!replicateResponse.ok) {
      const errorText = await replicateResponse.text();
      console.error(`[${Date.now()}] Replicate poll error:`, errorText);
      throw new Error(`Replicate API error: ${errorText}`);
    }
    
    const replicateResult = await replicateResponse.json();
    console.log(`[${Date.now()}] Try-on status:`, replicateResult.status);
    
    if (replicateResult.status === 'succeeded') {
      // Extract result URL
      const output = Array.isArray(replicateResult.output) 
        ? replicateResult.output[replicateResult.output.length - 1] 
        : replicateResult.output;
      
      return res.json({
        status: 'succeeded',
        resultUrl: output
      });
    }
    
    if (replicateResult.status === 'failed' || replicateResult.error) {
      return res.json({
        status: 'failed',
        error: replicateResult.error || 'Try-on failed'
      });
    }
    
    // Return current status (queued, starting, processing)
    return res.json({
      status: replicateResult.status
    });
  } catch (error) {
    console.error(`[${Date.now()}] Try-on poll error:`, error);
    return res.status(500).json({ error: 'Failed to poll try-on status' });
  }
}

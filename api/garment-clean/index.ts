import type { VercelRequest, VercelResponse } from '@vercel/node';
import sharp from 'sharp';
export default async (req:VercelRequest,res:VercelResponse)=>{
  try{
    if(req.method!=='POST') return res.status(405).json({error:'method_not_allowed'});
    const { imageUrl } = req.body||{};
    if(!imageUrl) return res.status(400).json({error:'missing imageUrl'});
    const buf = await fetch(imageUrl).then(r=>r.arrayBuffer()).then(b=>Buffer.from(b));
    const resized = await sharp(buf).resize({ width: 768, withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
    const dataUrl = `data:image/jpeg;base64,${resized.toString('base64')}`;
    return res.json({ cleanUrl: dataUrl });
  }catch(e:any){ return res.status(500).json({ error: e?.message || 'server_error' }); }
};

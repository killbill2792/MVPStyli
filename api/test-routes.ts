// api/test-routes.ts
// Simple test endpoint to verify routes are working
import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return res.status(200).json({ 
    message: 'API routes are working!',
    timestamp: new Date().toISOString(),
    routes: {
      productfromurl: '/api/productfromurl',
      searchwebproducts: '/api/searchwebproducts'
    }
  });
}


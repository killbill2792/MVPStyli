export async function getCleanGarmentUrl(productId: string, rawUrl: string, category?: 'upper' | 'lower' | 'dress') {
  const API = process.env.EXPO_PUBLIC_API_BASE;
  
  if (!API) {
    throw new Error('EXPO_PUBLIC_API_BASE not configured. Please set your Vercel API URL in .env.local');
  }
  
  try {
    const response = await fetch(`${API}/api/garment-clean`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl: rawUrl, category, productId })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    const data = await response.json();
    return data.cleanUrl as string;
  } catch (error) {
    console.error('Garment cleaning error:', error);
    // Fallback to original URL on error
    return rawUrl;
  }
}

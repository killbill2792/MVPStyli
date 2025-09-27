export type TryOnJob = { jobId: string };
export type TryOnStatus = { 
  status: 'queued' | 'running' | 'succeeded' | 'failed', 
  resultUrl?: string, 
  error?: string 
};

export async function startTryOn(
  personUrl: string, 
  clothUrl: string, 
  category?: string
): Promise<TryOnJob> {
  const API = process.env.EXPO_PUBLIC_API_BASE;
  
  if (!API) {
    throw new Error('EXPO_PUBLIC_API_BASE not configured. Please set your Vercel API URL in .env.local');
  }
  
  try {
    const response = await fetch(`${API}/api/tryon`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        userUrl: personUrl, 
        garmentUrl: clothUrl, 
        category 
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Try-on start error:', error);
    throw error;
  }
}

export async function pollTryOn(jobId: string): Promise<TryOnStatus> {
  const API = process.env.EXPO_PUBLIC_API_BASE;
  
  if (!API) {
    throw new Error('EXPO_PUBLIC_API_BASE not configured. Please set your Vercel API URL in .env.local');
  }
  
  try {
    const response = await fetch(`${API}/api/tryon/${jobId}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Try-on poll error:', error);
    throw error;
  }
}

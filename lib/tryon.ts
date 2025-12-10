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
    // Validate category - must be one of the three valid values
    const validCategories = ['upper_body', 'lower_body', 'dresses'];
    
    if (!category || !validCategories.includes(category)) {
      console.error('❌ INVALID CATEGORY in startTryOn:', category);
      throw new Error(`Invalid category: ${category}. Must be one of: ${validCategories.join(', ')}`);
    }
    
    // Build request body
    const requestBody = { 
      human_img: personUrl, 
      garm_img: clothUrl, 
      category: category
    };
    
    console.log('📤 startTryOn - REQUEST BODY:', JSON.stringify(requestBody));
    console.log('📤 startTryOn - CATEGORY VALUE:', category, 'TYPE:', typeof category);
    
    const response = await fetch(`${API}/api/tryon`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
    
    const responseText = await response.text();
    console.log('📥 startTryOn - RAW RESPONSE:', responseText);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${responseText}`);
    }
    
    const result = JSON.parse(responseText);
    console.log('✅ startTryOn - PARSED RESPONSE:', result);
    console.log('✅ startTryOn - Category that API says it sent:', result.categorySent);
    
    return result;
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

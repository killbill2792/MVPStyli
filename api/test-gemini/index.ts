// api/test-gemini/index.ts
// Test endpoint to verify Gemini API key is working

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    
    if (!GEMINI_API_KEY) {
      return res.status(200).json({
        success: false,
        error: 'GEMINI_API_KEY not found in environment variables',
        hasKey: false
      });
    }

    console.log('🔵 Testing Gemini API with key:', GEMINI_API_KEY.substring(0, 10) + '...');
    
    // Test with a simple prompt
    const testPrompt = 'Say "Hello, Gemini is working!" in one sentence.';
    // Using production model: gemini-2.5-flash-lite (stable production lite model)
    const model = 'gemini-2.5-flash-lite';
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: testPrompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 100
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Gemini API test failed:', response.status, errorText);
      
      return res.status(200).json({
        success: false,
        error: `API call failed: ${response.status}`,
        errorDetails: errorText,
        hasKey: true,
        apiUrl: apiUrl.replace(GEMINI_API_KEY, 'KEY_HIDDEN')
      });
    }

    const data = await response.json();
    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    console.log('✅ Gemini API test successful!');
    
    return res.status(200).json({
      success: true,
      message: 'Gemini API is working correctly!',
      response: aiResponse,
      model: model,
      hasKey: true
    });

  } catch (error: any) {
    console.error('❌ Gemini API test error:', error);
    return res.status(500).json({
      success: false,
      error: 'Test failed',
      detail: error.message,
      stack: error.stack
    });
  }
}


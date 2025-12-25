// api/ai-insights/index.ts
// Optimized Gemini API integration with caching, rate limiting, and cost reduction

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface UserProfile {
  height?: string;
  weight?: string;
  topSize?: string;
  bottomSize?: string;
  bodyShape?: string;
  skinTone?: string;
  colorSeason?: string;
  gender?: string;
  chest?: string;
  waist?: string;
  hips?: string;
}

interface ProductInfo {
  name: string;
  category?: string;
  color?: string;
  fabric?: string;
  fit?: string;
  price?: string;
  brand?: string;
  url?: string; // For cache key
}

// In-memory cache: key = userId_productUrl_insightType, value = { data, timestamp }
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Rate limiting: key = userId or IP, value = last call timestamp
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_MS = 3000; // 3 seconds between calls

// Cleanup old cache entries every hour
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      cache.delete(key);
    }
  }
}, 60 * 60 * 1000);

function getRateLimitKey(req: VercelRequest, userId?: string): string {
  // Use userId if available, otherwise use IP
  if (userId) return `user_${userId}`;
  const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
  return `ip_${Array.isArray(ip) ? ip[0] : ip}`;
}

function checkRateLimit(key: string): { allowed: boolean; waitMs?: number } {
  const lastCall = rateLimitMap.get(key);
  if (!lastCall) {
    rateLimitMap.set(key, Date.now());
    return { allowed: true };
  }
  
  const timeSinceLastCall = Date.now() - lastCall;
  if (timeSinceLastCall < RATE_LIMIT_MS) {
    return { allowed: false, waitMs: RATE_LIMIT_MS - timeSinceLastCall };
  }
  
  rateLimitMap.set(key, Date.now());
  return { allowed: true };
}

function getCacheKey(userId: string | undefined, productUrl: string | undefined, insightType: string): string {
  const url = productUrl || 'no-url';
  const user = userId || 'anonymous';
  return `${user}_${url}_${insightType}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userProfile, product, insightType, garment_id, userId } = req.body;
    
    if (!product) {
      return res.status(400).json({ error: 'Product info required' });
    }

    // Rate limiting
    const rateLimitKey = getRateLimitKey(req, userId);
    const rateLimitCheck = checkRateLimit(rateLimitKey);
    if (!rateLimitCheck.allowed) {
      return res.status(429).json({
        error: 'Please wait before requesting again',
        waitSeconds: Math.ceil((rateLimitCheck.waitMs || 0) / 1000),
        message: 'Too many requests. Please wait a moment and try again.'
      });
    }

    // Check cache
    const productUrl = product.url || product.link || product.product_link;
    const cacheKey = getCacheKey(userId, productUrl, insightType);
    const cached = cache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      console.log('✅ Returning cached insights for:', cacheKey);
      return res.status(200).json({
        ...cached.data,
        cached: true,
        cacheAge: Math.floor((Date.now() - cached.timestamp) / 1000) // seconds
      });
    }

    // Fetch garment dimensions from database if garment_id is provided
    let garmentDimensions = null;
    if (garment_id) {
      try {
        const { data: garment, error: garmentError } = await supabase
          .from('garments')
          .select('*')
          .eq('id', garment_id)
          .single();

        if (!garmentError && garment) {
          garmentDimensions = garment;
          console.log('✅ Fetched garment dimensions for AI insights');
        }
      } catch (error) {
        console.warn('⚠️ Could not fetch garment dimensions:', error);
      }
    }

    // Check API key with detailed logging
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    
    // Log all env vars that start with GEMINI to help debug
    const geminiVars = Object.keys(process.env).filter(k => k.includes('GEMINI'));
    console.log('🔍 Environment variables with "GEMINI":', geminiVars);
    console.log('🔍 GEMINI_API_KEY exists:', !!GEMINI_API_KEY);
    console.log('🔍 GEMINI_API_KEY length:', GEMINI_API_KEY?.length || 0);
    console.log('🔍 GEMINI_API_KEY first 10 chars:', GEMINI_API_KEY?.substring(0, 10) || 'N/A');
    
    if (!GEMINI_API_KEY || GEMINI_API_KEY.trim().length === 0) {
      console.error('❌ GEMINI_API_KEY not found or empty in environment variables.');
      console.error('❌ Check Vercel dashboard -> Settings -> Environment Variables');
      console.error('❌ Variable name must be exactly: GEMINI_API_KEY');
      console.error('❌ After adding, redeploy the function.');
      
      const fallbackInsights = generateFallbackInsights(userProfile, product, insightType, garmentDimensions);
      return res.status(200).json({
        insights: fallbackInsights,
        source: 'fallback',
        cached: false,
        error: 'GEMINI_API_KEY not configured. Please add it in Vercel environment variables and redeploy.',
        errorCode: 'API_KEY_MISSING'
      });
    }

    // Build optimized prompt (minimal data)
    const prompt = buildOptimizedPrompt(userProfile, product, insightType, garmentDimensions);
    const systemInstruction = `You are a professional fashion stylist. Give specific, actionable advice. Be direct and concise.`;
    
    // Use confirmed available models: gemini-2.5-flash (cheapest), then gemini-2.0-flash
    const models = [
      'gemini-2.5-flash',  // Confirmed available, cheapest
      'gemini-2.0-flash',  // Fallback
    ];
    
    const requestBody = {
      contents: [
        {
          parts: [{ text: `${systemInstruction}\n\n${prompt}` }]
        }
      ],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 500, // Reduced from 800 to save costs
        topP: 0.9,
        topK: 40
      }
    };
    
    console.log('🔵 Calling Gemini API with model:', models[0]);
    console.log('🔵 Prompt length:', prompt.length, 'chars');
    console.log('🔵 API Key format check - starts with AIza:', GEMINI_API_KEY.startsWith('AIza'));
    console.log('🔵 Full API URL (key hidden):', `https://generativelanguage.googleapis.com/v1beta/models/${models[0]}:generateContent?key=***`);
    
    let response: Response | null = null;
    let usedModel = models[0];
    let lastError: any = null;
    let modelIndex = 0;
    let retryCount = 0;
    const maxRetries = 2;
    
    // Try models with retry logic for 429
    while (modelIndex < models.length) {
      const model = models[modelIndex];
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
      const safeUrl = apiUrl.replace(GEMINI_API_KEY, 'KEY_HIDDEN');
      
      console.log(`🔵 Trying model: ${model} (attempt ${retryCount + 1})`);
      
      try {
        response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });
        
        if (response.ok) {
          usedModel = model;
          console.log(`✅ Success with model: ${model}`);
          break;
        }
        
        const errorText = await response.text();
        let errorJson = null;
        try {
          errorJson = JSON.parse(errorText);
        } catch (e) {
          // Not JSON
        }
        
        console.log(`❌ Model ${model} failed: ${response.status}`);
        if (errorJson?.error?.message) {
          console.log(`   Error: ${errorJson.error.message}`);
        } else {
          console.log(`   Error text: ${errorText.substring(0, 200)}`);
        }
        
        lastError = { status: response.status, error: errorJson || errorText, model };
        
        // Handle 400 - could be invalid API key or invalid model
        if (response.status === 400) {
          const errorMsg = errorJson?.error?.message || errorText || '';
          if (errorMsg.includes('API Key') || errorMsg.includes('API key') || errorMsg.includes('key')) {
            console.error('❌ API Key issue detected. Check:');
            console.error('   1. Key is valid and not expired');
            console.error('   2. Key has Gemini API enabled in Google Cloud Console');
            console.error('   3. Key has correct permissions');
            // Try next model in case it's a model-specific issue
            if (modelIndex < models.length - 1) {
              console.log(`⚠️ Trying next model in case it's model-specific...`);
              modelIndex++;
              retryCount = 0;
              continue;
            } else {
              // All models failed with 400 - likely API key issue
              break;
            }
          } else {
            // 400 but not about API key - might be invalid model or request format
            console.log(`⚠️ 400 error (not API key related), trying next model...`);
            modelIndex++;
            retryCount = 0;
            continue;
          }
        }
        
        // Handle 429 with retry and backoff
        if (response.status === 429) {
          if (retryCount < maxRetries) {
            const backoffMs = retryCount === 0 ? 2000 : 6000; // 2s then 6s
            console.log(`⚠️ Rate limit (429) on ${model}, retrying in ${backoffMs}ms...`);
            await new Promise(resolve => setTimeout(resolve, backoffMs));
            retryCount++;
            continue; // Retry same model
          } else {
            console.log(`⚠️ Max retries reached for ${model}, trying next model...`);
            modelIndex++;
            retryCount = 0;
            continue;
          }
        }
        
        // If 404, try next model
        if (response.status === 404) {
          console.log(`⚠️ 404 error on ${model}, trying next model...`);
          modelIndex++;
          retryCount = 0;
          continue;
        }
        
        // For other errors, stop trying
        console.log(`⚠️ Non-400/404/429 error (${response.status}), stopping`);
        break;
        
      } catch (fetchError) {
        console.error(`❌ Fetch error for ${model}:`, fetchError);
        lastError = fetchError;
        modelIndex++;
        retryCount = 0;
        continue;
      }
    }
    
    // If all models failed, return fallback
    if (!response || !response.ok) {
      console.error('❌ All Gemini models failed. Using fallback.');
      const fallbackInsights = generateFallbackInsights(userProfile, product, insightType, garmentDimensions);
      
      // Still cache fallback to avoid repeated failures
      const responseData = {
        insights: fallbackInsights,
        source: 'fallback',
        modelUsed: null,
        cached: false,
        error: `API error: ${lastError?.status || 'Unknown'}`,
      };
      
      cache.set(cacheKey, { data: responseData, timestamp: Date.now() });
      
      return res.status(200).json(responseData);
    }

    const data = await response.json();
    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    console.log('✅ Gemini API response received, length:', aiResponse.length);
    
    if (!aiResponse || aiResponse.trim().length === 0) {
      console.error('⚠️ Empty response from Gemini, using fallback');
      const fallbackInsights = generateFallbackInsights(userProfile, product, insightType, garmentDimensions);
      return res.status(200).json({
        insights: fallbackInsights,
        source: 'fallback',
        modelUsed: usedModel,
        cached: false,
        error: 'Empty response from Gemini'
      });
    }
    
    // Parse AI response
    const insights = parseAIResponse(aiResponse, insightType);
    
    const responseData = {
      insights,
      source: 'gemini',
      modelUsed: usedModel,
      cached: false
    };
    
    // Cache the response
    cache.set(cacheKey, { data: responseData, timestamp: Date.now() });
    console.log('✅ Cached insights for:', cacheKey);
    
    return res.status(200).json(responseData);

  } catch (error: any) {
    console.error('AI Insights error:', error);
    return res.status(500).json({ 
      error: 'Failed to generate insights', 
      detail: error.message,
      cached: false
    });
  }
}

// Optimized prompt builder - only essential data
function buildOptimizedPrompt(user: UserProfile, product: ProductInfo, type: string, garmentDimensions?: any): string {
  // Minimal user data
  const userParts: string[] = [];
  if (user?.height) userParts.push(`H:${user.height}`);
  if (user?.weight) userParts.push(`W:${user.weight}`);
  if (user?.bodyShape) userParts.push(`Shape:${user.bodyShape}`);
  if (user?.chest) userParts.push(`Chest:${user.chest}cm`);
  if (user?.waist) userParts.push(`Waist:${user.waist}cm`);
  if (user?.hips) userParts.push(`Hips:${user.hips}cm`);
  if (user?.colorSeason) userParts.push(`Season:${user.colorSeason}`);
  const userDesc = userParts.length > 0 ? userParts.join(' ') : 'No profile';
  
  // Minimal product data - only essential fields
  const productParts: string[] = [product.name];
  if (product.brand) productParts.push(`Brand:${product.brand}`);
  if (product.category) productParts.push(`Cat:${product.category}`);
  if (product.color) productParts.push(`Color:${product.color}`);
  if (product.fabric) productParts.push(`Fabric:${product.fabric}`);
  if (product.fit) productParts.push(`Fit:${product.fit}`);
  
  // Only essential garment dimensions
  if (garmentDimensions) {
    const dims: string[] = [];
    if (garmentDimensions.chest) dims.push(`C:${garmentDimensions.chest}cm`);
    if (garmentDimensions.waist) dims.push(`W:${garmentDimensions.waist}cm`);
    if (garmentDimensions.hip) dims.push(`H:${garmentDimensions.hip}cm`);
    if (dims.length > 0) productParts.push(`Size:${dims.join(',')}`);
  }
  
  const productDesc = productParts.join(' ');
  
  if (type === 'fit') {
    return `User: ${userDesc}\nProduct: ${productDesc}\n\nAnalyze fit. Format:\nVERDICT: [Strong Match/Good with Tweaks/Consider Alternatives]\nBODY: [ONE sentence about body fit]\nCOLOR: [ONE sentence about color match]`;
  }
  
  if (type === 'size') {
    return `User: ${userDesc}\nProduct: ${productDesc}\n\nRecommend size. Format:\nRECOMMENDED: [size]\nBACKUP: [backup or none]\nREASONING: [ONE sentence]\nRISK: [Low/Medium/High]`;
  }
  
  return `User: ${userDesc}\nProduct: ${productDesc}\n\nStyle suggestions. Format:\nOCCASIONS: [3-4 occasions, comma-separated]\nTIPS: [3 tips, one per line]`;
}

function parseAIResponse(response: string, type: string): any {
  if (type === 'fit') {
    const verdictMatch = response.match(/VERDICT:\s*(.+)/i);
    const bodyMatch = response.match(/BODY:\s*(.+?)(?=COLOR:|$)/is);
    const colorMatch = response.match(/COLOR:\s*(.+?)$/is);
    
    let verdict = 'good_with_tweaks';
    const verdictText = verdictMatch?.[1]?.trim() || 'This could work for you';
    
    if (verdictText.toLowerCase().includes('strong match')) {
      verdict = 'strong_match';
    } else if (verdictText.toLowerCase().includes('alternative')) {
      verdict = 'consider_alternatives';
    }
    
    return {
      verdict,
      verdictText,
      bodyAdvice: bodyMatch?.[1]?.trim().split('\n').filter(Boolean) || [],
      colorAdvice: colorMatch?.[1]?.trim().split('\n').filter(Boolean) || [],
      hasEnoughData: true
    };
  }
  
  if (type === 'size') {
    const recMatch = response.match(/RECOMMENDED:\s*(.+)/i);
    const backupMatch = response.match(/BACKUP:\s*(.+)/i);
    const reasonMatch = response.match(/REASONING:\s*(.+?)(?=RISK:|$)/is);
    const riskMatch = response.match(/RISK:\s*(.+)/i);
    
    let returnRisk: 'low' | 'medium' | 'high' = 'medium';
    const riskText = riskMatch?.[1]?.toLowerCase() || '';
    if (riskText.includes('low')) returnRisk = 'low';
    else if (riskText.includes('high')) returnRisk = 'high';
    
    return {
      recommendedSize: recMatch?.[1]?.trim() || 'M',
      backupSize: backupMatch?.[1]?.trim(),
      reasoning: reasonMatch?.[1]?.trim().split('\n').filter(Boolean) || [],
      returnRisk,
      hasEnoughData: true
    };
  }
  
  // Style
  const occasionsMatch = response.match(/OCCASIONS:\s*(.+)/i);
  const tipsMatch = response.match(/TIPS:\s*(.+)/is);
  
  return {
    bestFor: occasionsMatch?.[1]?.split(',').map(s => s.trim()) || ['Versatile wear'],
    stylingTips: tipsMatch?.[1]?.trim().split('\n').filter(Boolean).slice(0, 4) || [],
    occasions: occasionsMatch?.[1]?.split(',').map(s => s.trim()) || []
  };
}

function generateFallbackInsights(user: UserProfile, product: ProductInfo, type: string, garmentDimensions?: any): any {
  if (type === 'fit') {
    const bodyAdvice: string[] = [];
    const colorAdvice: string[] = [];
    
    if (user?.bodyShape) {
      const shape = user.bodyShape.toLowerCase();
      if (shape === 'hourglass') bodyAdvice.push('Fitted styles highlight your waist');
      else if (shape === 'pear') bodyAdvice.push('A-line cuts balance your silhouette');
      else if (shape === 'apple') bodyAdvice.push('Empire or wrap styles create flattering lines');
      else bodyAdvice.push(`Works with your ${user.bodyShape} shape`);
    }
    
    if (user?.colorSeason) {
      colorAdvice.push(`${product.color || 'This color'} complements your ${user.colorSeason} coloring`);
    }
    
    return {
      verdict: 'good_with_tweaks',
      verdictText: 'Good with tweaks',
      bodyAdvice: bodyAdvice.length > 0 ? bodyAdvice : ['Add body shape for fit advice'],
      colorAdvice: colorAdvice.length > 0 ? colorAdvice : ['Add color profile for color advice'],
      hasEnoughData: !!(user?.bodyShape || user?.colorSeason)
    };
  }
  
  if (type === 'size') {
    const reasoning: string[] = [];
    
    if (garmentDimensions) {
      if (user?.chest && garmentDimensions.chest) {
        const userChest = parseFloat(user.chest);
        const garmentChest = parseFloat(garmentDimensions.chest);
        if (Math.abs(userChest - garmentChest) <= 4) {
          reasoning.push(`Chest matches (${userChest}cm vs ${garmentChest}cm)`);
        }
      }
      if (user?.waist && garmentDimensions.waist) {
        const userWaist = parseFloat(user.waist);
        const garmentWaist = parseFloat(garmentDimensions.waist);
        if (Math.abs(userWaist - garmentWaist) <= 4) {
          reasoning.push(`Waist matches (${userWaist}cm vs ${garmentWaist}cm)`);
        }
      }
    }
    
    if (reasoning.length === 0 && user?.topSize) {
      reasoning.push(`Based on your usual ${user.topSize}`);
    }
    
    return {
      recommendedSize: user?.topSize || 'M',
      backupSize: undefined,
      reasoning: reasoning.length > 0 ? reasoning : ['Add measurements for accurate sizing'],
      returnRisk: reasoning.length > 0 ? 'low' as const : 'medium' as const,
      hasEnoughData: !!(user?.topSize || garmentDimensions)
    };
  }
  
  return {
    bestFor: ['Casual', 'Weekend', 'Work'],
    stylingTips: ['Layer with basics', 'Add statement accessories', 'Mix textures'],
    occasions: ['Casual', 'Work', 'Weekend']
  };
}

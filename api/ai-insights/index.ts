// api/ai-insights/index.ts
// Uses Google Gemini 2.5 Flash Lite to generate personalized outfit insights based on user profile and product

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
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userProfile, product, insightType, garment_id } = req.body;
    
    if (!product) {
      return res.status(400).json({ error: 'Product info required' });
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
          console.log('✅ Fetched garment dimensions for AI insights:', {
            name: garment.name,
            hasDimensions: !!(garment.chest || garment.waist || garment.hip)
          });
        }
      } catch (error) {
        console.warn('⚠️ Could not fetch garment dimensions:', error);
        // Continue without dimensions - non-critical
      }
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    
    if (!GEMINI_API_KEY) {
      // Fallback to rule-based if no API key
      console.error('❌ GEMINI_API_KEY not found in environment variables. Using fallback.');
      console.error('Please set GEMINI_API_KEY in Vercel environment variables.');
      return res.status(200).json({
        insights: generateFallbackInsights(userProfile, product, insightType, garmentDimensions),
        source: 'fallback',
        error: 'GEMINI_API_KEY not configured'
      });
    }

    const prompt = buildPrompt(userProfile, product, insightType, garmentDimensions);
    const systemInstruction = `You are a professional fashion stylist and personal shopper with expertise in body types, color analysis, and fit. 
Give specific, actionable advice based on the user's profile. Be direct and helpful, not generic.
Always explain WHY something works or doesn't work for their specific body type/coloring.
Use conversational but professional tone. Be encouraging but honest.`;
    
    // Gemini API endpoint - Using Gemini 1.5 Flash (stable production model)
    // Correct model names: gemini-pro, gemini-1.5-pro, gemini-1.5-flash, gemini-2.0-flash-exp
    const model = 'gemini-1.5-flash'; // Changed from incorrect model name
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
    
    console.log('🔵 Calling Gemini API:', model);
    console.log('🔵 API Key present:', !!GEMINI_API_KEY, 'Length:', GEMINI_API_KEY?.length || 0);
    
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
                text: `${systemInstruction}\n\n${prompt}`
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.9, // Increased for more varied responses
          maxOutputTokens: 800, // Increased for more detailed responses
          topP: 0.95, // Increased for more diversity
          topK: 50 // Increased for more variety
        }
      })
    });

    if (!response.ok) {
      let errorText = '';
      let errorJson = null;
      
      try {
        errorText = await response.text();
        errorJson = JSON.parse(errorText);
      } catch (e) {
        // Not JSON, use text as is
      }
      
      console.error('❌ Gemini API error:', response.status);
      console.error('❌ Error response:', errorText.substring(0, 500));
      if (errorJson) {
        console.error('❌ Parsed error:', JSON.stringify(errorJson, null, 2));
      }
      
      // Check for specific quota errors
      const quotaError = errorText.includes('quota') || errorText.includes('QUOTA') || 
                        errorText.includes('429') || errorText.includes('rate limit');
      
      if (quotaError) {
        console.error('⚠️ QUOTA ERROR DETECTED - Check Google Cloud Console for quota limits');
        console.error('⚠️ Make sure billing is enabled and quota limits are set correctly');
      }
      
      // Return fallback if API fails
      return res.status(200).json({
        insights: generateFallbackInsights(userProfile, product, insightType, garmentDimensions),
        source: 'fallback',
        error: `Gemini API error: ${response.status}`,
        errorDetails: errorJson || errorText.substring(0, 200),
        isQuotaError: quotaError
      });
    }

    const data = await response.json();
    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    console.log('✅ Gemini API response received, length:', aiResponse.length);
    console.log('✅ Raw AI response:', aiResponse.substring(0, 200));
    
    if (!aiResponse || aiResponse.trim().length === 0) {
      console.error('⚠️ Empty response from Gemini, using fallback');
      return res.status(200).json({
        insights: generateFallbackInsights(userProfile, product, insightType, garmentDimensions),
        source: 'fallback',
        error: 'Empty response from Gemini'
      });
    }
    
    // Parse AI response into structured format
    const insights = parseAIResponse(aiResponse, insightType);
    
    console.log('✅ Parsed insights:', JSON.stringify(insights, null, 2));
    
    return res.status(200).json({
      insights,
      source: 'gemini-1.5-flash',
      rawResponse: aiResponse.substring(0, 100) // Include snippet for debugging
    });

  } catch (error: any) {
    console.error('AI Insights error:', error);
    return res.status(500).json({ error: 'Failed to generate insights', detail: error.message });
  }
}

function buildPrompt(user: UserProfile, product: ProductInfo, type: string, garmentDimensions?: any): string {
  const userDesc = buildUserDescription(user);
  const productDesc = buildProductDescription(product, garmentDimensions);
  
  // Add timestamp/random element to ensure different responses
  const variation = Date.now() % 1000;
  
  if (type === 'fit') {
    return `${userDesc}

Item: ${productDesc}

You are a professional fashion stylist. Analyze this specific item for this specific user. Give personalized, unique advice that considers their exact body type, measurements, and coloring.

Be specific and actionable. Reference the actual measurements if provided.

Format EXACTLY like this:
VERDICT: [Strong Match OR Good with Tweaks OR Consider Alternatives]
BODY: [ONE specific sentence about how this fits their body shape - mention specific measurements if relevant]
COLOR: [ONE specific sentence about how this color works with their skin tone/season]

Make your advice unique to this combination of user and product.`;
  }
  
  if (type === 'size') {
    return `${userDesc}

Item: ${productDesc}

You are a professional fit specialist. Recommend the best size for this specific user based on their measurements and the garment's measurements.

Be precise and reference actual measurements when available.

Format:
RECOMMENDED: [size only, e.g. "M" or "Large"]
BACKUP: [backup size or "none"]
REASONING: [ONE specific sentence explaining why this size - mention measurements if available]
RISK: [Low/Medium/High]

Base your recommendation on the actual measurements provided, not generic advice.`;
  }
  
  // Style advice
  return `${userDesc}

Item: ${productDesc}

You are a professional stylist. Suggest how to style this specific item for this specific user.

Be creative and specific to this product and user combination.

Format:
OCCASIONS: [3-4 specific occasions, comma-separated]
TIPS: [3 specific styling tips, one line each - be creative and unique]

Make suggestions that are tailored to this specific item and user's style profile.`;
}

function buildUserDescription(user: UserProfile): string {
  const parts = ['User profile:'];
  
  if (!user || Object.keys(user).length === 0) {
    return 'User profile: No profile data available. Give general advice.';
  }
  
  if (user.gender) parts.push(`Gender: ${user.gender}`);
  if (user.height) parts.push(`Height: ${user.height}`);
  if (user.weight) parts.push(`Weight: ${user.weight}`);
  if (user.bodyShape) parts.push(`Body shape: ${user.bodyShape}`);
  if (user.topSize) parts.push(`Usual top size: ${user.topSize}`);
  if (user.bottomSize) parts.push(`Usual bottom size: ${user.bottomSize}`);
  if (user.skinTone) parts.push(`Skin tone: ${user.skinTone}`);
  if (user.colorSeason) parts.push(`Color season: ${user.colorSeason} (${getSeasonDescription(user.colorSeason)})`);
  
  return parts.join('\n');
}

function getSeasonDescription(season: string): string {
  const descriptions: Record<string, string> = {
    'spring': 'warm undertones, looks best in warm, clear colors like coral, peach, golden yellow',
    'summer': 'cool undertones, looks best in soft, muted colors like lavender, dusty rose, powder blue',
    'autumn': 'warm undertones, looks best in rich, earthy colors like rust, olive, mustard, burgundy',
    'winter': 'cool undertones, looks best in bold, clear colors like true red, emerald, black, pure white'
  };
  return descriptions[season.toLowerCase()] || 'balanced coloring';
}

function buildProductDescription(product: ProductInfo, garmentDimensions?: any): string {
  const parts = [product.name];
  if (product.brand) parts.push(`by ${product.brand}`);
  if (product.color) parts.push(`in ${product.color}`);
  if (product.fabric) parts.push(`made of ${product.fabric}`);
  if (product.fit) parts.push(`(${product.fit} fit)`);
  if (product.category) parts.push(`- Category: ${product.category}`);
  
  // Add garment dimensions if available
  if (garmentDimensions) {
    const dims = [];
    if (garmentDimensions.chest) dims.push(`Chest: ${garmentDimensions.chest}cm`);
    if (garmentDimensions.waist) dims.push(`Waist: ${garmentDimensions.waist}cm`);
    if (garmentDimensions.hip) dims.push(`Hip: ${garmentDimensions.hip}cm`);
    if (garmentDimensions.front_length) dims.push(`Front Length: ${garmentDimensions.front_length}cm`);
    if (garmentDimensions.back_length) dims.push(`Back Length: ${garmentDimensions.back_length}cm`);
    if (garmentDimensions.sleeve_length) dims.push(`Sleeve Length: ${garmentDimensions.sleeve_length}cm`);
    if (garmentDimensions.back_width) dims.push(`Back Width: ${garmentDimensions.back_width}cm`);
    if (garmentDimensions.arm_width) dims.push(`Arm Width: ${garmentDimensions.arm_width}cm`);
    if (garmentDimensions.shoulder_width) dims.push(`Shoulder Width: ${garmentDimensions.shoulder_width}cm`);
    if (garmentDimensions.front_rise) dims.push(`Front Rise: ${garmentDimensions.front_rise}cm`);
    if (garmentDimensions.back_rise) dims.push(`Back Rise: ${garmentDimensions.back_rise}cm`);
    if (garmentDimensions.inseam) dims.push(`Inseam: ${garmentDimensions.inseam}cm`);
    if (garmentDimensions.outseam) dims.push(`Outseam: ${garmentDimensions.outseam}cm`);
    
    if (dims.length > 0) {
      parts.push(`\nMeasurements: ${dims.join(', ')}`);
    }
  }
  
  return parts.join(' ');
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
  // Rule-based fallback when Gemini API is not available
  if (type === 'fit') {
    const bodyAdvice: string[] = [];
    const colorAdvice: string[] = [];
    
    if (user?.bodyShape) {
      const shape = user.bodyShape.toLowerCase();
      if (shape === 'hourglass') bodyAdvice.push('Fitted styles highlight your waist definition');
      else if (shape === 'pear') bodyAdvice.push('A-line cuts balance your silhouette nicely');
      else if (shape === 'apple') bodyAdvice.push('Empire or wrap styles create flattering lines');
      else if (shape === 'rectangle') bodyAdvice.push('Belted styles add dimension to your frame');
      else bodyAdvice.push(`Works with your ${user.bodyShape} shape`);
    }
    
    if (user?.colorSeason) {
      const season = user.colorSeason.toLowerCase();
      const color = product.color?.toLowerCase() || '';
      if ((season === 'winter' || season === 'summer') && (color.includes('warm') || color.includes('gold'))) {
        colorAdvice.push('Cool tones suit you better than this warm shade');
      } else if ((season === 'spring' || season === 'autumn') && (color.includes('cool') || color.includes('silver'))) {
        colorAdvice.push('Warm tones flatter you more than cool shades');
      } else {
        colorAdvice.push(`${product.color || 'This color'} complements your ${season} coloring`);
      }
    }
    
    return {
      verdict: 'good_with_tweaks',
      verdictText: 'Good with tweaks',
      bodyAdvice: bodyAdvice.length > 0 ? bodyAdvice : ['Add body shape for fit advice'],
      colorAdvice: colorAdvice.length > 0 ? colorAdvice : ['Add face photo for color advice'],
      hasEnoughData: !!(user?.bodyShape || user?.colorSeason)
    };
  }
  
  if (type === 'size') {
    const reasoning: string[] = [];
    
    // Use garment dimensions if available
    if (garmentDimensions) {
      if (user?.chest && garmentDimensions.chest) {
        const userChest = parseFloat(user.chest);
        const garmentChest = parseFloat(garmentDimensions.chest);
        if (Math.abs(userChest - garmentChest) <= 4) {
          reasoning.push(`Chest measurement matches (${userChest}cm vs ${garmentChest}cm)`);
        } else if (userChest < garmentChest) {
          reasoning.push(`Garment chest is ${garmentChest - userChest}cm larger - may be loose`);
        } else {
          reasoning.push(`Garment chest is ${userChest - garmentChest}cm smaller - may be tight`);
        }
      }
      if (user?.waist && garmentDimensions.waist) {
        const userWaist = parseFloat(user.waist);
        const garmentWaist = parseFloat(garmentDimensions.waist);
        if (Math.abs(userWaist - garmentWaist) <= 4) {
          reasoning.push(`Waist measurement matches (${userWaist}cm vs ${garmentWaist}cm)`);
        }
      }
      if (user?.hips && garmentDimensions.hip) {
        const userHips = parseFloat(user.hips);
        const garmentHip = parseFloat(garmentDimensions.hip);
        if (Math.abs(userHips - garmentHip) <= 4) {
          reasoning.push(`Hip measurement matches (${userHips}cm vs ${garmentHip}cm)`);
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


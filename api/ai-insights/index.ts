// api/ai-insights/index.ts
// Uses Google Gemini 2.5 Flash Lite to generate personalized outfit insights based on user profile and product

import type { VercelRequest, VercelResponse } from '@vercel/node';

interface UserProfile {
  height?: string;
  weight?: string;
  topSize?: string;
  bottomSize?: string;
  bodyShape?: string;
  skinTone?: string;
  colorSeason?: string;
  gender?: string;
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
    const { userProfile, product, insightType } = req.body;
    
    if (!product) {
      return res.status(400).json({ error: 'Product info required' });
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    
    if (!GEMINI_API_KEY) {
      // Fallback to rule-based if no API key
      console.log('No Gemini API key, using fallback');
      return res.status(200).json({
        insights: generateFallbackInsights(userProfile, product, insightType),
        source: 'fallback'
      });
    }

    const prompt = buildPrompt(userProfile, product, insightType);
    const systemInstruction = `You are a professional fashion stylist and personal shopper with expertise in body types, color analysis, and fit. 
Give specific, actionable advice based on the user's profile. Be direct and helpful, not generic.
Always explain WHY something works or doesn't work for their specific body type/coloring.
Use conversational but professional tone. Be encouraging but honest.`;
    
    // Gemini API endpoint - Production: Using Gemini 2.5 Flash Lite (stable production model)
    // This is the production-ready 2.5 Flash Lite model
    const model = 'gemini-2.5-flash-lite';
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
    
    console.log('🔵 Calling Gemini API (Production):', model);
    
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
          temperature: 0.7,
          maxOutputTokens: 500,
          topP: 0.8,
          topK: 40
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Gemini API error:', response.status, errorText);
      
      // Return fallback if API fails
      return res.status(200).json({
        insights: generateFallbackInsights(userProfile, product, insightType),
        source: 'fallback',
        error: `Gemini API error: ${response.status}`
      });
    }

    const data = await response.json();
    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    console.log('✅ Gemini API response received, length:', aiResponse.length);
    
    // Parse AI response into structured format
    const insights = parseAIResponse(aiResponse, insightType);
    
    return res.status(200).json({
      insights,
      source: 'gemini-2.5-flash-lite'
    });

  } catch (error: any) {
    console.error('AI Insights error:', error);
    return res.status(500).json({ error: 'Failed to generate insights', detail: error.message });
  }
}

function buildPrompt(user: UserProfile, product: ProductInfo, type: string): string {
  const userDesc = buildUserDescription(user);
  const productDesc = buildProductDescription(product);
  
  if (type === 'fit') {
    return `${userDesc}

Item: ${productDesc}

Give BRIEF, SPECIFIC advice. Be concise - max 1 short sentence per point.

Format EXACTLY like this:
VERDICT: [Strong Match OR Good with Tweaks OR Consider Alternatives]
BODY: [ONE short sentence about how this fits their body shape]
COLOR: [ONE short sentence about how this color works with their skin tone]`;
  }
  
  if (type === 'size') {
    return `${userDesc}

Item: ${productDesc}

Be brief and direct.

Format:
RECOMMENDED: [size only, e.g. "M"]
BACKUP: [backup size or "none"]
REASONING: [ONE short sentence]
RISK: [Low/Medium/High]`;
  }
  
  // Style advice
  return `${userDesc}

Item: ${productDesc}

Be brief - just key points.

Format:
OCCASIONS: [3-4 words max, comma-separated]
TIPS: [3 SHORT tips, one line each]`;
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

function buildProductDescription(product: ProductInfo): string {
  const parts = [product.name];
  if (product.brand) parts.push(`by ${product.brand}`);
  if (product.color) parts.push(`in ${product.color}`);
  if (product.fabric) parts.push(`made of ${product.fabric}`);
  if (product.fit) parts.push(`(${product.fit} fit)`);
  if (product.category) parts.push(`- Category: ${product.category}`);
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

function generateFallbackInsights(user: UserProfile, product: ProductInfo, type: string): any {
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
    return {
      recommendedSize: user?.topSize || 'M',
      backupSize: undefined,
      reasoning: user?.topSize ? [`Based on your usual ${user.topSize}`] : ['Add measurements'],
      returnRisk: 'medium' as const,
      hasEnoughData: !!user?.topSize
    };
  }
  
  return {
    bestFor: ['Casual', 'Weekend', 'Work'],
    stylingTips: ['Layer with basics', 'Add statement accessories', 'Mix textures'],
    occasions: ['Casual', 'Work', 'Weekend']
  };
}


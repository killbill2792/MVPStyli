// api/ai-insights/index.ts
// Uses OpenAI to generate personalized outfit insights based on user profile and product

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

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    
    if (!OPENAI_API_KEY) {
      // Fallback to rule-based if no API key
      console.log('No OpenAI API key, using fallback');
      return res.status(200).json({
        insights: generateFallbackInsights(userProfile, product, insightType),
        source: 'fallback'
      });
    }

    const prompt = buildPrompt(userProfile, product, insightType);
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a professional fashion stylist and personal shopper with expertise in body types, color analysis, and fit. 
Give specific, actionable advice based on the user's profile. Be direct and helpful, not generic.
Always explain WHY something works or doesn't work for their specific body type/coloring.
Use conversational but professional tone. Be encouraging but honest.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI API error:', error);
      return res.status(200).json({
        insights: generateFallbackInsights(userProfile, product, insightType),
        source: 'fallback'
      });
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content || '';
    
    // Parse AI response into structured format
    const insights = parseAIResponse(aiResponse, insightType);
    
    return res.status(200).json({
      insights,
      source: 'openai'
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

The user is considering this item: ${productDesc}

Analyze if this outfit suits them. Consider:
1. How the item's fit/silhouette works with their body shape
2. How the color works with their skin tone/coloring
3. Any length/proportion considerations for their height

Give a clear verdict (Strong Match / Good with Tweaks / Consider Alternatives) and 2-3 specific reasons.
Format your response as:
VERDICT: [your verdict]
BODY: [1-2 points about body/shape fit]
COLOR: [1-2 points about color match with their skin tone]`;
  }
  
  if (type === 'size') {
    return `${userDesc}

The user wants to know what size to buy: ${productDesc}

Based on their measurements and usual sizes, recommend:
1. The best size for them
2. A backup size if between sizes
3. Any brand-specific sizing notes
4. Return risk level (Low/Medium/High)

Format:
RECOMMENDED: [size]
BACKUP: [backup size or "none needed"]
REASONING: [why this size]
RISK: [Low/Medium/High]`;
  }
  
  // Style advice
  return `${userDesc}

The user has this item: ${productDesc}

Give styling advice:
1. Best occasions/settings for this piece
2. 3-4 specific outfit ideas/pairings
3. Accessories that would work

Format:
OCCASIONS: [comma-separated list]
TIPS: [numbered styling tips]`;
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
  // Rule-based fallback when OpenAI is not available
  if (type === 'fit') {
    const bodyAdvice = [];
    const colorAdvice = [];
    
    if (user?.bodyShape) {
      bodyAdvice.push(`For your ${user.bodyShape} body shape, consider how this cut flatters your proportions.`);
    }
    if (user?.height) {
      bodyAdvice.push(`At ${user.height}, check if the length/proportions work for you.`);
    }
    if (user?.skinTone || user?.colorSeason) {
      colorAdvice.push(`Based on your ${user.colorSeason || user.skinTone} coloring, ${product.color || 'this color'} could work well.`);
    }
    
    return {
      verdict: 'good_with_tweaks',
      verdictText: user?.bodyShape ? `This piece has potential for your ${user.bodyShape} shape` : 'This piece is versatile',
      bodyAdvice: bodyAdvice.length > 0 ? bodyAdvice : ['Add your body shape in profile for personalized fit advice'],
      colorAdvice: colorAdvice.length > 0 ? colorAdvice : ['Add a face photo to get color matching advice'],
      hasEnoughData: !!(user?.bodyShape || user?.colorSeason)
    };
  }
  
  if (type === 'size') {
    return {
      recommendedSize: user?.topSize || 'M',
      backupSize: undefined,
      reasoning: user?.topSize ? [`Based on your usual size ${user.topSize}`] : ['Add your measurements for better recommendations'],
      returnRisk: 'medium' as const,
      hasEnoughData: !!user?.topSize
    };
  }
  
  return {
    bestFor: ['Versatile wear', 'Multiple occasions'],
    stylingTips: [
      'Layer with basics for everyday wear',
      'Dress up with accessories for special occasions',
      'Mix textures for visual interest'
    ],
    occasions: ['Casual', 'Work', 'Weekend']
  };
}


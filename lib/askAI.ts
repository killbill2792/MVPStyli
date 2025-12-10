// Ask AI - Generates personalized outfit insights
// Combines user profile data with product info to provide fit, size, and styling advice

import { ColorProfile, doesColorMatch } from './colorAnalysis';

export interface UserProfile {
  height?: string;
  weight?: string;
  topSize?: string;
  bottomSize?: string;
  shoeSize?: string;
  chest?: string;
  waist?: string;
  hips?: string;
  bodyShape?: string;
  colorProfile?: ColorProfile;
}

export interface ProductInfo {
  name: string;
  category?: string;
  color?: string;
  fabric?: string;
  fit?: string;
  length?: string;
  price?: number;
  brand?: string;
  sizeChart?: { [size: string]: { bust?: number; waist?: number; hips?: number; length?: number } };
}

export interface FitAdvice {
  verdict: 'strong_match' | 'good_with_tweaks' | 'consider_alternatives';
  verdictText: string;
  bodyAdvice: string[];
  colorAdvice: string[];
  hasEnoughData: boolean;
  missingDataMessage?: string;
}

export interface SizeAdvice {
  recommendedSize: string;
  backupSize?: string;
  reasoning: string[];
  returnRisk: 'low' | 'medium' | 'high';
  hasEnoughData: boolean;
  missingDataMessage?: string;
}

export interface StyleAdvice {
  bestFor: string[];
  stylingTips: string[];
  occasions: string[];
}

// Helper to get random item from array
const sample = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

// Generate fit advice based on user profile and product
export function generateFitAdvice(user: UserProfile, product: ProductInfo): FitAdvice {
  const bodyAdvice: string[] = [];
  const colorAdvice: string[] = [];
  let verdict: 'strong_match' | 'good_with_tweaks' | 'consider_alternatives' = 'good_with_tweaks';
  let verdictText = sample(["Nice piece that could work well for you", "This has potential for your style", "A solid addition to your wardrobe"]);
  
  // Check if we have enough data
  const hasBodyData = user.height || user.bodyShape || user.topSize;
  const hasColorData = !!user.colorProfile;
  
  if (!hasBodyData && !hasColorData) {
    return {
      verdict: 'good_with_tweaks',
      verdictText: "We need more info to give personalized advice",
      bodyAdvice: [],
      colorAdvice: [],
      hasEnoughData: false,
      missingDataMessage: "To give better advice, add your measurements and a face photo in Account → Fit Profile. This helps us understand your body shape and best colors."
    };
  }

  // Body shape analysis
  if (user.bodyShape) {
    const category = (product.category || '').toLowerCase();
    const fit = (product.fit || '').toLowerCase();
    const fabric = (product.fabric || '').toLowerCase();
    
    switch (user.bodyShape.toLowerCase()) {
      case 'hourglass':
        if (fit.includes('fitted') || fit.includes('wrap') || fit.includes('belted')) {
          bodyAdvice.push("✓ This fitted style highlights your natural waist definition");
          verdict = 'strong_match';
        } else if (fit.includes('oversized') || fit.includes('boxy')) {
          bodyAdvice.push("This boxy cut might hide your curves - consider adding a belt");
        } else if (category.includes('skirt') && fit.includes('pencil')) {
          bodyAdvice.push("✓ Pencil cuts follow your natural lines perfectly");
          verdict = 'strong_match';
        }
        break;
      case 'pear':
        if (category.includes('top') && (fit.includes('ruffle') || fit.includes('embellished') || fabric.includes('textured'))) {
          bodyAdvice.push("✓ Details on top balance your silhouette nicely");
          verdict = 'strong_match';
        } else if (category.includes('bottom') && (fit.includes('wide') || fit.includes('flare') || fit.includes('a-line'))) {
          bodyAdvice.push("✓ A-line and wide cuts flow beautifully over your hips");
          verdict = 'strong_match';
        } else if (category.includes('bottom') && fit.includes('skinny')) {
          bodyAdvice.push("Skinny fits emphasize hips - pair with a longer top for balance");
        }
        break;
      case 'apple':
        if (fit.includes('empire') || fit.includes('a-line') || fit.includes('swing')) {
          bodyAdvice.push("✓ This flowy cut skims comfortably without clinging");
          verdict = 'strong_match';
        } else if (fit.includes('wrap')) {
          bodyAdvice.push("✓ Wrap styles define a waistline exactly where you want it");
          verdict = 'strong_match';
        } else if (fit.includes('crop') && category.includes('top')) {
          bodyAdvice.push("Cropped tops might feel short on the torso - check the length");
        }
        break;
      case 'rectangle':
        if (fit.includes('wrap') || fit.includes('peplum') || fit.includes('ruched')) {
          bodyAdvice.push("✓ This style creates the illusion of curves and dimension");
          verdict = 'strong_match';
        } else if (category.includes('dress') && fit.includes('shift')) {
          bodyAdvice.push("✓ Shift dresses complement your straight lines effortlessly");
          verdict = 'strong_match';
        } else if (fit.includes('belted')) {
          bodyAdvice.push("✓ Belting creates immediate waist definition");
        }
        break;
      case 'inverted_triangle':
        if (category.includes('bottom') && (fit.includes('wide') || fit.includes('flare') || fit.includes('pleated'))) {
          bodyAdvice.push("✓ Volume on the bottom balances broader shoulders");
          verdict = 'strong_match';
        } else if (category.includes('top') && fit.includes('v-neck')) {
          bodyAdvice.push("✓ V-necks break up the shoulder line nicely");
          verdict = 'strong_match';
        } else if (category.includes('top') && (fit.includes('puff') || fit.includes('shoulder pad'))) {
          bodyAdvice.push("Shoulder details might emphasize width - maybe try a simpler sleeve");
        }
        break;
    }
  }

  // Height-based advice
  if (user.height) {
    const heightInches = parseHeight(user.height);
    const length = (product.length || '').toLowerCase();
    const category = (product.category || '').toLowerCase();
    
    if (heightInches && heightInches < 64) { // Under 5'4"
      if (length.includes('maxi') || length.includes('long')) {
        bodyAdvice.push("Maxi lengths can overwhelm petite frames - heels or hemming required");
      } else if (length.includes('mini') || length.includes('cropped')) {
        bodyAdvice.push("✓ Cropped/mini cuts are great for elongating your legs");
        if (verdict !== 'strong_match') verdict = 'good_with_tweaks';
      } else if (category.includes('pant') && !length.includes('petite')) {
        bodyAdvice.push("Check the inseam - regular length pants usually need hemming");
      }
    } else if (heightInches && heightInches > 68) { // Over 5'8"
      if (length.includes('crop')) {
        bodyAdvice.push("Cropped styles show off your height beautifully");
      } else if (length.includes('mini')) {
        bodyAdvice.push("Mini lengths will look quite short on you - keep it in mind");
      } else if (category.includes('jumpsuit') || category.includes('romper')) {
        bodyAdvice.push("Check torso length specifically for jumpsuits to avoid pulling");
      }
    }
  }

  // Color analysis
  if (user.colorProfile && product.color) {
    const colorMatch = doesColorMatch(product.color, user.colorProfile);
    
    if (colorMatch === 'good') {
      colorAdvice.push(`✓ ${product.color} radiates on you - one of your power colors`);
      if (verdict !== 'strong_match') verdict = 'strong_match'; // Bump up verdict for great color
    } else if (colorMatch === 'avoid') {
      colorAdvice.push(`This specific ${product.color} might wash you out - try a warmer/deeper shade`);
      if (verdict === 'strong_match') verdict = 'good_with_tweaks'; // Downgrade for bad color
    } else {
      colorAdvice.push(`${product.color} is neutral for you - safe but add accessories to pop`);
    }
    
    // Add season-specific advice
    if (user.colorProfile.season) {
      const season = user.colorProfile.season;
      if (season === 'winter' || season === 'summer') {
        if (product.color?.toLowerCase().includes('gold') || product.color?.toLowerCase().includes('orange')) {
          colorAdvice.push("Cool tones suit you best - silver jewelry pairs better than gold here");
        }
      } else {
        if (product.color?.toLowerCase().includes('silver') || product.color?.toLowerCase().includes('grey')) {
          colorAdvice.push("Warm tones make you glow - gold accessories will lift this look");
        }
      }
    }
  }

  // Set final verdict text
  if (verdict === 'strong_match') {
    verdictText = sample([
      "Strong match for your frame and coloring ✨",
      "This hits all the right notes for you 🎯",
      "Ideally suited for your shape and tone 🌟"
    ]);
  } else if (verdict === 'consider_alternatives') {
    verdictText = "Might be tricky to style for your profile";
  } else if (bodyAdvice.length === 0 && colorAdvice.length === 0) {
    verdictText = "This piece is versatile and safe to try";
  }

  return {
    verdict,
    verdictText,
    bodyAdvice,
    colorAdvice,
    hasEnoughData: true
  };
}

// Generate size recommendation
export function generateSizeAdvice(user: UserProfile, product: ProductInfo): SizeAdvice {
  // Check if we have enough data
  if (!user.topSize && !user.chest && !user.waist && !user.hips) {
    return {
      recommendedSize: 'Unknown',
      reasoning: [],
      returnRisk: 'high',
      hasEnoughData: false,
      missingDataMessage: "Add your measurements or usual sizes in Account → Fit Profile for accurate size recommendations."
    };
  }

  const reasoning: string[] = [];
  let recommendedSize = user.topSize || 'M';
  let backupSize: string | undefined;
  let returnRisk: 'low' | 'medium' | 'high' = 'medium';

  // If we have a size chart and measurements
  if (product.sizeChart && (user.chest || user.waist || user.hips)) {
    // Simple logic to check if size chart has data
    const sizes = Object.keys(product.sizeChart);
    if (sizes.length > 0) {
        // Find best matching size
        let bestScore = -1;
        let bestSize = recommendedSize;

        for (const size of sizes) {
        const sizeData = product.sizeChart[size];
        let score = 0;
        let checks = 0;
        
        if (user.chest && sizeData.bust) {
            const userChest = parseFloat(user.chest);
            checks++;
            // Within 2-3cm is good
            if (userChest <= parseFloat(sizeData.bust.toString()) + 2 && userChest >= parseFloat(sizeData.bust.toString()) - 4) score += 2;
            else if (userChest <= parseFloat(sizeData.bust.toString()) + 4) score += 1; // Slightly tight but ok
        }
        if (user.waist && sizeData.waist) {
            const userWaist = parseFloat(user.waist);
            checks++;
            if (userWaist <= parseFloat(sizeData.waist.toString()) + 2 && userWaist >= parseFloat(sizeData.waist.toString()) - 4) score += 2;
        }
        if (user.hips && sizeData.hips) {
            const userHips = parseFloat(user.hips);
            checks++;
            if (userHips <= parseFloat(sizeData.hips.toString()) + 2 && userHips >= parseFloat(sizeData.hips.toString()) - 4) score += 2;
        }
        
        if (checks > 0 && score > bestScore) {
            bestScore = score;
            bestSize = size;
        }
        }
        
        if (bestScore > 0) {
            recommendedSize = bestSize;
            returnRisk = 'low';
            reasoning.push(`Matches your measurements according to the brand's chart`);
        }
    }
  }

  // General advice based on available data if no chart match
  if (reasoning.length === 0) {
    if (user.chest) {
        reasoning.push(`Based on your bust measurement (~${user.chest}cm)`);
    }
    if (user.topSize) {
        reasoning.push(`Considering your usual size ${user.topSize}`);
    }
  }

  // Fabric stretch factor
  const fabric = (product.fabric || '').toLowerCase();
  if (fabric.includes('elastane') || fabric.includes('spandex') || fabric.includes('stretch') || fabric.includes('knit')) {
    reasoning.push("Fabric has stretch, so your usual size should fit comfortably");
    returnRisk = 'low';
  } else if (fabric.includes('100% cotton') || fabric.includes('linen') || fabric.includes('denim')) {
    reasoning.push("Non-stretch fabric - stick to the size chart or size up for comfort");
    backupSize = getSizeUp(recommendedSize);
    returnRisk = 'medium';
  }

  // Brand-specific advice
  if (product.brand) {
    const brand = product.brand.toLowerCase();
    if (brand.includes('zara') || brand.includes('h&m')) {
      reasoning.push("This brand runs small in shoulders/bust - sizing up is safer");
      backupSize = getSizeUp(recommendedSize);
    } else if (brand.includes('uniqlo') || brand.includes('gap') || brand.includes('banana republic')) {
      reasoning.push("Brand typically runs true to size");
      returnRisk = returnRisk === 'high' ? 'medium' : returnRisk;
    } else if (brand.includes('asos')) {
        reasoning.push("ASOS sizes vary by sub-brand - check measurements if possible");
    }
  }

  return {
    recommendedSize,
    backupSize,
    reasoning,
    returnRisk,
    hasEnoughData: true
  };
}

// Generate styling advice
export function generateStyleAdvice(user: UserProfile, product: ProductInfo): StyleAdvice {
  const category = (product.category || product.name || '').toLowerCase();
  const fabric = (product.fabric || '').toLowerCase();
  const color = (product.color || '').toLowerCase();
  
  let bestFor: string[] = [];
  let stylingTips: string[] = [];
  let occasions: string[] = [];

  // Fabric & Category Matrix
  if (category.includes('dress')) {
    if (fabric.includes('silk') || fabric.includes('satin') || fabric.includes('velvet')) {
      bestFor = sample([
          ['Date nights', 'Cocktail parties', 'Weddings'],
          ['Evening galas', 'Romantic dinners', 'Holiday parties']
      ]);
      stylingTips = [
        "Strappy heels and delicate jewelry let the fabric shine",
        "A structured blazer adds a modern edge for dinner",
        "Finish with a clutch for a polished evening look"
      ];
    } else if (fabric.includes('linen') || fabric.includes('cotton')) {
      bestFor = ['Summer brunch', 'Vacation', 'Casual weekends'];
      stylingTips = [
        "Pair with leather slides or espadrilles",
        "A denim jacket is the perfect layer for cool evenings",
        "Woven or straw accessories complete the natural vibe"
      ];
    } else if (fabric.includes('knit') || fabric.includes('sweater')) {
      bestFor = ['Cozy weekends', 'Fall layering', 'Coffee runs'];
      stylingTips = [
        "Knee-high boots create a chic autumn silhouette",
        "Belt it to add structure if it feels too relaxed",
        "Layer a collared shirt underneath for a preppy twist"
      ];
    } else {
      bestFor = ['Office to dinner', 'Versatile wear'];
      stylingTips = [
        "Swap blazer for leather jacket to go day-to-night",
        "Statement earrings instantly elevate the look",
        "Works with both ankle boots and pumps"
      ];
    }
  } else if (category.includes('top') || category.includes('blouse') || category.includes('shirt')) {
    if (fabric.includes('silk') || category.includes('blouse')) {
        bestFor = ['Work meetings', 'Dinner dates'];
        stylingTips = [
            "Half-tuck into high-waisted trousers for ease",
            "Layer under a sleeveless dress to extend its wear",
            "Add a pendant necklace to highlight the neckline"
        ];
    } else {
        bestFor = ['Everyday layering', 'Casual office'];
        stylingTips = [
            "French tuck into jeans for a polished casual vibe",
            "Layer under a cardigan or blazer",
            "Cuff the sleeves for a relaxed touch"
        ];
    }
  } else if (category.includes('jean') || category.includes('denim')) {
    bestFor = ['Weekend staples', 'Casual Fridays'];
    stylingTips = [
        "Pair with a silk cami and blazer for high-low contrast",
        "Crisp white sneakers keep it fresh and modern",
        "A tucked-in oversized shirt balances the silhouette"
    ];
  } else if (category.includes('skirt')) {
    if (product.length === 'mini') {
        bestFor = ['Night out', 'Summer days'];
        stylingTips = [
            "Balance the short length with a looser top or sweater",
            "Opaque tights extend wear into colder months",
            "Flat boots or sneakers keep it grounded for day"
        ];
    } else {
        bestFor = ['Office', 'Elegant brunch'];
        stylingTips = [
            "A fitted bodysuit ensures a smooth waistline",
            "Pointed shoes extend the leg line",
            "Cropped jackets maintain your proportions"
        ];
    }
  } else {
    // Generic/Outerwear
    bestFor = ['Layering', 'Completing the look'];
    stylingTips = [
      "Drape over shoulders for an effortless editorial vibe",
      "Roll or push up sleeves to show some wrist",
      "Mix textures (e.g., knit + leather) for visual interest"
    ];
  }

  // Color specific styling
  if (color.includes('red') || color.includes('burgundy')) {
    stylingTips.push("Keep makeup neutral to let the red pop");
  } else if (color.includes('black')) {
    stylingTips.push("Add texture or metallic accessories to break up the monochrome");
  } else if (color.includes('white') || color.includes('cream')) {
    stylingTips.push("Nude undergarments are key for a flawless finish");
  }

  return {
    bestFor,
    stylingTips: stylingTips.slice(0, 4), // Limit to 4
    occasions: bestFor // reusing for simplicity in MVP
  };
}

// Helper: Parse height string to inches
function parseHeight(height: string): number | null {
  // Handle formats like "5'8", "5'8\"", "5 ft 8", "170cm", "170"
  if (height.includes('cm')) {
    const cm = parseFloat(height);
    return cm / 2.54;
  }
  if (height.includes("'") || height.includes('ft')) {
    const parts = height.match(/(\d+)['\s]?(?:ft)?\s*(\d*)/);
    if (parts) {
      const feet = parseInt(parts[1]);
      const inches = parseInt(parts[2]) || 0;
      return feet * 12 + inches;
    }
  }
  // Assume just inches if plain number > 48
  const num = parseFloat(height);
  if (num > 48) return num;
  return null;
}

// Helper: Get next size up
function getSizeUp(size: string): string {
  const sizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  const idx = sizes.indexOf(size.toUpperCase());
  if (idx >= 0 && idx < sizes.length - 1) {
    return sizes[idx + 1];
  }
  // Numeric sizes
  const num = parseInt(size);
  if (!isNaN(num)) {
    return (num + 2).toString();
  }
  return size;
}
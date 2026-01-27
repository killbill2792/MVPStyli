/**
 * Stylit — Color + Body Shape Suitability (NO-AI)
 * File: lib/styleSuitability.js
 *
 * PRIMARY METHOD: Uses Lab + ΔE classification (same as StyleVault) for unified color analysis
 * FALLBACK: Uses attribute-based rules and string matching when hex/season unavailable
 *
 * Inputs expected on user:
 * - undertone: "warm" | "cool" | "neutral" | null
 * - season: "spring" | "summer" | "autumn" | "winter" | null (optional)
 * - bodyShape: string | null (women/men shapes)
 *
 * Inputs expected on product:
 * - colorHex: string | null (e.g., "#FF0000") - SOURCE OF TRUTH for color logic
 * - primaryColor: string | null (e.g., "black", "navy", "beige") - UI display only, fallback if hex missing
 * - category: "upper_body" | "lower_body" | "dresses"
 * - fitType: "slim" | "regular" | "relaxed" | "oversized" | null
 */

const { colorAttributesFromHex } = require('./colorAttributes');

// Import classification system (unified with StyleVault)
// Note: colorClassification.ts uses ES6 exports, but React Native/Expo can handle this
let classifyGarment = null;
try {
  // Try to import the classification system
  const colorClassification = require('./colorClassification');
  
  // Handle both ES6 default export and named export patterns
  if (colorClassification) {
    // Try named export first
    if (typeof colorClassification.classifyGarment === 'function') {
      classifyGarment = colorClassification.classifyGarment;
    }
    // Try default export
    else if (colorClassification.default && typeof colorClassification.default.classifyGarment === 'function') {
      classifyGarment = colorClassification.default.classifyGarment;
    }
    // Try if default is the function itself
    else if (typeof colorClassification.default === 'function') {
      classifyGarment = colorClassification.default;
    }
  }
  
  // classifyGarment loaded if available
} catch (error) {
  // Classification system not available - will use alternative methods
}

function normalizeColorName(c) {
  if (!c) return null;
  return String(c).trim().toLowerCase();
}


function colorFamily(color) {
  const c = normalizeColorName(color);
  if (!c) return null;
  
  // Comprehensive color families for skin tone matching
  const neutrals = [
    "black", "white", "grey", "gray", "dark grey", "light grey", "charcoal", "slate", "silver",
    "cream", "beige", "tan", "ivory", "off-white", "ecru", "taupe"
  ];
  
  const warm = [
    "brown", "dark brown", "chocolate", "coffee", "mocha", "camel", "caramel",
    "rust", "terracotta", "mustard", "olive", "khaki", "sage",
    "orange", "tangerine", "amber", "gold", "peach", "coral", "salmon",
    "warm red", "red", "crimson", "scarlet", "cherry",
    "maroon", "burgundy", "wine", "mahogany",
    "plum", "purple", "violet", "mauve", "amethyst",
    "yellow", "lemon"
  ];
  
  const cool = [
    "navy", "dark blue", "blue", "royal blue", "cobalt", "sky blue", "baby blue", "periwinkle",
    "indigo", "teal", "turquoise", "aqua",
    "emerald", "green", "dark green", "forest green", "mint",
    "cool pink", "pink", "rose", "blush", "lavender", "lilac",
    "icy blue", "slate"
  ];
  
  const loud = [
    "neon", "neon pink", "neon green", "neon yellow", "electric blue",
    "lime", "hot pink", "tangerine", "scarlet"
  ];
  
  // Direct match
  if (neutrals.includes(c)) return "neutral";
  if (warm.includes(c)) return "warm";
  if (cool.includes(c)) return "cool";
  if (loud.includes(c)) return "loud";
  
  // Fallback: keyword matching for compound names or variations
  if (c.includes("navy") || c.includes("blue") || c.includes("teal") || c.includes("emerald") || 
      c.includes("slate") || c.includes("indigo") || c.includes("turquoise") || c.includes("aqua") ||
      c.includes("mint") || c.includes("sky") || c.includes("periwinkle") || c.includes("lavender") ||
      c.includes("lilac") || c.includes("icy")) return "cool";
  
  if (c.includes("beige") || c.includes("cream") || c.includes("ivory") || c.includes("tan") ||
      c.includes("taupe") || c.includes("ecru") || c.includes("charcoal") || c.includes("silver")) return "neutral";
  
  if (c.includes("brown") || c.includes("rust") || c.includes("olive") || c.includes("burgundy") ||
      c.includes("plum") || c.includes("purple") || c.includes("wine") || c.includes("maroon") ||
      c.includes("camel") || c.includes("terracotta") || c.includes("mustard") || c.includes("khaki") ||
      c.includes("sage") || c.includes("coral") || c.includes("salmon") || c.includes("peach") ||
      c.includes("amber") || c.includes("gold") || c.includes("caramel") || c.includes("mocha") ||
      c.includes("orange") || c.includes("tangerine") || c.includes("cherry") || c.includes("crimson") ||
      c.includes("scarlet") || c.includes("mahogany") || c.includes("violet") || c.includes("mauve") ||
      c.includes("amethyst") || c.includes("yellow") || c.includes("lemon")) return "warm";
  
  if (c.includes("black") || c.includes("white") || c.includes("grey") || c.includes("gray")) return "neutral";
  
  if (c.includes("neon") || c.includes("electric") || c.includes("lime") || c.includes("hot pink")) return "loud";
  
  return "unknown";
}

/**
 * Get human-readable explanation for why a color works/doesn't work
 * Based on color attributes (contrast, mutedness, brightness, etc.)
 */
function getColorExplanation(productMicroSeason, userMicroSeason, productGroup, matchQuality) {
  const explanations = [];
  
  // Get color characteristics from micro-season names
  const getSeasonCharacteristics = (microSeason) => {
    if (microSeason.includes('light')) return { depth: 'light', clarity: 'delicate' };
    if (microSeason.includes('bright')) return { depth: 'medium', clarity: 'vibrant' };
    if (microSeason.includes('soft')) return { depth: 'medium', clarity: 'muted' };
    if (microSeason.includes('deep')) return { depth: 'deep', clarity: 'rich' };
    if (microSeason.includes('warm') || microSeason.includes('cool')) return { depth: 'medium', clarity: 'clear' };
    return { depth: 'medium', clarity: 'balanced' };
  };
  
  const productChars = getSeasonCharacteristics(productMicroSeason);
  const userChars = getSeasonCharacteristics(userMicroSeason);
  
  // Explain based on match quality
  if (matchQuality < 3) {
    // Excellent match
    if (productChars.clarity === 'muted' && userChars.clarity === 'muted') {
      explanations.push("This muted, soft color harmonizes beautifully with your delicate coloring.");
    } else if (productChars.clarity === 'vibrant' && userChars.clarity === 'vibrant') {
      explanations.push("This bright, clear color creates perfect contrast with your vibrant features.");
    } else if (productChars.depth === userChars.depth) {
      explanations.push("The depth and intensity of this color match your natural coloring perfectly.");
    } else {
      explanations.push("This color complements your skin tone's undertone and clarity beautifully.");
    }
  } else if (matchQuality < 6) {
    // Good match
    explanations.push("This color works well with your coloring, though it's not a perfect match.");
    if (productChars.clarity !== userChars.clarity) {
      explanations.push(`It's slightly more ${productChars.clarity === 'muted' ? 'muted' : 'vibrant'} than ideal for your ${userChars.clarity} coloring.`);
    }
  } else {
    // Acceptable match
    explanations.push("This color is in the right family but may not be the most flattering shade.");
  }
  
  return explanations;
}

/**
 * Get explanation for why a color doesn't work
 */
function getMismatchExplanation(productMicroSeason, userMicroSeason, productGroup) {
  const explanations = [];
  
  // Determine why it doesn't work
  const productParent = productMicroSeason.includes('spring') ? 'spring' :
                        productMicroSeason.includes('summer') ? 'summer' :
                        productMicroSeason.includes('autumn') ? 'autumn' : 'winter';
  const userParent = userMicroSeason.includes('spring') ? 'spring' :
                     userMicroSeason.includes('summer') ? 'summer' :
                     userMicroSeason.includes('autumn') ? 'autumn' : 'winter';
  
  // Temperature mismatch
  const warmSeasons = ['spring', 'autumn'];
  const coolSeasons = ['summer', 'winter'];
  const productIsWarm = warmSeasons.includes(productParent);
  const userIsWarm = warmSeasons.includes(userParent);
  
  if (productIsWarm !== userIsWarm) {
    if (productIsWarm) {
      explanations.push("This warm-toned color will clash with your cool undertones, making your skin look sallow.");
    } else {
      explanations.push("This cool-toned color will make your warm skin look washed out or grayish.");
    }
  }
  
  // Clarity mismatch
  if (productMicroSeason.includes('bright') && userMicroSeason.includes('soft')) {
    explanations.push("This vibrant, high-contrast color is too intense for your soft, muted coloring—it will overpower your features.");
  } else if (productMicroSeason.includes('soft') && userMicroSeason.includes('bright')) {
    explanations.push("This muted, soft color lacks the contrast your vibrant coloring needs—it will make you look dull.");
  }
  
  // Depth mismatch
  if (productMicroSeason.includes('deep') && userMicroSeason.includes('light')) {
    explanations.push("This deep, rich color is too heavy for your light coloring—it will create harsh contrast.");
  } else if (productMicroSeason.includes('light') && userMicroSeason.includes('deep')) {
    explanations.push("This light, delicate color lacks the depth your rich coloring needs—it will look washed out.");
  }
  
  // If no specific reason found, give general explanation
  if (explanations.length === 0) {
    explanations.push(`This color is from the ${productParent} palette, which has different properties than your ${userParent} coloring.`);
  }
  
  return explanations;
}

/**
 * PRIMARY METHOD: Classification-based color suitability (unified with StyleVault)
 * Uses shared color scoring pipeline with Lab + ΔE distance
 * NO FALLBACK - This is the only method
 */
function colorSuitabilityUsingClassification(user, colorHex) {
  if (!user?.season || !colorHex) {
    return null;
  }
  
  try {
    // Use shared color scoring pipeline
    const { computeColorScore } = require('./colorScoring');
    
    if (!computeColorScore) {
      return null;
    }
    
    // Provide defaults for depth/clarity if missing
    const depth = user.depth || 'medium';
    const clarity = user.clarity || 'muted';
    const undertone = user.undertone || ((user.season === 'spring' || user.season === 'autumn') ? 'warm' : 'cool');
    
    const score = computeColorScore(
      colorHex,
      user.season,
      depth,
      clarity,
      user.microSeason,
      undertone
    );
    
    // Map rating to verdict
    const ratingToVerdict = {
      'great': 'great',
      'good': 'good',
      'ok': 'ok',
      'risky': 'risky',
      'insufficient_data': null,
    };
    
    const verdict = ratingToVerdict[score.rating];
    if (!verdict) {
      return {
        status: "INSUFFICIENT_DATA",
        verdict: null,
        summary: "Could not determine color suitability.",
        bullets: ["The color analysis returned an unknown result."],
        reasons: ["Could not determine color suitability."],
        alternatives: [],
        method: 'classification',
      };
    }
    
    // Ensure explanation exists
    if (!score.explanation || !score.explanation.summary) {
      return {
        status: "INSUFFICIENT_DATA",
        verdict,
        summary: "Color analysis completed but explanation unavailable.",
        bullets: ["The color was analyzed but detailed explanation is not available."],
        reasons: ["Color analysis completed but explanation unavailable."],
        alternatives: [],
        method: 'classification',
      };
    }
    
    return {
      status: "OK",
      verdict,
      summary: score.explanation.summary,
      bullets: score.explanation.bullets || [],
      reasons: score.explanation.bullets || [], // For backward compatibility
      alternatives: [], // No alternatives - use "how to wear" instead
      method: 'ciede2000',
      // New spec fields
      deltaE: score.deltaE,
      minDistance: score.deltaE, // Backward compatibility
      garmentAttributes: score.garmentAttributes,
      compatibility: score.compatibility,
      stylingTip: score.stylingTip,
    };
  } catch (error) {
    // Return error result instead of null (no fallback)
    return {
      status: "ERROR",
      verdict: null,
      summary: "Error analyzing color. Please try again.",
      bullets: [`Error: ${error.message}`],
      reasons: [`Error: ${error.message}`],
      alternatives: [],
      method: 'classification',
    };
  }
}

/**
 * FALLBACK METHOD: Original attribute-based and string-matching logic
 * Used when classification is unavailable or insufficient data
 */
function colorSuitabilityFallback(user, product) {
  const undertone = user?.undertone || null;
  const season = user?.season || null;
  
  // Use colorHex as source of truth, fallback to primaryColor if hex not available
  const colorHex = product?.colorHex || null;
  const primaryColor = normalizeColorName(product?.primaryColor);
  
  // Get color attributes from hex (if available) or compute from name (fallback)
  let colorAttrs = null;
  if (colorHex) {
    colorAttrs = colorAttributesFromHex(colorHex);
  }
  
  // Only show insufficient data if BOTH user color profile AND product color are missing
  const hasUserColorProfile = !!(undertone || season);
  const hasProductColor = !!(colorAttrs || (primaryColor && primaryColor.trim() !== '' && primaryColor !== 'null' && primaryColor !== 'undefined'));
  
  if (!hasUserColorProfile && !hasProductColor) {
    return {
      status: "INSUFFICIENT_DATA",
      verdict: null,
      reasons: ["Need Color Info: Set your Color Profile (undertone + depth) AND product color."],
      alternatives: [],
      method: 'fallback',
    };
  }
  
  // If product color is missing but user profile exists, still show insufficient
  if (hasUserColorProfile && !hasProductColor) {
    return {
      status: "INSUFFICIENT_DATA",
      verdict: null,
      reasons: ["Need Color Info: Product color not detected. Add product color or use a link with color info."],
      alternatives: [],
      method: 'fallback',
    };
  }
  
  // If we have at least one, we can provide some analysis
  // If only product color exists, give generic advice
  if (!hasUserColorProfile && hasProductColor) {
    if (colorAttrs) {
      if (colorAttrs.temperature === "neutral") {
        return {
          status: "OK",
          verdict: "ok",
          reasons: ["Neutral color - works across most undertones. Set your Color Profile for personalized advice."],
          alternatives: [],
          method: 'fallback',
        };
      }
      return {
        status: "OK",
        verdict: "ok",
        reasons: [`This is a ${colorAttrs.temperature} color. Set your Color Profile to see if it matches your undertone.`],
        alternatives: [],
        method: 'fallback',
      };
    } else {
      // Fallback to old string-based logic if no hex
    const fam = colorFamily(primaryColor);
    if (fam === "neutral") {
      return {
        status: "OK",
        verdict: "ok",
        reasons: ["Neutral color - works across most undertones. Set your Color Profile for personalized advice."],
        alternatives: [],
        method: 'fallback',
      };
    }
    return {
      status: "OK",
      verdict: "ok",
      reasons: [`This is a ${fam} color. Set your Color Profile to see if it matches your undertone.`],
      alternatives: [],
      method: 'fallback',
    };
    }
  }
  
  // If only user profile exists but no product color, can't analyze
  if (hasUserColorProfile && !hasProductColor) {
    return {
      status: "INSUFFICIENT_DATA",
      verdict: null,
      reasons: ["Product color not detected. Add product color or use a link with color info."],
      alternatives: [],
      method: 'fallback',
    };
  }
  
  // Both exist - proceed with full analysis using attributes
  // Priority 1: Check avoid_colors (still use string matching for user-defined lists)
  const bestColors = user?.bestColors || [];
  const avoidColors = user?.avoidColors || [];
  
  if (primaryColor) {
  const normalizedAvoidColors = avoidColors.map(c => normalizeColorName(c));
  const isInAvoidList = normalizedAvoidColors.some(avoidColor => 
    primaryColor.includes(avoidColor) || avoidColor.includes(primaryColor)
  );
  
  if (isInAvoidList) {
    return {
      status: "OK",
      verdict: "risky",
      reasons: ["This color is in your avoid list based on your color profile."],
      alternatives: bestColors.length > 0 ? [`Try: ${bestColors.slice(0, 3).join(', ')}`] : [],
      method: 'fallback',
    };
  }
  
  // Priority 2: Check best_colors (or synonyms)
  const normalizedBestColors = bestColors.map(c => normalizeColorName(c));
  const colorSynonyms = {
    'burgundy': ['plum', 'wine', 'maroon', 'purple'],
    'plum': ['burgundy', 'wine', 'purple', 'maroon'],
    'wine': ['burgundy', 'plum', 'maroon'],
    'navy': ['blue', 'cobalt'],
    'olive': ['khaki', 'army green'],
  };
  
  const isInBestList = normalizedBestColors.some(bestColor => {
    if (primaryColor.includes(bestColor) || bestColor.includes(primaryColor)) return true;
    // Check synonyms
    const synonyms = colorSynonyms[bestColor] || [];
    return synonyms.some(syn => primaryColor.includes(syn) || syn.includes(primaryColor));
  });
  
  if (isInBestList) {
    return {
      status: "OK",
      verdict: "great",
      reasons: ["This color matches your best colors from your color profile."],
      alternatives: [],
      method: 'fallback',
    };
    }
  }
  
  // Priority 3: Use attribute-based season compatibility
  if (!colorAttrs) {
    // Fallback to old string-based logic if no hex available
  const fam = colorFamily(primaryColor);
    const tone = undertone || (season === "spring" || season === "autumn" ? "warm" : season === "summer" || season === "winter" ? "cool" : "neutral");
    
    if (fam === "neutral") {
      return {
        status: "OK",
        verdict: "ok",
        reasons: ["Neutrals usually work across most undertones."],
        alternatives: [],
        method: 'fallback',
      };
    } else if (fam === tone) {
      return {
        status: "OK",
        verdict: "great",
        reasons: [`This ${fam} color matches your ${tone} undertone.`],
        alternatives: [],
        method: 'fallback',
      };
    } else {
      return {
        status: "OK",
        verdict: "risky",
        reasons: [`This ${fam} color may not match your ${tone} undertone.`],
        alternatives: tone === "warm" ? ["Try warm tones (camel, olive, rust) or cream neutrals."] : ["Try cool tones (navy, emerald, icy shades) or crisp white/grey."],
        method: 'fallback',
      };
    }
  }
  
  // Attribute-based season compatibility rules
  const { temperature, clarity, lightness } = colorAttrs;
  let score = 0;
  const reasons = [];
  const alternatives = [];
  
  // Derive undertone from season if not explicitly set
  const derivedUndertone = undertone || (
    season === "spring" || season === "autumn" ? "warm" :
    season === "summer" || season === "winter" ? "cool" : "neutral"
  );
  
  // Season-specific compatibility rules (based on color analysis research)
  if (season === "winter") {
    // Winter: cool + high contrast + clear/vivid
    // Best: cool + clear/vivid + medium to deep lightness
    // Avoid: warm + muted + light/pastel
    if (temperature === "cool" && (clarity === "clear" || clarity === "vivid") && lightness >= 0.2 && lightness <= 0.8) {
      score = 3;
      reasons.push("Cool + clear aligns with your Winter palette.");
    } else if (temperature === "cool" && clarity === "muted") {
      score = 2;
      reasons.push("Cool color works, but Winter typically favors clearer, more vivid tones.");
    } else if (temperature === "neutral" && clarity === "clear") {
      score = 2;
      reasons.push("Neutral colors work, but Winter typically favors cool, clear tones.");
    } else if (temperature === "warm" || (clarity === "muted" && lightness > 0.7)) {
      score = 0;
      reasons.push("Warm or muted pastel colors typically clash with Winter's cool, clear palette.");
      alternatives.push("Try cool, clear tones like navy, emerald, or crisp white.");
    } else {
      score = 1;
      reasons.push("This color may not be ideal for Winter - consider cooler, clearer alternatives.");
      alternatives.push("Try cool, vivid tones like navy, emerald, or bright white.");
    }
  } else if (season === "summer") {
    // Summer: cool + light + muted
    // Best: cool + muted + light to medium lightness
    // Avoid: warm + vivid + dark/deep
    if (temperature === "cool" && clarity === "muted" && lightness >= 0.4 && lightness <= 0.8) {
      score = 3;
      reasons.push("Cool + muted aligns with your Summer palette.");
    } else if (temperature === "cool" && clarity === "clear") {
      score = 2;
      reasons.push("Cool color works, but Summer typically favors softer, muted tones.");
    } else if (temperature === "neutral" && clarity === "muted" && lightness > 0.5) {
      score = 2;
      reasons.push("Neutral colors work, but Summer typically favors cool, muted tones.");
    } else if (temperature === "warm" || (clarity === "vivid" && lightness < 0.4)) {
      score = 0;
      reasons.push("Warm or vivid dark colors typically clash with Summer's cool, muted palette.");
      alternatives.push("Try cool, muted tones like powder blue, lavender, or soft grey.");
    } else {
      score = 1;
      reasons.push("This color may not be ideal for Summer - consider cooler, softer alternatives.");
      alternatives.push("Try cool, muted tones like powder blue, lavender, or soft pastels.");
    }
  } else if (season === "autumn") {
    // Autumn: warm + deep + muted/earthy
    // Best: warm + muted + medium to deep lightness
    // Avoid: cool + clear/vivid + light/pastel
    if (temperature === "warm" && clarity === "muted" && lightness >= 0.2 && lightness <= 0.7) {
      score = 3;
      reasons.push("Warm + muted aligns with your Autumn palette.");
    } else if (temperature === "warm" && clarity === "clear") {
      score = 2;
      reasons.push("Warm color works, but Autumn typically favors muted, earthy tones.");
    } else if (temperature === "neutral" && clarity === "muted" && lightness < 0.6) {
      score = 2;
      reasons.push("Neutral colors work, but Autumn typically favors warm, muted tones.");
    } else if (temperature === "cool" || (clarity === "vivid" && lightness > 0.7)) {
      score = 0;
      reasons.push("Cool or vivid pastel colors typically clash with Autumn's warm, muted palette.");
      alternatives.push("Try warm, muted tones like burgundy, rust, olive, or cream.");
    } else {
      score = 1;
      reasons.push("This color may not be ideal for Autumn - consider warmer, more muted alternatives.");
      alternatives.push("Try warm, muted tones like burgundy, rust, olive, or camel.");
    }
  } else if (season === "spring") {
    // Spring: warm + light-medium + clear/bright
    // Best: warm + clear + light to medium lightness
    // Avoid: muted + dark/deep + cool
    if (temperature === "warm" && (clarity === "clear" || clarity === "vivid") && lightness >= 0.4 && lightness <= 0.8) {
      score = 3;
      reasons.push("Warm + clear aligns with your Spring palette.");
    } else if (temperature === "warm" && clarity === "muted") {
      score = 2;
      reasons.push("Warm color works, but Spring typically favors clearer, brighter tones.");
    } else if (temperature === "neutral" && clarity === "clear" && lightness > 0.5) {
      score = 2;
      reasons.push("Neutral colors work, but Spring typically favors warm, clear tones.");
    } else if (temperature === "cool" || (clarity === "muted" && lightness < 0.4)) {
      score = 0;
      reasons.push("Cool or muted dark colors typically clash with Spring's warm, clear palette.");
      alternatives.push("Try warm, clear tones like coral, peach, or bright yellow.");
    } else {
      score = 1;
      reasons.push("This color may not be ideal for Spring - consider warmer, clearer alternatives.");
      alternatives.push("Try warm, clear tones like coral, peach, or bright pastels.");
    }
  } else {
    // Fallback to undertone-based logic (no season)
    if (temperature === "neutral") {
      score = 2;
      reasons.push("Neutrals usually work across most undertones.");
    } else if (temperature === derivedUndertone) {
      score = 3;
      reasons.push(`This ${temperature} color matches your ${derivedUndertone} undertone.`);
    } else if (derivedUndertone === "neutral") {
      score = 2;
      reasons.push("This color may work, but neutrals are typically safer.");
      alternatives.push("Try neutral tones or colors that match your season.");
    } else {
      score = 0;
      reasons.push(`This ${temperature} color may clash with your ${derivedUndertone} undertone.`);
      alternatives.push(derivedUndertone === "warm" ? "Try warm tones (camel, olive, rust) or cream neutrals." : "Try cool tones (navy, emerald, icy shades) or crisp white/grey.");
    }
  }
  
  const verdict = score >= 3 ? "great" : score === 2 ? "ok" : "risky";
  
  return { status: "OK", verdict, reasons, alternatives, method: 'fallback' };
}

/**
 * MAIN FUNCTION: Color suitability analysis
 * ONLY METHOD: Uses Lab + ΔE classification with micro-seasons (unified with StyleVault)
 * NO FALLBACK - This is the single source of truth
 */
function colorSuitability(user, product) {
  // ONLY use hex from product - do NOT convert color names to hex (inaccurate)
  const colorHex = product?.colorHex || null;
  
  // ONLY METHOD: Classification-based analysis
  // Provide defaults for missing depth/clarity to ensure it always runs
  const userWithDefaults = {
    ...user,
    season: user?.season || null,
    depth: user?.depth || 'medium', // Default to medium if missing
    clarity: user?.clarity || 'muted', // Default to muted if missing
    undertone: user?.undertone || null,
    microSeason: user?.microSeason || null,
  };
  
  // If no season, return insufficient data
  if (!userWithDefaults.season) {
    return {
      status: "INSUFFICIENT_DATA",
      verdict: null,
      summary: "Need Color Info: Set your Color Profile (season) to get personalized color feedback.",
      bullets: ["Please set your color season in your Color Profile."],
      reasons: ["Need Color Info: Set your Color Profile (season) to get personalized color feedback."],
      alternatives: [],
      method: 'classification',
    };
  }
  
  // If no color hex, return insufficient data
  if (!colorHex) {
    return {
      status: "INSUFFICIENT_DATA",
      verdict: null,
      summary: "Need Color Info: Product color not detected.",
      bullets: ["Please ensure the product has a color hex code."],
      reasons: ["Need Color Info: Product color not detected."],
      alternatives: [],
      method: 'classification',
    };
  }
  
  // Use classification method - NO FALLBACK
  const classificationResult = colorSuitabilityUsingClassification(userWithDefaults, colorHex);
  
  if (classificationResult) {
    return classificationResult;
  }
  
  // If classification returns null, return insufficient data (don't fall back to old method)
  return {
    status: "INSUFFICIENT_DATA",
    verdict: null,
    summary: "Color analysis system unavailable. Please try again.",
    bullets: ["The color analysis system could not process this color."],
    reasons: ["Color analysis system unavailable."],
    alternatives: [],
    method: 'classification',
  };
}

function bodyShapeSuitability(user, product) {
  const shape = (user?.bodyShape || "").toLowerCase();
  const rawCat = (product?.category || "").toLowerCase();
  const fit = (product?.fitType || "regular").toLowerCase();
  
  // Normalize category to standard values
  const cat = rawCat.includes("dress") ? "dresses" :
              rawCat.includes("lower") || rawCat.includes("pant") || rawCat.includes("jean") || rawCat.includes("skirt") || rawCat.includes("short") || rawCat.includes("bottom") ? "lower_body" :
              rawCat.includes("upper") || rawCat.includes("top") || rawCat.includes("shirt") || rawCat.includes("blouse") || rawCat.includes("jacket") ? "upper_body" :
              "unknown";
  
  // Get display name for body shape (capitalize first letter)
  const shapeDisplay = shape ? shape.charAt(0).toUpperCase() + shape.slice(1) : '';
  
  if (!shape) {
    return {
      status: "INSUFFICIENT_DATA",
      verdict: null,
      reasons: ["Set your body shape in Fit Profile to get silhouette advice."],
      alternatives: [],
      bodyShapeLabel: null,
    };
  }
  
  const reasons = [];
  const alternatives = [];
  
  // ========== PEAR / TRIANGLE SHAPE ==========
  if (shape.includes("pear") || shape.includes("triangle")) {
    // Upper body
    if (cat === "upper_body") {
      if (fit === "oversized" || fit === "relaxed") {
        reasons.push("A roomier top adds volume up top, balancing your hips beautifully.");
        return { status: "OK", verdict: "flattering", reasons, alternatives, bodyShapeLabel: shapeDisplay };
      }
      if (fit === "slim" || fit === "fitted") {
        reasons.push("Fitted tops draw attention upward, which works well for your shape.");
        return { status: "OK", verdict: "flattering", reasons, alternatives, bodyShapeLabel: shapeDisplay };
      }
      reasons.push("Regular fit tops are versatile for your proportions.");
      return { status: "OK", verdict: "ok", reasons, alternatives, bodyShapeLabel: shapeDisplay };
    }
    // Lower body
    if (cat === "lower_body") {
      if (fit === "slim" || fit === "skinny") {
        reasons.push("Slim-fit bottoms will highlight your hip and thigh area.");
        alternatives.push("For balance, try straight-leg or bootcut styles.");
        return { status: "OK", verdict: "neutral", reasons, alternatives, bodyShapeLabel: shapeDisplay };
      }
      if (fit === "wide" || fit === "bootcut" || fit === "flare") {
        reasons.push("Wider leg openings create a balanced silhouette from hip to hem.");
        return { status: "OK", verdict: "flattering", reasons, alternatives, bodyShapeLabel: shapeDisplay };
      }
      reasons.push("Regular fit bottoms work well, especially with darker colors.");
      return { status: "OK", verdict: "ok", reasons, alternatives, bodyShapeLabel: shapeDisplay };
    }
    // Dresses
    if (cat === "dresses") {
      reasons.push("A-line and fit-and-flare dresses complement your shape perfectly.");
      alternatives.push("Empire waist styles also work well.");
      return { status: "OK", verdict: "flattering", reasons, alternatives, bodyShapeLabel: shapeDisplay };
    }
    // Fallback for pear shape with unknown category
    reasons.push("For your pear shape, look for styles that add volume on top and balance your hips.");
    return { status: "OK", verdict: "ok", reasons, alternatives, bodyShapeLabel: shapeDisplay };
  }
  
  // ========== APPLE / OVAL SHAPE ==========
  if (shape.includes("apple") || shape.includes("oval")) {
    // Upper body
    if (cat === "upper_body") {
      if (fit === "slim" || fit === "fitted") {
        reasons.push("Slim tops may cling around the midsection.");
        alternatives.push("Try regular or relaxed fits with some drape.");
        return { status: "OK", verdict: "risky", reasons, alternatives, bodyShapeLabel: shapeDisplay };
      }
      if (fit === "oversized" || fit === "relaxed") {
        reasons.push("Relaxed fits with drape create a smooth, flattering line.");
        return { status: "OK", verdict: "flattering", reasons, alternatives, bodyShapeLabel: shapeDisplay };
      }
      reasons.push("Regular fit tops work well—look for styles that don't cinch at the waist.");
      return { status: "OK", verdict: "ok", reasons, alternatives, bodyShapeLabel: shapeDisplay };
    }
    // Lower body
    if (cat === "lower_body") {
      if (fit === "high-rise" || fit === "high waist") {
        reasons.push("High-rise styles help smooth and support the midsection.");
        return { status: "OK", verdict: "flattering", reasons, alternatives, bodyShapeLabel: shapeDisplay };
      }
      reasons.push("Mid to high-rise bottoms are most comfortable for your shape.");
      return { status: "OK", verdict: "ok", reasons, alternatives, bodyShapeLabel: shapeDisplay };
    }
    // Dresses
    if (cat === "dresses") {
      reasons.push("Empire waist and A-line dresses create a smooth, elegant silhouette.");
      alternatives.push("Wrap dresses also work beautifully.");
      return { status: "OK", verdict: "flattering", reasons, alternatives, bodyShapeLabel: shapeDisplay };
    }
    // Fallback for apple shape with unknown category
    reasons.push("For your apple shape, look for styles with drape that don't cling at the midsection.");
    return { status: "OK", verdict: "ok", reasons, alternatives, bodyShapeLabel: shapeDisplay };
  }
  
  // ========== RECTANGLE SHAPE ==========
  if (shape.includes("rectangle") || shape.includes("straight")) {
    // Upper body
    if (cat === "upper_body") {
      if (fit === "peplum" || fit === "fitted") {
        reasons.push("Fitted or peplum tops add curves and definition to your waist.");
        return { status: "OK", verdict: "flattering", reasons, alternatives, bodyShapeLabel: shapeDisplay };
      }
      reasons.push("Most top styles work well—try adding a belt to create waist definition.");
      return { status: "OK", verdict: "ok", reasons, alternatives, bodyShapeLabel: shapeDisplay };
    }
    // Lower body
    if (cat === "lower_body") {
      reasons.push("You can pull off most bottom styles easily. Experiment with details.");
      alternatives.push("Try pleats, pockets, or patterns to add dimension.");
      return { status: "OK", verdict: "ok", reasons, alternatives, bodyShapeLabel: shapeDisplay };
    }
    // Dresses
    if (cat === "dresses") {
      reasons.push("Belted or wrap dresses add beautiful waist definition.");
      alternatives.push("Peplum styles also create curves.");
      return { status: "OK", verdict: "flattering", reasons, alternatives, bodyShapeLabel: shapeDisplay };
    }
    // Fallback for rectangle shape with unknown category
    reasons.push("For your rectangle shape, add waist definition with belts or structured pieces.");
    return { status: "OK", verdict: "ok", reasons, alternatives, bodyShapeLabel: shapeDisplay };
  }
  
  // ========== HOURGLASS SHAPE ==========
  if (shape.includes("hourglass")) {
    // Upper body
    if (cat === "upper_body") {
      if (fit === "oversized" || fit === "boxy") {
        reasons.push("Oversized fits may hide your defined waist.");
        alternatives.push("Try tucking in or adding a belt to show your curves.");
        return { status: "OK", verdict: "neutral", reasons, alternatives, bodyShapeLabel: shapeDisplay };
      }
      if (fit === "slim" || fit === "fitted") {
        reasons.push("Fitted tops highlight your balanced proportions beautifully.");
        return { status: "OK", verdict: "flattering", reasons, alternatives, bodyShapeLabel: shapeDisplay };
      }
      reasons.push("Regular fits work well—cinch at the waist to define your curves.");
      return { status: "OK", verdict: "ok", reasons, alternatives, bodyShapeLabel: shapeDisplay };
    }
    // Lower body
    if (cat === "lower_body") {
      if (fit === "high-rise" || fit === "high waist") {
        reasons.push("High-rise styles emphasize your narrow waist—perfect for your shape.");
        return { status: "OK", verdict: "flattering", reasons, alternatives, bodyShapeLabel: shapeDisplay };
      }
      reasons.push("Most bottom styles complement your proportions.");
      return { status: "OK", verdict: "ok", reasons, alternatives, bodyShapeLabel: shapeDisplay };
    }
    // Dresses
    if (cat === "dresses") {
      if (fit === "regular" || fit === "slim" || fit === "fitted") {
        reasons.push("Fitted dresses showcase your naturally balanced curves.");
        return { status: "OK", verdict: "flattering", reasons, alternatives, bodyShapeLabel: shapeDisplay };
      }
      reasons.push("Most dress styles work—look for waist definition to highlight your shape.");
      return { status: "OK", verdict: "ok", reasons, alternatives, bodyShapeLabel: shapeDisplay };
    }
    // Fallback for hourglass shape with unknown category
    reasons.push("For your hourglass shape, highlight your waist with fitted or belted styles.");
    return { status: "OK", verdict: "ok", reasons, alternatives, bodyShapeLabel: shapeDisplay };
  }
  
  // ========== INVERTED TRIANGLE SHAPE ==========
  if (shape.includes("inverted") || shape.includes("v-shape") || shape.includes("athletic")) {
    // Upper body
    if (cat === "upper_body") {
      if (fit === "oversized" || fit === "boxy") {
        reasons.push("Extra volume on top may exaggerate shoulder width.");
        alternatives.push("Try V-necks or fitted styles to streamline your upper body.");
        return { status: "OK", verdict: "risky", reasons, alternatives, bodyShapeLabel: shapeDisplay };
      }
      if (fit === "slim" || fit === "fitted") {
        reasons.push("Fitted tops with V-necks create a streamlined look.");
        return { status: "OK", verdict: "flattering", reasons, alternatives, bodyShapeLabel: shapeDisplay };
      }
      reasons.push("Regular fit works—V-necks and open necklines are your friend.");
      return { status: "OK", verdict: "ok", reasons, alternatives, bodyShapeLabel: shapeDisplay };
    }
    // Lower body
    if (cat === "lower_body") {
      if (fit === "wide" || fit === "bootcut" || fit === "flare" || fit === "relaxed") {
        reasons.push("Wider leg styles add volume below, balancing your broader shoulders.");
        return { status: "OK", verdict: "flattering", reasons, alternatives, bodyShapeLabel: shapeDisplay };
      }
      reasons.push("Add volume or detail on the lower half to balance your proportions.");
      alternatives.push("Try lighter colors or patterns on bottoms.");
      return { status: "OK", verdict: "ok", reasons, alternatives, bodyShapeLabel: shapeDisplay };
    }
    // Dresses
    if (cat === "dresses") {
      reasons.push("A-line or fit-and-flare dresses balance your shoulders with volume below.");
      return { status: "OK", verdict: "flattering", reasons, alternatives, bodyShapeLabel: shapeDisplay };
    }
    // Fallback for inverted triangle shape with unknown category
    reasons.push("For your inverted triangle shape, balance broad shoulders with volume on the lower half.");
    return { status: "OK", verdict: "ok", reasons, alternatives, bodyShapeLabel: shapeDisplay };
  }
  
  // ========== DEFAULT RESPONSE ==========
  // Generic advice when no specific rule matches
  reasons.push("This style is versatile and works for your shape. Adjust with styling as desired.");
  return { status: "OK", verdict: "ok", reasons, alternatives, bodyShapeLabel: shapeDisplay };
}

function evaluateSuitability(userProfile, product) {
  const color = colorSuitability(userProfile, product);
  const body = bodyShapeSuitability(userProfile, product);
  
  return {
    color,
    body,
    summary: buildSummary(color, body),
  };
}

function buildSummary(color, body) {
  const bits = [];
  if (color.status === "OK") bits.push(`Color: ${color.verdict}`);
  else bits.push("Color: needs setup");
  if (body.status === "OK") bits.push(`Silhouette: ${body.verdict}`);
  else bits.push("Silhouette: needs setup");
  return bits.join(" • ");
}

module.exports = {
  evaluateSuitability,
  colorSuitability,
  bodyShapeSuitability,
};


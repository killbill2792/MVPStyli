/**
 * Stylit — Color + Body Shape Suitability (NO-AI)
 * File: lib/styleSuitability.js
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

function colorSuitability(user, product) {
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
    };
  }
  
  // If product color is missing but user profile exists, still show insufficient
  if (hasUserColorProfile && !hasProductColor) {
    return {
      status: "INSUFFICIENT_DATA",
      verdict: null,
      reasons: ["Need Color Info: Product color not detected. Add product color or use a link with color info."],
      alternatives: [],
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
        };
      }
      return {
        status: "OK",
        verdict: "ok",
        reasons: [`This is a ${colorAttrs.temperature} color. Set your Color Profile to see if it matches your undertone.`],
        alternatives: [],
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
        };
      }
      return {
        status: "OK",
        verdict: "ok",
        reasons: [`This is a ${fam} color. Set your Color Profile to see if it matches your undertone.`],
        alternatives: [],
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
      console.log('🎨 Color decision: AVOID (in avoid_colors list)');
      return {
        status: "OK",
        verdict: "risky",
        reasons: ["This color is in your avoid list based on your color profile."],
        alternatives: bestColors.length > 0 ? [`Try: ${bestColors.slice(0, 3).join(', ')}`] : [],
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
      console.log('🎨 Color decision: GREAT (in best_colors list or synonym)');
      return {
        status: "OK",
        verdict: "great",
        reasons: ["This color matches your best colors from your color profile."],
        alternatives: [],
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
      };
    } else if (fam === tone) {
      return {
        status: "OK",
        verdict: "great",
        reasons: [`This ${fam} color matches your ${tone} undertone.`],
        alternatives: [],
      };
    } else {
      return {
        status: "OK",
        verdict: "risky",
        reasons: [`This ${fam} color may not match your ${tone} undertone.`],
        alternatives: tone === "warm" ? ["Try warm tones (camel, olive, rust) or cream neutrals."] : ["Try cool tones (navy, emerald, icy shades) or crisp white/grey."],
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
  
  // Comprehensive logging for color suitability analysis
  console.log('🎨 ========== COLOR SUITABILITY ANALYSIS ==========');
  console.log('🎨 INPUTS:');
  console.log('🎨   Product Color:');
  console.log('🎨     - Source:', colorHex ? 'colorHex (attribute-based)' : primaryColor ? 'primaryColor (string fallback)' : 'none');
  console.log('🎨     - Hex:', colorHex || 'N/A');
  console.log('🎨     - Name:', primaryColor || 'N/A');
  if (colorAttrs) {
    console.log('🎨     - Attributes:', {
      hue: Math.round(colorAttrs.hue),
      lightness: colorAttrs.lightness.toFixed(2),
      saturation: colorAttrs.saturation.toFixed(2),
      temperature: colorAttrs.temperature,
      clarity: colorAttrs.clarity,
    });
  }
  console.log('🎨   User Profile (from face analysis):');
  console.log('🎨     - Undertone:', undertone || 'N/A', undertone ? '(detected from skin tone)' : '(not set)');
  console.log('🎨     - Season:', season || 'N/A', season ? '(suggested from skin tone)' : '(not set)');
  console.log('🎨     - Derived Undertone:', derivedUndertone, derivedUndertone !== undertone ? '(derived from season)' : '(from profile)');
  console.log('🎨     - Best Colors:', user?.bestColors?.length > 0 ? user.bestColors.join(', ') : 'none');
  console.log('🎨     - Avoid Colors:', user?.avoidColors?.length > 0 ? user.avoidColors.join(', ') : 'none');
  console.log('🎨 ANALYSIS:');
  console.log('🎨   - Method:', colorAttrs ? 'Attribute-based season compatibility' : 'String-based fallback');
  console.log('🎨   - Score:', score, '/ 3');
  console.log('🎨   - Verdict:', verdict);
  console.log('🎨   - Reasons:', reasons);
  if (alternatives.length > 0) {
    console.log('🎨   - Alternatives:', alternatives);
  }
  console.log('🎨 ================================================');
  
  return { status: "OK", verdict, reasons, alternatives };
}

function bodyShapeSuitability(user, product) {
  const shape = (user?.bodyShape || "").toLowerCase();
  const cat = product?.category;
  const fit = (product?.fitType || "regular").toLowerCase();
  
  if (!shape) {
    return {
      status: "INSUFFICIENT_DATA",
      verdict: null,
      reasons: ["Set your body shape in Fit Profile to get silhouette advice."],
      alternatives: [],
    };
  }
  
  const reasons = [];
  const alternatives = [];
  
  // Very conservative: only explain likely silhouette effect.
  // Women examples:
  if (shape.includes("pear")) {
    if (cat === "upper_body" && (fit === "oversized" || fit === "relaxed")) {
      reasons.push("A roomier top can balance hips by adding volume up top.");
      return { status: "OK", verdict: "flattering", reasons, alternatives };
    }
    if (cat === "lower_body" && fit === "slim") {
      reasons.push("Slim-fit bottoms may emphasize hip/thigh area (could be desired or not).");
      alternatives.push("If you want balance, try straight-leg or wide-leg.");
      return { status: "OK", verdict: "neutral", reasons, alternatives };
    }
  }
  
  if (shape.includes("apple") || shape.includes("oval")) {
    if (cat === "dresses") {
      reasons.push("Structured or A-line dresses usually create a smoother line through the midsection.");
      alternatives.push("Avoid very tight waist seams if you want comfort.");
      return { status: "OK", verdict: "flattering", reasons, alternatives };
    }
    if (cat === "upper_body" && fit === "slim") {
      reasons.push("Very slim tops can cling around the midsection.");
      alternatives.push("Try regular/relaxed fits or layering pieces.");
      return { status: "OK", verdict: "risky", reasons, alternatives };
    }
  }
  
  if (shape.includes("rectangle")) {
    if (cat === "dresses") {
      reasons.push("Belts, wrap styles, or defined waists can create more shape if you want it.");
      alternatives.push("If you prefer minimal, straight silhouettes also work.");
      return { status: "OK", verdict: "ok", reasons, alternatives };
    }
  }
  
  if (shape.includes("hourglass")) {
    if (cat === "dresses" && (fit === "regular" || fit === "slim")) {
      reasons.push("Waist definition typically highlights your natural proportions.");
      return { status: "OK", verdict: "flattering", reasons, alternatives };
    }
    if (fit === "oversized") {
      reasons.push("Oversized fits may hide waist definition (could be a vibe, but less 'shaped').");
      return { status: "OK", verdict: "neutral", reasons, alternatives };
    }
  }
  
  if (shape.includes("inverted")) {
    if (cat === "upper_body" && fit === "oversized") {
      reasons.push("Extra volume up top can exaggerate shoulder width.");
      alternatives.push("If you want balance, try cleaner tops + wider/looser bottoms.");
      return { status: "OK", verdict: "risky", reasons, alternatives };
    }
    if (cat === "lower_body" && (fit === "relaxed" || fit === "oversized")) {
      reasons.push("More volume on the lower body can balance broader shoulders.");
      return { status: "OK", verdict: "flattering", reasons, alternatives };
    }
  }
  
  // Default safe response
  reasons.push("This fit should work for most body types; tweak with styling (tuck, belt, layering).");
  return { status: "OK", verdict: "ok", reasons, alternatives };
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


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
 * - primaryColor: string | null (e.g., "black", "navy", "beige")
 * - category: "upper_body" | "lower_body" | "dresses"
 * - fitType: "slim" | "regular" | "relaxed" | "oversized" | null
 */

function normalizeColorName(c) {
  if (!c) return null;
  return String(c).trim().toLowerCase();
}

function colorFamily(color) {
  const c = normalizeColorName(color);
  if (!c) return null;
  
  const neutrals = ["black","white","grey","gray","cream","beige","tan","ivory"];
  const warm = ["brown","camel","rust","terracotta","mustard","olive","khaki","orange","warm red","maroon","burgundy","plum","purple","wine","mahogany"];
  const cool = ["navy","blue","cobalt","teal","emerald","cool pink","lavender","purple","icy blue","violet","indigo","slate"];
  const loud = ["neon","lime","hot pink","electric blue"];
  
  if (neutrals.includes(c)) return "neutral";
  if (warm.includes(c)) return "warm";
  if (cool.includes(c)) return "cool";
  if (loud.includes(c)) return "loud";
  
  // fallback: attempt keyword match (check for color names within the string)
  if (c.includes("navy") || c.includes("blue") || c.includes("teal") || c.includes("emerald") || c.includes("slate")) return "cool";
  if (c.includes("beige") || c.includes("cream") || c.includes("ivory") || c.includes("tan")) return "neutral";
  if (c.includes("brown") || c.includes("rust") || c.includes("olive") || c.includes("burgundy") || c.includes("plum") || c.includes("purple") || c.includes("wine") || c.includes("maroon")) return "warm";
  if (c.includes("black") || c.includes("white") || c.includes("grey") || c.includes("gray")) return "neutral";
  
  return "unknown";
}

function colorSuitability(user, product) {
  const undertone = user?.undertone || null;
  const season = user?.season || null;
  const primaryColor = normalizeColorName(product?.primaryColor);
  
  // Only show insufficient data if BOTH user color profile AND product color are missing
  const hasUserColorProfile = !!(undertone || season);
  // Check if primaryColor is a valid non-empty string after normalization
  const hasProductColor = !!(primaryColor && primaryColor.trim() !== '' && primaryColor !== 'null' && primaryColor !== 'undefined');
  
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
  
  // If only user profile exists but no product color, can't analyze
  if (hasUserColorProfile && !hasProductColor) {
    return {
      status: "INSUFFICIENT_DATA",
      verdict: null,
      reasons: ["Product color not detected. Add product color or use a link with color info."],
      alternatives: [],
    };
  }
  
  // Both exist - proceed with full analysis
  
  const fam = colorFamily(primaryColor);
  
  // Simple scoring
  let score = 0;
  const reasons = [];
  const alternatives = [];
  
  const tone = undertone || (season === "spring" || season === "autumn" ? "warm" : season === "summer" || season === "winter" ? "cool" : "neutral");
  
  if (fam === "neutral") {
    score = 2;
    reasons.push("Neutrals usually work across most undertones.");
  } else if (fam === tone) {
    score = 3;
    reasons.push(`This color family matches your ${tone} undertone.`);
  } else if (fam === "unknown") {
    score = 1;
    reasons.push("Color family unclear — advice may be less accurate.");
  } else if (fam === "loud") {
    score = 1;
    reasons.push("High-saturation colors depend on your contrast level; try cautiously.");
    alternatives.push("Try a muted version of this color or pair with neutrals.");
  } else {
    score = 0;
    reasons.push(`This color family often clashes with ${tone} undertones.`);
    alternatives.push(tone === "warm" ? "Try warm tones (camel, olive, rust) or cream neutrals." : "Try cool tones (navy, emerald, icy shades) or crisp white/grey.");
  }
  
  const verdict = score >= 3 ? "great" : score === 2 ? "ok" : "risky";
  
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


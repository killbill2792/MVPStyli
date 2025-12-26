/**
 * Stylit — Fabric & Comfort Analysis (NO-AI)
 * File: lib/fabricComfort.js
 */

function normalizeFabricName(fabric) {
  if (!fabric) return null;
  return String(fabric).trim().toLowerCase();
}

function analyzeFabricComfort(product) {
  const material = normalizeFabricName(product?.material || product?.fabric);
  
  if (!material) {
    return {
      status: "INSUFFICIENT_DATA",
      verdict: null,
      insights: ["Fabric information not available. Add material details for comfort analysis."],
    };
  }
  
  const insights = [];
  let comfortScore = 0;
  let verdict = "ok";
  
  // Check for stretch/elastic
  const hasStretch = material.includes('stretch') || 
                     material.includes('elastic') || 
                     material.includes('spandex') || 
                     material.includes('elastane') ||
                     material.includes('lycra');
  
  if (hasStretch) {
    comfortScore += 2;
    insights.push("Stretch fabric offers flexibility and comfort");
  } else {
    insights.push("No stretch detected - may feel restrictive");
  }
  
  // Check for natural fibers (generally more comfortable)
  const naturalFibers = ['cotton', 'linen', 'silk', 'wool', 'cashmere', 'bamboo', 'modal'];
  const hasNatural = naturalFibers.some(fiber => material.includes(fiber));
  
  if (hasNatural) {
    comfortScore += 1;
    insights.push("Natural fibers typically feel soft and breathable");
  }
  
  // Check for synthetic fibers (can be less breathable)
  const syntheticFibers = ['polyester', 'nylon', 'acrylic', 'polyamide'];
  const hasSynthetic = syntheticFibers.some(fiber => material.includes(fiber));
  
  if (hasSynthetic && !hasNatural) {
    comfortScore -= 1;
    insights.push("Synthetic fabric may be less breathable - watch for sweat");
  }
  
  // Check for specific comfort concerns
  if (material.includes('wool') && !material.includes('merino')) {
    insights.push("Wool may feel itchy on sensitive skin");
  }
  
  if (material.includes('linen')) {
    insights.push("Linen wrinkles easily but stays cool");
  }
  
  if (material.includes('silk') || material.includes('satin')) {
    insights.push("Silk/satin feels luxurious but can be delicate");
  }
  
  if (material.includes('denim')) {
    insights.push("Denim may feel stiff initially, softens with wear");
  }
  
  if (material.includes('leather') || material.includes('pleather')) {
    insights.push("Leather/pleather may not breathe well");
  }
  
  // Check for sheer/transparency
  if (material.includes('sheer') || material.includes('mesh') || material.includes('chiffon')) {
    insights.push("Sheer fabric - may need layering");
  }
  
  // Determine verdict
  if (comfortScore >= 2) {
    verdict = "comfortable";
  } else if (comfortScore >= 0) {
    verdict = "ok";
  } else {
    verdict = "risky";
  }
  
  return {
    status: "OK",
    verdict,
    insights,
  };
}

module.exports = {
  analyzeFabricComfort,
};


/**
 * Shared Color Scoring Pipeline
 * Used by: Suggested Products, Fit Check
 * 
 * Implements unified color matching using Lab + ΔE distance
 * with human-readable explanations
 */

// Import color classification functions
// Note: colorClassification.ts exports functions directly
let hexToLab, deltaE, getMicroSeasonPalette, determineMicroSeason, getMicroSeasonsForParent;
try {
  // Try CommonJS require first (if transpiled)
  const colorClassification = require('./colorClassification');
  hexToLab = colorClassification.hexToLab;
  deltaE = colorClassification.deltaE;
  getMicroSeasonPalette = colorClassification.getMicroSeasonPalette;
  determineMicroSeason = colorClassification.determineMicroSeason;
  getMicroSeasonsForParent = colorClassification.getMicroSeasonsForParent;
  
  // If not found, try default export
  if (!hexToLab && colorClassification.default) {
    hexToLab = colorClassification.default.hexToLab;
    deltaE = colorClassification.default.deltaE;
    getMicroSeasonPalette = colorClassification.default.getMicroSeasonPalette;
    determineMicroSeason = colorClassification.default.determineMicroSeason;
    getMicroSeasonsForParent = colorClassification.default.getMicroSeasonsForParent;
  }
} catch (e) {
  console.error('Could not load colorClassification:', e);
  // Functions will be null, will fall back to old method
}

/**
 * Compute color score and explanation using CIEDE2000
 * 
 * @param {string} garmentHex - Product color hex code
 * @param {string} userSeason - User's parent season (spring/summer/autumn/winter)
 * @param {string} userDepth - User's depth (light/medium/deep)
 * @param {string} userClarity - User's clarity (muted/clear/vivid/medium)
 * @param {string} userMicroSeason - User's micro-season (optional, will be determined if not provided)
 * @param {string} userUndertone - User's undertone (warm/cool/neutral, optional - derived from season if not provided)
 * @param {boolean} nearFace - Whether the garment is worn near the face (tops, scarves, etc.) - affects clarity penalty
 * @returns {Object} Score with rating, deltaE, garmentAttributes, compatibility, reason, stylingTip
 */
function computeColorScore(garmentHex, userSeason, userDepth, userClarity, userMicroSeason = null, userUndertone = null, nearFace = true) {
  if (!garmentHex || !userSeason) {
    console.warn('🎨 computeColorScore: Missing required inputs', {
      hasHex: !!garmentHex,
      hasSeason: !!userSeason,
    });
    return {
      rating: 'insufficient_data',
      summary: 'Need color information to analyze',
      bullets: ['Please provide both garment color hex and user season.'],
      deltaE: null,
      garmentAttributes: null,
      compatibility: null,
    };
  }
  
  // Derive user undertone from season if not provided
  const derivedUndertone = userUndertone || ((userSeason === 'spring' || userSeason === 'autumn') ? 'warm' : 'cool');
  
  // Normalize hex format (ensure it starts with #)
  let normalizedHex = garmentHex.trim();
  if (!normalizedHex.startsWith('#')) {
    normalizedHex = '#' + normalizedHex;
  }
  
  // Check if functions are available
  if (!hexToLab || !deltaE || !getMicroSeasonPalette || !determineMicroSeason) {
    console.error('🎨 computeColorScore: Color classification functions not available', {
      hasHexToLab: !!hexToLab,
      hasDeltaE: !!deltaE,
      hasGetMicroSeasonPalette: !!getMicroSeasonPalette,
      hasDetermineMicroSeason: !!determineMicroSeason,
    });
    return {
      rating: 'insufficient_data',
      summary: 'Color analysis system not available',
      bullets: ['The color classification system could not be loaded.'],
      minDistance: null,
    };
  }
  
  // Convert garment hex to Lab
  const garmentLab = hexToLab(normalizedHex);
  if (!garmentLab) {
    console.warn('🎨 computeColorScore: Could not convert hex to Lab', { hex: normalizedHex });
    return {
      rating: 'insufficient_data',
      summary: 'Could not analyze color',
      bullets: [`Invalid color hex code: ${normalizedHex}`],
      minDistance: null,
    };
  }
  
  // Compute garment's undertone, depth, and clarity FIRST (needed for comparisons)
  const garmentUndertone = computeGarmentUndertone(garmentLab);
  const garmentDepth = computeGarmentDepth(garmentLab);
  const garmentClarity = computeGarmentClarity(garmentLab);
  const garmentChroma = Math.sqrt(garmentLab.a ** 2 + garmentLab.b ** 2);
  
  // Calculate hue angle for logging
  let garmentHueAngle = Math.atan2(garmentLab.b, garmentLab.a) * (180 / Math.PI);
  if (garmentHueAngle < 0) garmentHueAngle += 360;
  
  // Determine user's micro-season if not provided
  let microSeason = userMicroSeason;
  if (!microSeason && userSeason) {
    microSeason = determineMicroSeason(userSeason, userDepth, userClarity, derivedUndertone);
  }
  
  // ============================================================================
  // FIX #1: Compare against ALL sub-seasons under the same parent season
  // ============================================================================
  const candidateMicroSeasons = getMicroSeasonsForParent ? getMicroSeasonsForParent(userSeason) : [microSeason];
  
  // Track deltaE for each sub-season
  const deltaEBySubSeason = {};
  let minDistance = Infinity;
  let closestColor = null;
  let closestCategory = null;
  let bestSubSeason = null;
  
  // Check ALL sub-seasons under the parent season
  for (const subSeason of candidateMicroSeasons) {
    const palette = getMicroSeasonPalette(subSeason);
    if (!palette) continue;
    
    let minForThisSeason = Infinity;
    
    for (const category of ['neutrals', 'accents', 'brights', 'softs']) {
      if (!palette[category]) continue;
      for (const paletteColor of palette[category]) {
        if (!paletteColor.lab) continue;
        const dE = deltaE(garmentLab, paletteColor.lab);
        
        // Track minimum for this sub-season
        if (dE < minForThisSeason) {
          minForThisSeason = dE;
        }
        
        // Track global minimum
        if (dE < minDistance) {
          minDistance = dE;
          closestColor = paletteColor;
          closestCategory = category;
          bestSubSeason = subSeason;
        }
      }
    }
    
    deltaEBySubSeason[subSeason] = minForThisSeason;
  }
  
  if (minDistance === Infinity) {
    console.warn('🎨 computeColorScore: Could not find any palette colors to compare');
    return {
      rating: 'insufficient_data',
      summary: 'Could not determine color palette',
      bullets: ['No palette colors available for comparison'],
      minDistance: null,
    };
  }
  
  // Compute attribute compatibility
  const attributeCompatibility = checkAttributeCompatibility(
    garmentUndertone,
    garmentDepth,
    garmentClarity,
    userSeason,
    userDepth,
    userClarity
  );
  
  // ============================================================================
  // FIX #2: Deep Color Threshold Correction (different thresholds for L < 40)
  // ============================================================================
  const isDeepColor = garmentLab.L < 40;
  const thresholds = isDeepColor
    ? { great: 8, good: 16, ok: 30 }   // Relaxed thresholds for deep colors
    : { great: 6, good: 12, ok: 22 };  // Standard thresholds
  
  // ============================================================================
  // RATING LOGIC with all fixes (olive undertone + chroma-based clarity)
  // ============================================================================
  let rating;
  let ratingReason = '';
  let clarityCap = null; // Track if clarity capped the rating
  let vividWarning = false; // Track if we should warn about vivid color
  
  // Get detailed undertone analysis for logging
  const undertoneAnalysis = getUndertoneAnalysis(garmentLab);
  
  // Check if undertone is allowed (using new allowed-match logic)
  // Olive is allowed for warm users!
  const undertoneAllowed = isUndertoneAllowed(garmentUndertone, derivedUndertone);
  const undertoneMatches = garmentUndertone === derivedUndertone || 
    garmentUndertone === 'neutral' ||
    (garmentUndertone === 'olive' && derivedUndertone === 'warm'); // OLIVE FIX
  
  // ============================================================================
  // CHROMA-BASED CLARITY LOGIC (replaces simple cap to OK)
  // ============================================================================
  // Determine clarity mismatch TYPE:
  // - "too_vivid": user muted + garment clear (high chroma = more risk)
  // - "too_soft": user clear + garment muted (less critical)
  const normalizedUserClarity = userClarity === 'vivid' ? 'clear' : userClarity;
  const isMutedUser = normalizedUserClarity === 'muted';
  const isClearUser = normalizedUserClarity === 'clear' || userClarity === 'vivid';
  const isGarmentVivid = garmentClarity === 'clear' || garmentChroma >= 45;
  const isGarmentMuted = garmentClarity === 'muted' || garmentChroma < 20;
  
  // Clarity mismatch analysis
  const tooVividForUser = isMutedUser && isGarmentVivid;
  const tooSoftForUser = isClearUser && isGarmentMuted;
  const clarityMismatch = tooVividForUser || tooSoftForUser;
  
  // Chroma intensity levels for muted users
  const chromaLevel = garmentChroma >= 70 ? 'neon' :
                      garmentChroma >= 55 ? 'very_vivid' :
                      garmentChroma >= 45 ? 'vivid' :
                      garmentChroma >= 30 ? 'mild' : 'soft';
  
  // ============================================================================
  // STEP 1: Compute BASE RATING from ΔE ONLY (no score gating!)
  // ============================================================================
  let baseRating;
  if (minDistance <= thresholds.great) {
    baseRating = 'great';
  } else if (minDistance <= thresholds.good) {
    baseRating = 'good';
  } else if (minDistance <= thresholds.ok) {
    baseRating = 'ok';
  } else {
    baseRating = 'risky';
  }
  
  // Start with base rating
  rating = baseRating;
  ratingReason = `ΔE ${minDistance.toFixed(1)} → base: ${baseRating.toUpperCase()}`;
  
  // Track caps applied
  const capsApplied = [];
  
  // ============================================================================
  // STEP 2: UNDERTONE HARD FAIL (except olive-allowed)
  // ============================================================================
  if (attributeCompatibility.hasTrueConflict) {
    rating = 'risky';
    ratingReason = `True undertone conflict (${garmentUndertone}↔${derivedUndertone}) - HARD FAIL`;
    capsApplied.push('undertone_hard_fail');
  }
  // ============================================================================
  // STEP 3: Apply CLARITY CAP (not score gating!)
  // ============================================================================
  else {
    // For MUTED users with VIVID garments
    if (tooVividForUser) {
      // Neon-level chroma (70+) + nearFace = cap at OK
      if (chromaLevel === 'neon' && nearFace) {
        if (rating === 'great' || rating === 'good') {
          rating = 'ok';
          clarityCap = 'ok';
          capsApplied.push('neon_nearface_cap_ok');
        }
        vividWarning = true;
      }
      // Very vivid (55-70) or any vivid + nearFace = cap at GOOD (never GREAT)
      else if ((chromaLevel === 'very_vivid' || chromaLevel === 'vivid') && nearFace) {
        if (rating === 'great') {
          rating = 'good';
          clarityCap = 'good';
          capsApplied.push('vivid_nearface_cap_good');
        }
        vividWarning = true;
      }
      // Muted user + clear garment (any chroma level) = cap at GOOD max
      else if (rating === 'great') {
        rating = 'good';
        clarityCap = 'good';
        capsApplied.push('clarity_mismatch_cap_good');
        vividWarning = chromaLevel === 'vivid' || chromaLevel === 'very_vivid' || chromaLevel === 'neon';
      }
      // Not nearFace or lower chroma - just warn if vivid
      else {
        if (chromaLevel === 'vivid' || chromaLevel === 'very_vivid' || chromaLevel === 'neon') {
          vividWarning = true;
        }
      }
    }
    
    // For CLEAR users with MUTED garments - cap at GOOD (can look dull, not risky)
    if (tooSoftForUser && rating === 'great') {
      rating = 'good';
      clarityCap = 'good';
      capsApplied.push('too_soft_cap_good');
    }
    
    // ============================================================================
    // STEP 4: Special rule for "ΔE extremely low" (≤ 4.5)
    // If undertone allowed AND ΔE ≤ 4.5 → rating must be at least GOOD
    // unless neon-level chroma + nearFace
    // ============================================================================
    const isPaletteMatch = minDistance <= 4.5;
    if (undertoneAllowed && isPaletteMatch) {
      const isNeonNearFace = chromaLevel === 'neon' && nearFace;
      if (rating === 'ok' && !isNeonNearFace) {
        rating = 'good';
        capsApplied.push('palette_match_upgrade_good');
        ratingReason += ` → upgraded to GOOD (palette match ΔE≤4.5)`;
      } else if (rating === 'risky' && !isNeonNearFace) {
        rating = 'good';
        capsApplied.push('palette_match_upgrade_good');
        ratingReason += ` → upgraded to GOOD (palette match ΔE≤4.5)`;
      }
    }
    
    // ============================================================================
    // STEP 5: Undertone protection (cannot be RISKY if undertone allowed + ΔE OK)
    // ============================================================================
    if (undertoneAllowed && rating === 'risky' && minDistance <= thresholds.ok) {
      rating = 'ok';
      capsApplied.push('undertone_protection_ok');
      ratingReason += ` → protected from RISKY (undertone allowed)`;
    }
  }
  
  // Build final reason with caps
  if (capsApplied.length > 0) {
    ratingReason += ` | caps: [${capsApplied.join(', ')}]`;
  }
  
  // Get the best sub-season's palette for median calculations
  const bestPalette = getMicroSeasonPalette(bestSubSeason);
  const paletteColors = bestPalette ? [
    ...(bestPalette.neutrals || []),
    ...(bestPalette.accents || []),
    ...(bestPalette.brights || []),
    ...(bestPalette.softs || []),
  ] : [];
  
  // Compute palette medians for explanation
  const paletteL = paletteColors.length > 0 
    ? paletteColors.filter(c => c.lab).map(c => c.lab.L).sort((a, b) => a - b)[Math.floor(paletteColors.length / 2)] 
    : 50;
  const paletteB = paletteColors.length > 0 
    ? paletteColors.filter(c => c.lab).map(c => c.lab.b).sort((a, b) => a - b)[Math.floor(paletteColors.length / 2)] 
    : 0;
  const paletteChroma = paletteColors.length > 0 
    ? paletteColors.filter(c => c.lab).map(c => Math.sqrt(c.lab.a ** 2 + c.lab.b ** 2)).sort((a, b) => a - b)[Math.floor(paletteColors.length / 2)] 
    : 20;
  
  // Determine differences
  const warmthDiff = garmentLab.b - paletteB;
  const depthDiff = garmentLab.L - paletteL;
  const clarityDiff = garmentChroma - paletteChroma;
  
  // Build explanation with attribute compatibility info and clarity context
  const explanation = buildExplanation(
    rating,
    minDistance,
    warmthDiff,
    depthDiff,
    clarityDiff,
    userSeason,
    microSeason,
    closestCategory,
    attributeCompatibility,
    { vividWarning, nearFace, clarityCap, chromaLevel, tooVividForUser, tooSoftForUser }
  );
  
  // Return in spec format
  return {
    rating,
    baseRating, // Rating from ΔE only (before caps)
    deltaE: minDistance,
    minDistance, // Backward compatibility
    garmentAttributes: {
      undertone: garmentUndertone,
      depth: garmentDepth,
      clarity: garmentClarity,
      chroma: parseFloat(garmentChroma.toFixed(2)),
      hueAngle: parseFloat(garmentHueAngle.toFixed(1)),
    },
    compatibility: {
      undertoneScore: attributeCompatibility.undertoneScore,
      depthScore: attributeCompatibility.depthScore,
      clarityScore: attributeCompatibility.clarityScore,
      totalScore: attributeCompatibility.score,
    },
    // Clarity context
    clarityContext: {
      clarityCap,
      vividWarning,
      chromaLevel,
      nearFace,
      tooVividForUser,
      tooSoftForUser,
    },
    // Caps applied during rating
    capsApplied,
    reason: explanation.summary,
    ratingReason, // Technical reason for rating
    stylingTip: explanation.bullets[2] || '', // "How to wear" tip
    // Keep backward compatibility
    closestColor,
    closestCategory,
    bestSubSeason, // Which sub-season gave the best match
    deltaEBySubSeason, // ΔE values for all sub-seasons
    explanation,
    attributeCompatibility,
  };
}

/**
 * Compute garment's undertone from Lab values using chroma and hue angle
 * Returns: 'warm' | 'cool' | 'neutral' | 'olive'
 * 
 * FIX: Olive/khaki/sage colors should NOT be classified as "cool"
 * Olive = yellow (b>0) with slight green tint (a<0, small magnitude)
 */
function computeGarmentUndertone(lab) {
  const chroma = Math.sqrt(lab.a ** 2 + lab.b ** 2);
  
  // Calculate hue angle in degrees [0-360]
  let hueAngle = Math.atan2(lab.b, lab.a) * (180 / Math.PI);
  if (hueAngle < 0) hueAngle += 360;
  
  // NEUTRAL: Very low chroma (achromatic colors: black, white, gray)
  if (chroma < 10) {
    return 'neutral';
  }
  
  // OLIVE: Yellow-dominant (b > 8) with slight green tint (a < 0, |a| <= 12)
  // This catches olive, khaki, sage, artichoke - warm-friendly "earth" colors
  if (lab.b > 8 && lab.a < 0 && Math.abs(lab.a) <= 12) {
    return 'olive';
  }
  
  // Also catch green-yellow band [90-140°] with positive b as olive
  if (hueAngle >= 90 && hueAngle <= 140 && lab.b > 0) {
    return 'olive';
  }
  
  // WARM: Orange/yellow/red families
  // Hue angles: [0-20], [20-110], [320-360] = warm hues
  if ((hueAngle >= 0 && hueAngle <= 110) || (hueAngle >= 320 && hueAngle <= 360)) {
    return 'warm';
  }
  
  // COOL: Green/blue/purple families
  // Hue angles: [110-320] = cool hues (excluding olive range already handled)
  return 'cool';
}

/**
 * Get detailed undertone analysis for logging
 */
function getUndertoneAnalysis(lab) {
  const chroma = Math.sqrt(lab.a ** 2 + lab.b ** 2);
  let hueAngle = Math.atan2(lab.b, lab.a) * (180 / Math.PI);
  if (hueAngle < 0) hueAngle += 360;
  const undertone = computeGarmentUndertone(lab);
  
  return {
    chroma: chroma.toFixed(2),
    hueAngle: hueAngle.toFixed(1),
    undertone,
    lab: { L: lab.L.toFixed(2), a: lab.a.toFixed(2), b: lab.b.toFixed(2) },
  };
}

/**
 * Check if garment undertone is allowed for user's undertone
 * Olive is allowed for warm users (autumn/spring)
 * Neutral is universally allowed
 */
function isUndertoneAllowed(garmentUndertone, userUndertone) {
  const allowedMap = {
    warm: ['warm', 'neutral', 'olive'],   // Warm users can wear olive!
    cool: ['cool', 'neutral'],            // Cool users should avoid olive/warm
    neutral: ['warm', 'cool', 'neutral', 'olive'], // Neutrals can wear anything
  };
  
  const allowed = allowedMap[userUndertone] || ['warm', 'cool', 'neutral', 'olive'];
  return allowed.includes(garmentUndertone);
}

/**
 * Check if undertone conflict is a TRUE opposite family conflict
 * Only warm↔cool is a true conflict; olive is NOT opposite to warm
 */
function isTrueUndertoneConflict(garmentUndertone, userUndertone) {
  // Olive is warm-friendly, not a conflict with warm
  if (garmentUndertone === 'olive' && userUndertone === 'warm') {
    return false;
  }
  // Neutral is never a conflict
  if (garmentUndertone === 'neutral' || userUndertone === 'neutral') {
    return false;
  }
  // True conflict: warm garment on cool user, or cool garment on warm user
  const warmTones = ['warm', 'olive'];
  const coolTones = ['cool'];
  
  const garmentIsWarm = warmTones.includes(garmentUndertone);
  const garmentIsCool = coolTones.includes(garmentUndertone);
  const userIsWarm = userUndertone === 'warm';
  const userIsCool = userUndertone === 'cool';
  
  return (garmentIsWarm && userIsCool) || (garmentIsCool && userIsWarm);
}

/**
 * Compute garment's depth from Lab values
 * Rule: light if L* > 70, medium if 45 < L* ≤ 70, deep if L* ≤ 45
 */
function computeGarmentDepth(lab) {
  if (lab.L > 70) return 'light';
  if (lab.L > 45) return 'medium';
  return 'deep';
}

/**
 * Compute garment's clarity from Lab values (chroma = sqrt(a² + b²))
 * Rule: muted if C < 20, medium if 20 ≤ C ≤ 30, clear if C > 30
 */
function computeGarmentClarity(lab) {
  const chroma = Math.sqrt(lab.a ** 2 + lab.b ** 2);
  if (chroma < 20) return 'muted';
  if (chroma <= 30) return 'medium';
  return 'clear';
}

/**
 * Check attribute compatibility between garment and user
 * Priority: Undertone > Clarity > Depth
 * Returns: { score, undertoneScore, clarityScore, depthScore, reasons, hasUndertoneMismatch, hasClarityMismatch, hasTrueConflict }
 */
function checkAttributeCompatibility(garmentUndertone, garmentDepth, garmentClarity, userSeason, userDepth, userClarity) {
  const reasons = [];
  let hasUndertoneMismatch = false;
  let hasClarityMismatch = false;
  let hasTrueConflict = false;
  
  // Determine expected undertone for user's season
  const expectedUndertone = (userSeason === 'spring' || userSeason === 'autumn') ? 'warm' : 'cool';
  
  // Check if undertone is allowed using new logic
  const undertoneAllowed = isUndertoneAllowed(garmentUndertone, expectedUndertone);
  const trueConflict = isTrueUndertoneConflict(garmentUndertone, expectedUndertone);
  
  // PRIORITY 1: Undertone scoring (with olive fix)
  let undertoneScore = 0;
  if (garmentUndertone === expectedUndertone) {
    // Perfect match
    undertoneScore = 1;
    reasons.push('undertone_match');
  } else if (garmentUndertone === 'olive' && expectedUndertone === 'warm') {
    // Olive works great for warm users (autumn/spring)
    undertoneScore = 0.8;
    reasons.push('undertone_olive_warm_compatible');
  } else if (garmentUndertone === 'neutral') {
    // Neutral works with any undertone
    undertoneScore = 0.5;
    reasons.push('undertone_neutral');
  } else if (undertoneAllowed) {
    // Allowed but not perfect
    undertoneScore = 0.3;
    reasons.push('undertone_compatible');
  } else if (trueConflict) {
    // TRUE opposite conflict (warm↔cool) = hard fail
    undertoneScore = -2;
    hasUndertoneMismatch = true;
    hasTrueConflict = true;
    reasons.push('undertone_true_conflict');
  } else {
    // Mismatch but not a true conflict
    undertoneScore = -0.5;
    hasUndertoneMismatch = true;
    reasons.push('undertone_mismatch');
  }
  
  // PRIORITY 2: Clarity scoring
  // Normalize user clarity (treat 'vivid' as 'clear')
  const normalizedUserClarity = userClarity === 'vivid' ? 'clear' : userClarity;
  
  let clarityScore = 0;
  if (garmentClarity === normalizedUserClarity) {
    clarityScore = 1;
    reasons.push('clarity_match');
  } else if (
    (garmentClarity === 'medium' && (normalizedUserClarity === 'muted' || normalizedUserClarity === 'clear')) ||
    (normalizedUserClarity === 'medium' && (garmentClarity === 'muted' || garmentClarity === 'clear'))
  ) {
    // Adjacent: muted ↔ medium or medium ↔ clear
    clarityScore = 0;
    reasons.push('clarity_adjacent');
  } else {
    // Mismatch: muted ↔ clear (opposite ends) = HARD LIMIT TO OK
    clarityScore = -1.5;
    hasClarityMismatch = true;
    reasons.push('clarity_mismatch');
  }
  
  // PRIORITY 3: Depth scoring
  let depthScore = 0;
  if (garmentDepth === userDepth) {
    depthScore = 0.5;
    reasons.push('depth_match');
  } else if (Math.abs(getDepthValue(garmentDepth) - getDepthValue(userDepth)) === 1) {
    // Adjacent depths (light-medium or medium-deep)
    depthScore = 0.25;
    reasons.push('depth_adjacent');
  } else {
    // Opposite (light ↔ deep)
    depthScore = -1;
    reasons.push('depth_mismatch');
  }
  
  // Total compatibility score
  const score = undertoneScore + clarityScore + depthScore;
  
  return { 
    score,
    undertoneScore,
    clarityScore,
    depthScore,
    reasons, 
    hasUndertoneMismatch, 
    hasClarityMismatch,
    hasTrueConflict,
  };
}

function getDepthValue(depth) {
  if (depth === 'light') return 0;
  if (depth === 'medium') return 1;
  return 2; // deep
}

/**
 * Build human-readable explanation per rating (spec format)
 * Format: summary + bullets (face impact, what goes wrong, how to wear)
 * 
 * @param {object} clarityContext - { vividWarning, nearFace, clarityCap, chromaLevel, tooVividForUser, tooSoftForUser }
 */
function buildExplanation(rating, minDistance, warmthDiff, depthDiff, clarityDiff, userSeason, microSeason, category, attributeCompatibility = null, clarityContext = {}) {
  const { vividWarning, nearFace, clarityCap, chromaLevel, tooVividForUser, tooSoftForUser } = clarityContext;
  
  // Generate explanation based on rating per spec
  // Format: summary (plain text), bullet 1 (plain text), bullets 2&3 (micronotes - smaller/lighter)
  if (rating === 'great') {
    return {
      summary: "This color matches your undertone and clarity very well.",
      bullets: [
        { text: "It brightens your features and blends naturally with your own coloring.", isMicronote: false },
        { text: "The warmth and softness align with your natural coloring, so it won't create shadows or wash you out.", isMicronote: true },
        { text: "Especially flattering near your face—perfect for tops, scarves, or accessories.", isMicronote: true },
      ],
    };
  } else if (rating === 'good') {
    // Check if there's a vivid warning to add context
    let summary = "This color is close to your palette.";
    let bullets = [];
    
    if (vividWarning && tooVividForUser) {
      summary = "This color works for you, but it's bold.";
      bullets = [
        { text: "The saturation is higher than your natural coloring prefers.", isMicronote: false },
        { text: "Works well as a statement piece or in small doses.", isMicronote: true },
        { text: "Balance with softer colors in your palette near the face, or use as an accent.", isMicronote: true },
      ];
    } else if (tooSoftForUser) {
      summary = "This color is close to your palette but softer than ideal.";
      bullets = [
        { text: "It may look slightly muted against your vibrant coloring.", isMicronote: false },
        { text: "You'll still look good wearing it.", isMicronote: true },
        { text: "Add brighter accessories or makeup to maintain your natural vibrancy.", isMicronote: true },
      ];
    } else {
      bullets = [
        { text: "It works well overall, but is slightly off in clarity or depth.", isMicronote: false },
        { text: "You'll still look good wearing it near the face.", isMicronote: true },
        { text: "Works best as a top with a neckline opening or layered with a color that matches your season.", isMicronote: true },
      ];
    }
    
    return { summary, bullets };
  } else if (rating === 'ok') {
    let summary = "Not a perfect match, but wearable.";
    let bullets = [];
    
    if (clarityCap && tooVividForUser) {
      // Clarity was capped due to vivid color for muted user
      const intensityDesc = chromaLevel === 'neon' ? 'very intense' : 
                            chromaLevel === 'very_vivid' ? 'quite saturated' : 'bold';
      summary = `This color is ${intensityDesc} for your muted coloring.`;
      bullets = [
        { text: "High saturation can overpower your natural softness.", isMicronote: false },
        { text: "May create visual competition near your face.", isMicronote: true },
        { text: "Best worn away from the face (pants, skirt, bag) or as a small accent.", isMicronote: true },
      ];
    } else if (tooSoftForUser) {
      summary = "This color may look washed out on you.";
      bullets = [
        { text: "The muted tone doesn't match your natural vibrancy.", isMicronote: false },
        { text: "Can make you look less energetic or vibrant.", isMicronote: true },
        { text: "Best for layering under brighter pieces or worn away from the face.", isMicronote: true },
      ];
    } else {
      bullets = [
        { text: "It may create mild shadowing or reduce brightness.", isMicronote: false },
        { text: "Better with styling: open neckline, layers, makeup, accessories.", isMicronote: true },
        { text: "Best worn away from the face (pants, skirt) or layered with a color from your palette.", isMicronote: true },
      ];
    }
    
    return { summary, bullets };
  } else { // risky
    // Determine why it's risky for the summary
    let primaryIssue = '';
    if (attributeCompatibility?.hasTrueConflict) {
      const userIsWarm = (userSeason === 'spring' || userSeason === 'autumn');
      primaryIssue = userIsWarm 
        ? 'conflicts strongly with your warm undertone'
        : 'conflicts strongly with your cool undertone';
    } else if (tooVividForUser && chromaLevel === 'neon') {
      primaryIssue = 'is too intense for your muted coloring';
    } else if (attributeCompatibility?.hasClarityMismatch) {
      primaryIssue = 'conflicts with your clarity';
    } else {
      primaryIssue = 'far from your palette';
    }
    
    // Build appropriate bullets based on the issue
    let faceImpact = "It may create dullness, greyness, or heavy contrast near the face.";
    let whatGoesWrong = "The mismatch can emphasize shadows and reduce brightness.";
    let howToWear = "If you still want to wear it, use it away from the face or add a layer in your season's colors near your face.";
    
    if (attributeCompatibility?.hasTrueConflict) {
      faceImpact = "The undertone clashes strongly with your skin's natural coloring.";
      whatGoesWrong = "The undertone mismatch can make skin look tired, grey, or sallow.";
      howToWear = "Best avoided near the face. If wearing, keep it far from your face (pants, skirt, shoes).";
    } else if (tooVividForUser && chromaLevel === 'neon') {
      faceImpact = "This intensity level can overpower your natural softness.";
      whatGoesWrong = "Very saturated colors can make you look washed out or create visual competition.";
      howToWear = "Best as a small accent only. Avoid wearing it as a top or near your face.";
    }
    
    return {
      summary: `This color ${primaryIssue}.`,
      bullets: [
        { text: faceImpact, isMicronote: false },
        { text: whatGoesWrong, isMicronote: true },
        { text: howToWear, isMicronote: true },
      ],
    };
  }
}

/**
 * Check if a color passes the suggested products filter
 * Only includes colors rated "great" or "good"
 */
function passesSuggestedProductsFilter(garmentHex, userSeason, userDepth, userClarity, userMicroSeason = null) {
  const score = computeColorScore(garmentHex, userSeason, userDepth, userClarity, userMicroSeason);
  return score.rating === 'great' || score.rating === 'good';
}

module.exports = {
  computeColorScore,
  passesSuggestedProductsFilter,
};

/**
 * Stylit — Fit & Size Logic (NO-AI)
 * File: lib/fitLogic.js
 *
 * Goal:
 * - Recommend best size using user body measurements + product size chart (when available)
 * - Provide human-stylist-style insights: shoulders, chest/bust, waist, hips, length, inseam
 * - Avoid false confidence: if data is missing, return "INSUFFICIENT_DATA" with clear next steps
 *
 * Works for Replicate category tags:
 * - upper_body
 * - lower_body
 * - dresses
 *
 * Assumptions:
 * - User measurements are BODY measurements in INCHES (circumference)
 * - Product chart measurements are GARMENT measurements in INCHES (circumference)
 * - All measurements are circumference-only (no flat measurements)
 *
 * Safety:
 * - Strongly penalize "too small" (negative ease)
 * - Never claim exact results without key measurements present
 */

/** -----------------------------
 * Helpers
 * ------------------------------*/

/** Convert value to inches; accepts numbers (assumed inches) or strings with units */
function toInches(val) {
  if (val == null) return null;
  if (typeof val === "number") return Number.isFinite(val) ? val : null;
  const s = String(val).trim().toLowerCase();
  if (!s) return null;
  
  // inches
  const inMatch = s.match(/([\d.]+)\s*(in|inch|inches|")/);
  if (inMatch) {
    return safeNum(inMatch[1]);
  }
  
  // cm - convert to inches
  const cmMatch = s.match(/([\d.]+)\s*cm/);
  if (cmMatch) {
    const cm = safeNum(cmMatch[1]);
    return cm == null ? null : cm / 2.54;
  }
  
  // raw number string -> assume inches
  return safeNum(s);
}

function safeNum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

/** Pick closest size by index fallback */
function neighborSizeLabel(sortedSizes, idx, direction) {
  const j = idx + direction;
  if (j < 0 || j >= sortedSizes.length) return null;
  return sortedSizes[j].size;
}

/** Normalize measurement keys from different sites - expects circumference in inches */
function normalizeChartRow(row) {
  // Accept many naming variants
  // All measurements are circumference in inches
  const m = row.measurements || row.measurement || row;
  const out = {
    // Upper body - circumference in inches
    chest: toInches(m.chest ?? m.bust ?? m.chest_circumference ?? m.bust_circumference),
    shoulder: toInches(m.shoulder ?? m.shoulders ?? m.shoulder_width ?? m.shoulder_width_in),
    sleeve: toInches(m.sleeve ?? m["sleeve length"] ?? m.sleeve_length ?? m.sleeve_length_in ?? m.arm),
    topLength: toInches(m.length ?? m["top length"] ?? m["shirt length"] ?? m.garment_length ?? m.garment_length_in),
    // Lower body - circumference in inches
    waist: toInches(m.waist ?? m.waist_circumference),
    hips: toInches(m.hips ?? m.hip ?? m.hip_circumference ?? m.hips_circumference),
    inseam: toInches(m.inseam ?? m["in seam"] ?? m["inside leg"] ?? m.inseam_in),
    outseam: toInches(m.outseam ?? m["out seam"] ?? m["outside leg"]),
    rise: toInches(m.rise ?? m["front rise"] ?? m.rise_in),
    // Dresses - circumference in inches
    dressLength: toInches(m["dress length"] ?? m.length ?? m["full length"] ?? m.garment_length ?? m.garment_length_in),
  };
  return out;
}

/** -----------------------------
 * Fit targets (ease) in INCHES
 * ------------------------------
 * Target garment measurement ≈ body measurement + desired ease
 * If fabricStretch = true, allow slightly less ease on waist/hips/chest.
 * All ease values are in inches (circumference).
 */
function getEaseProfile({ category, fitIntent, fabricStretch }) {
  // fitIntent: "snug" | "regular" | "relaxed" | "oversized"
  const intent = fitIntent || "regular";
  const stretch = !!fabricStretch;
  
  // Base ease ranges (INCHES) - converted from cm: 1 cm ≈ 0.394 inches
  // NOTE: These are "typical" and intentionally conservative.
  const EASE = {
    upper_body: {
      chest: { snug: 2.4, regular: 3.9, relaxed: 6.3, oversized: 9.4 }, // ~6, 10, 16, 24 cm
      shoulder: { snug: 0.2, regular: 0.6, relaxed: 1.2, oversized: 2.0 }, // ~0.5, 1.5, 3, 5 cm
      sleeve: { snug: 0, regular: 0.2, relaxed: 0.4, oversized: 0.8 }, // ~0, 0.5, 1, 2 cm
      length: { snug: 0, regular: 0, relaxed: 0.4, oversized: 0.8 }, // ~0, 0, 1, 2 cm
    },
    lower_body: {
      waist: { snug: stretch ? 0 : 0.4, regular: stretch ? 0.4 : 0.8, relaxed: stretch ? 0.8 : 1.6, oversized: 2.4 }, // ~0-1, 1-2, 2-4, 6 cm
      hips: { snug: 0.8, regular: 2.0, relaxed: 3.1, oversized: 4.7 }, // ~2, 5, 8, 12 cm
      inseam: { snug: 0, regular: 0, relaxed: 0, oversized: 0 }, // inseam is length; not ease
      rise: { snug: 0, regular: 0, relaxed: 0, oversized: 0 },
    },
    dresses: {
      bust: { snug: 2.4, regular: 3.9, relaxed: 5.5, oversized: 7.1 }, // ~6, 10, 14, 18 cm
      waist: { snug: stretch ? 0 : 0.8, regular: stretch ? 0.8 : 1.6, relaxed: 2.4, oversized: 3.9 }, // ~0-2, 2-4, 6, 10 cm
      hips: { snug: 0.8, regular: 2.4, relaxed: 3.9, oversized: 5.5 }, // ~2, 6, 10, 14 cm
      length: { snug: 0, regular: 0, relaxed: 0.4, oversized: 0.8 }, // ~0, 0, 1, 2 cm
    },
  };
  
  const key = category === "dresses" ? "dresses" : category === "lower_body" ? "lower_body" : "upper_body";
  return { key, ease: EASE[key] };
}

/** -----------------------------
 * Required user measurements by category (in inches)
 * ------------------------------*/
function requiredUserMeasurements(category) {
  if (category === "lower_body") return ["waistIn", "hipsIn", "inseamIn", "heightIn"];
  if (category === "dresses") return ["bustIn", "waistIn", "hipsIn", "heightIn"];
  return ["chestIn", "shoulderIn", "heightIn"]; // upper_body
}

/** -----------------------------
 * Required chart measurements by category (minimum set)
 * ------------------------------*/
function requiredChartMeasurements(category) {
  if (category === "lower_body") return ["waist", "hips"]; // inseam improves length advice
  if (category === "dresses") return ["chest", "waist", "hips"]; // use chest as bust equivalent
  return ["chest"]; // shoulder improves accuracy
}

/** -----------------------------
 * Scoring
 * ------------------------------
 * High score if garment >= target and close.
 * Heavy penalty if garment < body (negative ease).
 */
function scoreMetric({ garment, target, body, hardTooSmallPenalty = 8 }) {
  if (garment == null || target == null || body == null) return { score: 0, note: null, valid: false };
  
  const easeActual = garment - body;
  const diffToTarget = garment - target; // positive means looser than target
  
  // Too small (negative ease) => big penalty
  if (easeActual < 0) {
    return {
      score: -hardTooSmallPenalty - Math.abs(easeActual) * 1.5,
      note: `Too tight (garment is ${Math.round(Math.abs(easeActual))}cm smaller than body)`,
      valid: true,
    };
  }
  
  // Close to target is best; being looser is OK but reduces confidence gradually
  // Within ±2cm of target => best
  const abs = Math.abs(diffToTarget);
  let score = 0;
  if (abs <= 2) score = 6;
  else if (abs <= 5) score = 4;
  else if (abs <= 9) score = 2;
  else score = 1;
  
  // Slightly looser is preferred over slightly tight for most casual wear
  // (but not for waist on bottoms—handled by different weights below)
  return { score, note: null, valid: true };
}

function sumScores(parts) {
  return parts.reduce((a, p) => a + (p?.score || 0), 0);
}

/** -----------------------------
 * Public API
 * ------------------------------*/

/**
 * @typedef {Object} UserProfile
 * @property {number|null} heightCm
 * @property {number|null} weightKg
 * @property {string|null} gender // optional
 * @property {number|null} chestCm
 * @property {number|null} bustCm
 * @property {number|null} waistCm
 * @property {number|null} hipsCm
 * @property {number|null} shoulderCm
 * @property {number|null} inseamCm
 */

/**
 * @typedef {Object} Product
 * @property {"upper_body"|"lower_body"|"dresses"} category
 * @property {string} name
 * @property {string|null} fitType // "regular" | "slim" | "relaxed" | "oversized" (optional)
 * @property {boolean|null} fabricStretch
 * @property {Array<{size: string, measurements: Object}>} sizeChart
 */

/**
 * @param {UserProfile} user
 * @param {Product} product
 * @param {{ fitIntent?: "snug"|"regular"|"relaxed"|"oversized" }} opts
 * @returns {{
 *   status: "OK"|"INSUFFICIENT_DATA",
 *   recommendedSize: string|null,
 *   backupSize: string|null,
 *   risk: "low"|"medium"|"high",
 *   confidence: number, // 0-100
 *   insights: string[],
 *   missing: string[],
 * }}
 */
function recommendSizeAndFit(user, product, opts = {}) {
  const category = product?.category || "upper_body";
  
  // Normalize user measurement selection (all in inches)
  // Accept both old (Cm) and new (In) field names for backward compatibility
  // If user.heightIn/user.chestIn etc. are already numbers, use them directly
  // toInches() handles numbers correctly (returns as-is if finite)
  console.log('🔢 fitLogic: Normalizing user measurements...');
  console.log('🔢 fitLogic: Raw user input:', JSON.stringify(user, null, 2));
  
  // Import parseHeightToInches for height normalization
  let parseHeightToInches;
  try {
    const measurementUtils = require('./measurementUtils');
    parseHeightToInches = measurementUtils.parseHeightToInches;
  } catch (e) {
    // Fallback if module not available
    parseHeightToInches = (val) => {
      if (val == null) return null;
      if (typeof val === 'number' && val >= 36) return val; // Already in inches
      // Try to parse as feet.inches
      if (typeof val === 'number' && val < 36) {
        const feet = Math.floor(val);
        const inches = Math.round((val - feet) * 10);
        if (inches >= 0 && inches <= 11) return feet * 12 + inches;
      }
      return toInches(val);
    };
  }
  
  const u = {
    heightIn: (user?.heightIn != null) ? parseHeightToInches(user.heightIn) : (user?.heightCm != null ? toInches(user.heightCm) : null),
    weightKg: safeNum(user?.weightKg),
    chestIn: (user?.chestIn != null) ? toInches(user.chestIn) : (user?.chestCm != null ? toInches(user.chestCm) : null),
    bustIn: (user?.bustIn != null) ? toInches(user.bustIn) : (user?.bustCm != null ? toInches(user.bustCm) : null) ?? (user?.chestIn != null ? toInches(user.chestIn) : (user?.chestCm != null ? toInches(user.chestCm) : null)), // fallback
    waistIn: (user?.waistIn != null) ? toInches(user.waistIn) : (user?.waistCm != null ? toInches(user.waistCm) : null),
    hipsIn: (user?.hipsIn != null) ? toInches(user.hipsIn) : (user?.hipsCm != null ? toInches(user.hipsCm) : null),
    shoulderIn: (user?.shoulderIn != null) ? toInches(user.shoulderIn) : (user?.shoulderCm != null ? toInches(user.shoulderCm) : null),
    inseamIn: (user?.inseamIn != null) ? toInches(user.inseamIn) : (user?.inseamCm != null ? toInches(user.inseamCm) : null),
  };
  
  console.log('🔢 fitLogic: Normalized measurements (after toInches):', JSON.stringify(u, null, 2));
  
  const requiredU = requiredUserMeasurements(category);
  // Check if values are null/undefined (toInches returns null for invalid values)
  const missingU = requiredU.filter((k) => {
    const value = u[k];
    return value == null || (typeof value === 'number' && !Number.isFinite(value));
  });
  
  // Debug logging
  if (missingU.length > 0) {
    console.log('🔍 fitLogic missing check:', {
      required: requiredU,
      missing: missingU,
      actualValues: requiredU.reduce((acc, k) => {
        acc[k] = u[k];
        return acc;
      }, {}),
    });
  }
  
  // Must have a size chart for logic sizing (otherwise: ask user to choose brand size manually)
  const chart = Array.isArray(product?.sizeChart) ? product.sizeChart : [];
  if (chart.length === 0) {
    return {
      status: "INSUFFICIENT_DATA",
      recommendedSize: null,
      backupSize: null,
      risk: "high",
      confidence: 0,
      insights: [
        "No size chart found for this product. For accuracy, Stylit needs garment measurements (size chart).",
        "Tip: try another product link that includes a size chart, or add your usual brand size in your Fit Profile.",
      ],
      missing: [...missingU, "sizeChart"],
    };
  }
  
  const rows = chart
    .map((r) => ({ size: r.size ?? r.label ?? r.name, m: normalizeChartRow(r) }))
    .filter((r) => !!r.size);
  
  const requiredC = requiredChartMeasurements(category);
  const hasMinChart = requiredC.every((key) => {
    // dresses uses chest as bust equivalent
    return rows.some((r) => r.m[key] != null);
  });
  
  if (missingU.length > 0 || !hasMinChart) {
    const missing = [...missingU];
    if (!hasMinChart) missing.push("sizeChart_missing_key_measurements");
    return {
      status: "INSUFFICIENT_DATA",
      recommendedSize: null,
      backupSize: null,
      risk: "high",
      confidence: 0,
      insights: [
        "Not enough measurement data to give a safe recommendation.",
        "Add the missing Fit Profile fields and/or use a product link with a proper size chart.",
      ],
      missing,
    };
  }
  
  // Fit intent: prefer product.fitType if present; otherwise use opts
  const rawFit = (product.fitType || opts.fitIntent || "regular").toLowerCase();
  const fitIntent =
    rawFit.includes("over") ? "oversized" :
    rawFit.includes("relax") ? "relaxed" :
    rawFit.includes("slim") ? "snug" :
    rawFit.includes("snug") ? "snug" :
    rawFit.includes("regular") ? "regular" :
    /** default */ "regular";
  
  const { key, ease } = getEaseProfile({ category, fitIntent, fabricStretch: product.fabricStretch });
  
  console.log('🎯 fitLogic: Fit profile:', { category, fitIntent, fabricStretch: product.fabricStretch, key, ease });
  
  // Build targets (all in inches)
  const targets =
    key === "upper_body"
      ? {
          chest: u.chestIn != null ? u.chestIn + ease.chest[fitIntent] : null,
          shoulder: u.shoulderIn != null ? u.shoulderIn + ease.shoulder[fitIntent] : null,
          sleeve: null,
          length: null,
        }
      : key === "lower_body"
      ? {
          waist: u.waistIn != null ? u.waistIn + ease.waist[fitIntent] : null,
          hips: u.hipsIn != null ? u.hipsIn + ease.hips[fitIntent] : null,
          inseam: u.inseamIn, // target inseam = body inseam
          rise: null,
        }
      : {
          chest: u.bustIn != null ? u.bustIn + ease.bust[fitIntent] : null,
          waist: u.waistIn != null ? u.waistIn + ease.waist[fitIntent] : null,
          hips: u.hipsIn != null ? u.hipsIn + ease.hips[fitIntent] : null,
          length: null,
        };
  
  console.log('🎯 fitLogic: Calculated targets:', JSON.stringify(targets, null, 2));
  console.log('📊 fitLogic: Size chart rows:', JSON.stringify(rows.map(r => ({ size: r.size, measurements: r.m })), null, 2));
  
  // Score each size row
  console.log('📈 fitLogic: Starting to score sizes...');
  const scored = rows.map((r, idx) => {
    const m = r.m;
    let parts = [];
    
    if (key === "upper_body") {
      const chest = scoreMetric({ garment: m.chest, target: targets.chest, body: u.chestIn, hardTooSmallPenalty: 10 });
      const shoulder = u.shoulderIn != null && m.shoulder != null
        ? scoreMetric({ garment: m.shoulder, target: u.shoulderIn + ease.shoulder[fitIntent], body: u.shoulderIn, hardTooSmallPenalty: 6 })
        : { score: 0, valid: false };
      
      // weight chest most
      const score = chest.score * 2 + shoulder.score * 1;
      parts = [{ name: "chest", ...chest }, { name: "shoulder", ...shoulder }];
      
      console.log(`📈 fitLogic: Size ${r.size} scored:`, {
        size: r.size,
        chest: { garment: m.chest, target: targets.chest, body: u.chestIn, score: chest.score, note: chest.note },
        shoulder: { garment: m.shoulder, target: u.shoulderIn + ease.shoulder[fitIntent], body: u.shoulderIn, score: shoulder.score, note: shoulder.note },
        totalScore: score,
      });
      
      return { idx, size: r.size, score, parts, m };
    }
    
    if (key === "lower_body") {
      const waist = scoreMetric({ garment: m.waist, target: targets.waist, body: u.waistIn, hardTooSmallPenalty: 12 });
      const hips = scoreMetric({ garment: m.hips, target: targets.hips, body: u.hipsIn, hardTooSmallPenalty: 10 });
      
      // waist slightly higher importance than hips for most bottoms
      const score = waist.score * 2 + hips.score * 1.5;
      parts = [{ name: "waist", ...waist }, { name: "hips", ...hips }];
      
      console.log(`📈 fitLogic: Size ${r.size} scored:`, {
        size: r.size,
        waist: { garment: m.waist, target: targets.waist, body: u.waistIn, score: waist.score, note: waist.note },
        hips: { garment: m.hips, target: targets.hips, body: u.hipsIn, score: hips.score, note: hips.note },
        totalScore: score,
      });
      
      return { idx, size: r.size, score, parts, m };
    }
    
    // dresses
    const bust = scoreMetric({ garment: m.chest, target: targets.chest, body: u.bustIn, hardTooSmallPenalty: 10 });
    const waist = scoreMetric({ garment: m.waist, target: targets.waist, body: u.waistIn, hardTooSmallPenalty: 12 });
    const hips = scoreMetric({ garment: m.hips, target: targets.hips, body: u.hipsIn, hardTooSmallPenalty: 10 });
    const score = bust.score * 1.5 + waist.score * 1.5 + hips.score * 1.5;
    parts = [{ name: "bust", ...bust }, { name: "waist", ...waist }, { name: "hips", ...hips }];
    
    console.log(`📈 fitLogic: Size ${r.size} scored:`, {
      size: r.size,
      bust: { garment: m.chest, target: targets.chest, body: u.bustIn, score: bust.score, note: bust.note },
      waist: { garment: m.waist, target: targets.waist, body: u.waistIn, score: waist.score, note: waist.note },
      hips: { garment: m.hips, target: targets.hips, body: u.hipsIn, score: hips.score, note: hips.note },
      totalScore: score,
    });
    
    return { idx, size: r.size, score, parts, m };
  });
  
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  const second = scored[1] || null;
  
  console.log('🏆 fitLogic: Scoring complete. All scores:', scored.map(s => ({ size: s.size, score: s.score })));
  console.log('🏆 fitLogic: Best size:', best.size, 'Score:', best.score);
  console.log('🏆 fitLogic: Second best:', second?.size || 'none', 'Score:', second?.score || 'N/A');
  
  // Risk + confidence
  // If any "too tight" note exists in best, raise risk.
  const tooTightCount = best.parts.filter((p) => p.note && p.note.toLowerCase().includes("too tight")).length;
  let risk = "low";
  if (tooTightCount >= 1) risk = "high";
  else if (best.score < 8) risk = "medium";
  
  // Confidence scale from score
  const rawConf = clamp(Math.round((best.score / 18) * 100), 0, 100);
  const confidence = risk === "high" ? Math.min(rawConf, 45) : risk === "medium" ? Math.min(rawConf, 70) : rawConf;
  
  console.log('⚠️ fitLogic: Risk assessment:', { tooTightCount, risk, rawConf, confidence, bestScore: best.score });
  
  // Insights: stylist-style
  const insights = [];
  insights.push(`Fit intent: ${fitIntent}${product.fabricStretch ? " (stretch fabric)" : ""}.`);
  
  // Import formatInchesAsFraction for display
  let formatInchesAsFraction;
  try {
    const measurementUtils = require('./measurementUtils');
    formatInchesAsFraction = measurementUtils.formatInchesAsFraction;
  } catch (e) {
    // Fallback if module not available
    formatInchesAsFraction = (inches) => `${inches.toFixed(2)} in`;
  }
  
  if (key === "upper_body") {
    const chestEase = best.m.chest != null && u.chestIn != null ? best.m.chest - u.chestIn : null;
    if (chestEase != null) {
      const easeStr = formatInchesAsFraction(Math.abs(chestEase));
      if (chestEase < 0) insights.push(`Chest will feel tight (≈ ${easeStr} smaller than your chest).`);
      else insights.push(`Chest ease ≈ ${easeStr} (how roomy it will feel).`);
    }
    if (best.m.shoulder != null && u.shoulderIn != null) {
      const sh = best.m.shoulder - u.shoulderIn;
      const shStr = formatInchesAsFraction(Math.abs(sh));
      if (sh < 0) insights.push(`Shoulders may pull/feel narrow (≈ ${shStr}).`);
      else insights.push(`Shoulders look okay (≈ +${shStr}).`);
    }
    if (best.m.topLength != null && u.heightIn != null) {
      insights.push(describeTopLength(best.m.topLength, u.heightIn));
    }
  }
  
  if (key === "lower_body") {
    if (best.m.waist != null && u.waistIn != null) {
      const w = best.m.waist - u.waistIn;
      const wStr = formatInchesAsFraction(Math.abs(w));
      if (w < 0) insights.push(`Waist will be tight (≈ ${wStr} smaller than your waist).`);
      else insights.push(`Waist room ≈ +${wStr}.`);
    }
    if (best.m.hips != null && u.hipsIn != null) {
      const h = best.m.hips - u.hipsIn;
      const hStr = formatInchesAsFraction(Math.abs(h));
      if (h < 0) insights.push(`Hip area may feel tight (≈ ${hStr}).`);
      else insights.push(`Hip room ≈ +${hStr}.`);
    }
    if (best.m.inseam != null && u.inseamIn != null) {
      insights.push(describeInseam(best.m.inseam, u.inseamIn));
    }
  }
  
  if (key === "dresses") {
    if (best.m.chest != null && u.bustIn != null) {
      const b = best.m.chest - u.bustIn;
      const bStr = formatInchesAsFraction(Math.abs(b));
      insights.push(b < 0 ? `Bust will be tight (≈ ${bStr}).` : `Bust ease ≈ +${bStr}.`);
    }
    if (best.m.waist != null && u.waistIn != null) {
      const w = best.m.waist - u.waistIn;
      const wStr = formatInchesAsFraction(Math.abs(w));
      insights.push(w < 0 ? `Waist will be tight (≈ ${wStr}).` : `Waist ease ≈ +${wStr}.`);
    }
    if (best.m.hips != null && u.hipsIn != null) {
      const h = best.m.hips - u.hipsIn;
      const hStr = formatInchesAsFraction(Math.abs(h));
      insights.push(h < 0 ? `Hip area may feel tight (≈ ${hStr}).` : `Hip ease ≈ +${hStr}.`);
    }
    if (best.m.dressLength != null && u.heightIn != null) {
      insights.push(describeDressLength(best.m.dressLength, u.heightIn));
    }
  }
  
  // Backup size:
  // - If best is slightly tight -> suggest next size up as backup
  // - Else suggest neighbor that's closest in score
  const bestIdx = best.idx;
  const sortedByOriginal = [...rows].map((r, i) => ({ size: r.size, i }));
  const bestPos = sortedByOriginal.findIndex((x) => x.i === bestIdx);
  let backup = null;
  if (risk === "high") {
    // go up one if possible
    backup = neighborSizeLabel(sortedByOriginal, bestPos, +1);
  } else {
    backup = second?.size || neighborSizeLabel(sortedByOriginal, bestPos, +1) || neighborSizeLabel(sortedByOriginal, bestPos, -1);
  }
  
  const result = {
    status: "OK",
    recommendedSize: best.size,
    backupSize: backup,
    risk,
    confidence,
    insights,
    missing: [],
  };
  
  console.log('✅ fitLogic: Final result:', JSON.stringify(result, null, 2));
  console.log('✅ fitLogic: Calculation complete - NOT using dummy values!');
  
  return result;
}

/** -----------------------------
 * Length descriptions (simple & safe)
 * ------------------------------*/
function describeTopLength(garmentLengthIn, heightIn) {
  // Heuristic: top length vs height ratio (works the same in inches)
  const ratio = garmentLengthIn / heightIn;
  if (ratio < 0.28) return "Top length looks cropped (higher than typical hip length).";
  if (ratio < 0.33) return "Top length looks standard (around hip).";
  if (ratio < 0.37) return "Top length looks longer (covers more of hip/upper thigh).";
  return "Top length looks very long/oversized (likely covers upper thigh).";
}

function describeInseam(garmentInseamIn, bodyInseamIn) {
  let formatInchesAsFraction;
  try {
    const measurementUtils = require('./measurementUtils');
    formatInchesAsFraction = measurementUtils.formatInchesAsFraction;
  } catch (e) {
    formatInchesAsFraction = (inches) => `${inches.toFixed(2)} in`;
  }
  const diff = garmentInseamIn - bodyInseamIn;
  const diffStr = formatInchesAsFraction(Math.abs(diff));
  if (Math.abs(diff) <= 0.8) return "Inseam length should hit close to your usual length."; // ~2cm = 0.8in
  if (diff > 0.8) return `Inseam is ≈ ${diffStr} longer than your usual — expect extra length at the bottom.`;
  return `Inseam is ≈ ${diffStr} shorter than your usual — expect a shorter/ankle look.`;
}

function describeDressLength(dressLengthIn, heightIn) {
  // Ratio works the same in inches
  const ratio = dressLengthIn / heightIn;
  if (ratio < 0.45) return "Dress length reads as mini/above-knee on most people.";
  if (ratio < 0.55) return "Dress length reads as around-knee to midi.";
  if (ratio < 0.65) return "Dress length reads as midi (below knee).";
  return "Dress length reads as maxi/near ankle.";
}

/** -----------------------------
 * Tiny self-tests (optional)
 * Run locally: node lib/fitLogic.js
 * ------------------------------*/
function assert(cond, msg) {
  if (!cond) throw new Error("Test failed: " + msg);
}

function runTests() {
  // Upper body
  const user = { heightCm: 175, chestCm: 100, shoulderCm: 46 };
  const product = {
    category: "upper_body",
    name: "Oversized Tee",
    fitType: "oversized",
    fabricStretch: true,
    sizeChart: [
      { size: "S", measurements: { chest: "104 cm", shoulder: "46 cm", length: "66 cm" } },
      { size: "M", measurements: { chest: "110 cm", shoulder: "48 cm", length: "69 cm" } },
      { size: "L", measurements: { chest: "116 cm", shoulder: "50 cm", length: "72 cm" } },
    ],
  };
  const r = recommendSizeAndFit(user, product, {});
  assert(r.status === "OK", "upper body should return OK");
  assert(!!r.recommendedSize, "recommended size should exist");
  
  // Lower body
  const user2 = { heightCm: 170, waistCm: 86, hipsCm: 104, inseamCm: 78 };
  const jeans = {
    category: "lower_body",
    name: "Jeans",
    fitType: "regular",
    fabricStretch: false,
    sizeChart: [
      { size: "30", measurements: { waist: "80 cm", hips: "98 cm", inseam: "79 cm" } },
      { size: "32", measurements: { waist: "85 cm", hips: "103 cm", inseam: "80 cm" } },
      { size: "34", measurements: { waist: "90 cm", hips: "108 cm", inseam: "80 cm" } },
    ],
  };
  const r2 = recommendSizeAndFit(user2, jeans, {});
  assert(r2.status === "OK", "lower body should return OK");
  
  // Missing chart
  const r3 = recommendSizeAndFit(user2, { category: "lower_body", name: "No chart", sizeChart: [] }, {});
  assert(r3.status === "INSUFFICIENT_DATA", "missing chart should be insufficient");
}

// If executed directly (node), run tests
if (typeof require !== "undefined" && require.main === module) {
  runTests();
  // eslint-disable-next-line no-console
  console.log("✅ fitLogic.js tests passed");
}

module.exports = {
  recommendSizeAndFit,
  toInches,
  toCm: toInches, // Alias for backward compatibility
};


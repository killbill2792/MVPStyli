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
 * - User measurements are BODY measurements in CM
 * - Product chart measurements are GARMENT measurements in CM
 *
 * Safety:
 * - Strongly penalize "too small" (negative ease)
 * - Never claim exact results without key measurements present
 */

/** -----------------------------
 * Helpers
 * ------------------------------*/

/** Convert inches string/number to cm if needed; accepts "32", "32 in", "81cm", "81 cm" */
function toCm(val) {
  if (val == null) return null;
  if (typeof val === "number") return Number.isFinite(val) ? val : null;
  const s = String(val).trim().toLowerCase();
  if (!s) return null;
  
  // cm
  const cmMatch = s.match(/([\d.]+)\s*cm/);
  if (cmMatch) return safeNum(cmMatch[1]);
  
  // inches
  const inMatch = s.match(/([\d.]+)\s*(in|inch|inches|")/);
  if (inMatch) {
    const inches = safeNum(inMatch[1]);
    return inches == null ? null : inches * 2.54;
  }
  
  // raw number string -> assume cm
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

/** Normalize measurement keys from different sites */
function normalizeChartRow(row) {
  // Accept many naming variants
  const m = row.measurements || row.measurement || row;
  const out = {
    // Upper body
    chest: toCm(m.chest ?? m.bust ?? m.pit_to_pit ?? m["pit to pit"] ?? m["bust/chest"]),
    shoulder: toCm(m.shoulder ?? m.shoulders ?? m["shoulder width"]),
    sleeve: toCm(m.sleeve ?? m["sleeve length"] ?? m.arm),
    topLength: toCm(m.length ?? m["top length"] ?? m["shirt length"]),
    // Lower body
    waist: toCm(m.waist),
    hips: toCm(m.hips ?? m.hip),
    inseam: toCm(m.inseam ?? m["in seam"] ?? m["inside leg"]),
    outseam: toCm(m.outseam ?? m["out seam"] ?? m["outside leg"]),
    rise: toCm(m.rise ?? m["front rise"]),
    // Dresses
    dressLength: toCm(m["dress length"] ?? m.length ?? m["full length"]),
  };
  return out;
}

/** -----------------------------
 * Fit targets (ease) in CM
 * ------------------------------
 * Target garment measurement ≈ body measurement + desired ease
 * If fabricStretch = true, allow slightly less ease on waist/hips/chest.
 */
function getEaseProfile({ category, fitIntent, fabricStretch }) {
  // fitIntent: "snug" | "regular" | "relaxed" | "oversized"
  const intent = fitIntent || "regular";
  const stretch = !!fabricStretch;
  
  // Base ease ranges (CM)
  // NOTE: These are "typical" and intentionally conservative.
  const EASE = {
    upper_body: {
      chest: { snug: 6, regular: 10, relaxed: 16, oversized: 24 },
      shoulder: { snug: 0.5, regular: 1.5, relaxed: 3, oversized: 5 },
      sleeve: { snug: 0, regular: 0.5, relaxed: 1, oversized: 2 },
      length: { snug: 0, regular: 0, relaxed: 1, oversized: 2 },
    },
    lower_body: {
      waist: { snug: stretch ? 0 : 1, regular: stretch ? 1 : 2, relaxed: stretch ? 2 : 4, oversized: 6 },
      hips: { snug: 2, regular: 5, relaxed: 8, oversized: 12 },
      inseam: { snug: 0, regular: 0, relaxed: 0, oversized: 0 }, // inseam is length; not ease
      rise: { snug: 0, regular: 0, relaxed: 0, oversized: 0 },
    },
    dresses: {
      bust: { snug: 6, regular: 10, relaxed: 14, oversized: 18 },
      waist: { snug: stretch ? 0 : 2, regular: stretch ? 2 : 4, relaxed: 6, oversized: 10 },
      hips: { snug: 2, regular: 6, relaxed: 10, oversized: 14 },
      length: { snug: 0, regular: 0, relaxed: 1, oversized: 2 },
    },
  };
  
  const key = category === "dresses" ? "dresses" : category === "lower_body" ? "lower_body" : "upper_body";
  return { key, ease: EASE[key] };
}

/** -----------------------------
 * Required user measurements by category
 * ------------------------------*/
function requiredUserMeasurements(category) {
  if (category === "lower_body") return ["waistCm", "hipsCm", "inseamCm", "heightCm"];
  if (category === "dresses") return ["bustCm", "waistCm", "hipsCm", "heightCm"];
  return ["chestCm", "shoulderCm", "heightCm"]; // upper_body
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
  
  // Normalize user measurement selection
  const u = {
    heightCm: safeNum(user?.heightCm),
    weightKg: safeNum(user?.weightKg),
    chestCm: safeNum(user?.chestCm),
    bustCm: safeNum(user?.bustCm ?? user?.chestCm), // fallback
    waistCm: safeNum(user?.waistCm),
    hipsCm: safeNum(user?.hipsCm),
    shoulderCm: safeNum(user?.shoulderCm),
    inseamCm: safeNum(user?.inseamCm),
  };
  
  const requiredU = requiredUserMeasurements(category);
  const missingU = requiredU.filter((k) => u[k] == null);
  
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
  
  // Build targets
  const targets =
    key === "upper_body"
      ? {
          chest: u.chestCm + ease.chest[fitIntent],
          shoulder: u.shoulderCm != null ? u.shoulderCm + ease.shoulder[fitIntent] : null,
          sleeve: null,
          length: null,
        }
      : key === "lower_body"
      ? {
          waist: u.waistCm + ease.waist[fitIntent],
          hips: u.hipsCm + ease.hips[fitIntent],
          inseam: u.inseamCm, // target inseam = body inseam
          rise: null,
        }
      : {
          chest: u.bustCm + ease.bust[fitIntent],
          waist: u.waistCm + ease.waist[fitIntent],
          hips: u.hipsCm + ease.hips[fitIntent],
          length: null,
        };
  
  // Score each size row
  const scored = rows.map((r, idx) => {
    const m = r.m;
    let parts = [];
    
    if (key === "upper_body") {
      const chest = scoreMetric({ garment: m.chest, target: targets.chest, body: u.chestCm, hardTooSmallPenalty: 10 });
      const shoulder = u.shoulderCm != null && m.shoulder != null
        ? scoreMetric({ garment: m.shoulder, target: u.shoulderCm + ease.shoulder[fitIntent], body: u.shoulderCm, hardTooSmallPenalty: 6 })
        : { score: 0, valid: false };
      
      // weight chest most
      const score = chest.score * 2 + shoulder.score * 1;
      parts = [{ name: "chest", ...chest }, { name: "shoulder", ...shoulder }];
      return { idx, size: r.size, score, parts, m };
    }
    
    if (key === "lower_body") {
      const waist = scoreMetric({ garment: m.waist, target: targets.waist, body: u.waistCm, hardTooSmallPenalty: 12 });
      const hips = scoreMetric({ garment: m.hips, target: targets.hips, body: u.hipsCm, hardTooSmallPenalty: 10 });
      
      // waist slightly higher importance than hips for most bottoms
      const score = waist.score * 2 + hips.score * 1.5;
      parts = [{ name: "waist", ...waist }, { name: "hips", ...hips }];
      return { idx, size: r.size, score, parts, m };
    }
    
    // dresses
    const bust = scoreMetric({ garment: m.chest, target: targets.chest, body: u.bustCm, hardTooSmallPenalty: 10 });
    const waist = scoreMetric({ garment: m.waist, target: targets.waist, body: u.waistCm, hardTooSmallPenalty: 12 });
    const hips = scoreMetric({ garment: m.hips, target: targets.hips, body: u.hipsCm, hardTooSmallPenalty: 10 });
    const score = bust.score * 1.5 + waist.score * 1.5 + hips.score * 1.5;
    parts = [{ name: "bust", ...bust }, { name: "waist", ...waist }, { name: "hips", ...hips }];
    return { idx, size: r.size, score, parts, m };
  });
  
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  const second = scored[1] || null;
  
  // Risk + confidence
  // If any "too tight" note exists in best, raise risk.
  const tooTightCount = best.parts.filter((p) => p.note && p.note.toLowerCase().includes("too tight")).length;
  let risk = "low";
  if (tooTightCount >= 1) risk = "high";
  else if (best.score < 8) risk = "medium";
  
  // Confidence scale from score
  const rawConf = clamp(Math.round((best.score / 18) * 100), 0, 100);
  const confidence = risk === "high" ? Math.min(rawConf, 45) : risk === "medium" ? Math.min(rawConf, 70) : rawConf;
  
  // Insights: stylist-style
  const insights = [];
  insights.push(`Fit intent: ${fitIntent}${product.fabricStretch ? " (stretch fabric)" : ""}.`);
  
  if (key === "upper_body") {
    const chestEase = best.m.chest != null ? Math.round(best.m.chest - u.chestCm) : null;
    if (chestEase != null) {
      if (chestEase < 0) insights.push(`Chest will feel tight (≈ ${Math.abs(chestEase)}cm smaller than your chest).`);
      else insights.push(`Chest ease ≈ ${chestEase}cm (how roomy it will feel).`);
    }
    if (best.m.shoulder != null && u.shoulderCm != null) {
      const sh = Math.round(best.m.shoulder - u.shoulderCm);
      if (sh < 0) insights.push(`Shoulders may pull/feel narrow (≈ ${Math.abs(sh)}cm).`);
      else insights.push(`Shoulders look okay (≈ +${sh}cm).`);
    }
    if (best.m.topLength != null && u.heightCm != null) {
      insights.push(describeTopLength(best.m.topLength, u.heightCm));
    }
  }
  
  if (key === "lower_body") {
    if (best.m.waist != null) {
      const w = Math.round(best.m.waist - u.waistCm);
      if (w < 0) insights.push(`Waist will be tight (≈ ${Math.abs(w)}cm smaller than your waist).`);
      else insights.push(`Waist room ≈ +${w}cm.`);
    }
    if (best.m.hips != null) {
      const h = Math.round(best.m.hips - u.hipsCm);
      if (h < 0) insights.push(`Hip area may feel tight (≈ ${Math.abs(h)}cm).`);
      else insights.push(`Hip room ≈ +${h}cm.`);
    }
    if (best.m.inseam != null && u.inseamCm != null) {
      insights.push(describeInseam(best.m.inseam, u.inseamCm));
    }
  }
  
  if (key === "dresses") {
    if (best.m.chest != null) {
      const b = Math.round(best.m.chest - u.bustCm);
      insights.push(b < 0 ? `Bust will be tight (≈ ${Math.abs(b)}cm).` : `Bust ease ≈ +${b}cm.`);
    }
    if (best.m.waist != null) {
      const w = Math.round(best.m.waist - u.waistCm);
      insights.push(w < 0 ? `Waist will be tight (≈ ${Math.abs(w)}cm).` : `Waist ease ≈ +${w}cm.`);
    }
    if (best.m.hips != null) {
      const h = Math.round(best.m.hips - u.hipsCm);
      insights.push(h < 0 ? `Hip area may feel tight (≈ ${Math.abs(h)}cm).` : `Hip ease ≈ +${h}cm.`);
    }
    if (best.m.dressLength != null && u.heightCm != null) {
      insights.push(describeDressLength(best.m.dressLength, u.heightCm));
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
  
  return {
    status: "OK",
    recommendedSize: best.size,
    backupSize: backup,
    risk,
    confidence,
    insights,
    missing: [],
  };
}

/** -----------------------------
 * Length descriptions (simple & safe)
 * ------------------------------*/
function describeTopLength(garmentLengthCm, heightCm) {
  // Heuristic: top length vs height ratio
  const ratio = garmentLengthCm / heightCm;
  if (ratio < 0.28) return "Top length looks cropped (higher than typical hip length).";
  if (ratio < 0.33) return "Top length looks standard (around hip).";
  if (ratio < 0.37) return "Top length looks longer (covers more of hip/upper thigh).";
  return "Top length looks very long/oversized (likely covers upper thigh).";
}

function describeInseam(garmentInseamCm, bodyInseamCm) {
  const diff = Math.round(garmentInseamCm - bodyInseamCm);
  if (Math.abs(diff) <= 2) return "Inseam length should hit close to your usual length.";
  if (diff > 2) return `Inseam is ≈ ${diff}cm longer than your usual — expect extra length at the bottom.`;
  return `Inseam is ≈ ${Math.abs(diff)}cm shorter than your usual — expect a shorter/ankle look.`;
}

function describeDressLength(dressLengthCm, heightCm) {
  const ratio = dressLengthCm / heightCm;
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
  toCm,
};


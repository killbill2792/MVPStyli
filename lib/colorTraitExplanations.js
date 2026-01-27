/**
 * Color Trait Explanations
 * Provides human-readable explanations for Undertone, Depth, and Clarity
 * Used in "What this means" cards when users tap trait chips
 */

/**
 * Get explanation for Undertone
 */
export function getUndertoneExplanation(undertone, lean = null) {
  const isNeutral = undertone === 'neutral';
  const leanDirection = lean || 'warm'; // Default lean if neutral
  
  const definitions = {
    warm: {
      definition: "Your undertone is warm — your skin has a golden/peach base. Colors with warmth tend to make you look more alive.",
      bullet1: "Warm colors make your skin look brighter and healthier.",
      bullet2: "Icy/cool tones can make you look a bit grey or tired.",
      bullet3: "Choose creamy whites, warm browns, peachy pinks, olive greens.",
    },
    cool: {
      definition: "Your undertone is cool — your skin has a pink/rosy base. Cooler shades look more natural and balanced.",
      bullet1: "Cool colors make your skin look clearer and more even.",
      bullet2: "Very warm/yellow tones can make you look sallow or emphasize redness.",
      bullet3: "Choose crisp whites, charcoal/navy, berry pinks, blue-greens.",
    },
    neutral: {
      definition: `Your undertone is neutral (leans ${leanDirection}) — you can wear both, but you'll look best when colors lean slightly ${leanDirection}.`,
      bullet1: `Slightly ${leanDirection}-leaning colors make you look most balanced.`,
      bullet2: "Extreme warm or extreme icy can overpower you.",
      bullet3: "Choose balanced shades: soft white, cocoa/stone, muted rose, teal.",
    },
  };
  
  return definitions[undertone] || definitions.warm;
}

/**
 * Get explanation for Depth
 */
export function getDepthExplanation(depth) {
  const definitions = {
    light: {
      definition: "Your depth is light — very dark colors can overpower you, while lighter shades keep you open and fresh.",
      bullet1: "Right depth makes you look brighter; too-dark can create under-eye shadows.",
      bullet2: "Black/very dark can make you look tired.",
      bullet3: "Choose light-to-mid tones: soft beige, warm ivory, light teal.",
    },
    medium: {
      definition: "Your depth is medium — you handle mid-tones best, and extremes (very pale or very dark) need careful balance.",
      bullet1: "Balanced depth makes you look clear; extremes can make you look washed out or heavy.",
      bullet2: "Neon brights or stark white/black can feel harsh.",
      bullet3: "Choose mid tones: camel, olive, dusty blue, cocoa.",
    },
    deep: {
      definition: "Your depth is deep — richer, darker colors support your contrast and keep you looking strong and defined.",
      bullet1: "Deeper colors sharpen your features; too-light can look faded.",
      bullet2: "Very pale colors can drain you.",
      bullet3: "Choose rich tones: espresso, deep teal, aubergine, navy.",
    },
  };
  
  return definitions[depth] || definitions.medium;
}

/**
 * Get explanation for Clarity
 */
export function getClarityExplanation(clarity) {
  const definitions = {
    muted: {
      definition: "Your clarity is soft — slightly muted colors blend with you and make your skin look smoother.",
      bullet1: "Soft colors make you look calm, even, and naturally radiant.",
      bullet2: "Neon/very pure colors can look loud and overpower you.",
      bullet3: "Choose muted tones: dusty rose, sage, soft teal, warm taupe.",
    },
    soft: {
      definition: "Your clarity is soft — slightly muted colors blend with you and make your skin look smoother.",
      bullet1: "Soft colors make you look calm, even, and naturally radiant.",
      bullet2: "Neon/very pure colors can look loud and overpower you.",
      bullet3: "Choose muted tones: dusty rose, sage, soft teal, warm taupe.",
    },
    clear: {
      definition: "Your clarity is clear — cleaner, brighter colors make your face look sharper and more energized.",
      bullet1: "Clear colors make you look bright and defined.",
      bullet2: "Dusty/greyed colors can make you look dull or 'flat'.",
      bullet3: "Choose clean tones: coral, true teal, bright navy, clear red.",
    },
    bright: {
      definition: "Your clarity is clear — cleaner, brighter colors make your face look sharper and more energized.",
      bullet1: "Clear colors make you look bright and defined.",
      bullet2: "Dusty/greyed colors can make you look dull or 'flat'.",
      bullet3: "Choose clean tones: coral, true teal, bright navy, clear red.",
    },
    vivid: {
      definition: "Your clarity is clear — cleaner, brighter colors make your face look sharper and more energized.",
      bullet1: "Clear colors make you look bright and defined.",
      bullet2: "Dusty/greyed colors can make you look dull or 'flat'.",
      bullet3: "Choose clean tones: coral, true teal, bright navy, clear red.",
    },
  };
  
  // Normalize clarity values
  const normalizedClarity = clarity === 'muted' || clarity === 'soft' ? 'muted' : 'clear';
  return definitions[normalizedClarity] || definitions.clear;
}

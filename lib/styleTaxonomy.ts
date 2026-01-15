/**
 * Style Taxonomy - Comprehensive tag system for Style Twins matching
 * All tags are standardized and canonical - users select from these
 */

// ============================================
// STYLE TAXONOMY - 80+ tags across categories
// ============================================

export const STYLE_TAXONOMY = {
  // Style Aesthetics (most important for matching) - 30+ tags
  aesthetics: [
    'streetwear', 'minimalist', 'bohemian', 'goth', 'preppy', 'vintage',
    'elegant', 'casual', 'sporty', 'edgy', 'romantic', 'classic',
    'grunge', 'cottagecore', 'dark-academia', 'y2k', 'avant-garde',
    'normcore', 'athleisure', 'chic', 'glamorous', 'punk', 'retro',
    'artsy', 'androgynous', 'feminine', 'masculine', 'baddie', 'soft-girl',
    'e-girl', 'coastal', 'old-money', 'quiet-luxury', 'maximalist', 'eclectic'
  ],

  // Regional/Cultural Styles - 15+ tags
  regions: [
    'korean', 'japanese', 'indian', 'western', 'european', 'american',
    'french', 'italian', 'scandinavian', 'british', 'chinese',
    'middle-eastern', 'african', 'latin', 'mediterranean', 'aussie'
  ],

  // Occasions - 20+ tags
  occasions: [
    'party', 'formal', 'work', 'vacation', 'wedding', 'date',
    'beach', 'brunch', 'club', 'concert', 'interview', 'gym',
    'lounge', 'outdoor', 'everyday', 'festival', 'graduation',
    'business-casual', 'cocktail', 'black-tie', 'garden-party', 'travel'
  ],

  // Seasons
  seasons: ['summer', 'winter', 'spring', 'fall', 'transitional', 'all-season'],

  // Categories (garment types)
  categories: [
    'dress', 'top', 'bottom', 'outerwear', 'shoes', 'accessories',
    'jumpsuit', 'romper', 'skirt', 'pants', 'jeans', 'shorts',
    'jacket', 'coat', 'blazer', 'cardigan', 'sweater', 'hoodie',
    'blouse', 'shirt', 't-shirt', 'tank-top', 'crop-top', 'bodysuit',
    'suit', 'co-ord', 'activewear', 'swimwear', 'lingerie', 'sleepwear'
  ],

  // Colors
  colors: [
    'black', 'white', 'red', 'blue', 'green', 'pink', 'yellow',
    'orange', 'purple', 'brown', 'beige', 'grey', 'navy', 'teal',
    'coral', 'burgundy', 'olive', 'cream', 'gold', 'silver',
    'nude', 'blush', 'mint', 'lavender', 'rust', 'mustard', 'maroon'
  ],

  // Patterns/Prints
  patterns: [
    'floral', 'striped', 'plaid', 'polka-dot', 'animal-print', 'geometric',
    'solid', 'tie-dye', 'camo', 'paisley', 'abstract', 'tropical'
  ],

  // Materials
  materials: [
    'cotton', 'silk', 'linen', 'denim', 'leather', 'suede',
    'velvet', 'satin', 'chiffon', 'lace', 'wool', 'cashmere',
    'knit', 'mesh', 'sequin', 'faux-fur'
  ]
};

// Flatten all tags for easy lookup
export const ALL_STYLE_TAGS = [
  ...STYLE_TAXONOMY.aesthetics,
  ...STYLE_TAXONOMY.regions,
  ...STYLE_TAXONOMY.occasions,
  ...STYLE_TAXONOMY.seasons,
];

export const ALL_CATEGORY_TAGS = STYLE_TAXONOMY.categories;
export const ALL_COLOR_TAGS = STYLE_TAXONOMY.colors;
export const ALL_PATTERN_TAGS = STYLE_TAXONOMY.patterns;
export const ALL_MATERIAL_TAGS = STYLE_TAXONOMY.materials;

// Combined list of all selectable tags for UI
export const SELECTABLE_TAGS = {
  style: STYLE_TAXONOMY.aesthetics,
  region: STYLE_TAXONOMY.regions,
  occasion: STYLE_TAXONOMY.occasions,
  season: STYLE_TAXONOMY.seasons,
};

// ============================================
// SYNONYM MAPPING - For fuzzy matching
// ============================================

export const TAG_SYNONYMS: Record<string, string[]> = {
  // Aesthetics
  'streetwear': ['street wear', 'street style', 'urban', 'street fashion', 'hypebeast', 'hype'],
  'minimalist': ['minimal', 'simple', 'clean', 'understated', 'basic'],
  'bohemian': ['boho', 'boho-chic', 'hippie', 'free-spirited', 'gypsy'],
  'elegant': ['sophisticated', 'refined', 'classy', 'graceful', 'polished'],
  'casual': ['relaxed', 'laid-back', 'everyday', 'effortless', 'chill'],
  'vintage': ['retro', 'old-school', 'classic', 'throwback', 'thrift'],
  'sporty': ['athletic', 'activewear', 'sport', 'fitness', 'workout'],
  'goth': ['gothic', 'dark', 'emo', 'alt'],
  'preppy': ['ivy league', 'collegiate', 'country club', 'academia'],
  'romantic': ['feminine', 'soft', 'dreamy', 'delicate', 'girly'],
  'edgy': ['bold', 'fierce', 'rebellious', 'daring'],
  'chic': ['stylish', 'fashionable', 'trendy', 'posh'],
  'glamorous': ['glam', 'luxe', 'luxury', 'dazzling', 'stunning'],
  'athleisure': ['sporty-chic', 'athletic-casual', 'sport luxe'],
  'cottagecore': ['cottage', 'countryside', 'pastoral', 'rural'],
  'dark-academia': ['academic', 'scholarly', 'bookish'],
  'y2k': ['2000s', 'early 2000s', 'millennium'],
  'old-money': ['quiet luxury', 'understated luxury', 'heritage', 'timeless'],
  'quiet-luxury': ['stealth wealth', 'understated', 'subtle luxury'],
  
  // Regions
  'korean': ['k-style', 'k-fashion', 'korean fashion', 'k-pop', 'seoul style', 'hallyu'],
  'japanese': ['j-fashion', 'japan style', 'harajuku', 'tokyo fashion', 'j-style'],
  'indian': ['desi', 'south asian', 'ethnic', 'traditional indian'],
  'french': ['parisian', 'paris style', 'french girl'],
  'italian': ['milan style', 'milano'],
  'scandinavian': ['nordic', 'scandi', 'danish', 'swedish'],
  
  // Occasions
  'party': ['clubbing', 'night out', 'evening', 'celebration', 'going out'],
  'formal': ['business', 'professional', 'office', 'corporate', 'work formal'],
  'vacation': ['holiday', 'resort', 'getaway', 'trip'],
  'wedding': ['bridal', 'wedding guest', 'ceremony'],
  'date': ['date night', 'romantic dinner', 'special occasion'],
  'work': ['office', 'business', 'professional', 'corporate'],
  'beach': ['poolside', 'seaside', 'coastal', 'summer vacation'],
  'festival': ['music festival', 'coachella', 'rave'],
  
  // Categories
  'dress': ['dresses', 'frock', 'gown', 'midi', 'maxi', 'mini dress'],
  'top': ['tops', 'upper', 'upper wear', 'upperwear'],
  'bottom': ['bottoms', 'lower', 'lower wear', 'lowerwear'],
  'outerwear': ['outer', 'jacket', 'coat', 'layering'],
  'jumpsuit': ['romper', 'one-piece', 'playsuit'],
  'jeans': ['denim', 'denim pants'],
  'hoodie': ['hooded', 'sweatshirt'],
  't-shirt': ['tee', 'tshirt'],
  'sweater': ['pullover', 'jumper', 'knitwear'],
};

// ============================================
// TAG INFERENCE FUNCTION
// ============================================

interface InferredTags {
  tags: string[];
  colors: string[];
  category: string | null;
  patterns: string[];
}

/**
 * Infer standardized tags from product data
 * This is the core function that extracts our taxonomy tags from any product
 */
export function inferTagsFromProduct(product: {
  name?: string;
  title?: string;
  description?: string;
  category?: string;
  color?: string;
  material?: string;
  query?: string; // The search query used to find this product
  tags?: string[]; // Existing tags (from admin uploads)
}): InferredTags {
  // If product already has our standardized tags, use them
  if (product.tags && product.tags.length > 0) {
    const validTags = product.tags.filter(t => ALL_STYLE_TAGS.includes(t.toLowerCase()));
    if (validTags.length > 0) {
      return {
        tags: validTags,
        colors: product.color ? [product.color.toLowerCase()] : [],
        category: product.category || null,
        patterns: []
      };
    }
  }

  // Combine all available text for analysis
  const searchText = [
    product.name,
    product.title,
    product.description,
    product.query,
    product.material
  ].filter(Boolean).join(' ').toLowerCase();

  const inferredTags: Set<string> = new Set();
  const inferredColors: Set<string> = new Set();
  const inferredPatterns: Set<string> = new Set();
  let inferredCategory: string | null = null;

  // Helper to check text and synonyms
  const matchTag = (tag: string, text: string): boolean => {
    if (text.includes(tag)) return true;
    const synonyms = TAG_SYNONYMS[tag];
    if (synonyms) {
      return synonyms.some(syn => text.includes(syn));
    }
    return false;
  };

  // 1. Match aesthetics
  for (const tag of STYLE_TAXONOMY.aesthetics) {
    if (matchTag(tag, searchText)) {
      inferredTags.add(tag);
    }
  }

  // 2. Match regions
  for (const tag of STYLE_TAXONOMY.regions) {
    if (matchTag(tag, searchText)) {
      inferredTags.add(tag);
    }
  }

  // 3. Match occasions
  for (const tag of STYLE_TAXONOMY.occasions) {
    if (matchTag(tag, searchText)) {
      inferredTags.add(tag);
    }
  }

  // 4. Match seasons
  for (const tag of STYLE_TAXONOMY.seasons) {
    if (matchTag(tag, searchText)) {
      inferredTags.add(tag);
    }
  }

  // 5. Match colors
  const colorSource = (product.color || '').toLowerCase() + ' ' + searchText;
  for (const color of STYLE_TAXONOMY.colors) {
    if (colorSource.includes(color)) {
      inferredColors.add(color);
    }
  }

  // 6. Match patterns
  for (const pattern of STYLE_TAXONOMY.patterns) {
    if (searchText.includes(pattern)) {
      inferredPatterns.add(pattern);
    }
  }

  // 7. Determine category
  const categorySource = (product.category || '').toLowerCase() + ' ' + searchText;
  for (const cat of STYLE_TAXONOMY.categories) {
    if (matchTag(cat, categorySource)) {
      inferredCategory = cat;
      break;
    }
  }

  // If no category found, try to infer from common patterns
  if (!inferredCategory) {
    if (categorySource.includes('dress') || categorySource.includes('gown')) {
      inferredCategory = 'dress';
    } else if (categorySource.includes('shirt') || categorySource.includes('blouse') || categorySource.includes('top')) {
      inferredCategory = 'top';
    } else if (categorySource.includes('pant') || categorySource.includes('jean') || categorySource.includes('trouser')) {
      inferredCategory = 'bottom';
    } else if (categorySource.includes('jacket') || categorySource.includes('coat')) {
      inferredCategory = 'outerwear';
    }
  }

  return {
    tags: Array.from(inferredTags),
    colors: Array.from(inferredColors),
    category: inferredCategory,
    patterns: Array.from(inferredPatterns)
  };
}

/**
 * Normalize a user-entered tag to canonical form
 */
export function normalizeTag(tag: string): string | null {
  const lower = tag.toLowerCase().trim();
  
  // Direct match
  if (ALL_STYLE_TAGS.includes(lower)) {
    return lower;
  }
  
  // Check synonyms
  for (const [canonical, synonyms] of Object.entries(TAG_SYNONYMS)) {
    if (lower === canonical || synonyms.includes(lower)) {
      return canonical;
    }
  }
  
  return null; // No match found
}

/**
 * Get suggested tags for a product (for UI display)
 */
export function getSuggestedTags(product: any): string[] {
  const inferred = inferTagsFromProduct(product);
  return inferred.tags;
}

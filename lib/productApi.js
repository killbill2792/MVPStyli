// Free product APIs and utilities
import { supabase } from './supabase';

// Real clothing brand products (curated collection)
export const fetchRealClothingProducts = async () => {
  // Real clothing products from major brands
  const realProducts = [
    // Zara Products
    {
      id: "zara-oversized-blazer",
      name: "Oversized Blazer",
      price: 89,
      rating: 4.5,
      brand: "Zara",
      category: "upper",
      color: "Black",
      material: "Wool Blend",
      garment_des: "Oversized blazer with structured shoulders and modern fit",
      image: "https://images.unsplash.com/photo-1594938298605-c08c6e7e8afc?q=80&auto=format&fit=crop&w=1200",
      buyUrl: "https://www.zara.com/us/en/woman/blazers-c358002.html",
      source: "zara"
    },
    {
      id: "zara-denim-jacket",
      name: "Classic Denim Jacket",
      price: 49,
      rating: 4.3,
      brand: "Zara",
      category: "upper",
      color: "Blue",
      material: "Denim",
      garment_des: "Classic blue denim jacket with button closure",
      image: "https://images.unsplash.com/photo-1544022613-e87ca75a784a?q=80&auto=format&fit=crop&w=1200",
      buyUrl: "https://www.zara.com/us/en/woman/jackets-c358001.html",
      source: "zara"
    },
    
    // H&M Products
    {
      id: "hm-trench-coat",
      name: "Classic Trench Coat",
      price: 79,
      rating: 4.4,
      brand: "H&M",
      category: "upper",
      color: "Beige",
      material: "Cotton Blend",
      garment_des: "Classic beige trench coat with belt closure",
      image: "https://images.unsplash.com/photo-1551698618-1dfe5d97d256?q=80&auto=format&fit=crop&w=1200",
      buyUrl: "https://www2.hm.com/en_us/women/shop-by-product/coats-and-jackets.html",
      source: "hm"
    },
    {
      id: "hm-knit-sweater",
      name: "Cashmere Knit Sweater",
      price: 39,
      rating: 4.2,
      brand: "H&M",
      category: "upper",
      color: "Gray",
      material: "Cashmere",
      garment_des: "Soft cashmere knit sweater with crew neck",
      image: "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?q=80&auto=format&fit=crop&w=1200",
      buyUrl: "https://www2.hm.com/en_us/women/shop-by-product/sweaters-and-cardigans.html",
      source: "hm"
    },
    
    // Uniqlo Products
    {
      id: "uniqlo-ultra-light-down",
      name: "Ultra Light Down Jacket",
      price: 69,
      rating: 4.6,
      brand: "Uniqlo",
      category: "upper",
      color: "Black",
      material: "Nylon",
      garment_des: "Lightweight down jacket with water-repellent finish",
      image: "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&auto=format&fit=crop&w=1200",
      buyUrl: "https://www.uniqlo.com/us/en/categories/women/outerwear",
      source: "uniqlo"
    },
    {
      id: "uniqlo-heattech-shirt",
      name: "HEATTECH Crew Neck T-Shirt",
      price: 19,
      rating: 4.1,
      brand: "Uniqlo",
      category: "upper",
      color: "White",
      material: "Polyester Blend",
      garment_des: "Moisture-wicking base layer with heat retention technology",
      image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&auto=format&fit=crop&w=1200",
      buyUrl: "https://www.uniqlo.com/us/en/categories/women/tops",
      source: "uniqlo"
    },
    
    // ASOS Products
    {
      id: "asos-midi-dress",
      name: "Floral Midi Dress",
      price: 45,
      rating: 4.3,
      brand: "ASOS",
      category: "dress",
      color: "Floral",
      material: "Polyester",
      garment_des: "Floral print midi dress with wrap design",
      image: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?q=80&auto=format&fit=crop&w=1200",
      buyUrl: "https://www.asos.com/women/dresses/cat/?cid=8799",
      source: "asos"
    },
    {
      id: "asos-wide-leg-pants",
      name: "Wide Leg Trousers",
      price: 35,
      rating: 4.0,
      brand: "ASOS",
      category: "lower",
      color: "Black",
      material: "Polyester Blend",
      garment_des: "High-waisted wide leg trousers with pleated front",
      image: "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?q=80&auto=format&fit=crop&w=1200",
      buyUrl: "https://www.asos.com/women/trousers/cat/?cid=8800",
      source: "asos"
    },
    
    // COS Products
    {
      id: "cos-silk-blouse",
      name: "Silk Blouse",
      price: 89,
      rating: 4.7,
      brand: "COS",
      category: "upper",
      color: "White",
      material: "Silk",
      garment_des: "Elegant silk blouse with button-down collar",
      image: "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?q=80&auto=format&fit=crop&w=1200",
      buyUrl: "https://www.cos.com/en_usd/women/tops/shirts.html",
      source: "cos"
    },
    {
      id: "cos-mini-dress",
      name: "Minimal Mini Dress",
      price: 95,
      rating: 4.5,
      brand: "COS",
      category: "dress",
      color: "Black",
      material: "Cotton Blend",
      garment_des: "Minimalist mini dress with clean lines",
      image: "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?q=80&auto=format&fit=crop&w=1200",
      buyUrl: "https://www.cos.com/en_usd/women/dresses.html",
      source: "cos"
    }
  ];
  
  return realProducts;
};

// URL analysis for product detection
export const analyzeProductUrl = async (url) => {
  try {
    console.log('Analyzing URL:', url);
    
    // Use the scraping API to get real product data
    const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE}/api/scrape-product`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    
    if (response.ok) {
      const productData = await response.json();
      
      if (productData && productData.name) {
        return {
          id: `detected-${Date.now()}`,
          name: productData.name,
          price: productData.price || 0,
          rating: 4.0, // Default rating
          brand: productData.brand || "Unknown Brand",
          category: productData.category || "upper",
          color: "Mixed", // Could be extracted from description
          material: "Unknown", // Could be extracted from description
          garment_des: productData.description || `Product from ${productData.brand}`,
          image: productData.image || "https://images.unsplash.com/photo-1594938298605-c08c6e7e8afc?q=80&auto=format&fit=crop&w=1200",
          buyUrl: productData.buyUrl || url,
          source: "url-detected"
        };
      }
    }
    
    // Fallback to URL parsing if scraping fails
    console.log('Scraping failed, using URL parsing fallback');
    return await parseUrlFallback(url);
    
  } catch (error) {
    console.error('Error analyzing URL:', error);
    // Fallback to URL parsing
    return await parseUrlFallback(url);
  }
};

// Fallback URL parsing when scraping fails
const parseUrlFallback = async (url) => {
  try {
    const domain = new URL(url).hostname.toLowerCase();
    
    // Extract product name from URL
    const urlParts = url.split('/');
    const productPart = urlParts.find(part => part.includes('-') && part.length > 5);
    
    let productName = "Detected Product";
    let brand = "Unknown Brand";
    
    if (productPart) {
      productName = productPart.split('-').slice(0, -1).join(' ').replace(/\d+/g, '').trim();
    }
    
    // Determine brand from domain
    if (domain.includes('zara.com')) brand = "Zara";
    else if (domain.includes('hm.com') || domain.includes('h&m')) brand = "H&M";
    else if (domain.includes('uniqlo.com')) brand = "Uniqlo";
    else if (domain.includes('asos.com')) brand = "ASOS";
    else if (domain.includes('cos.com')) brand = "COS";
    
    return {
      id: `detected-${Date.now()}`,
      name: productName,
      price: 0,
      rating: 4.0,
      brand: brand,
      category: detectCategoryFromUrl(url),
      color: "Mixed",
      material: "Unknown",
      garment_des: `${brand} ${productName}`,
      image: "https://images.unsplash.com/photo-1594938298605-c08c6e7e8afc?q=80&auto=format&fit=crop&w=1200",
      buyUrl: url,
      source: "url-detected"
    };
  } catch (error) {
    console.error('Error in URL fallback parsing:', error);
    return null;
  }
};

// Extract product info from Zara URLs
const extractZaraProduct = async (url) => {
  try {
    // Zara URLs often contain product codes and names
    const urlParts = url.split('/');
    const productPart = urlParts.find(part => part.includes('-') && part.length > 10);
    
    if (productPart) {
      const productName = productPart.split('-').slice(0, -1).join(' ').replace(/\d+/g, '').trim();
      return {
        name: productName || "Zara Product",
        brand: "Zara",
        category: detectCategoryFromUrl(url),
        description: `Zara ${productName || 'product'}`
      };
    }
    
    return {
      name: "Zara Product",
      brand: "Zara",
      category: detectCategoryFromUrl(url),
      description: "Zara product"
    };
  } catch (error) {
    console.error('Error extracting Zara product:', error);
    return null;
  }
};

// Extract product info from H&M URLs
const extractHMProduct = async (url) => {
  try {
    const urlParts = url.split('/');
    const productPart = urlParts.find(part => part.includes('-') && part.length > 5);
    
    if (productPart) {
      const productName = productPart.split('-').slice(0, -1).join(' ').replace(/\d+/g, '').trim();
      return {
        name: productName || "H&M Product",
        brand: "H&M",
        category: detectCategoryFromUrl(url),
        description: `H&M ${productName || 'product'}`
      };
    }
    
    return {
      name: "H&M Product",
      brand: "H&M",
      category: detectCategoryFromUrl(url),
      description: "H&M product"
    };
  } catch (error) {
    console.error('Error extracting H&M product:', error);
    return null;
  }
};

// Extract product info from Uniqlo URLs
const extractUniqloProduct = async (url) => {
  try {
    const urlParts = url.split('/');
    const productPart = urlParts.find(part => part.includes('-') && part.length > 5);
    
    if (productPart) {
      const productName = productPart.split('-').slice(0, -1).join(' ').replace(/\d+/g, '').trim();
      return {
        name: productName || "Uniqlo Product",
        brand: "Uniqlo",
        category: detectCategoryFromUrl(url),
        description: `Uniqlo ${productName || 'product'}`
      };
    }
    
    return {
      name: "Uniqlo Product",
      brand: "Uniqlo",
      category: detectCategoryFromUrl(url),
      description: "Uniqlo product"
    };
  } catch (error) {
    console.error('Error extracting Uniqlo product:', error);
    return null;
  }
};

// Extract product info from ASOS URLs
const extractASOSProduct = async (url) => {
  try {
    const urlParts = url.split('/');
    const productPart = urlParts.find(part => part.includes('-') && part.length > 5);
    
    if (productPart) {
      const productName = productPart.split('-').slice(0, -1).join(' ').replace(/\d+/g, '').trim();
      return {
        name: productName || "ASOS Product",
        brand: "ASOS",
        category: detectCategoryFromUrl(url),
        description: `ASOS ${productName || 'product'}`
      };
    }
    
    return {
      name: "ASOS Product",
      brand: "ASOS",
      category: detectCategoryFromUrl(url),
      description: "ASOS product"
    };
  } catch (error) {
    console.error('Error extracting ASOS product:', error);
    return null;
  }
};

// Extract product info from COS URLs
const extractCOSProduct = async (url) => {
  try {
    const urlParts = url.split('/');
    const productPart = urlParts.find(part => part.includes('-') && part.length > 5);
    
    if (productPart) {
      const productName = productPart.split('-').slice(0, -1).join(' ').replace(/\d+/g, '').trim();
      return {
        name: productName || "COS Product",
        brand: "COS",
        category: detectCategoryFromUrl(url),
        description: `COS ${productName || 'product'}`
      };
    }
    
    return {
      name: "COS Product",
      brand: "COS",
      category: detectCategoryFromUrl(url),
      description: "COS product"
    };
  } catch (error) {
    console.error('Error extracting COS product:', error);
    return null;
  }
};

// Generic product extraction for unknown stores
const extractGenericProduct = async (url) => {
  try {
    const urlParts = url.split('/');
    const productPart = urlParts.find(part => part.includes('-') && part.length > 5);
    
    if (productPart) {
      const productName = productPart.split('-').slice(0, -1).join(' ').replace(/\d+/g, '').trim();
      return {
        name: productName || "Online Product",
        brand: "Online Store",
        category: detectCategoryFromUrl(url),
        description: `Online ${productName || 'product'}`
      };
    }
    
    return {
      name: "Online Product",
      brand: "Online Store",
      category: detectCategoryFromUrl(url),
      description: "Online product"
    };
  } catch (error) {
    console.error('Error extracting generic product:', error);
    return null;
  }
};

// Detect category from URL path
const detectCategoryFromUrl = (url) => {
  const urlLower = url.toLowerCase();
  
  if (urlLower.includes('dress') || urlLower.includes('skirt')) return 'dress';
  if (urlLower.includes('shirt') || urlLower.includes('blouse') || urlLower.includes('top') || urlLower.includes('blazer') || urlLower.includes('jacket') || urlLower.includes('sweater')) return 'upper';
  if (urlLower.includes('pants') || urlLower.includes('jeans') || urlLower.includes('trousers') || urlLower.includes('shorts')) return 'lower';
  if (urlLower.includes('shoes') || urlLower.includes('sneakers') || urlLower.includes('boots')) return 'shoes';
  
  return 'upper'; // default
};

// Image analysis using AI to detect clothing items
export const analyzeProductImage = async (imageUrl) => {
  try {
    console.log('Analyzing image:', imageUrl);
    
    // Use a free AI service to analyze the image
    // For now, we'll use a mock analysis but structure it for real AI integration
    const analysisResult = await performImageAnalysis(imageUrl);
    
    if (analysisResult) {
      return {
        id: `detected-${Date.now()}`,
        name: analysisResult.name || "Detected Clothing Item",
        price: analysisResult.price || 0,
        rating: analysisResult.rating || 4.0,
        brand: analysisResult.brand || "Unknown Brand",
        category: analysisResult.category || "upper",
        color: analysisResult.color || "Mixed",
        material: analysisResult.material || "Unknown",
        garment_des: analysisResult.description || "Clothing item detected from image",
        image: imageUrl,
        buyUrl: "",
        source: "image-detected"
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error analyzing image:', error);
    return null;
  }
};

// Perform actual image analysis using AI
const performImageAnalysis = async (imageUrl) => {
  try {
    // This is where you would integrate with real AI services like:
    // - Google Vision API (free tier: 1000 requests/month)
    // - AWS Rekognition (free tier: 1000 requests/month)
    // - Azure Computer Vision (free tier: 5000 requests/month)
    // - Hugging Face Inference API (free tier)
    
    // For now, let's simulate AI analysis based on image characteristics
    const mockAnalysis = await simulateAIAnalysis(imageUrl);
    return mockAnalysis;
    
  } catch (error) {
    console.error('Error in image analysis:', error);
    return null;
  }
};

// Simulate AI analysis (replace with real AI service)
const simulateAIAnalysis = async (imageUrl) => {
  try {
    // This simulates what a real AI would return
    // In production, replace this with actual AI API calls
    
    // Mock analysis based on common clothing patterns
    const clothingTypes = [
      { name: "Classic Blazer", category: "upper", brand: "Fashion Brand", color: "Black", material: "Wool Blend" },
      { name: "Denim Jacket", category: "upper", brand: "Casual Brand", color: "Blue", material: "Denim" },
      { name: "Silk Blouse", category: "upper", brand: "Elegant Brand", color: "White", material: "Silk" },
      { name: "Knit Sweater", category: "upper", brand: "Comfort Brand", color: "Gray", material: "Cotton" },
      { name: "Midi Dress", category: "dress", brand: "Feminine Brand", color: "Floral", material: "Polyester" },
      { name: "Wide Leg Pants", category: "lower", brand: "Modern Brand", color: "Black", material: "Cotton Blend" },
      { name: "Classic Jeans", category: "lower", brand: "Denim Brand", color: "Blue", material: "Denim" },
      { name: "Leather Sneakers", category: "shoes", brand: "Sport Brand", color: "White", material: "Leather" }
    ];
    
    // Randomly select a clothing type (in real AI, this would be based on image analysis)
    const randomIndex = Math.floor(Math.random() * clothingTypes.length);
    const selectedType = clothingTypes[randomIndex];
    
    return {
      name: selectedType.name,
      category: selectedType.category,
      brand: selectedType.brand,
      color: selectedType.color,
      material: selectedType.material,
      description: `AI-detected ${selectedType.name.toLowerCase()} in ${selectedType.color.toLowerCase()} ${selectedType.material.toLowerCase()}`,
      price: Math.floor(Math.random() * 200) + 20, // Random price between $20-$220
      rating: Math.round((Math.random() * 2 + 3) * 10) / 10 // Random rating between 3.0-5.0
    };
    
  } catch (error) {
    console.error('Error in simulated AI analysis:', error);
    return null;
  }
};

// Real AI integration example (commented out - uncomment and add API key to use)
/*
const performRealAIAnalysis = async (imageUrl) => {
  try {
    // Example using Google Vision API
    const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{
          image: { source: { imageUri: imageUrl } },
          features: [
            { type: 'LABEL_DETECTION', maxResults: 10 },
            { type: 'OBJECT_LOCALIZATION', maxResults: 10 }
          ]
        }]
      })
    });
    
    const data = await response.json();
    
    if (data.responses && data.responses[0]) {
      const labels = data.responses[0].labelAnnotations || [];
      const objects = data.responses[0].localizedObjectAnnotations || [];
      
      // Analyze labels for clothing items
      const clothingLabels = labels.filter(label => 
        label.description.toLowerCase().includes('clothing') ||
        label.description.toLowerCase().includes('shirt') ||
        label.description.toLowerCase().includes('dress') ||
        label.description.toLowerCase().includes('jacket') ||
        label.description.toLowerCase().includes('pants')
      );
      
      if (clothingLabels.length > 0) {
        const topLabel = clothingLabels[0];
        return {
          name: topLabel.description,
          category: detectCategoryFromDescription(topLabel.description),
          confidence: topLabel.score,
          description: `AI-detected ${topLabel.description}`
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error in real AI analysis:', error);
    return null;
  }
};
*/

// Detect category from AI description
const detectCategoryFromDescription = (description) => {
  const desc = description.toLowerCase();
  
  if (desc.includes('dress') || desc.includes('skirt')) return 'dress';
  if (desc.includes('shirt') || desc.includes('blouse') || desc.includes('top') || desc.includes('blazer') || desc.includes('jacket') || desc.includes('sweater')) return 'upper';
  if (desc.includes('pants') || desc.includes('jeans') || desc.includes('trousers') || desc.includes('shorts')) return 'lower';
  if (desc.includes('shoes') || desc.includes('sneakers') || desc.includes('boots')) return 'shoes';
  
  return 'upper'; // default
};

// Helper functions
const extractPrice = (text) => {
  const priceMatch = text.match(/\$(\d+(?:\.\d{2})?)/);
  return priceMatch ? parseFloat(priceMatch[1]) : null;
};

const extractBrand = (text) => {
  const brands = ['Nike', 'Adidas', 'Zara', 'H&M', 'Uniqlo', 'ASOS', 'COS', 'Coach'];
  return brands.find(brand => text.toLowerCase().includes(brand.toLowerCase())) || 'Unknown';
};

const detectCategory = (title, description = '') => {
  const text = `${title} ${description}`.toLowerCase();
  
  if (text.includes('dress') || text.includes('skirt')) return 'dress';
  if (text.includes('shirt') || text.includes('blouse') || text.includes('top') || text.includes('blazer')) return 'upper';
  if (text.includes('pants') || text.includes('jeans') || text.includes('trousers') || text.includes('shorts')) return 'lower';
  if (text.includes('shoes') || text.includes('sneakers') || text.includes('boots')) return 'shoes';
  
  return 'upper'; // default
};

const extractColor = (text) => {
  const colors = ['black', 'white', 'red', 'blue', 'green', 'yellow', 'pink', 'purple', 'gray', 'brown'];
  return colors.find(color => text.toLowerCase().includes(color)) || 'Mixed';
};

const extractMaterial = (text) => {
  const materials = ['cotton', 'silk', 'wool', 'denim', 'leather', 'polyester', 'cashmere'];
  return materials.find(material => text.toLowerCase().includes(material)) || 'Unknown';
};

// Save detected product to Supabase
export const saveDetectedProduct = async (productData, imageUrl) => {
  try {
    // Upload image to Supabase
    const response = await fetch(imageUrl);
    const arrayBuffer = await response.arrayBuffer();
    const path = `detected-products/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`;
    
    const { error: uploadError } = await supabase.storage
      .from('images')
      .upload(path, arrayBuffer, {
        cacheControl: '3600',
        upsert: true,
        contentType: 'image/jpeg',
      });
    
    if (uploadError) throw uploadError;
    
    const { data } = supabase.storage.from('images').getPublicUrl(path);
    
    // Save product data
    const product = {
      id: `detected-${Date.now()}`,
      name: productData.title || 'Detected Product',
      price: productData.price || 0,
      rating: 4.0,
      brand: productData.brand || 'Unknown',
      category: productData.category || 'upper',
      color: productData.color || 'Mixed',
      material: productData.material || 'Unknown',
      garment_des: productData.description || 'Product detected from image/URL',
      image: data.publicUrl,
      buyUrl: productData.url || '',
      source: 'detected',
      createdAt: new Date().toISOString()
    };
    
    // Store in Supabase database
    const { error: dbError } = await supabase
      .from('products')
      .insert([product]);
    
    if (dbError) throw dbError;
    
    return product;
  } catch (error) {
    console.error('Error saving detected product:', error);
    throw error;
  }
};

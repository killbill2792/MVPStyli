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
    // For now, return a mock product structure for testing
    // In production, you would integrate with OpenGraph API or web scraping
    const mockProduct = {
      id: `detected-${Date.now()}`,
      name: "Detected Product",
      price: 89,
      rating: 4.2,
      brand: "Detected Brand",
      category: "upper", // Default to upper, can be improved with AI
      color: "Mixed",
      material: "Unknown",
      garment_des: "Product detected from URL - " + url,
      image: "https://images.unsplash.com/photo-1594938298605-c08c6e7e8afc?q=80&auto=format&fit=crop&w=1200", // Default image
      buyUrl: url,
      source: "url-detected"
    };
    
    return mockProduct;
  } catch (error) {
    console.error('Error analyzing URL:', error);
    return null;
  }
};

// Image analysis using free APIs
export const analyzeProductImage = async (imageUrl) => {
  try {
    // Using Hugging Face's free inference API
    const response = await fetch('https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-base', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer YOUR_HF_TOKEN', // Free token
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: imageUrl,
        parameters: {
          max_length: 100,
          num_beams: 4
        }
      })
    });
    
    const result = await response.json();
    
    if (result && result[0]) {
      const caption = result[0].generated_text;
      return {
        description: caption,
        category: detectCategory(caption),
        color: extractColor(caption),
        material: extractMaterial(caption)
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error analyzing image:', error);
    return null;
  }
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

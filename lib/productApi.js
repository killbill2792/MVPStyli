// Free product APIs and utilities
import { supabase } from './supabase';

// Fake Store API integration
export const fetchFakeStoreProducts = async () => {
  try {
    const response = await fetch('https://fakestoreapi.com/products');
    const products = await response.json();
    
    // Transform to our format
    return products.map(product => ({
      id: `fake-${product.id}`,
      name: product.title,
      price: Math.round(product.price),
      rating: Math.round(product.rating.rate * 10) / 10,
      brand: 'Fake Store',
      category: product.category === 'men\'s clothing' ? 'upper' : 
                product.category === 'women\'s clothing' ? 'upper' : 'lower',
      color: 'Mixed',
      material: 'Unknown',
      garment_des: product.description,
      image: product.image,
      buyUrl: `https://fakestoreapi.com/products/${product.id}`,
      source: 'fake-store'
    }));
  } catch (error) {
    console.error('Error fetching fake store products:', error);
    return [];
  }
};

// URL analysis for product detection
export const analyzeProductUrl = async (url) => {
  try {
    // Extract OpenGraph data
    const response = await fetch(`https://api.opengraph.io/v1.1/site/${encodeURIComponent(url)}?app_id=your_app_id`);
    const data = await response.json();
    
    if (data.hybridGraph) {
      return {
        title: data.hybridGraph.title,
        description: data.hybridGraph.description,
        image: data.hybridGraph.image,
        price: extractPrice(data.hybridGraph.description),
        brand: extractBrand(data.hybridGraph.title),
        category: detectCategory(data.hybridGraph.title, data.hybridGraph.description)
      };
    }
    
    return null;
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

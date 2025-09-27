import { supabase } from './supabase';

export async function uploadImageAsync(localUri: string, prefix = 'images') {
  try {
    const res = await fetch(localUri);
    const blob = await res.blob();
    const name = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
    
    const { data, error } = await supabase.storage.from('images').upload(name, blob, { 
      contentType: 'image/jpeg' 
    });
    
    if (error) throw error;
    
    const { data: publicData } = supabase.storage.from('images').getPublicUrl(data.path);
    return publicData.publicUrl;
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
}

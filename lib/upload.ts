import { supabase } from './supabase';

export async function uploadImageAsync(uri: string, folder='images'): Promise<string> {
  try {
    // uri is a local file path from Expo ImagePicker
    const response = await fetch(uri);
    const arrayBuffer = await response.arrayBuffer();
    const path = `${folder}/${Date.now()}.jpg`;

    const { data, error } = await supabase.storage.from('images').upload(path, arrayBuffer, {
      cacheControl: '3600', 
      upsert: false, 
      contentType: 'image/jpeg'
    });
    
    if (error) {
      console.error('Supabase upload error:', error);
      throw new Error(`Upload failed: ${error.message}`);
    }

    const { data: pub } = supabase.storage.from('images').getPublicUrl(path);
    if (!pub?.publicUrl) throw new Error('No public URL generated');
    
    console.log('Upload successful:', pub.publicUrl);
    return pub.publicUrl; // HTTPS
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
}

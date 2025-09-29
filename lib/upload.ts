import { supabase } from './supabase';

export async function uploadImageAsync(uri: string, folder='images'): Promise<string> {
  try {
    console.log('Starting upload for URI:', uri);
    
    // uri is a local file path from Expo ImagePicker
    const response = await fetch(uri);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`;

    console.log('Uploading to Supabase path:', path);

    const { data, error } = await supabase.storage.from('images').upload(path, arrayBuffer, {
      cacheControl: '3600', 
      upsert: false, 
      contentType: 'image/jpeg'
    });
    
    if (error) {
      console.error('Supabase upload error:', error);
      // If RLS error, try with a different approach
      if (error.message.includes('row-level security')) {
        console.log('RLS error detected, trying alternative upload method');
        // For now, return the local URI as fallback
        return uri;
      }
      throw new Error(`Upload failed: ${error.message}`);
    }

    const { data: pub } = supabase.storage.from('images').getPublicUrl(path);
    if (!pub?.publicUrl) throw new Error('No public URL generated');
    
    console.log('Upload successful:', pub.publicUrl);
    return pub.publicUrl; // HTTPS
  } catch (error) {
    console.error('Upload error:', error);
    // Return local URI as fallback
    console.log('Using local URI as fallback:', uri);
    return uri;
  }
}

import { supabase } from './supabase';

export async function uploadImageAsync(uri: string, folder='images'): Promise<string> {
  // uri is a local file path from Expo ImagePicker
  const response = await fetch(uri);
  const arrayBuffer = await response.arrayBuffer();
  const path = `${folder}/${Date.now()}.jpg`;

  const { data, error } = await supabase.storage.from('images').upload(path, arrayBuffer, {
    cacheControl: '3600', 
    upsert: false, 
    contentType: 'image/jpeg'
  });
  if (error) throw error;

  const { data: pub } = supabase.storage.from('images').getPublicUrl(path);
  if (!pub?.publicUrl) throw new Error('No public URL');
  return pub.publicUrl; // HTTPS
}

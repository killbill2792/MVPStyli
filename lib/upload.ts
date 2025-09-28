import { supabase } from './supabase';

export async function uploadImageAsync(uri: string, folder='images'): Promise<string> {
  // uri is a local file path from Expo ImagePicker
  const resp = await fetch(uri);
  const blob = await resp.blob();
  const file = new File([blob], `${Date.now()}.jpg`, { type: 'image/jpeg' });
  const path = `${folder}/${Date.now()}.jpg`;

  const { data, error } = await supabase.storage.from('images').upload(path, file, {
    cacheControl: '3600', upsert: false, contentType: 'image/jpeg'
  });
  if (error) throw error;

  const { data: pub } = supabase.storage.from('images').getPublicUrl(path);
  if (!pub?.publicUrl) throw new Error('No public URL');
  return pub.publicUrl; // HTTPS
}

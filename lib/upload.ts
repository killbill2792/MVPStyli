// lib/upload.ts
import { supabase } from './supabase';
import { decode as atob } from 'base-64'; // <-- RN/Expo-safe atob
import { File } from 'expo-file-system';

/**
 * Upload a local device file (file://...) to Supabase public bucket "images".
 * Returns a PUBLIC https URL (works with Replicate).
 */
export async function uploadImageAsync(localUri: string) {
  try {
    console.log('Uploading image:', localUri);
    
    // Read file as base64 using new File API
    const file = new File(localUri);
    const base64 = await file.readAsStringAsync('base64');
    
    // Convert base64 to ArrayBuffer for Supabase
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    
    console.log('File read, size:', bytes.length);

    const path = `users/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
    console.log('Uploading to path:', path);

    const { error } = await supabase.storage
      .from('images')
      .upload(path, bytes.buffer, {
        cacheControl: '3600',
        upsert: true,
        contentType: 'image/jpeg',
      });

    if (error) {
      console.error('Supabase upload error:', error);
      throw error;
    }

    const { data } = supabase.storage.from('images').getPublicUrl(path);
    console.log('Upload successful, public URL:', data.publicUrl);
    return data.publicUrl;
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
}

/**
 * Upload a data:URI (base64) image to Supabase "images" bucket and return a PUBLIC https URL.
 * We use this only when the garment cleaner returns a data URI instead of an https URL.
 */
export async function uploadDataUrlToSupabase(dataUrl: string, pathPrefix = 'garments'): Promise<string> {
  if (!dataUrl?.startsWith('data:')) throw new Error('not a data:URL');

  const [meta, base64] = dataUrl.split(',');
  const mime = (meta.match(/data:(.*?);base64/)?.[1] || 'image/png') as string;

  // Convert base64 -> ArrayBuffer (Supabase accepts ArrayBuffer/File/Blob)
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  const arrayBuffer = bytes.buffer;

  const ext = mime.includes('png') ? 'png' : 'jpg';
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const filePath = `${pathPrefix}/${fileName}`;

  const { error } = await supabase.storage.from('images').upload(filePath, arrayBuffer, {
    contentType: mime,
    upsert: false,
    cacheControl: '3600',
  });
  if (error) throw error;

  const { data } = supabase.storage.from('images').getPublicUrl(filePath);
  return data.publicUrl;
}

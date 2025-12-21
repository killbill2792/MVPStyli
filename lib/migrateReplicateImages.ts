// lib/migrateReplicateImages.ts
// Utility to check and migrate old Replicate URLs to permanent Supabase Storage

import { supabase } from './supabase';
import { uploadRemoteImage } from './upload';

export interface ReplicateTryOn {
  id: string;
  user_id: string;
  result_url: string;
  product_name?: string;
  created_at: string;
}

/**
 * Check for try-ons with Replicate URLs that need migration
 */
export async function checkReplicateUrls(): Promise<ReplicateTryOn[]> {
  try {
    const { data, error } = await supabase
      .from('try_on_history')
      .select('id, user_id, result_url, product_name, created_at')
      .or('result_url.ilike.%replicate.delivery%,result_url.ilike.%replicate.com%')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error checking Replicate URLs:', error);
      return [];
    }

    return (data || []).filter(item => {
      const url = item.result_url;
      return url && (url.includes('replicate.delivery') || url.includes('replicate.com'));
    });
  } catch (error) {
    console.error('Error in checkReplicateUrls:', error);
    return [];
  }
}

/**
 * Migrate a single Replicate URL to permanent Supabase Storage
 * Returns the new permanent URL, or null if migration failed
 */
export async function migrateReplicateUrl(
  tryOnId: string,
  replicateUrl: string
): Promise<string | null> {
  try {
    console.log(`🔄 Migrating Replicate URL for try-on ${tryOnId}...`);
    
    // Upload to Supabase Storage
    const permanentUrl = await uploadRemoteImage(replicateUrl);
    
    if (!permanentUrl || permanentUrl === replicateUrl) {
      console.error('❌ Failed to upload Replicate image');
      return null;
    }

    // Update the database with the permanent URL
    const { error } = await supabase
      .from('try_on_history')
      .update({ result_url: permanentUrl })
      .eq('id', tryOnId);

    if (error) {
      console.error('❌ Error updating try-on URL:', error);
      return null;
    }

    console.log(`✅ Migrated try-on ${tryOnId} to permanent URL`);
    return permanentUrl;
  } catch (error) {
    console.error('❌ Error migrating Replicate URL:', error);
    return null;
  }
}

/**
 * Migrate all Replicate URLs found in try-on history
 * This should be run as a one-time migration script
 */
export async function migrateAllReplicateUrls(): Promise<{
  total: number;
  migrated: number;
  failed: number;
}> {
  const replicateTryOns = await checkReplicateUrls();
  console.log(`Found ${replicateTryOns.length} try-ons with Replicate URLs`);

  let migrated = 0;
  let failed = 0;

  for (const tryOn of replicateTryOns) {
    const result = await migrateReplicateUrl(tryOn.id, tryOn.result_url);
    if (result) {
      migrated++;
    } else {
      failed++;
    }
    
    // Add a small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return {
    total: replicateTryOns.length,
    migrated,
    failed
  };
}


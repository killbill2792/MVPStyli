/**
 * Share URL builder and deep link utilities
 * Single source of truth for all share links
 */

export type ShareKind = 'install' | 'pod';

export interface ShareParams {
  kind: ShareKind;
  podId?: string;
  fromUserId: string;
}

/**
 * Build share URL - always returns https://stylit.ai URLs
 * @param {Object} params - Share parameters
 * @param {string} params.kind - 'install' or 'pod'
 * @param {string} [params.podId] - Pod ID (required for 'pod' kind)
 * @param {string} params.fromUserId - User ID of the person sharing
 * @param {string} [params.audience] - Pod audience: 'friends', 'style_twins', 'global_mix'
 */
export function buildShareUrl({ kind, podId, fromUserId, audience }) {
  const baseUrl = 'https://stylit.ai';
  
  if (kind === 'pod' && podId) {
    // Map audience to URL parameter
    let audParam = 'global'; // default
    if (audience === 'friends') {
      audParam = 'friends';
    } else if (audience === 'style_twins') {
      audParam = 'twins';
    } else if (audience === 'global_mix') {
      audParam = 'global';
    }
    
    // Use static file path: pod.html?podId=... (not dynamic route /pod/<id>)
    return `${baseUrl}/pod.html?podId=${encodeURIComponent(podId)}&from=${encodeURIComponent(fromUserId)}&aud=${audParam}`;
  }
  
  if (kind === 'install') {
    // Use static file path: download.html?from=...
    return `${baseUrl}/download.html?from=${encodeURIComponent(fromUserId)}`;
  }
  
  // Fallback to install link
  return `${baseUrl}/download.html?from=${encodeURIComponent(fromUserId)}`;
}

/**
 * Parse deep link URL and extract invite parameters
 * Supports both https://stylit.ai and stylit:// schemes
 * @param {string} url - Deep link URL
 * @returns {Object|null} Parsed invite with type, podId (optional), and fromUserId
 */
export function parseDeepLink(url) {
  try {
    // Normalize URL - handle both https:// and stylit:// schemes
    let normalizedUrl = url;
    if (url.startsWith('stylit://')) {
      normalizedUrl = url.replace('stylit://', 'https://stylit.ai/');
    }
    
    const urlObj = new URL(normalizedUrl);
    const params = new URLSearchParams(urlObj.search);
    
    // Check if it's a pod link
    // New format: /pod.html?podId=...&from=...&aud=...
    // Old format (for backwards compatibility): /pod/<podId> or /pod?podId=...
    let podId = null;
    
    // Check query parameter first (new static file format)
    podId = params.get('podId');
    
    // Fallback: check pathname for old dynamic route format
    if (!podId && urlObj.pathname.includes('/pod/')) {
      // Old format: /pod/<podId>
      const pathParts = urlObj.pathname.split('/pod/');
      if (pathParts.length > 1) {
        podId = pathParts[1].split('?')[0]; // Remove query params if any
      }
    }
    
    const fromUserId = params.get('from') || params.get('ref');
    
    if (podId && fromUserId) {
      return {
        type: 'pod',
        podId,
        fromUserId,
      };
    }
    
    // Check if it's a download/install link
    // New format: /download.html?from=...
    // Old format: /download?from=...
    if (fromUserId && (urlObj.pathname.includes('/download') || urlObj.pathname.includes('/download.html'))) {
      const ref = params.get('ref') || params.get('from');
      if (ref) {
        return {
          type: 'install',
          fromUserId: ref,
        };
      }
    }
    
    // Check if it's a pod link by pathname (old format)
    if (urlObj.pathname.includes('/pod') || urlObj.pathname.includes('/pod.html')) {
      const ref = params.get('ref') || params.get('from');
      if (ref && podId) {
        return {
          type: 'pod',
          podId,
          fromUserId: ref,
        };
      }
    }
    
    // Fallback: check for ref parameter (install link)
    const ref = params.get('ref') || params.get('from');
    if (ref) {
      return {
        type: 'install',
        fromUserId: ref,
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing deep link:', error);
    return null;
  }
}


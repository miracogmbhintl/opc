/**
 * Safe base URL that works in both dev and production (Cloudflare Workers)
 * Never has a trailing slash
 */

// In Cloudflare Workers, import.meta.env is NOT available at module initialization
// We need to handle this safely
let cachedBaseUrl: string | null = null;

export function getBaseUrl(): string {
  if (cachedBaseUrl !== null) {
    return cachedBaseUrl;
  }
  
  // Try to get from import.meta.env (works in build/dev)
  // But will be empty string in Workers at module load time
  const envBaseUrl = typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL 
    ? import.meta.env.BASE_URL 
    : '';
  
  cachedBaseUrl = envBaseUrl.replace(/\/$/, '');
  return cachedBaseUrl;
}

// Export as a getter function for safety
export const baseUrl = getBaseUrl();

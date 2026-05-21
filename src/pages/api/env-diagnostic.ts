import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ locals }) => {
  const diagnostics = {
    timestamp: new Date().toISOString(),
    environment: 'production',
    runtime: {
      hasLocals: !!locals,
      hasRuntimeEnv: !!locals?.runtime?.env,
    },
    envVars: {
      // Check all possible environment variable sources
      supabase: {
        url: {
          fromRuntime: !!import.meta.env.PUBLIC_SUPABASE_URL,
          fromImportMeta: !!import.meta.env.PUBLIC_SUPABASE_URL,
          value: import.meta.env.PUBLIC_SUPABASE_URL || import.meta.env.PUBLIC_SUPABASE_URL || 'MISSING',
          length: (import.meta.env.PUBLIC_SUPABASE_URL || import.meta.env.PUBLIC_SUPABASE_URL || '').length
        },
        anonKey: {
          fromRuntime: !!import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
          fromImportMeta: !!import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
          isSet: !!(import.meta.env.PUBLIC_SUPABASE_ANON_KEY || import.meta.env.PUBLIC_SUPABASE_ANON_KEY),
          length: (import.meta.env.PUBLIC_SUPABASE_ANON_KEY || import.meta.env.PUBLIC_SUPABASE_ANON_KEY || '').length
        },
        serviceRoleKey: {
          fromRuntime: !!import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
          fromRuntimeAlt: !!import.meta.env.SUPABASE_SERVICE_ROLE,
          fromImportMeta: !!import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
          fromImportMetaAlt: !!import.meta.env.SUPABASE_SERVICE_ROLE,
          isSet: !!(
            import.meta.env.SUPABASE_SERVICE_ROLE_KEY || 
            import.meta.env.SUPABASE_SERVICE_ROLE ||
            import.meta.env.SUPABASE_SERVICE_ROLE_KEY ||
            import.meta.env.SUPABASE_SERVICE_ROLE
          ),
          length: (
            import.meta.env.SUPABASE_SERVICE_ROLE_KEY || 
            import.meta.env.SUPABASE_SERVICE_ROLE ||
            import.meta.env.SUPABASE_SERVICE_ROLE_KEY ||
            import.meta.env.SUPABASE_SERVICE_ROLE ||
            ''
          ).length
        }
      },
      webflow: {
        apiHost: {
          fromRuntime: !!import.meta.env.WEBFLOW_API_HOST,
          fromImportMeta: !!import.meta.env.WEBFLOW_API_HOST,
          isSet: !!(import.meta.env.WEBFLOW_API_HOST || import.meta.env.WEBFLOW_API_HOST)
        },
        siteToken: {
          fromRuntime: !!import.meta.env.WEBFLOW_SITE_API_TOKEN,
          fromImportMeta: !!import.meta.env.WEBFLOW_SITE_API_TOKEN,
          isSet: !!(import.meta.env.WEBFLOW_SITE_API_TOKEN || import.meta.env.WEBFLOW_SITE_API_TOKEN)
        }
      },
      admin: {
        username: {
          fromRuntime: !!import.meta.env.ADMIN_USERNAME,
          fromImportMeta: !!import.meta.env.ADMIN_USERNAME,
          isSet: !!(import.meta.env.ADMIN_USERNAME || import.meta.env.ADMIN_USERNAME)
        },
        passwordHash: {
          fromRuntime: !!import.meta.env.ADMIN_PASSWORD_HASH,
          fromImportMeta: !!import.meta.env.ADMIN_PASSWORD_HASH,
          isSet: !!(import.meta.env.ADMIN_PASSWORD_HASH || import.meta.env.ADMIN_PASSWORD_HASH)
        }
      },
      ownerModKey: {
        fromRuntime: !!import.meta.env.OWNER_MOD_KEY,
        fromImportMeta: !!import.meta.env.OWNER_MOD_KEY,
        isSet: !!(import.meta.env.OWNER_MOD_KEY || import.meta.env.OWNER_MOD_KEY)
      }
    },
    // List all available runtime env keys (without values for security)
    availableRuntimeKeys: locals?.runtime?.env ? Object.keys(locals.runtime.env) : [],
    
    // Check if we're in Cloudflare Workers
    platform: {
      isCloudflare: !!locals?.runtime,
      platformName: locals?.runtime ? 'Cloudflare Workers' : 'Local/Other'
    }
  };

  return new Response(JSON.stringify(diagnostics, null, 2), {
    status: 200,
    headers: { 
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  });
};

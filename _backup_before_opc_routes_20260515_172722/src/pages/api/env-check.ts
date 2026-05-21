import type { APIRoute } from 'astro';

/**
 * Environment variables diagnostic endpoint
 * Shows which environment variables are available
 * SECURITY: Only shows if vars exist, not their values
 */
export const GET: APIRoute = async ({ locals }) => {
  const envCheck = {
    timestamp: new Date().toISOString(),
    runtime: {
      hasLocals: !!locals,
      hasRuntimeEnv: !!locals?.runtime?.env,
    },
    public: {
      PUBLIC_SUPABASE_URL: {
        runtime: !!locals?.runtime?.env?.PUBLIC_SUPABASE_URL,
        importMeta: !!import.meta.env.PUBLIC_SUPABASE_URL,
        value: locals?.runtime?.env?.PUBLIC_SUPABASE_URL || import.meta.env.PUBLIC_SUPABASE_URL || 'MISSING'
      },
      PUBLIC_SUPABASE_ANON_KEY: {
        runtime: !!locals?.runtime?.env?.PUBLIC_SUPABASE_ANON_KEY,
        importMeta: !!import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
        length: (locals?.runtime?.env?.PUBLIC_SUPABASE_ANON_KEY || import.meta.env.PUBLIC_SUPABASE_ANON_KEY || '').length
      },
      WEBFLOW_API_HOST: {
        runtime: !!locals?.runtime?.env?.WEBFLOW_API_HOST,
        importMeta: !!import.meta.env.WEBFLOW_API_HOST,
        value: locals?.runtime?.env?.WEBFLOW_API_HOST || import.meta.env.WEBFLOW_API_HOST || 'MISSING'
      }
    },
    secrets: {
      SUPABASE_SERVICE_ROLE_KEY: {
        runtime: !!locals?.runtime?.env?.SUPABASE_SERVICE_ROLE_KEY,
        importMeta: !!import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
        length: (locals?.runtime?.env?.SUPABASE_SERVICE_ROLE_KEY || import.meta.env.SUPABASE_SERVICE_ROLE_KEY || '').length
      },
      SUPABASE_SERVICE_ROLE: {
        runtime: !!locals?.runtime?.env?.SUPABASE_SERVICE_ROLE,
        importMeta: !!import.meta.env.SUPABASE_SERVICE_ROLE,
        length: (locals?.runtime?.env?.SUPABASE_SERVICE_ROLE || import.meta.env.SUPABASE_SERVICE_ROLE || '').length
      },
      WEBFLOW_SITE_API_TOKEN: {
        runtime: !!locals?.runtime?.env?.WEBFLOW_SITE_API_TOKEN,
        importMeta: !!import.meta.env.WEBFLOW_SITE_API_TOKEN,
        length: (locals?.runtime?.env?.WEBFLOW_SITE_API_TOKEN || import.meta.env.WEBFLOW_SITE_API_TOKEN || '').length
      },
      WEBFLOW_CMS_SITE_API_TOKEN: {
        runtime: !!locals?.runtime?.env?.WEBFLOW_CMS_SITE_API_TOKEN,
        importMeta: !!import.meta.env.WEBFLOW_CMS_SITE_API_TOKEN,
        length: (locals?.runtime?.env?.WEBFLOW_CMS_SITE_API_TOKEN || import.meta.env.WEBFLOW_CMS_SITE_API_TOKEN || '').length
      },
      OWNER_MOD_KEY: {
        runtime: !!locals?.runtime?.env?.OWNER_MOD_KEY,
        importMeta: !!import.meta.env.OWNER_MOD_KEY,
        length: (locals?.runtime?.env?.OWNER_MOD_KEY || import.meta.env.OWNER_MOD_KEY || '').length
      }
    },
    diagnosis: {
      allPublicVarsAvailable: false,
      allSecretsAvailable: false,
      recommendedAction: ''
    }
  };

  // Check if all public vars are available
  envCheck.diagnosis.allPublicVarsAvailable = 
    !!envCheck.public.PUBLIC_SUPABASE_URL.runtime &&
    !!envCheck.public.PUBLIC_SUPABASE_ANON_KEY.runtime &&
    !!envCheck.public.WEBFLOW_API_HOST.runtime;

  // Check if all secrets are available
  envCheck.diagnosis.allSecretsAvailable = 
    !!envCheck.secrets.SUPABASE_SERVICE_ROLE_KEY.runtime &&
    !!envCheck.secrets.SUPABASE_SERVICE_ROLE.runtime &&
    !!envCheck.secrets.WEBFLOW_SITE_API_TOKEN.runtime;

  // Provide recommendation
  if (!envCheck.diagnosis.allPublicVarsAvailable) {
    envCheck.diagnosis.recommendedAction = 'PUBLIC variables are missing. Check wrangler.jsonc';
  } else if (!envCheck.diagnosis.allSecretsAvailable) {
    envCheck.diagnosis.recommendedAction = 'SECRETS are missing. Webflow needs to set them in Cloudflare Dashboard. See 🚨_WEBFLOW_ENV_SETUP_REQUIRED.md';
  } else {
    envCheck.diagnosis.recommendedAction = 'All environment variables are configured correctly ✅';
  }

  return new Response(JSON.stringify(envCheck, null, 2), {
    status: 200,
    headers: { 
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
};

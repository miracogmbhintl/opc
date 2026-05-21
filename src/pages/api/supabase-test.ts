import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ locals }) => {
  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    environment: 'server',
    checks: {}
  };

  try {
    // Check environment variables
    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || 
                        import.meta.env.PUBLIC_SUPABASE_URL;
    const supabaseKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || 
                        import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

    diagnostics.checks.envVars = {
      urlSet: !!supabaseUrl,
      keySet: !!supabaseKey,
      urlValue: supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'MISSING',
      keyPrefix: supabaseKey ? supabaseKey.substring(0, 20) : 'MISSING'
    };

    // Validate URL format
    if (supabaseUrl) {
      try {
        const url = new URL(supabaseUrl);
        diagnostics.checks.urlFormat = {
          valid: true,
          protocol: url.protocol,
          hostname: url.hostname
        };
      } catch (e: any) {
        diagnostics.checks.urlFormat = {
          valid: false,
          error: e.message
        };
      }
    } else {
      diagnostics.checks.urlFormat = {
        valid: false,
        error: 'URL not set'
      };
    }

    // Test Supabase connection
    if (supabaseUrl && supabaseKey) {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/`, {
          method: 'GET',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
          }
        });

        diagnostics.checks.connection = {
          status: response.status,
          statusText: response.statusText,
          success: response.ok
        };

        if (!response.ok) {
          const text = await response.text();
          diagnostics.checks.connection.error = text;
        }
      } catch (e: any) {
        diagnostics.checks.connection = {
          success: false,
          error: e.message,
          type: e.constructor.name
        };
      }
    } else {
      diagnostics.checks.connection = {
        success: false,
        error: 'Missing credentials'
      };
    }

    // Overall status
    diagnostics.status = 
      diagnostics.checks.envVars.urlSet && 
      diagnostics.checks.envVars.keySet && 
      diagnostics.checks.urlFormat.valid && 
      diagnostics.checks.connection.success 
        ? 'OK' 
        : 'ERROR';

  } catch (error: any) {
    diagnostics.status = 'ERROR';
    diagnostics.error = {
      message: error.message,
      type: error.constructor.name
    };
  }

  return new Response(JSON.stringify(diagnostics, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json'
    }
  });
};

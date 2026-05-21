import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Email and password required' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get Supabase credentials
    const supabaseUrl = locals?.runtime?.env?.PUBLIC_SUPABASE_URL || 
                        import.meta.env.PUBLIC_SUPABASE_URL;
    const supabaseKey = locals?.runtime?.env?.PUBLIC_SUPABASE_ANON_KEY || 
                        import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Supabase credentials not configured',
        details: {
          urlSet: !!supabaseUrl,
          keySet: !!supabaseKey
        }
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Test connection first
    const { data: connectionTest, error: connectionError } = await supabase.auth.getSession();
    
    if (connectionError) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Failed to connect to Supabase',
        details: connectionError.message
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Attempt sign in
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: authError.message,
        code: authError.status,
        name: authError.name
      }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!authData.user) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'No user returned from authentication'
      }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if profile exists
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profileError) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'User authenticated but profile not found',
        details: profileError.message,
        userId: authData.user.id
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ 
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        role: profile.role
      },
      message: 'Login successful'
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Server error',
      details: error.message
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

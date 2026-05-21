import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return new Response(JSON.stringify({ 
        error: 'Email and password are required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Sign in with Supabase
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      return new Response(JSON.stringify({ 
        error: authError.message 
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!authData.user) {
      return new Response(JSON.stringify({ 
        error: 'No user returned from authentication' 
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Fetch user profile
    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profileError || !profileData) {
      return new Response(JSON.stringify({ 
        error: 'Unable to fetch user profile' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Return success
    return new Response(JSON.stringify({
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        role: profileData.role,
        name: profileData.name || authData.user.email
      },
      role: profileData.role,
      session: authData.session
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Set-Cookie': `sb-access-token=${authData.session.access_token}; Path=/; HttpOnly; Secure; SameSite=Lax`
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({ 
      error: 'An unexpected error occurred' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

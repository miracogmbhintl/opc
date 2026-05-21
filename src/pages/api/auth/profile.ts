import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const GET: APIRoute = async ({ locals }) => {
  try {
    // Get session from runtime or import.meta.env
    const session = locals?.runtime?.session || locals?.session;
    
    if (!session?.user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get user profile from user_profiles table
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('id, email, full_name, role, client_id, created_at')
      .eq('id', session.user.id)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Add last sign in from session metadata
    const enrichedProfile = {
      ...profile,
      last_sign_in_at: session.user.last_sign_in_at || null
    };

    return new Response(JSON.stringify(enrichedProfile), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Profile API error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

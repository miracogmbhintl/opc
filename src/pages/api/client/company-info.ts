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

    // Get user profile to find client_id
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('client_id, role')
      .eq('id', session.user.id)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // If not a client, return error
    if (profile.role !== 'client') {
      return new Response(JSON.stringify({ error: 'Not a client user' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get client company info
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('company_name, contact_email, contact_phone, address, website, industry')
      .eq('id', profile.client_id)
      .single();

    if (clientError) {
      console.error('Error fetching client info:', clientError);
      return new Response(JSON.stringify({ error: 'Client not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(client), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Company info API error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

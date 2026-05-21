import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    // Get the auth token from the request
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No auth header' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get environment variables
    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || import.meta.env.PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response(JSON.stringify({ error: 'Supabase not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create an authenticated Supabase client with the user's token
    const token = authHeader.replace('Bearer ', '');
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    });

    // Get the authenticated user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      return new Response(JSON.stringify({ 
        error: 'Auth failed',
        details: authError 
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get the user's client_id
    const { data: clientData, error: clientError } = await supabaseClient
      .from('clients')
      .select('id, company_name')
      .eq('user_id', user.id)
      .single();

    if (clientError || !clientData) {
      return new Response(JSON.stringify({ 
        error: 'Client lookup failed',
        user_id: user.id,
        details: clientError 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Try to insert a test ticket with the authenticated client
    const { data: ticket, error: insertError } = await supabaseClient
      .from('tickets')
      .insert({
        client_id: clientData.id,
        ticket_title: 'API Test Ticket',
        message: 'This is a test from the API endpoint',
        category: 'general',
        status: 'open'
      })
      .select()
      .single();

    if (insertError) {
      return new Response(JSON.stringify({ 
        error: 'Insert failed',
        user_id: user.id,
        client_id: clientData.id,
        company_name: clientData.company_name,
        details: insertError 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ 
      success: true,
      ticket,
      user_id: user.id,
      client_id: clientData.id,
      company_name: clientData.company_name
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ 
      error: 'Unexpected error',
      details: err instanceof Error ? err.message : String(err)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

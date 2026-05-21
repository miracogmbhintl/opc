import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    // Get the current session to verify admin access
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create Supabase admin client with service role key
    const supabaseUrl = locals?.runtime?.env?.PUBLIC_SUPABASE_URL || import.meta.env.PUBLIC_SUPABASE_URL;
    const serviceRoleKey = locals?.runtime?.env?.SUPABASE_SERVICE_ROLE_KEY || import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing Supabase configuration');
      return new Response(JSON.stringify({ 
        error: 'Server configuration error. Please ensure SUPABASE_SERVICE_ROLE_KEY is set.' 
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Verify the requesting user is an owner/admin
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if user has admin/owner role
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || (profile.role !== 'owner' && profile.role !== 'admin')) {
      return new Response(JSON.stringify({ error: 'Insufficient permissions' }), { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Parse request body
    const body = await request.json();
    const { email, password, username, role, clientData } = body;

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email and password are required' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create the user with admin API
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: username
      }
    });

    if (authError) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({ error: authError.message }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!authData.user) {
      return new Response(JSON.stringify({ error: 'User creation failed' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Insert into user_profiles
    const { error: profileInsertError } = await supabaseAdmin
      .from('user_profiles')
      .insert({
        id: authData.user.id,
        email,
        full_name: username,
        role: role || 'client'
      });

    if (profileInsertError) {
      console.error('Profile insert error:', profileInsertError);
      // Try to delete the auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return new Response(JSON.stringify({ error: 'Failed to create user profile' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Insert into clients table if clientData provided
    if (clientData) {
      const { error: clientInsertError } = await supabaseAdmin
        .from('clients')
        .insert({
          id: authData.user.id,
          company_name: clientData.company_name,
          client_name: clientData.client_name || username,
          contact_person: clientData.contact_person,
          email,
          street: clientData.street,
          street_number: clientData.street_number,
          city: clientData.city,
          zip_code: clientData.zip_code,
          country: clientData.country,
          phone: clientData.phone,
          preferred_contact_method: clientData.preferred_contact_method || 'email',
          status: 'active'
        });

      if (clientInsertError) {
        console.error('Client insert error:', clientInsertError);
        // Continue anyway - user and profile were created successfully
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      userId: authData.user.id 
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    console.error('Unexpected error:', err);
    return new Response(JSON.stringify({ 
      error: err.message || 'Internal server error' 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

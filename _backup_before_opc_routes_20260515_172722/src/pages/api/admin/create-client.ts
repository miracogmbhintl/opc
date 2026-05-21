import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../../lib/supabase-admin';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    // Get Supabase admin client with runtime env support
    const runtimeEnv = locals?.runtime?.env;
    const supabaseAdmin = getSupabaseAdmin(runtimeEnv);

    // Verify the requesting user is an admin/owner
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Parse request body
    const clientData = await request.json();
    
    if (!clientData.email) {
      return new Response(JSON.stringify({ error: 'Email is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('[Admin API] Creating client with email:', clientData.email);

    // Create auth user via invite using admin client
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      clientData.email,
      {
        redirectTo: `${new URL(request.url).origin}/miraka-co-portal/set-password`
      }
    );

    if (authError) {
      console.error('[Admin API] Auth error:', authError);
      return new Response(JSON.stringify({ 
        error: 'Failed to create user: ' + authError.message 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('[Admin API] User created:', authData.user?.id);

    // Insert into user_profiles
    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .insert({
        id: authData.user?.id,
        email: clientData.email,
        role: 'client',
        full_name: clientData.clientName || clientData.fullName || null
      });

    if (profileError) {
      console.error('[Admin API] Profile error:', profileError);
      return new Response(JSON.stringify({ 
        error: 'Failed to create profile: ' + profileError.message 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Insert into clients table with extended data
    const { error: clientError } = await supabaseAdmin
      .from('clients')
      .insert({
        user_id: authData.user?.id,
        company_name: clientData.companyName,
        client_name: clientData.clientName,
        contact_person: clientData.contactPerson,
        email: clientData.email,
        phone: clientData.phone,
        status: clientData.status || 'Active',
        tags: clientData.tags || [],
        first_project: clientData.first_project || null,
        notes: clientData.notes || null
      });

    if (clientError) {
      console.error('[Admin API] Client table error:', clientError);
      // Continue even if this fails - user and profile are created
    }

    console.log('[Admin API] Client created successfully');

    return new Response(JSON.stringify({ 
      success: true,
      user: authData.user 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    console.error('[Admin API] Unexpected error:', err);
    return new Response(JSON.stringify({ 
      error: err.message || 'An unexpected error occurred'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

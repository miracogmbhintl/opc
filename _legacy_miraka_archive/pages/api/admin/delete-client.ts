import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const POST: APIRoute = async ({ request, locals }) => {
  console.log('🔵 [API] delete-client: Request received');

  try {
    const supabaseUrl = locals?.runtime?.env?.PUBLIC_SUPABASE_URL || import.meta.env.PUBLIC_SUPABASE_URL;
    const serviceRoleKey = 
      locals?.runtime?.env?.SUPABASE_SERVICE_ROLE_KEY || 
      import.meta.env.SUPABASE_SERVICE_ROLE_KEY ||
      locals?.runtime?.env?.SUPABASE_SERVICE_ROLE || 
      import.meta.env.SUPABASE_SERVICE_ROLE;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('❌ [API] Missing Supabase credentials');
      return new Response(JSON.stringify({
        success: false,
        error: 'Server configuration error'
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

    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      console.error('❌ [API] No authorization header');
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      console.error('❌ [API] Invalid token:', userError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid authentication'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'owner') {
      console.error('❌ [API] User is not owner - role:', profile?.role);
      return new Response(JSON.stringify({
        success: false,
        error: 'Access denied - Only owner can delete clients'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('✓ [API] Owner authorization confirmed');

    const body = await request.json();
    const { clientId, modKey } = body as { clientId: string; modKey: string };

    if (!clientId || !modKey) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Client ID and MOD key are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('📋 [API] Verifying MOD key for client:', clientId);

    const ownerModKey = locals?.runtime?.env?.OWNER_MOD_KEY || import.meta.env.OWNER_MOD_KEY;

    if (!ownerModKey) {
      console.error('❌ [API] OWNER_MOD_KEY not configured');
      return new Response(JSON.stringify({
        success: false,
        error: 'Server configuration error - MOD key not configured'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (modKey !== ownerModKey) {
      console.error('❌ [API] Invalid MOD key provided');
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid MOD key - Access denied'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('✓ [API] MOD key verified');

    const { data: clientData, error: clientFetchError } = await supabaseAdmin
      .from('clients')
      .select('user_id, company_name, email')
      .eq('id', clientId)
      .single();

    if (clientFetchError || !clientData) {
      console.error('❌ [API] Client not found:', clientFetchError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Client not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('📦 [API] Archiving client before deletion:', {
      id: clientId,
      company: clientData.company_name,
      email: clientData.email
    });

    // STEP 1: Archive the client data (SOFT DELETE)
    const { data: archiveId, error: archiveError } = await supabaseAdmin
      .rpc('archive_client_data', {
        p_client_id: clientId,
        p_archived_by: user.id,
        p_reason: 'Client deleted by owner'
      });

    if (archiveError) {
      console.error('❌ [API] Failed to archive client:', archiveError);
      return new Response(JSON.stringify({
        success: false,
        error: `Failed to archive client: ${archiveError.message}`
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('✓ [API] Client archived successfully. Archive ID:', archiveId);

    // Client is now soft-deleted (deleted_at is set, archived = true)
    // Data is preserved in Supabase for restoration
    // RLS policies will hide the client from normal queries

    // Log activity
    await supabaseAdmin
      .from('activity_log')
      .insert({
        user_id: user.id,
        action: 'client_deleted',
        resource_type: 'client',
        resource_id: clientId,
        details: {
          company_name: clientData.company_name,
          email: clientData.email,
          archive_id: archiveId,
          deleted_by: 'owner',
          deletion_type: 'soft_delete',
          can_restore: true
        }
      });

    return new Response(JSON.stringify({
      success: true,
      message: 'Client archived successfully. Data is preserved for potential restoration.',
      archiveId: archiveId,
      canRestore: true
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('❌ [API] Unexpected error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'An unexpected error occurred'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

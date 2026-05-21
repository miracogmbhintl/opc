import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const POST: APIRoute = async ({ request, locals }) => {
  console.log('🔵 [API] restore-client: Request received');

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
        error: 'Access denied - Only owner can restore clients'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const { archiveId } = body as { archiveId: string };

    if (!archiveId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Archive ID is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('📦 [API] Restoring client from archive:', archiveId);

    // Get archive info before restoration
    const { data: archiveInfo } = await supabaseAdmin
      .from('client_archives')
      .select('original_client_id, company_name, can_restore')
      .eq('id', archiveId)
      .single();

    if (!archiveInfo || !archiveInfo.can_restore) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Archive not found or cannot be restored'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Call the restore function
    const { data: restoredClientId, error: restoreError } = await supabaseAdmin
      .rpc('restore_client_from_archive', {
        p_archive_id: archiveId,
        p_restored_by: user.id
      });

    if (restoreError) {
      console.error('❌ [API] Failed to restore client:', restoreError);
      return new Response(JSON.stringify({
        success: false,
        error: `Failed to restore client: ${restoreError.message}`
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('✓ [API] Client restored successfully. Client ID:', restoredClientId);

    // Log activity
    await supabaseAdmin
      .from('activity_log')
      .insert({
        user_id: user.id,
        action: 'client_restored',
        resource_type: 'client',
        resource_id: restoredClientId,
        details: {
          company_name: archiveInfo.company_name,
          archive_id: archiveId,
          restored_by: 'owner'
        }
      });

    return new Response(JSON.stringify({
      success: true,
      message: 'Client restored successfully',
      clientId: restoredClientId
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

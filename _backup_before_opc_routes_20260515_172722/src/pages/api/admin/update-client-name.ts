import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const POST: APIRoute = async ({ request, locals }) => {
  const requestId = Date.now().toString(36);
  console.log(`🔵 [${requestId}] update-client-name: Request received`);

  try {
    // Get Supabase service role credentials
    const supabaseUrl = 
      locals?.runtime?.env?.PUBLIC_SUPABASE_URL || 
      import.meta.env.PUBLIC_SUPABASE_URL;
    
    const serviceRoleKey = 
      locals?.runtime?.env?.SUPABASE_SERVICE_ROLE_KEY || 
      locals?.runtime?.env?.SUPABASE_SERVICE_ROLE ||
      import.meta.env.SUPABASE_SERVICE_ROLE_KEY ||
      import.meta.env.SUPABASE_SERVICE_ROLE;

    console.log(`🔍 [${requestId}] Environment check:`, {
      supabaseUrl: supabaseUrl ? '✓ SET' : '✗ MISSING',
      serviceRoleKey: serviceRoleKey ? '✓ SET' : '✗ MISSING'
    });

    if (!supabaseUrl || !serviceRoleKey) {
      console.error(`❌ [${requestId}] Missing Supabase credentials`);
      return new Response(JSON.stringify({
        success: false,
        error: 'Server configuration error - Missing Supabase credentials',
        requestId
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create admin client with service role
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Verify authorization
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      console.error(`❌ [${requestId}] No authorization header`);
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized - No authentication provided',
        requestId
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      console.error(`❌ [${requestId}] Invalid token:`, userError?.message);
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid authentication',
        requestId
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check user role
    const { data: profile, error: profileFetchError } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileFetchError || !profile || !['owner', 'admin'].includes(profile.role)) {
      console.error(`❌ [${requestId}] User lacks admin privileges. Role:`, profile?.role);
      return new Response(JSON.stringify({
        success: false,
        error: 'Insufficient permissions - Admin or Owner role required',
        requestId
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`✓ [${requestId}] Admin authorization confirmed. Role:`, profile.role);

    // Parse request body
    const { clientId, newName } = await request.json();

    console.log(`👤 [${requestId}] Updating name for client:`, clientId);

    // Validate name
    if (!newName || newName.trim().length === 0) {
      console.error(`❌ [${requestId}] Invalid name - empty`);
      return new Response(JSON.stringify({
        success: false,
        error: 'Name cannot be empty',
        requestId
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const normalizedName = newName.trim();

    // Step 1: Get user_id from clients table
    console.log(`🔍 [${requestId}] Step 1: Fetching user_id from clients table...`);
    const { data: client, error: clientFetchError } = await supabaseAdmin
      .from('clients')
      .select('user_id, client_name')
      .eq('id', clientId)
      .single();

    if (clientFetchError || !client?.user_id) {
      console.error(`❌ [${requestId}] Client not found:`, clientFetchError?.message);
      return new Response(JSON.stringify({
        success: false,
        error: 'Client not found',
        requestId
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const userId = client.user_id;
    console.log(`✓ [${requestId}] Client found. User ID:`, userId);
    console.log(`👤 [${requestId}] Old name:`, client.client_name);
    console.log(`👤 [${requestId}] New name:`, normalizedName);

    // Check if name actually changed
    if (client.client_name?.trim() === normalizedName) {
      console.log(`ℹ️ [${requestId}] Name unchanged, skipping update`);
      return new Response(JSON.stringify({
        success: true,
        message: 'Name unchanged',
        requestId
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Step 2: Update user_profiles.full_name
    console.log(`📝 [${requestId}] Step 2: Updating user_profiles table...`);
    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .update({ full_name: normalizedName })
      .eq('id', userId);

    if (profileError) {
      console.error(`❌ [${requestId}] Failed to update profile name:`, profileError.message);
      return new Response(JSON.stringify({
        success: false,
        error: `Failed to update profile name: ${profileError.message}`,
        requestId
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`✓ [${requestId}] Profile name updated successfully`);

    // Step 3: Update clients.client_name
    console.log(`🏢 [${requestId}] Step 3: Updating clients table...`);
    const { error: clientUpdateError } = await supabaseAdmin
      .from('clients')
      .update({ 
        client_name: normalizedName,
        updated_at: new Date().toISOString()
      })
      .eq('id', clientId);

    if (clientUpdateError) {
      console.error(`❌ [${requestId}] Failed to update client name:`, clientUpdateError.message);
      return new Response(JSON.stringify({
        success: false,
        error: `Failed to update client name: ${clientUpdateError.message}`,
        requestId
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`✓ [${requestId}] Client name updated`);

    console.log(`🎉 [${requestId}] Name update completed successfully`);

    return new Response(JSON.stringify({
      success: true,
      message: 'Name updated successfully in all tables',
      oldName: client.client_name,
      newName: normalizedName,
      requestId
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error(`❌ [${requestId}] Unexpected error:`, error);
    console.error(`❌ [${requestId}] Error stack:`, error.stack);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'An unexpected error occurred',
      errorType: error.constructor.name,
      requestId
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

import type { APIRoute } from 'astro';
import { createServerSupabaseClient, requireAuth } from '../../../lib/supabase-server';

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

// GET /api/work-os/workspaces - List all workspaces for the current user
export const GET: APIRoute = async ({ cookies, url, locals }) => {
  try {
    // 1. Check authentication
    const user = await requireAuth(cookies, locals?.runtime?.env);
    
    console.log('[Work OS Workspaces GET] Auth check:', {
      isAuthenticated: !!user,
      userId: user?.id || 'none'
    });
    
    if (!user) {
      console.log('[Work OS Workspaces GET] Not authenticated');
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('[Work OS Workspaces GET] Authenticated user:', user.id);

    // 2. Create authenticated Supabase client
    const supabase = createServerSupabaseClient(cookies, locals?.runtime?.env);

    // 3. Query parameters
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const clientId = url.searchParams.get('client_id');
    const type = url.searchParams.get('type');
    const includeArchived = url.searchParams.get('include_archived') === 'true';

    // 4. Validate UUIDs if provided
    if (clientId && !isValidUUID(clientId)) {
      return new Response(JSON.stringify({ error: 'Invalid client_id format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 5. Validate type if provided
    if (type && type !== 'client' && type !== 'internal') {
      return new Response(JSON.stringify({ error: 'Type must be "client" or "internal"' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 6. Build query with RLS enforced - explicit select list only
    let query = supabase
      .from('work_os_workspaces')
      .select('id, name, description, type, client_id, color, is_archived, created_by, created_at, updated_at', { count: 'exact' })
      .order('created_at', { ascending: false });

    // Default filter: exclude archived
    if (!includeArchived) {
      query = query.eq('is_archived', false);
    }

    if (clientId) {
      query = query.eq('client_id', clientId);
    }

    if (type) {
      query = query.eq('type', type);
    }

    query = query.range(offset, offset + limit - 1);

    const { data: workspaces, error, count } = await query;

    if (error) {
      console.error('[Work OS API] Error fetching workspaces:', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch workspaces' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('[Work OS Workspaces GET] Success:', workspaces?.length || 0, 'workspaces');

    return new Response(JSON.stringify({
      workspaces: workspaces || [],
      total: count || 0,
      limit,
      offset
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Work OS API] Workspaces GET error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// POST /api/work-os/workspaces - Create a new workspace
export const POST: APIRoute = async ({ request, cookies, locals }) => {
  try {
    console.log('[Work OS Workspaces POST] ========== NEW REQUEST ==========');
    console.log('[Work OS Workspaces POST] Method:', request.method);
    console.log('[Work OS Workspaces POST] Content-Type:', request.headers.get('Content-Type'));
    console.log('[Work OS Workspaces POST] Cookies present:', {
      hasAccessToken: !!cookies.get('sb-access-token')?.value,
      hasRefreshToken: !!cookies.get('sb-refresh-token')?.value,
      accessTokenPreview: cookies.get('sb-access-token')?.value?.substring(0, 20) || 'none'
    });
    
    // 1. Check authentication
    const user = await requireAuth(cookies, locals?.runtime?.env);
    
    console.log('[Work OS Workspaces POST] Auth check:', {
      isAuthenticated: !!user,
      userId: user?.id || 'none'
    });
    
    if (!user) {
      console.log('[Work OS Workspaces POST] ❌ NOT AUTHENTICATED - returning 401');
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('[Work OS Workspaces POST] ✅ Authenticated user:', user.id);
    console.log('[Work OS Workspaces POST] User email:', user.email);

    // 2. Create authenticated Supabase client
    const supabase = createServerSupabaseClient(cookies, locals?.runtime?.env);

    // 3. Parse and validate request body
    let body;
    try {
      body = await request.json();
      console.log('[Work OS Workspaces POST] Parsed body:', JSON.stringify(body, null, 2));
    } catch (parseError) {
      console.error('[Work OS Workspaces POST] ❌ JSON parse error:', parseError);
      return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const { name, description, type, client_id, color } = body;

    console.log('[Work OS Workspaces POST] Extracted fields:', { 
      name: name || 'MISSING', 
      type: type || 'MISSING', 
      hasColor: !!color, 
      colorValue: color || 'none',
      hasDescription: !!description, 
      hasClientId: !!client_id 
    });

    // Validation: name
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      console.log('[Work OS Workspaces POST] ❌ VALIDATION FAILED: name is required');
      return new Response(JSON.stringify({ error: 'Name is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    console.log('[Work OS Workspaces POST] ✅ name validated:', name.trim());

    // Validation: type
    if (!type || (type !== 'client' && type !== 'internal')) {
      console.log('[Work OS Workspaces POST] ❌ VALIDATION FAILED: type must be "client" or "internal", got:', type);
      return new Response(JSON.stringify({ error: 'Type is required and must be "client" or "internal"' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    console.log('[Work OS Workspaces POST] ✅ type validated:', type);

    // 4. Validate type-specific constraints
    if (type === 'client') {
      if (!client_id) {
        console.log('[Work OS Workspaces POST] ❌ VALIDATION FAILED: client_id required for type=client');
        return new Response(JSON.stringify({ error: 'client_id is required when type is "client"' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      if (!isValidUUID(client_id)) {
        console.log('[Work OS Workspaces POST] ❌ VALIDATION FAILED: client_id not a valid UUID:', client_id);
        return new Response(JSON.stringify({ error: 'Invalid client_id format' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      console.log('[Work OS Workspaces POST] ✅ client_id validated (type=client):', client_id);
    }

    if (type === 'internal' && client_id) {
      console.log('[Work OS Workspaces POST] ❌ VALIDATION FAILED: client_id must not be set for type=internal');
      return new Response(JSON.stringify({ error: 'client_id must not be provided when type is "internal"' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 5. Build insert payload conditionally
    const insertPayload: any = {
      name: name.trim(),
      type,
      created_by: user.id
    };

    if (description && typeof description === 'string') {
      insertPayload.description = description.trim();
    }

    if (type === 'client' && client_id) {
      insertPayload.client_id = client_id;
    }

    if (color && typeof color === 'string') {
      insertPayload.color = color.trim();
    }

    console.log('[Work OS Workspaces POST] Final insert payload:', JSON.stringify(insertPayload, null, 2));

    // 6. Insert with RLS enforced
    console.log('[Work OS Workspaces POST] Attempting database insert...');
    const { data: workspace, error } = await supabase
      .from('work_os_workspaces')
      .insert(insertPayload)
      .select('id, name, description, type, client_id, color, is_archived, created_by, created_at, updated_at')
      .single();

    if (error) {
      console.error('[Work OS Workspaces POST] ❌ DATABASE ERROR:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      return new Response(JSON.stringify({ 
        error: 'Failed to create workspace',
        details: error.message 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('[Work OS Workspaces POST] ✅ DATABASE INSERT SUCCESS');
    console.log('[Work OS Workspaces POST] Created workspace:', JSON.stringify(workspace, null, 2));

    return new Response(JSON.stringify({ workspace }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Work OS Workspaces POST] ❌ UNEXPECTED ERROR:', error);
    console.error('[Work OS Workspaces POST] Error stack:', error instanceof Error ? error.stack : 'no stack');
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};


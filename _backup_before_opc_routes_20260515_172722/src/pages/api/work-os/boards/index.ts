import type { APIRoute } from 'astro';
import { createServerSupabaseClient, requireAuth } from '../../../../lib/supabase-server';

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

// GET /api/work-os/boards - List all boards
export const GET: APIRoute = async ({ cookies, url, locals }) => {
  try {
    // 1. Check authentication
    const user = await requireAuth(cookies, locals?.runtime?.env);
    
    if (!user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2. Create authenticated Supabase client
    const supabase = createServerSupabaseClient(cookies, locals?.runtime?.env);

    // 3. Query parameters
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const workspaceId = url.searchParams.get('workspace_id');
    const projectId = url.searchParams.get('project_id');
    const includeArchived = url.searchParams.get('include_archived') === 'true';

    // 4. Validate UUIDs if provided
    if (workspaceId && !isValidUUID(workspaceId)) {
      return new Response(JSON.stringify({ error: 'Invalid workspace_id format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (projectId && !isValidUUID(projectId)) {
      return new Response(JSON.stringify({ error: 'Invalid project_id format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 5. Build query with RLS enforced - explicit select list only
    let query = supabase
      .from('work_os_boards')
      .select('id, workspace_id, name, description, project_id, internal_only, columns_config, view_mode, is_template, is_archived, created_by, created_at, updated_at', { count: 'exact' })
      .order('created_at', { ascending: false });

    // Default filter: exclude archived
    if (!includeArchived) {
      query = query.eq('is_archived', false);
    }

    if (workspaceId) {
      query = query.eq('workspace_id', workspaceId);
    }

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    query = query.range(offset, offset + limit - 1);

    const { data: boards, error, count } = await query;

    if (error) {
      console.error('[Work OS API] Error fetching boards:', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch boards' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      boards: boards || [],
      total: count || 0,
      limit,
      offset
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Work OS API] Boards GET error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// POST /api/work-os/boards - Create a new board
export const POST: APIRoute = async ({ request, cookies, locals }) => {
  try {
    // 1. Check authentication
    const user = await requireAuth(cookies, locals?.runtime?.env);
    
    if (!user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2. Create authenticated Supabase client
    const supabase = createServerSupabaseClient(cookies, locals?.runtime?.env);

    // 3. Parse and validate request body
    const body = await request.json();
    const { workspace_id, name, description, project_id, internal_only, columns_config, view_mode, is_template } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Name is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!workspace_id || !isValidUUID(workspace_id)) {
      return new Response(JSON.stringify({ error: 'Valid workspace_id is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 4. Validate project_id if provided
    if (project_id && !isValidUUID(project_id)) {
      return new Response(JSON.stringify({ error: 'Invalid project_id format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 5. Build insert payload conditionally
    const insertPayload: any = {
      workspace_id,
      name: name.trim(),
      created_by: user.id
    };

    if (description && typeof description === 'string') {
      insertPayload.description = description.trim();
    }

    if (project_id) {
      insertPayload.project_id = project_id;
    }

    if (internal_only !== undefined && typeof internal_only === 'boolean') {
      insertPayload.internal_only = internal_only;
    }

    if (columns_config !== undefined) {
      insertPayload.columns_config = columns_config;
    }

    if (view_mode && typeof view_mode === 'string') {
      insertPayload.view_mode = view_mode;
    }

    if (is_template !== undefined && typeof is_template === 'boolean') {
      insertPayload.is_template = is_template;
    }

    // 6. Insert with RLS enforced
    const { data: board, error } = await supabase
      .from('work_os_boards')
      .insert(insertPayload)
      .select('id, workspace_id, name, description, project_id, internal_only, columns_config, view_mode, is_template, is_archived, created_by, created_at, updated_at')
      .single();

    if (error) {
      console.error('[Work OS API] Error creating board:', error);
      return new Response(JSON.stringify({ 
        error: 'Failed to create board',
        details: error.message 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ board }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Work OS API] Boards POST error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};


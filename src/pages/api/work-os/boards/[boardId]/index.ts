import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

// GET /api/work-os/boards/:boardId - Get a specific board
export const GET: APIRoute = async ({ params, locals }) => {
  try {
    const { boardId } = params;

    if (!boardId || !isValidUUID(boardId)) {
      return new Response(JSON.stringify({ error: 'Invalid board ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 1. Get session from locals
    const session = locals?.runtime?.session || locals?.session;
    
    if (!session?.user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2. Create request-scoped authenticated Supabase client
    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || import.meta.env.PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      }
    });

    // 3. Query with RLS enforced - explicit select list
    const { data: board, error } = await supabase
      .from('work_os_boards')
      .select('id, workspace_id, name, description, project_id, internal_only, columns_config, view_mode, is_template, is_archived, created_by, created_at, updated_at')
      .eq('id', boardId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return new Response(JSON.stringify({ error: 'Board not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      console.error('[Work OS API] Error fetching board:', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch board' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ board }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Work OS API] Board GET error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// PATCH /api/work-os/boards/:boardId - Update a board
export const PATCH: APIRoute = async ({ params, request, locals }) => {
  try {
    const { boardId } = params;

    if (!boardId || !isValidUUID(boardId)) {
      return new Response(JSON.stringify({ error: 'Invalid board ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 1. Get session from locals
    const session = locals?.runtime?.session || locals?.session;
    
    if (!session?.user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2. Create request-scoped authenticated Supabase client
    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || import.meta.env.PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      }
    });

    // 3. Parse and validate request body
    const body = await request.json();
    const { name, description, project_id, internal_only, columns_config, view_mode, is_template } = body;

    // Build update payload conditionally - only validated board fields
    const updatePayload: any = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return new Response(JSON.stringify({ error: 'Name must be a non-empty string' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      updatePayload.name = name.trim();
    }

    if (description !== undefined) {
      if (typeof description === 'string') {
        updatePayload.description = description.trim();
      }
    }

    if (project_id !== undefined) {
      if (project_id !== null && !isValidUUID(project_id)) {
        return new Response(JSON.stringify({ error: 'Invalid project_id format' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      updatePayload.project_id = project_id;
    }

    if (internal_only !== undefined) {
      if (typeof internal_only !== 'boolean') {
        return new Response(JSON.stringify({ error: 'internal_only must be a boolean' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      updatePayload.internal_only = internal_only;
    }

    if (columns_config !== undefined) {
      updatePayload.columns_config = columns_config;
    }

    if (view_mode !== undefined) {
      if (typeof view_mode !== 'string') {
        return new Response(JSON.stringify({ error: 'view_mode must be a string' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      updatePayload.view_mode = view_mode;
    }

    if (is_template !== undefined) {
      if (typeof is_template !== 'boolean') {
        return new Response(JSON.stringify({ error: 'is_template must be a boolean' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      updatePayload.is_template = is_template;
    }

    if (Object.keys(updatePayload).length === 0) {
      return new Response(JSON.stringify({ error: 'No valid fields to update' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 4. Update with RLS enforced
    const { data: board, error } = await supabase
      .from('work_os_boards')
      .update(updatePayload)
      .eq('id', boardId)
      .select('id, workspace_id, name, description, project_id, internal_only, columns_config, view_mode, is_template, is_archived, created_by, created_at, updated_at')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return new Response(JSON.stringify({ error: 'Board not found or access denied' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      console.error('[Work OS API] Error updating board:', error);
      return new Response(JSON.stringify({ 
        error: 'Failed to update board',
        details: error.message 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ board }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Work OS API] Board PATCH error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// DELETE /api/work-os/boards/:boardId - Delete a board
export const DELETE: APIRoute = async ({ params, locals }) => {
  try {
    const { boardId } = params;

    if (!boardId || !isValidUUID(boardId)) {
      return new Response(JSON.stringify({ error: 'Invalid board ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 1. Get session from locals
    const session = locals?.runtime?.session || locals?.session;
    
    if (!session?.user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2. Create request-scoped authenticated Supabase client
    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || import.meta.env.PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      }
    });

    // 3. Delete with RLS enforced
    const { error } = await supabase
      .from('work_os_boards')
      .delete()
      .eq('id', boardId);

    if (error) {
      console.error('[Work OS API] Error deleting board:', error);
      return new Response(JSON.stringify({ 
        error: 'Failed to delete board',
        details: error.message 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Work OS API] Board DELETE error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

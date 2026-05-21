import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

// GET /api/work-os/boards/:boardId/items - List tasks in a board
// URL may use "items" for API contract, but internally uses work_os_tasks
export const GET: APIRoute = async ({ params, locals, url }) => {
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
    const supabaseUrl = locals?.runtime?.env?.PUBLIC_SUPABASE_URL || import.meta.env.PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = locals?.runtime?.env?.PUBLIC_SUPABASE_ANON_KEY || import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

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

    // 3. Query parameters
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 200);
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const groupId = url.searchParams.get('group_id');

    // 4. Validate group_id if provided
    if (groupId && !isValidUUID(groupId)) {
      return new Response(JSON.stringify({ error: 'Invalid group_id format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 5. Build query with RLS enforced - use work_os_tasks, not work_os_items
    let query = supabase
      .from('work_os_tasks')
      .select('id, group_id, board_id, name, description, status, priority, due_date, start_date, progress_percent, position, custom_fields, created_by, created_at, updated_at', { count: 'exact' })
      .eq('board_id', boardId)
      .order('position', { ascending: true });

    if (groupId) {
      query = query.eq('group_id', groupId);
    }

    query = query.range(offset, offset + limit - 1);

    const { data: tasks, error, count } = await query;

    if (error) {
      console.error('[Work OS API] Error fetching tasks:', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch tasks' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Return as "items" for API contract compatibility
    return new Response(JSON.stringify({
      items: tasks || [],
      total: count || 0,
      limit,
      offset
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Work OS API] Board tasks GET error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// POST /api/work-os/boards/:boardId/items - Create a new task
// URL may use "items" for API contract, but internally uses work_os_tasks
export const POST: APIRoute = async ({ params, request, locals }) => {
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
    const supabaseUrl = locals?.runtime?.env?.PUBLIC_SUPABASE_URL || import.meta.env.PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = locals?.runtime?.env?.PUBLIC_SUPABASE_ANON_KEY || import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

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
    const { name, description, group_id, status, priority, due_date, start_date, progress_percent, position, custom_fields } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Name is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 4. Validate group_id if provided
    if (group_id && !isValidUUID(group_id)) {
      return new Response(JSON.stringify({ error: 'Invalid group_id format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 5. Build insert payload conditionally
    const insertPayload: any = {
      name: name.trim(),
      board_id: boardId,
      created_by: session.user.id
    };

    if (description && typeof description === 'string') {
      insertPayload.description = description.trim();
    }

    if (group_id) {
      insertPayload.group_id = group_id;
    }

    if (status && typeof status === 'string') {
      insertPayload.status = status;
    }

    if (priority && typeof priority === 'string') {
      insertPayload.priority = priority;
    }

    if (due_date && typeof due_date === 'string') {
      insertPayload.due_date = due_date;
    }

    if (start_date && typeof start_date === 'string') {
      insertPayload.start_date = start_date;
    }

    if (progress_percent !== undefined && typeof progress_percent === 'number') {
      insertPayload.progress_percent = progress_percent;
    }

    if (position !== undefined && typeof position === 'number') {
      insertPayload.position = position;
    }

    if (custom_fields !== undefined) {
      insertPayload.custom_fields = custom_fields;
    }

    // 6. Insert with RLS enforced - use work_os_tasks, not work_os_items
    const { data: task, error } = await supabase
      .from('work_os_tasks')
      .insert(insertPayload)
      .select('id, group_id, board_id, name, description, status, priority, due_date, start_date, progress_percent, position, custom_fields, created_by, created_at, updated_at')
      .single();

    if (error) {
      console.error('[Work OS API] Error creating task:', error);
      return new Response(JSON.stringify({ 
        error: 'Failed to create task',
        details: error.message 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Return as "item" for API contract compatibility
    return new Response(JSON.stringify({ item: task }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Work OS API] Board tasks POST error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

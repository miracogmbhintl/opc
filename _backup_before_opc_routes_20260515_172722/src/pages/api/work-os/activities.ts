import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

// GET /api/work-os/activities - List activity logs
export const GET: APIRoute = async ({ locals, url }) => {
  try {
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
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const workspaceId = url.searchParams.get('workspace_id');
    const boardId = url.searchParams.get('board_id');
    const itemId = url.searchParams.get('item_id');

    // 4. Validate UUIDs if provided
    if (workspaceId && !isValidUUID(workspaceId)) {
      return new Response(JSON.stringify({ error: 'Invalid workspace_id format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (boardId && !isValidUUID(boardId)) {
      return new Response(JSON.stringify({ error: 'Invalid board_id format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (itemId && !isValidUUID(itemId)) {
      return new Response(JSON.stringify({ error: 'Invalid item_id format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 5. Build query with RLS enforced
    let query = supabase
      .from('work_os_activity_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (workspaceId) {
      query = query.eq('workspace_id', workspaceId);
    }

    if (boardId) {
      query = query.eq('board_id', boardId);
    }

    if (itemId) {
      query = query.eq('item_id', itemId);
    }

    query = query.range(offset, offset + limit - 1);

    const { data: activities, error, count } = await query;

    if (error) {
      console.error('[Work OS API] Error fetching activities:', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch activities' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      activities: activities || [],
      total: count || 0,
      limit,
      offset
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Work OS API] Activities GET error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

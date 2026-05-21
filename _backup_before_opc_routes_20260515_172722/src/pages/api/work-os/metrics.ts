import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

// GET /api/work-os/metrics - Get workspace/board metrics
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
    const workspaceId = url.searchParams.get('workspace_id');
    const boardId = url.searchParams.get('board_id');

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

    // 5. Build metrics response
    const metrics: any = {};

    // Count workspaces if no filters
    if (!workspaceId && !boardId) {
      const { count: workspaceCount } = await supabase
        .from('work_os_workspaces')
        .select('*', { count: 'exact', head: true });
      
      metrics.total_workspaces = workspaceCount || 0;
    }

    // Count boards
    let boardQuery = supabase
      .from('work_os_boards')
      .select('*', { count: 'exact', head: true });

    if (workspaceId) {
      boardQuery = boardQuery.eq('workspace_id', workspaceId);
    }

    const { count: boardCount } = await boardQuery;
    metrics.total_boards = boardCount || 0;

    // Count items
    let itemQuery = supabase
      .from('work_os_items')
      .select('*', { count: 'exact', head: true });

    if (boardId) {
      itemQuery = itemQuery.eq('board_id', boardId);
    } else if (workspaceId) {
      // Need to get boards first, then filter items
      const { data: boards } = await supabase
        .from('work_os_boards')
        .select('id')
        .eq('workspace_id', workspaceId);
      
      if (boards && boards.length > 0) {
        const boardIds = boards.map(b => b.id);
        itemQuery = itemQuery.in('board_id', boardIds);
      }
    }

    const { count: itemCount } = await itemQuery;
    metrics.total_items = itemCount || 0;

    // Count comments
    let commentQuery = supabase
      .from('work_os_comments')
      .select('*', { count: 'exact', head: true });

    if (boardId) {
      // Get items from board first
      const { data: items } = await supabase
        .from('work_os_items')
        .select('id')
        .eq('board_id', boardId);
      
      if (items && items.length > 0) {
        const itemIds = items.map(i => i.id);
        commentQuery = commentQuery.in('item_id', itemIds);
      }
    } else if (workspaceId) {
      // Get boards, then items, then filter comments
      const { data: boards } = await supabase
        .from('work_os_boards')
        .select('id')
        .eq('workspace_id', workspaceId);
      
      if (boards && boards.length > 0) {
        const boardIds = boards.map(b => b.id);
        const { data: items } = await supabase
          .from('work_os_items')
          .select('id')
          .in('board_id', boardIds);
        
        if (items && items.length > 0) {
          const itemIds = items.map(i => i.id);
          commentQuery = commentQuery.in('item_id', itemIds);
        }
      }
    }

    const { count: commentCount } = await commentQuery;
    metrics.total_comments = commentCount || 0;

    return new Response(JSON.stringify({ metrics }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Work OS API] Metrics GET error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

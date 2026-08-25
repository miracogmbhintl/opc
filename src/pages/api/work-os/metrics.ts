import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'private, no-store, max-age=0',
    },
  });
}

export const GET: APIRoute = async ({ locals, url }) => {
  try {
    const session = locals?.runtime?.session || locals?.session;

    if (!session?.user || !session?.access_token) {
      return json({ error: 'Not authenticated' }, 401);
    }

    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return json({ error: 'Server configuration error' }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const workspaceId = url.searchParams.get('workspace_id');
    const boardId = url.searchParams.get('board_id');

    if (workspaceId && !isValidUUID(workspaceId)) {
      return json({ error: 'Invalid workspace_id format' }, 400);
    }

    if (boardId && !isValidUUID(boardId)) {
      return json({ error: 'Invalid board_id format' }, 400);
    }

    const metrics: Record<string, number> = {};

    if (!workspaceId && !boardId) {
      const { count, error } = await supabase
        .from('work_os_workspaces')
        .select('id', { count: 'exact', head: true });
      if (error) throw error;
      metrics.total_workspaces = count || 0;
    }

    let boardIds: string[] = [];

    if (boardId) {
      const { data, error } = await supabase
        .from('work_os_boards')
        .select('id')
        .eq('id', boardId)
        .limit(1);
      if (error) throw error;
      boardIds = (data || []).map((row) => String(row.id));
      metrics.total_boards = boardIds.length;
    } else if (workspaceId) {
      const { data, error } = await supabase
        .from('work_os_boards')
        .select('id')
        .eq('workspace_id', workspaceId);
      if (error) throw error;
      boardIds = (data || []).map((row) => String(row.id));
      metrics.total_boards = boardIds.length;
    } else {
      const { data, error, count } = await supabase
        .from('work_os_boards')
        .select('id', { count: 'exact' });
      if (error) throw error;
      boardIds = (data || []).map((row) => String(row.id));
      metrics.total_boards = count || 0;
    }

    let taskIds: string[] = [];

    if (boardId || workspaceId) {
      if (boardIds.length === 0) {
        metrics.total_items = 0;
      } else {
        const { data, error } = await supabase
          .from('work_os_tasks')
          .select('id')
          .in('board_id', boardIds);
        if (error) throw error;
        taskIds = (data || []).map((row) => String(row.id));
        metrics.total_items = taskIds.length;
      }
    } else {
      const { data, error, count } = await supabase
        .from('work_os_tasks')
        .select('id', { count: 'exact' });
      if (error) throw error;
      taskIds = (data || []).map((row) => String(row.id));
      metrics.total_items = count || 0;
    }

    if (boardId || workspaceId) {
      if (taskIds.length === 0) {
        metrics.total_comments = 0;
      } else {
        const { count, error } = await supabase
          .from('work_os_comments')
          .select('id', { count: 'exact', head: true })
          .in('task_id', taskIds);
        if (error) throw error;
        metrics.total_comments = count || 0;
      }
    } else {
      const { count, error } = await supabase
        .from('work_os_comments')
        .select('id', { count: 'exact', head: true });
      if (error) throw error;
      metrics.total_comments = count || 0;
    }

    return json({ metrics });
  } catch (error) {
    console.error(
      '[Work OS API] Metrics GET error:',
      error instanceof Error ? error.message : error,
    );
    return json({ error: 'Internal server error' }, 500);
  }
};

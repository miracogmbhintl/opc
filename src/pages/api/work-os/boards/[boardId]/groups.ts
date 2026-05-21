import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

// GET /api/work-os/boards/:boardId/groups - List groups in a board
export const GET: APIRoute = async ({ params, locals }) => {
  try {
    const { boardId } = params;

    if (!boardId || !isValidUUID(boardId)) {
      return new Response(JSON.stringify({ error: 'Invalid board ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const session = locals?.runtime?.session || locals?.session;

    if (!session?.user || !session?.access_token) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl =
      import.meta.env.PUBLIC_SUPABASE_URL || import.meta.env.PUBLIC_SUPABASE_URL;
    const supabaseAnonKey =
      import.meta.env.PUBLIC_SUPABASE_ANON_KEY || import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

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

    const { data: groups, error } = await supabase
      .from('work_os_groups')
      .select('id, board_id, name, color, order_index, is_collapsed, created_at, updated_at')
      .eq('board_id', boardId)
      .order('order_index', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[Work OS API] Error fetching groups:', error);
      return new Response(
        JSON.stringify({
          error: 'Failed to fetch groups',
          details: error.message
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response(
      JSON.stringify({
        groups: groups || []
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error: any) {
    console.error('[Work OS API] Board groups GET error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error?.message || 'Unknown error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};
import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

// POST /api/work-os/boards/:boardId/archive - Archive a board
export const POST: APIRoute = async ({ params, locals }) => {
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

    // 3. Archive board with RLS enforced - use is_archived, not archived
    const { data: board, error } = await supabase
      .from('work_os_boards')
      .update({ is_archived: true })
      .eq('id', boardId)
      .select('id, name, is_archived')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return new Response(JSON.stringify({ error: 'Board not found or access denied' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      console.error('[Work OS API] Error archiving board:', error);
      return new Response(JSON.stringify({ 
        error: 'Failed to archive board',
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
    console.error('[Work OS API] Board archive error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

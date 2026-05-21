import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

// GET /api/work-os/items/:itemId/comments - List comments for a task
// URL may use "itemId" for API contract, but internally maps to task_id
export const GET: APIRoute = async ({ params, locals, url }) => {
  try {
    const { itemId } = params;

    if (!itemId || !isValidUUID(itemId)) {
      return new Response(JSON.stringify({ error: 'Invalid item ID' }), {
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

    // 3. Query parameters
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // 4. Query with RLS enforced - use task_id and user_id, not item_id and created_by
    const { data: comments, error, count } = await supabase
      .from('work_os_comments')
      .select('id, task_id, user_id, content, is_internal, parent_comment_id, created_at, updated_at', { count: 'exact' })
      .eq('task_id', itemId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[Work OS API] Error fetching comments:', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch comments' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      comments: comments || [],
      total: count || 0,
      limit,
      offset
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Work OS API] Comments GET error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// POST /api/work-os/items/:itemId/comments - Create a comment
// URL may use "itemId" for API contract, but internally maps to task_id
export const POST: APIRoute = async ({ params, request, locals }) => {
  try {
    const { itemId } = params;

    if (!itemId || !isValidUUID(itemId)) {
      return new Response(JSON.stringify({ error: 'Invalid item ID' }), {
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
    const { content, is_internal, parent_comment_id } = body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Content is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 4. Validate parent_comment_id if provided
    if (parent_comment_id && !isValidUUID(parent_comment_id)) {
      return new Response(JSON.stringify({ error: 'Invalid parent_comment_id format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 5. Build insert payload conditionally - use task_id and user_id
    const insertPayload: any = {
      task_id: itemId,
      user_id: session.user.id,
      content: content.trim()
    };

    if (is_internal !== undefined && typeof is_internal === 'boolean') {
      insertPayload.is_internal = is_internal;
    }

    if (parent_comment_id) {
      insertPayload.parent_comment_id = parent_comment_id;
    }

    // 6. Insert with RLS enforced
    const { data: comment, error } = await supabase
      .from('work_os_comments')
      .insert(insertPayload)
      .select('id, task_id, user_id, content, is_internal, parent_comment_id, created_at, updated_at')
      .single();

    if (error) {
      console.error('[Work OS API] Error creating comment:', error);
      return new Response(JSON.stringify({ 
        error: 'Failed to create comment',
        details: error.message 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ comment }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Work OS API] Comments POST error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

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

function createRequestClient(locals: any, accessToken: string) {
  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) throw new Error('Server configuration error');

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function canUseInternalComments(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from('opc_staff_roles')
    .select('role')
    .eq('user_id', userId)
    .in('status', ['active', 'aktiv', 'enabled'])
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('[Work OS comments] role lookup failed:', error.message);
    return false;
  }

  return ['owner', 'admin', 'dispatch', 'dispatcher', 'disposition'].includes(
    String(data?.role || '').trim().toLowerCase(),
  );
}

export const GET: APIRoute = async ({ params, locals, url }) => {
  try {
    const { itemId } = params;
    if (!itemId || !isValidUUID(itemId)) return json({ error: 'Invalid item ID' }, 400);

    const session = locals?.runtime?.session || locals?.session;
    if (!session?.user || !session?.access_token) return json({ error: 'Not authenticated' }, 401);

    const supabase = createRequestClient(locals, session.access_token);
    const canSeeInternal = await canUseInternalComments(supabase, session.user.id);
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50', 10) || 50, 1), 100);
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10) || 0, 0);

    let query = supabase
      .from('work_os_comments')
      .select('id, task_id, user_id, content, is_internal, parent_comment_id, created_at, updated_at', { count: 'exact' })
      .eq('task_id', itemId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (!canSeeInternal) query = query.eq('is_internal', false);

    const { data: comments, error, count } = await query;
    if (error) {
      console.error('[Work OS API] Error fetching comments:', error);
      return json({ error: 'Failed to fetch comments' }, 500);
    }

    return json({ comments: comments || [], total: count || 0, limit, offset });
  } catch (error) {
    console.error('[Work OS API] Comments GET error:', error);
    return json({ error: 'Internal server error' }, 500);
  }
};

export const POST: APIRoute = async ({ params, request, locals }) => {
  try {
    const { itemId } = params;
    if (!itemId || !isValidUUID(itemId)) return json({ error: 'Invalid item ID' }, 400);

    const session = locals?.runtime?.session || locals?.session;
    if (!session?.user || !session?.access_token) return json({ error: 'Not authenticated' }, 401);

    const supabase = createRequestClient(locals, session.access_token);
    const body = await request.json();
    const content = typeof body?.content === 'string' ? body.content.trim() : '';
    const parentCommentId = body?.parent_comment_id || null;
    const wantsInternal = body?.is_internal === true;

    if (!content) return json({ error: 'Content is required' }, 400);
    if (content.length > 20_000) return json({ error: 'Comment is too long' }, 413);
    if (parentCommentId && !isValidUUID(parentCommentId)) {
      return json({ error: 'Invalid parent_comment_id format' }, 400);
    }

    const canCreateInternal = await canUseInternalComments(supabase, session.user.id);
    if (wantsInternal && !canCreateInternal) {
      return json({ error: 'Internal comments require Owner, Admin or Dispatch access.' }, 403);
    }

    const insertPayload: Record<string, unknown> = {
      task_id: itemId,
      user_id: session.user.id,
      content,
      is_internal: wantsInternal && canCreateInternal,
    };

    if (parentCommentId) insertPayload.parent_comment_id = parentCommentId;

    const { data: comment, error } = await supabase
      .from('work_os_comments')
      .insert(insertPayload)
      .select('id, task_id, user_id, content, is_internal, parent_comment_id, created_at, updated_at')
      .single();

    if (error) {
      console.error('[Work OS API] Error creating comment:', error);
      return json({ error: 'Failed to create comment' }, 500);
    }

    return json({ comment }, 201);
  } catch (error) {
    console.error('[Work OS API] Comments POST error:', error);
    return json({ error: 'Internal server error' }, 500);
  }
};

import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

// GET /api/work-os/items/:itemId/files - List files attached to a task
// URL may use "itemId" for API contract, but internally maps to task_id in public.files
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

    // 4. Query with RLS enforced - use public.files with task_id, not work_os_files
    const { data: files, error, count } = await supabase
      .from('files')
      .select('id, name, file_path, file_size, file_type, uploaded_by, task_id, created_at', { count: 'exact' })
      .eq('task_id', itemId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[Work OS API] Error fetching files:', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch files' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      files: files || [],
      total: count || 0,
      limit,
      offset
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Work OS API] Files GET error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// POST /api/work-os/items/:itemId/files - Attach a file to a task
// URL may use "itemId" for API contract, but internally maps to task_id in public.files
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
    const { name, file_path, file_size, file_type } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'File name is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!file_path || typeof file_path !== 'string' || file_path.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'File path is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 4. Build insert payload conditionally - use public.files with task_id
    const insertPayload: any = {
      name: name.trim(),
      file_path: file_path.trim(),
      uploaded_by: session.user.id,
      task_id: itemId
    };

    if (file_size !== undefined && typeof file_size === 'number') {
      insertPayload.file_size = file_size;
    }

    if (file_type && typeof file_type === 'string') {
      insertPayload.file_type = file_type.trim();
    }

    // 5. Insert with RLS enforced - use public.files, not work_os_files
    const { data: file, error } = await supabase
      .from('files')
      .insert(insertPayload)
      .select('id, name, file_path, file_size, file_type, uploaded_by, task_id, created_at')
      .single();

    if (error) {
      console.error('[Work OS API] Error attaching file:', error);
      return new Response(JSON.stringify({ 
        error: 'Failed to attach file',
        details: error.message 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ file }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Work OS API] Files POST error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

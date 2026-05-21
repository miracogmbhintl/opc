import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

// GET /api/work-os/items/:itemId/files/:fileId - Get a specific file
// URL may use "itemId" for API contract, but internally maps to task_id in public.files
export const GET: APIRoute = async ({ params, locals }) => {
  try {
    const { itemId, fileId } = params;

    if (!itemId || !isValidUUID(itemId)) {
      return new Response(JSON.stringify({ error: 'Invalid item ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!fileId || !isValidUUID(fileId)) {
      return new Response(JSON.stringify({ error: 'Invalid file ID' }), {
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

    // 3. Query with RLS enforced - use public.files with task_id
    const { data: file, error } = await supabase
      .from('files')
      .select('id, name, file_path, file_size, file_type, uploaded_by, task_id, created_at')
      .eq('id', fileId)
      .eq('task_id', itemId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return new Response(JSON.stringify({ error: 'File not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      console.error('[Work OS API] Error fetching file:', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch file' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ file }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Work OS API] File GET error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// DELETE /api/work-os/items/:itemId/files/:fileId - Detach a file from a task
// URL may use "itemId" for API contract, but internally maps to task_id in public.files
export const DELETE: APIRoute = async ({ params, locals }) => {
  try {
    const { itemId, fileId } = params;

    if (!itemId || !isValidUUID(itemId)) {
      return new Response(JSON.stringify({ error: 'Invalid item ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!fileId || !isValidUUID(fileId)) {
      return new Response(JSON.stringify({ error: 'Invalid file ID' }), {
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

    // 3. Delete with RLS enforced - use public.files
    // Note: This deletes the file record. If you want to just detach (set task_id = null), use update instead
    const { error } = await supabase
      .from('files')
      .delete()
      .eq('id', fileId)
      .eq('task_id', itemId);

    if (error) {
      console.error('[Work OS API] Error deleting file:', error);
      return new Response(JSON.stringify({ 
        error: 'Failed to delete file',
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
    console.error('[Work OS API] File DELETE error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

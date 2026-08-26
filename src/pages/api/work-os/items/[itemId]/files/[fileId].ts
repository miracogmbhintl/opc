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

function authenticatedClient(locals: any) {
  const session = locals?.runtime?.session || locals?.session;
  if (!session?.user || !session?.access_token) return null;

  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return null;

  return createClient(supabaseUrl, supabaseAnonKey, {
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
}

export const GET: APIRoute = async ({ params, locals }) => {
  try {
    const { itemId, fileId } = params;

    if (!itemId || !isValidUUID(itemId)) return json({ error: 'Invalid item ID' }, 400);
    if (!fileId || !isValidUUID(fileId)) return json({ error: 'Invalid file ID' }, 400);

    const supabase = authenticatedClient(locals);
    if (!supabase) return json({ error: 'Not authenticated' }, 401);

    const { data: file, error } = await supabase
      .from('files')
      .select('id, name, file_path, file_size, file_type, uploaded_by, task_id, created_at')
      .eq('id', fileId)
      .eq('task_id', itemId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return json({ error: 'File not found' }, 404);
      console.error('[Work OS API] Error fetching file:', error.message);
      return json({ error: 'Failed to fetch file' }, 500);
    }

    return json({ file });
  } catch (error) {
    console.error(
      '[Work OS API] File GET error:',
      error instanceof Error ? error.message : error,
    );
    return json({ error: 'Internal server error' }, 500);
  }
};

// Detach a global file record from this task. The `files` table is shared by
// Work OS and onboarding flows, so deleting the row here could destroy a file
// that is still needed elsewhere. Physical storage lifecycle remains owned by
// the file subsystem that created the record.
export const DELETE: APIRoute = async ({ params, locals }) => {
  try {
    const { itemId, fileId } = params;

    if (!itemId || !isValidUUID(itemId)) return json({ error: 'Invalid item ID' }, 400);
    if (!fileId || !isValidUUID(fileId)) return json({ error: 'Invalid file ID' }, 400);

    const supabase = authenticatedClient(locals);
    if (!supabase) return json({ error: 'Not authenticated' }, 401);

    const { data, error } = await supabase
      .from('files')
      .update({ task_id: null })
      .eq('id', fileId)
      .eq('task_id', itemId)
      .select('id')
      .limit(1);

    if (error) {
      console.error('[Work OS API] Error detaching file:', error.message);
      return json({ error: 'Failed to detach file' }, 500);
    }

    if (!Array.isArray(data) || data.length === 0) {
      return json({ error: 'File not found or access denied' }, 404);
    }

    return json({ success: true, detached: true });
  } catch (error) {
    console.error(
      '[Work OS API] File DELETE error:',
      error instanceof Error ? error.message : error,
    );
    return json({ error: 'Internal server error' }, 500);
  }
};

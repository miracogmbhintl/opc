import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  try {
    const { itemId } = params;

    if (!itemId || !isValidUUID(itemId)) {
      return new Response(JSON.stringify({ error: 'Invalid item ID' }), {
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

    const rawBody = await request.json();

    const allowedFields = [
      'name',
      'group_id',
      'description',
      'status',
      'priority',
      'start_date',
      'due_date',
      'progress_percent'
    ] as const;

    const updateData: Record<string, any> = {};

    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(rawBody, field)) {
        updateData[field] = rawBody[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return new Response(JSON.stringify({ error: 'No valid fields provided for update' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (Object.prototype.hasOwnProperty.call(updateData, 'name')) {
      if (typeof updateData.name !== 'string' || !updateData.name.trim()) {
        return new Response(JSON.stringify({ error: 'Task name is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      updateData.name = updateData.name.trim();
    }

    if (Object.prototype.hasOwnProperty.call(updateData, 'group_id')) {
      if (updateData.group_id !== null && updateData.group_id !== '' && !isValidUUID(updateData.group_id)) {
        return new Response(JSON.stringify({ error: 'Invalid group ID' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      if (updateData.group_id === '') {
        updateData.group_id = null;
      }
    }

    if (Object.prototype.hasOwnProperty.call(updateData, 'description')) {
      if (typeof updateData.description === 'string') {
        updateData.description = updateData.description.trim() || null;
      } else if (updateData.description !== null) {
        return new Response(JSON.stringify({ error: 'Invalid description' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    if (Object.prototype.hasOwnProperty.call(updateData, 'status')) {
      if (typeof updateData.status === 'string') {
        updateData.status = updateData.status.trim() || null;
      } else if (updateData.status !== null) {
        return new Response(JSON.stringify({ error: 'Invalid status' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    if (Object.prototype.hasOwnProperty.call(updateData, 'priority')) {
      if (typeof updateData.priority === 'string') {
        updateData.priority = updateData.priority.trim() || null;
      } else if (updateData.priority !== null) {
        return new Response(JSON.stringify({ error: 'Invalid priority' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    if (Object.prototype.hasOwnProperty.call(updateData, 'start_date')) {
      if (updateData.start_date === '') {
        updateData.start_date = null;
      }
    }

    if (Object.prototype.hasOwnProperty.call(updateData, 'due_date')) {
      if (updateData.due_date === '') {
        updateData.due_date = null;
      }
    }

    if (Object.prototype.hasOwnProperty.call(updateData, 'progress_percent')) {
      if (
        updateData.progress_percent === '' ||
        updateData.progress_percent === undefined
      ) {
        updateData.progress_percent = null;
      } else if (updateData.progress_percent !== null) {
        const parsed = Number(updateData.progress_percent);
        if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) {
          return new Response(JSON.stringify({ error: 'Progress must be between 0 and 100' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        updateData.progress_percent = parsed;
      }
    }

    updateData.updated_at = new Date().toISOString();

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      }
    });

    const { data: item, error } = await supabase
      .from('work_os_items')
      .update(updateData)
      .eq('id', itemId)
      .select(`
        id,
        group_id,
        board_id,
        name,
        description,
        status,
        priority,
        due_date,
        start_date,
        progress_percent,
        position,
        custom_fields,
        created_by,
        created_at,
        updated_at
      `)
      .single();

    if (error) {
      console.error('[Work OS API] Error updating item:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to update item', details: error.message }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response(
      JSON.stringify({ item }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error: any) {
    console.error('[Work OS API] Item PATCH error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error?.message || 'Unknown error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};

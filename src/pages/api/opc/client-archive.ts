import type { APIRoute } from 'astro';
import { getRuntimeEnv } from '../../../lib/google-oauth';
import { getAuthenticatedContext } from '../../../lib/google-calendar';
import { resolveOpcServerAccess } from '../../../lib/opc-server-access';

export const prerender = false;
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

async function session(context: Parameters<APIRoute>[0]) {
  const env = getRuntimeEnv(context);
  const { supabase, user } = await getAuthenticatedContext(context.request, env);
  const access = await resolveOpcServerAccess(supabase, user);
  return { supabase, user, access };
}

export const GET: APIRoute = async (context) => {
  try {
    const { supabase, access } = await session(context);
    if (!access.canManageClients) return reply({ error: 'Forbidden' }, 403);
    const { data, error } = await supabase.from('opc_clients')
      .select('id,billing_name,billing_email,metadata,created_at')
      .not('metadata->archive->>archived_at', 'is', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    const rows = (data || []).map((row: any) => ({
      id: row.id,
      ...(access.role === 'owner' ? {
        billing_name: row.billing_name,
        billing_email: row.billing_email,
        archive: row.metadata?.archive || null,
      } : {}),
    }));
    return reply({ success: true, clients: rows });
  } catch (error) {
    console.error('[opc/client-archive] list failed', error);
    return reply({ error: 'Archived customer list unavailable.' }, 500);
  }
};

export const POST: APIRoute = async (context) => {
  try {
    const { supabase, user, access } = await session(context);
    if (access.role !== 'owner') return reply({ error: 'Owner only.' }, 403);
    const body = await context.request.json().catch(() => null);
    const id = String(body?.clientId || '');
    const action = String(body?.action || '');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ||
        !['archive','restore'].includes(action)) return reply({ error: 'Invalid request' }, 400);
    const { data: existing, error: selectError } = await supabase.from('opc_clients')
      .select('id,metadata').eq('id', id).single();
    if (selectError || !existing) return reply({ error: 'Customer unavailable.' }, 404);
    const previous = existing.metadata?.archive || {};
    const archived = Boolean(previous.archived_at);
    if (action === 'archive' && archived) return reply({ error: 'Already archived.' }, 409);
    if (action === 'restore' && !archived) return reply({ error: 'Not archived.' }, 409);
    const now = new Date().toISOString();
    const archive = action === 'archive'
      ? { ...previous, archived_at: now, archived_by: user.id, reason: 'Owner archived customer' }
      : { ...previous, archived_at: null, restored_at: now, restored_by: user.id };
    const metadata = { ...(existing.metadata || {}), archive };
    const { data: updated, error } = await supabase.from('opc_clients')
      .update({ metadata }).eq('id', id).eq('metadata', existing.metadata)
      .select('id').maybeSingle();
    if (error) throw error;
    if (!updated) return reply({ error: 'Customer changed during request. Retry.' }, 409);
    return reply({ success: true, clientId: id, archived: action === 'archive' });
  } catch (error) {
    console.error('[opc/client-archive] update failed', error);
    return reply({ error: 'Customer archive operation failed.' }, 500);
  }
};

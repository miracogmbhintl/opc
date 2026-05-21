import type { APIRoute } from 'astro';
import { createOpcServiceClient, jsonResponse } from '../../../lib/opc-ticket-admin';

export const prerender = false;

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function readPayload(request: Request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

async function getActor(request: Request, supabase: any) {
  const fallback = {
    actor_user_id: null,
    actor_name: 'Orange Pro Clean Team',
    actor_email: null,
    actor_type: 'staff',
  };

  const authHeader = request.headers.get('Authorization') || '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!bearer) return fallback;

  try {
    const { data: userData } = await supabase.auth.getUser(bearer);
    const user = userData?.user;

    if (!user) return fallback;

    const fullName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email ||
      'Orange Pro Clean Team';

    return {
      actor_user_id: user.id,
      actor_name: fullName,
      actor_email: user.email || null,
      actor_type: 'staff',
    };
  } catch {
    return fallback;
  }
}

function cleanStatus(value: unknown) {
  const status = String(value || '').trim();

  if (['new', 'in_progress', 'resolved', 'closed'].includes(status)) return status;
  return null;
}

function cleanPriority(value: unknown) {
  const priority = String(value || '').trim();

  if (['low', 'normal', 'high'].includes(priority)) return priority;
  return null;
}

function cleanCategory(value: unknown) {
  const category = String(value || '').trim();

  if (
    [
      'damage',
      'cleaning_needed',
      'recleaning',
      'material_missing',
      'complaint',
      'praise',
      'other',
    ].includes(category)
  ) {
    return category;
  }

  return null;
}

function statusLabel(status: string | null | undefined) {
  if (status === 'new') return 'Neu';
  if (status === 'in_progress') return 'In Bearbeitung';
  if (status === 'resolved') return 'Erledigt';
  if (status === 'closed') return 'Geschlossen';
  return status || 'Unbekannt';
}

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const payload = await readPayload(request);
    const id = String(payload.id || '').trim();

    if (!id || !isUuid(id)) {
      return jsonResponse({ ok: false, error: 'Ungültige Ticket-ID.' }, 400);
    }

    const supabase = createOpcServiceClient(locals);
    const actor = await getActor(request, supabase);

    const { data: current, error: currentError } = await supabase
      .from('opc_tickets')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (currentError) {
      return jsonResponse(
        { ok: false, error: `Ticket konnte nicht geladen werden: ${currentError.message}` },
        500
      );
    }

    if (!current) {
      return jsonResponse({ ok: false, error: 'Ticket wurde nicht gefunden.' }, 404);
    }

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    const status = cleanStatus(payload.status);
    const priority = cleanPriority(payload.priority);
    const category = cleanCategory(payload.category);
    const internalNote = String(payload.internal_note || '').trim();

    if (status) {
      updates.status = status;

      if (status === 'in_progress' && current.status !== 'in_progress') {
        updates.assigned_to_user_id = actor.actor_user_id;
        updates.assigned_to_name = actor.actor_name;
        updates.assigned_at = new Date().toISOString();
      }

      if ((status === 'resolved' || status === 'closed') && current.status !== status) {
        updates.resolved_by_user_id = actor.actor_user_id;
        updates.resolved_by_name = actor.actor_name;
        updates.resolved_at = new Date().toISOString();
      }
    }

    if (priority) updates.priority = priority;
    if (category) updates.category = category;

    const { data: updated, error: updateError } = await supabase
      .from('opc_tickets')
      .update(updates)
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (updateError) {
      return jsonResponse(
        { ok: false, error: `Ticket konnte nicht aktualisiert werden: ${updateError.message}` },
        500
      );
    }

    const eventMessages: string[] = [];

    if (status && status !== current.status) {
      eventMessages.push(`Status geändert: ${statusLabel(current.status)} → ${statusLabel(status)}`);
    }

    if (priority && priority !== current.priority) {
      eventMessages.push(`Priorität geändert: ${current.priority || '—'} → ${priority}`);
    }

    if (category && category !== current.category) {
      eventMessages.push(`Kategorie geändert: ${current.category || '—'} → ${category}`);
    }

    if (internalNote) {
      eventMessages.push(`Interne Notiz: ${internalNote}`);
    }

    if (eventMessages.length === 0) {
      eventMessages.push('Ticket wurde geprüft.');
    }

    const eventRows = eventMessages.map((message) => ({
      ticket_id: id,
      ticket_number: current.ticket_number || null,
      event_type: internalNote && message.startsWith('Interne Notiz') ? 'internal_note' : 'internal_update',
      message,
      actor_type: actor.actor_type,
      actor_user_id: actor.actor_user_id,
      actor_name: actor.actor_name,
      actor_email: actor.actor_email,
      old_status: current.status || null,
      new_status: status || current.status || null,
      visibility: 'internal',
      metadata: {
        actor_name: actor.actor_name,
        actor_email: actor.actor_email,
        changes: updates,
      },
    }));

    const { error: eventError } = await supabase.from('opc_ticket_events').insert(eventRows);

    return jsonResponse({
      ok: true,
      ticket: updated,
      event_error: eventError?.message || null,
    });
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Ticket konnte nicht aktualisiert werden.',
      },
      500
    );
  }
};

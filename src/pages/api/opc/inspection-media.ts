import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { getOpcServerEnvValue } from '../../../lib/opc-server-env';

export const prerender = false;

const BUCKET_ID = 'opc-site-inspection-media';
const MAX_FILES = 20;
const MAX_FILE_SIZE_BYTES = 30 * 1024 * 1024;
const RESTORE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

type StaffActor = {
  userId: string;
  employeeId: string | null;
  role: 'owner' | 'admin' | 'dispatch' | 'employee';
  displayName: string;
  email: string;
};

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

function clean(value: unknown) {
  return String(value ?? '').trim();
}

function normalizeRole(value: unknown) {
  const role = clean(value).toLowerCase();

  if (role === 'godmode' || role === 'owner') return 'owner';
  if (role === 'admin') return 'admin';
  if (['dispatch', 'dispatcher', 'disposition'].includes(role)) return 'dispatch';
  if (['employee', 'mitarbeiter', 'staff'].includes(role)) return 'employee';

  return '';
}

function getServerSupabase(locals: any) {
  const supabaseUrl =
    getOpcServerEnvValue(locals, 'SUPABASE_URL') ||
    getOpcServerEnvValue(locals, 'PUBLIC_SUPABASE_URL');

  const serviceRoleKey =
    getOpcServerEnvValue(locals, 'SUPABASE_SERVICE_ROLE_KEY') ||
    getOpcServerEnvValue(locals, 'SUPABASE_SERVICE_ROLE');

  if (!supabaseUrl) throw new Error('SUPABASE_URL fehlt.');
  if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY fehlt.');

  const lowerKey = serviceRoleKey.toLowerCase();
  if (serviceRoleKey.startsWith('sb_publishable_') || lowerKey.includes('anon')) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY enthält keinen gültigen Service-Role-Key.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        'X-OPC-Route': 'inspection-media',
      },
    },
  });
}

function getAccessToken(request: Request, cookies: any) {
  const authorization = request.headers.get('authorization') || '';

  if (/^Bearer\s+/i.test(authorization)) {
    return authorization.replace(/^Bearer\s+/i, '').trim();
  }

  return clean(cookies.get('sb-access-token')?.value);
}

async function resolveActor(supabaseAdmin: any, accessToken: string): Promise<StaffActor> {
  if (!accessToken) throw new Error('Nicht authentifiziert.');

  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(accessToken);

  if (authError || !user) {
    throw new Error('Ungültige oder abgelaufene Sitzung.');
  }

  const { data: staffRole, error: staffError } = await supabaseAdmin
    .from('opc_staff_roles')
    .select('id,user_id,employee_id,role,display_name,email,status,can_access_portal,can_manage_jobs,can_view_all_jobs')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  if (staffError) {
    throw new Error(`Rollenprüfung fehlgeschlagen: ${staffError.message}`);
  }

  let role = normalizeRole(staffRole?.role);

  if (!['owner', 'admin', 'dispatch'].includes(role) && (
    staffRole?.can_manage_jobs === true ||
    staffRole?.can_view_all_jobs === true
  )) {
    role = 'dispatch';
  }

  let profile: any = null;
  if (!staffRole || !role) {
    const profileResponse = await supabaseAdmin
      .from('user_profiles')
      .select('id,email,full_name,role')
      .eq('id', user.id)
      .maybeSingle();

    if (!profileResponse.error) profile = profileResponse.data;
    role = normalizeRole(profile?.role);
  }

  if (!role || !['owner', 'admin', 'dispatch', 'employee'].includes(role)) {
    throw new Error('Keine Berechtigung für Besichtigungsmedien.');
  }

  if (staffRole && staffRole.can_access_portal === false) {
    throw new Error('Der Portalzugriff ist deaktiviert.');
  }

  return {
    userId: user.id,
    employeeId: staffRole?.employee_id || null,
    role: role as StaffActor['role'],
    displayName: clean(staffRole?.display_name || profile?.full_name || user.email || 'Mitarbeiter'),
    email: clean(staffRole?.email || profile?.email || user.email),
  };
}

function collectAssignmentIds(source: any) {
  if (!source || typeof source !== 'object') return new Set<string>();

  const scalarKeys = [
    'created_by',
    'assigned_to',
    'assigned_to_user_id',
    'assigned_user_id',
    'employee_id',
    'assigned_employee_id',
    'inspector_id',
    'inspector_user_id',
    'staff_user_id',
  ];
  const listKeys = [
    'assigned_to_ids',
    'assigned_user_ids',
    'employee_ids',
    'assigned_employee_ids',
    'inspector_ids',
    'staff_user_ids',
  ];

  const values = new Set<string>();

  for (const key of scalarKeys) {
    const value = clean(source[key]);
    if (value) values.add(value);
  }

  for (const key of listKeys) {
    const candidate = source[key];
    if (!Array.isArray(candidate)) continue;

    for (const value of candidate) {
      const normalized = clean(
        typeof value === 'object'
          ? value?.id || value?.user_id || value?.employee_id
          : value,
      );
      if (normalized) values.add(normalized);
    }
  }

  return values;
}

async function employeeHasInspectionAccess(
  supabaseAdmin: any,
  inspection: any,
  actor: StaffActor,
) {
  const candidates = new Set<string>([
    ...collectAssignmentIds(inspection),
    ...collectAssignmentIds(inspection?.metadata),
  ]);

  if (candidates.has(actor.userId)) return true;
  if (actor.employeeId && candidates.has(actor.employeeId)) return true;

  const ownMediaResponse = await supabaseAdmin
    .from('opc_site_inspection_media')
    .select('id')
    .eq('inspection_id', inspection.id)
    .eq('uploaded_by', actor.userId)
    .limit(1);

  if (!ownMediaResponse.error && ownMediaResponse.data?.length) return true;

  const assignmentTables = ['opc_job_assignments', 'opc_service_jobs'];

  for (const tableName of assignmentTables) {
    const response = await supabaseAdmin
      .from(tableName)
      .select('*')
      .eq('inspection_id', inspection.id)
      .limit(50);

    if (response.error || !Array.isArray(response.data)) continue;

    for (const row of response.data) {
      const rowIds = new Set<string>([
        ...collectAssignmentIds(row),
        ...collectAssignmentIds(row?.metadata),
      ]);

      if (rowIds.has(actor.userId)) return true;
      if (actor.employeeId && rowIds.has(actor.employeeId)) return true;
    }
  }

  return false;
}

async function getInspection(
  supabaseAdmin: any,
  inspectionId: string,
  actor: StaffActor,
) {
  const { data: inspection, error } = await supabaseAdmin
    .from('opc_site_inspections')
    .select('*')
    .eq('id', inspectionId)
    .maybeSingle();

  if (error) throw new Error(`Besichtigung konnte nicht geprüft werden: ${error.message}`);
  if (!inspection) throw new Error('Besichtigung wurde nicht gefunden.');

  if (actor.role === 'employee') {
    const allowed = await employeeHasInspectionAccess(supabaseAdmin, inspection, actor);
    if (!allowed) {
      throw new Error('Diese Besichtigung ist dem Mitarbeiter nicht zugewiesen.');
    }
  }

  return inspection;
}

async function createSignedUrl(supabaseAdmin: any, row: any) {
  const bucketId = clean(row.bucket_id) || BUCKET_ID;
  const objectPath = clean(row.object_path);

  if (!objectPath) return null;

  const { data, error } = await supabaseAdmin.storage
    .from(bucketId)
    .createSignedUrl(objectPath, 60 * 30);

  if (error) return null;
  return data?.signedUrl || null;
}

function inspectionSummary(inspection: any) {
  const snapshot = inspection?.address_snapshot && typeof inspection.address_snapshot === 'object'
    ? inspection.address_snapshot
    : {};

  return {
    id: inspection.id,
    inspection_number: inspection.inspection_number || null,
    status: inspection.status || null,
    requested_service_category: inspection.requested_service_category || null,
    scheduled_at: inspection.scheduled_at || null,
    address: [
      snapshot.address_text,
      [snapshot.postal_code, snapshot.city].filter(Boolean).join(' '),
    ].filter(Boolean).join(', '),
  };
}

function restoreAvailableUntil(value: unknown) {
  const date = new Date(clean(value));
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() >= Date.now();
}

async function purgeExpiredTrash(supabaseAdmin: any, actor: StaffActor) {
  if (actor.role !== 'owner' && actor.role !== 'admin') return;

  const expiredResponse = await supabaseAdmin
    .from('opc_site_inspection_media_trash')
    .select('media_id,inspection_id,client_id,bucket_id,object_path,media_snapshot')
    .lt('restore_until', new Date().toISOString())
    .is('permanently_deleted_at', null)
    .order('restore_until', { ascending: true })
    .limit(100);

  if (expiredResponse.error || !Array.isArray(expiredResponse.data)) return;

  for (const row of expiredResponse.data) {
    const bucketId = clean(row.bucket_id) || BUCKET_ID;
    const objectPath = clean(row.object_path);

    if (objectPath) {
      const removeResponse = await supabaseAdmin.storage
        .from(bucketId)
        .remove([objectPath]);

      if (removeResponse.error) continue;
    }

    const deletedAt = new Date().toISOString();
    const updateResponse = await supabaseAdmin
      .from('opc_site_inspection_media_trash')
      .update({ permanently_deleted_at: deletedAt })
      .eq('media_id', row.media_id)
      .is('permanently_deleted_at', null);

    if (updateResponse.error) continue;

    await supabaseAdmin.from('opc_site_inspection_media_audit').insert({
      media_id: row.media_id,
      inspection_id: row.inspection_id,
      client_id: row.client_id,
      action: 'permanently_deleted',
      actor_user_id: actor.userId,
      actor_role: actor.role,
      actor_display_name: 'Automatische 30-Tage-Bereinigung',
      reason: 'Wiederherstellungsfrist abgelaufen.',
      media_snapshot: row.media_snapshot || {},
    });
  }
}

async function loadPayload(supabaseAdmin: any, inspection: any, actor: StaffActor) {
  const mediaResponse = await supabaseAdmin
    .from('opc_site_inspection_media')
    .select('*')
    .eq('inspection_id', inspection.id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (mediaResponse.error) {
    throw new Error(`Besichtigungsmedien konnten nicht geladen werden: ${mediaResponse.error.message}`);
  }

  const media = await Promise.all((mediaResponse.data || []).map(async (row: any) => ({
    ...row,
    preview_url: await createSignedUrl(supabaseAdmin, row),
    can_delete:
      actor.role === 'owner' ||
      (actor.role === 'employee' && row.uploaded_by === actor.userId),
  })));

  let deleted: any[] = [];
  let audit: any[] = [];

  if (actor.role === 'owner' || actor.role === 'admin') {
    const [trashResponse, auditResponse] = await Promise.all([
      supabaseAdmin
        .from('opc_site_inspection_media_trash')
        .select('*')
        .eq('inspection_id', inspection.id)
        .order('deleted_at', { ascending: false }),
      supabaseAdmin
        .from('opc_site_inspection_media_audit')
        .select('*')
        .eq('inspection_id', inspection.id)
        .order('created_at', { ascending: false })
        .limit(250),
    ]);

    if (trashResponse.error) {
      throw new Error(`Gelöschte Medien konnten nicht geladen werden: ${trashResponse.error.message}`);
    }
    if (auditResponse.error) {
      throw new Error(`Löschprotokoll konnte nicht geladen werden: ${auditResponse.error.message}`);
    }

    deleted = await Promise.all((trashResponse.data || []).map(async (row: any) => ({
      ...row,
      preview_url: await createSignedUrl(supabaseAdmin, row),
      can_restore:
        actor.role === 'owner' &&
        !row.permanently_deleted_at &&
        restoreAvailableUntil(row.restore_until),
    })));
    audit = auditResponse.data || [];
  }

  return {
    success: true,
    actor: {
      id: actor.userId,
      role: actor.role,
      display_name: actor.displayName,
    },
    inspection: inspectionSummary(inspection),
    media,
    deleted,
    audit,
  };
}

function sanitizeFileName(fileName: string) {
  const safe = clean(fileName)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  return safe || 'datei';
}

// OPC_INSPECTION_UPLOAD_IDEMPOTENCY_20260812
function sanitizeUploadToken(value: unknown) {
  return clean(value)
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

async function findExistingUpload(
  supabaseAdmin: any,
  inspectionId: string,
  actorUserId: string,
  uploadToken: string,
) {
  if (!uploadToken) return null;

  const response = await supabaseAdmin
    .from('opc_site_inspection_media')
    .select('*')
    .eq('inspection_id', inspectionId)
    .eq('uploaded_by', actorUserId)
    .contains('metadata', {
      upload_token: uploadToken,
    })
    .limit(1)
    .maybeSingle();

  if (response.error) {
    return null;
  }

  return response.data || null;
}

function fileExtension(file: File) {
  const name = clean(file.name).toLowerCase();
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1) : '';
}

function getMediaType(file: File) {
  const type = clean(file.type).toLowerCase();
  const extension = fileExtension(file);

  if (
    type.startsWith('video/') ||
    ['mov', 'mp4', 'm4v', 'webm'].includes(extension)
  ) {
    return 'video';
  }

  if (
    type === 'application/pdf' ||
    extension === 'pdf'
  ) {
    return 'document';
  }

  return 'image';
}

function isAllowedFile(file: File) {
  const type = clean(file.type).toLowerCase();
  const extension = fileExtension(file);

  if (
    type.startsWith('image/') ||
    type.startsWith('video/') ||
    type === 'application/pdf'
  ) {
    return true;
  }

  if (!type || type === 'application/octet-stream') {
    return [
      'jpg',
      'jpeg',
      'png',
      'webp',
      'gif',
      'heic',
      'heif',
      'mov',
      'mp4',
      'm4v',
      'webm',
      'pdf',
    ].includes(extension);
  }

  return false;
}

function errorStatus(message: string) {
  if (message.includes('authentifiziert') || message.includes('Sitzung')) return 401;
  if (message.includes('Berechtigung') || message.includes('zugewiesen') || message.includes('Portalzugriff') || message.includes('Nur Owner')) return 403;
  if (message.includes('nicht gefunden')) return 404;
  if (message.includes('30 Tagen') || message.includes('endgültig gelöscht')) return 409;
  return 500;
}

export const GET: APIRoute = async ({ request, locals, cookies, url }) => {
  try {
    const inspectionId = clean(url.searchParams.get('inspection_id'));
    if (!inspectionId) return jsonResponse({ success: false, error: 'inspection_id fehlt.' }, 400);

    const supabaseAdmin = getServerSupabase(locals);
    const actor = await resolveActor(supabaseAdmin, getAccessToken(request, cookies));
    const inspection = await getInspection(supabaseAdmin, inspectionId, actor);
    await purgeExpiredTrash(supabaseAdmin, actor);
    const payload = await loadPayload(supabaseAdmin, inspection, actor);

    return jsonResponse(payload);
  } catch (error: any) {
    const message = error?.message || 'Besichtigungsmedien konnten nicht geladen werden.';
    return jsonResponse({ success: false, error: message }, errorStatus(message));
  }
};

export const POST: APIRoute = async ({ request, locals, cookies }) => {
  try {
    const supabaseAdmin = getServerSupabase(locals);
    const actor = await resolveActor(supabaseAdmin, getAccessToken(request, cookies));
    const formData = await request.formData();
    const inspectionId = clean(formData.get('inspection_id'));
    const uploadToken = sanitizeUploadToken(
      formData.get('upload_token'),
    );

    if (!inspectionId) return jsonResponse({ success: false, error: 'inspection_id fehlt.' }, 400);

    const inspection = await getInspection(supabaseAdmin, inspectionId, actor);
    const files = formData
      .getAll('files')
      .filter((value): value is File => value instanceof File);

    if (!files.length) return jsonResponse({ success: false, error: 'Keine Dateien ausgewählt.' }, 400);
    if (files.length > MAX_FILES) {
      return jsonResponse({ success: false, error: `Maximal ${MAX_FILES} Dateien pro Upload.` }, 400);
    }

    const invalidFile = files.find((file) => !isAllowedFile(file) || file.size > MAX_FILE_SIZE_BYTES);
    if (invalidFile) {
      return jsonResponse({
        success: false,
        error: `${invalidFile.name}: Nur Bilder, Videos und PDF bis 30 MB sind erlaubt.`,
      }, 400);
    }

    if (uploadToken && files.length === 1) {
      const existingUpload =
        await findExistingUpload(
          supabaseAdmin,
          inspection.id,
          actor.userId,
          uploadToken,
        );

      if (existingUpload) {
        return jsonResponse({
          success: true,
          uploaded_count: 1,
          reused: true,
        }, 200);
      }
    }

    const lastSortResponse = await supabaseAdmin
      .from('opc_site_inspection_media')
      .select('sort_order')
      .eq('inspection_id', inspection.id)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    const firstSortOrder = Number(lastSortResponse.data?.sort_order || 0) + 1;
    const uploaded: any[] = [];

    for (const [index, file] of files.entries()) {
      const safeName = sanitizeFileName(file.name);
      const objectName = uploadToken
        ? `${uploadToken}-${safeName}`
        : `${Date.now()}-${crypto.randomUUID()}-${safeName}`;
      const objectPath = `${inspection.client_id}/${inspection.id}/${objectName}`;
      const arrayBuffer = await file.arrayBuffer();

      const uploadResponse = await supabaseAdmin.storage
        .from(BUCKET_ID)
        .upload(objectPath, arrayBuffer, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || undefined,
        });

      if (uploadResponse.error) {
        if (uploadToken) {
          const existingUpload =
            await findExistingUpload(
              supabaseAdmin,
              inspection.id,
              actor.userId,
              uploadToken,
            );

          if (existingUpload) {
            uploaded.push(existingUpload);
            continue;
          }
        }

        throw new Error(`${file.name}: ${uploadResponse.error.message}`);
      }

      const mediaInsert = await supabaseAdmin
        .from('opc_site_inspection_media')
        .insert({
          inspection_id: inspection.id,
          client_id: inspection.client_id,
          client_site_id: inspection.client_site_id || null,
          bucket_id: BUCKET_ID,
          object_path: objectPath,
          media_type: getMediaType(file),
          purpose: 'inspection',
          file_name: file.name,
          mime_type: file.type || null,
          file_size_bytes: file.size,
          sort_order: firstSortOrder + index,
          uploaded_by: actor.userId,
          metadata: {
            uploaded_via: 'inspection_media_api',
            uploader_role: actor.role,
          },
        })
        .select('*')
        .single();

      if (mediaInsert.error || !mediaInsert.data) {
        await supabaseAdmin.storage.from(BUCKET_ID).remove([objectPath]);
        throw new Error(`${file.name}: ${mediaInsert.error?.message || 'Datenbankeintrag fehlgeschlagen.'}`);
      }

      await supabaseAdmin.from('opc_site_inspection_media_audit').insert({
        media_id: mediaInsert.data.id,
        inspection_id: inspection.id,
        client_id: inspection.client_id,
        action: 'uploaded',
        actor_user_id: actor.userId,
        actor_role: actor.role,
        actor_display_name: actor.displayName,
        media_snapshot: mediaInsert.data,
      });

      uploaded.push(mediaInsert.data);
    }

    return jsonResponse({ success: true, uploaded_count: uploaded.length }, 201);
  } catch (error: any) {
    const message = error?.message || 'Upload fehlgeschlagen.';
    return jsonResponse({ success: false, error: message }, errorStatus(message));
  }
};

export const DELETE: APIRoute = async ({ request, locals, cookies }) => {
  try {
    const supabaseAdmin = getServerSupabase(locals);
    const actor = await resolveActor(supabaseAdmin, getAccessToken(request, cookies));
    const body = await request.json().catch(() => ({}));
    const mediaId = clean(body?.media_id);
    const reason = clean(body?.reason);

    if (!mediaId) return jsonResponse({ success: false, error: 'media_id fehlt.' }, 400);

    const mediaResponse = await supabaseAdmin
      .from('opc_site_inspection_media')
      .select('*')
      .eq('id', mediaId)
      .maybeSingle();

    if (mediaResponse.error) throw new Error(mediaResponse.error.message);
    if (!mediaResponse.data) throw new Error('Besichtigungsmedium wurde nicht gefunden.');

    await getInspection(supabaseAdmin, mediaResponse.data.inspection_id, actor);

    const employeeOwnsMedia =
      actor.role === 'employee' &&
      mediaResponse.data.uploaded_by === actor.userId;

    if (actor.role !== 'owner' && !employeeOwnsMedia) {
      throw new Error('Keine Berechtigung zum Löschen dieses Bildes.');
    }

    const rpcResponse = await supabaseAdmin.rpc('opc_soft_delete_inspection_media', {
      p_media_id: mediaId,
      p_actor_user_id: actor.userId,
      p_actor_role: actor.role,
      p_actor_display_name: actor.displayName,
      p_reason: reason || null,
    });

    if (rpcResponse.error) throw new Error(rpcResponse.error.message);

    return jsonResponse({
      success: true,
      restore_until: new Date(Date.now() + RESTORE_WINDOW_MS).toISOString(),
    });
  } catch (error: any) {
    const message = error?.message || 'Bild konnte nicht gelöscht werden.';
    return jsonResponse({ success: false, error: message }, errorStatus(message));
  }
};

export const PATCH: APIRoute = async ({ request, locals, cookies }) => {
  try {
    const supabaseAdmin = getServerSupabase(locals);
    const actor = await resolveActor(supabaseAdmin, getAccessToken(request, cookies));

    if (actor.role !== 'owner') {
      throw new Error('Nur Owner können gelöschte Bilder wiederherstellen.');
    }

    const body = await request.json().catch(() => ({}));
    const mediaId = clean(body?.media_id);

    if (!mediaId) return jsonResponse({ success: false, error: 'media_id fehlt.' }, 400);

    const trashResponse = await supabaseAdmin
      .from('opc_site_inspection_media_trash')
      .select('media_id,inspection_id,restore_until,permanently_deleted_at')
      .eq('media_id', mediaId)
      .maybeSingle();

    if (trashResponse.error) throw new Error(trashResponse.error.message);
    if (!trashResponse.data) throw new Error('Gelöschtes Besichtigungsmedium wurde nicht gefunden.');

    await getInspection(supabaseAdmin, trashResponse.data.inspection_id, actor);

    const restoreUntil = new Date(trashResponse.data.restore_until);
    if (
      trashResponse.data.permanently_deleted_at ||
      Number.isNaN(restoreUntil.getTime()) ||
      restoreUntil.getTime() < Date.now()
    ) {
      throw new Error('Die Wiederherstellungsfrist von 30 Tagen ist abgelaufen.');
    }

    const rpcResponse = await supabaseAdmin.rpc('opc_restore_inspection_media', {
      p_media_id: mediaId,
      p_actor_user_id: actor.userId,
      p_actor_role: actor.role,
      p_actor_display_name: actor.displayName,
    });

    if (rpcResponse.error) throw new Error(rpcResponse.error.message);

    return jsonResponse({ success: true });
  } catch (error: any) {
    const message = error?.message || 'Bild konnte nicht wiederhergestellt werden.';
    return jsonResponse({ success: false, error: message }, errorStatus(message));
  }
};

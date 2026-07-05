import type { APIRoute } from 'astro';
import {
  officeErrorResponse,
  officeJson,
  OpcOfficeHttpError,
  requireOpcOfficeAuth,
} from '../../../../lib/opc-office-auth';
import { createBlankOfficeTemplate } from '../../../../lib/opc-office-templates';
import {
  canManageOfficeDocuments,
  ensureOfficeFileName,
  extensionFromFileName,
  getOfficeMimeType,
  inferOfficeDocumentKind,
  isAllowedOfficeExtension,
  OPC_OFFICE_BUCKET,
  OPC_OFFICE_MAX_FILE_SIZE,
  sanitizeOfficeFileName,
  type OpcDocumentKind,
} from '../../../../lib/opc-office-types';

export const prerender = false;

function clean(value: unknown) {
  return String(value ?? '').trim();
}

function titleFromFileName(fileName: string) {
  return clean(fileName).replace(/\.[^.]+$/, '') || 'Dokument';
}

async function createDocumentRecord({
  auth,
  title,
  description,
  fileName,
  extension,
  mimeType,
  kind,
  bytes,
  versionSource,
  link,
}: {
  auth: Awaited<ReturnType<typeof requireOpcOfficeAuth>>;
  title: string;
  description?: string | null;
  fileName: string;
  extension: string;
  mimeType: string;
  kind: OpcDocumentKind;
  bytes: Uint8Array;
  versionSource: 'upload' | 'template';
  link?: { entityType: string; entityId: string } | null;
}) {
  const now = new Date().toISOString();
  const { data: document, error: documentError } = await auth.admin
    .from('opc_documents')
    .insert({
      title,
      description: description || null,
      document_kind: kind,
      file_name: fileName,
      file_extension: extension,
      mime_type: mimeType,
      status: 'active',
      visibility: 'internal',
      storage_bucket: OPC_OFFICE_BUCKET,
      owner_user_id: auth.user.id,
      created_by: auth.user.id,
      updated_by: auth.user.id,
      metadata: {
        source: versionSource === 'template' ? 'portal_blank_document' : 'portal_upload',
        created_by_role: auth.role,
      },
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single();

  if (documentError || !document) {
    throw new Error(`Document creation failed: ${documentError?.message || 'No document returned.'}`);
  }

  const storagePath = `documents/${document.id}/versions/${crypto.randomUUID()}-${fileName}`;
  const { error: uploadError } = await auth.admin.storage
    .from(OPC_OFFICE_BUCKET)
    .upload(storagePath, bytes, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    await auth.admin.from('opc_documents').delete().eq('id', document.id);
    throw new Error(`Document upload failed: ${uploadError.message}`);
  }

  const { data: version, error: versionError } = await auth.admin
    .from('opc_document_versions')
    .insert({
      document_id: document.id,
      storage_bucket: OPC_OFFICE_BUCKET,
      storage_path: storagePath,
      file_name: fileName,
      file_extension: extension,
      mime_type: mimeType,
      file_size_bytes: bytes.byteLength,
      version_source: versionSource,
      created_by: auth.user.id,
      metadata: {
        source: versionSource,
      },
    })
    .select('*')
    .single();

  if (versionError || !version) {
    await auth.admin.storage.from(OPC_OFFICE_BUCKET).remove([storagePath]);
    await auth.admin.from('opc_documents').delete().eq('id', document.id);
    throw new Error(`Document version creation failed: ${versionError?.message || 'No version returned.'}`);
  }

  if (link?.entityType && link?.entityId) {
    const { error: linkError } = await auth.admin.from('opc_document_links').insert({
      document_id: document.id,
      entity_type: link.entityType,
      entity_id: link.entityId,
      relationship: 'related',
      created_by: auth.user.id,
      metadata: { source: 'document_create' },
    });

    if (linkError) {
      console.warn('[opc-office] Document link could not be created:', linkError.message);
    }
  }

  return {
    ...document,
    storage_path: storagePath,
    current_version_id: version.id,
    current_version_number: version.version_number,
    file_size_bytes: bytes.byteLength,
  };
}

export const GET: APIRoute = async ({ request, locals, cookies }) => {
  try {
    const auth = await requireOpcOfficeAuth({ request, locals, cookies });
    const url = new URL(request.url);
    const query = clean(url.searchParams.get('q'));
    const kind = clean(url.searchParams.get('kind'));
    const client = canManageOfficeDocuments(auth.role) ? auth.admin : auth.userClient;

    let builder = client
      .from('opc_documents')
      .select(
        'id, document_key, title, description, document_kind, file_name, file_extension, mime_type, status, visibility, current_version_id, current_version_number, file_size_bytes, owner_user_id, created_by, updated_by, metadata, created_at, updated_at',
      )
      .is('deleted_at', null)
      .neq('status', 'deleted')
      .order('updated_at', { ascending: false })
      .limit(300);

    if (query) {
      const escaped = query.replace(/[%_]/g, '\\$&');
      builder = builder.or(
        `title.ilike.%${escaped}%,file_name.ilike.%${escaped}%,description.ilike.%${escaped}%`,
      );
    }

    if (kind) {
      builder = builder.eq('document_kind', kind);
    }

    const { data, error } = await builder;

    if (error) {
      throw new Error(`Documents could not be loaded: ${error.message}`);
    }

    return officeJson({
      success: true,
      role: auth.role,
      canCreate: canManageOfficeDocuments(auth.role),
      documents: data || [],
    });
  } catch (error) {
    return officeErrorResponse(error);
  }
};

export const POST: APIRoute = async ({ request, locals, cookies }) => {
  try {
    const auth = await requireOpcOfficeAuth({ request, locals, cookies });

    if (!canManageOfficeDocuments(auth.role)) {
      throw new OpcOfficeHttpError('You do not have permission to create documents.', 403);
    }

    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      const file = form.get('file');

      if (!(file instanceof File) || file.size <= 0) {
        throw new OpcOfficeHttpError('Please select a document to upload.', 400);
      }

      if (file.size > OPC_OFFICE_MAX_FILE_SIZE) {
        throw new OpcOfficeHttpError('The document is larger than 100 MB.', 413);
      }

      const extension = extensionFromFileName(file.name);

      if (!isAllowedOfficeExtension(extension)) {
        throw new OpcOfficeHttpError('This file type is not supported.', 415);
      }

      const safeFileName = sanitizeOfficeFileName(file.name, `dokument.${extension}`);
      const title = clean(form.get('title')) || titleFromFileName(file.name);
      const entityType = clean(form.get('entityType'));
      const entityId = clean(form.get('entityId'));
      const bytes = new Uint8Array(await file.arrayBuffer());

      const document = await createDocumentRecord({
        auth,
        title,
        description: clean(form.get('description')) || null,
        fileName: safeFileName,
        extension,
        mimeType: getOfficeMimeType(extension, file.type),
        kind: inferOfficeDocumentKind(extension),
        bytes,
        versionSource: 'upload',
        link: entityType && entityId ? { entityType, entityId } : null,
      });

      return officeJson({ success: true, document }, 201);
    }

    const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const kind = clean(payload.kind) as OpcDocumentKind;

    if (!['document', 'spreadsheet', 'presentation'].includes(kind)) {
      throw new OpcOfficeHttpError('Select a document, spreadsheet or presentation.', 400);
    }

    const title = clean(payload.title) ||
      (kind === 'spreadsheet'
        ? 'Neue Tabelle'
        : kind === 'presentation'
          ? 'Neue Präsentation'
          : 'Neues Dokument');
    const template = createBlankOfficeTemplate(kind);
    const fileName = ensureOfficeFileName(title, template.extension);
    const entityType = clean(payload.entityType);
    const entityId = clean(payload.entityId);

    const document = await createDocumentRecord({
      auth,
      title,
      description: clean(payload.description) || null,
      fileName,
      extension: template.extension,
      mimeType: template.mimeType,
      kind,
      bytes: template.bytes,
      versionSource: 'template',
      link: entityType && entityId ? { entityType, entityId } : null,
    });

    return officeJson({ success: true, document }, 201);
  } catch (error) {
    return officeErrorResponse(error);
  }
};

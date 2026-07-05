import type { APIRoute } from 'astro';
import { createOpcSupabaseAdmin, getOpcOfficeConfig } from '../../../../../lib/opc-server-env';
import { verifyOfficeJwt } from '../../../../../lib/opc-office-jwt';
import {
  getOfficeMimeType,
  normalizeOfficeExtension,
  OPC_OFFICE_BUCKET,
  OPC_OFFICE_MAX_FILE_SIZE,
  sanitizeOfficeFileName,
} from '../../../../../lib/opc-office-types';

export const prerender = false;

type CallbackToken = {
  purpose?: string;
  documentId?: string;
  editorKey?: string;
  exp?: number;
};

function response(error = 0, status = 200) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

export const POST: APIRoute = async ({ request, locals, params }) => {
  const documentId = String(params.id || '').trim();

  try {
    if (!documentId) return response(1, 400);

    const office = getOpcOfficeConfig(locals);
    const token = new URL(request.url).searchParams.get('token') || '';
    const signed = await verifyOfficeJwt<CallbackToken>(token, office.jwtSecret);

    if (
      signed.purpose !== 'office_callback' ||
      signed.documentId !== documentId ||
      !signed.editorKey
    ) {
      return response(1, 401);
    }

    const payload = (await request.json().catch(() => null)) as any;

    if (!payload || typeof payload !== 'object') return response(1, 400);
    if (payload.key && payload.key !== signed.editorKey) return response(1, 409);

    const callbackStatus = Number(payload.status || 0);
    const admin = createOpcSupabaseAdmin(locals);

    if (![2, 6].includes(callbackStatus)) {
      await admin.from('opc_document_activity').insert({
        document_id: documentId,
        action: [3, 7].includes(callbackStatus) ? 'callback_failed' : 'callback_received',
        metadata: {
          callback_status: callbackStatus,
          editor_key: signed.editorKey,
        },
      });

      return response(0);
    }

    const { data: document, error: documentError } = await admin
      .from('opc_documents')
      .select('id, title, file_name, file_extension, mime_type, storage_bucket, status, deleted_at')
      .eq('id', documentId)
      .maybeSingle();

    if (documentError || !document || document.deleted_at || document.status === 'deleted') {
      return response(1, 404);
    }

    const callbackUrl = new URL(String(payload.url || ''));
    const configuredEngineUrl = new URL(office.serverUrl);

    if (callbackUrl.origin !== configuredEngineUrl.origin) {
      return response(1, 400);
    }

    const approvedDownloadUrl = new URL(
      `${callbackUrl.pathname}${callbackUrl.search}`,
      configuredEngineUrl.origin,
    );
    const fileResponse = await fetch(approvedDownloadUrl, {
      method: 'GET',
      redirect: 'error',
    });

    if (!fileResponse.ok) {
      throw new Error(`Office file download failed with HTTP ${fileResponse.status}.`);
    }

    const declaredLength = Number(fileResponse.headers.get('content-length') || 0);
    if (declaredLength > OPC_OFFICE_MAX_FILE_SIZE) {
      throw new Error('Saved office document exceeds the 100 MB limit.');
    }

    const bytes = new Uint8Array(await fileResponse.arrayBuffer());
    if (bytes.byteLength <= 0 || bytes.byteLength > OPC_OFFICE_MAX_FILE_SIZE) {
      throw new Error('Saved office document has an invalid size.');
    }

    const extension = normalizeOfficeExtension(document.file_extension);
    const fileName = sanitizeOfficeFileName(
      document.file_name || `${document.title}.${extension}`,
      `dokument.${extension}`,
    );
    const storageBucket = document.storage_bucket || OPC_OFFICE_BUCKET;
    const storagePath = `documents/${documentId}/versions/${crypto.randomUUID()}-${fileName}`;
    const mimeType = getOfficeMimeType(
      extension,
      fileResponse.headers.get('content-type') || document.mime_type,
    );

    const { error: uploadError } = await admin.storage
      .from(storageBucket)
      .upload(storagePath, bytes, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Saved document upload failed: ${uploadError.message}`);
    }

    const { error: versionError } = await admin.from('opc_document_versions').insert({
      document_id: documentId,
      storage_bucket: storageBucket,
      storage_path: storagePath,
      file_name: fileName,
      file_extension: extension,
      mime_type: mimeType,
      file_size_bytes: bytes.byteLength,
      version_source: callbackStatus === 6 ? 'autosave' : 'editor_callback',
      euro_office_status: callbackStatus,
      euro_office_key: signed.editorKey,
      metadata: {
        callback_status: callbackStatus,
        force_save_type: payload.forcesavetype || null,
        users: Array.isArray(payload.users) ? payload.users : [],
      },
    });

    if (versionError) {
      await admin.storage.from(storageBucket).remove([storagePath]);
      throw new Error(`Document version save failed: ${versionError.message}`);
    }

    await admin.from('opc_document_activity').insert({
      document_id: documentId,
      action: callbackStatus === 6 ? 'autosaved' : 'saved',
      metadata: {
        callback_status: callbackStatus,
        editor_key: signed.editorKey,
        file_size_bytes: bytes.byteLength,
      },
    });

    return response(0);
  } catch (error) {
    console.error('[opc-office-callback] Save failed:', error);
    return response(1, 500);
  }
};

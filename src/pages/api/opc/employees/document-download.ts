import type { APIRoute } from 'astro';
import {
  EMPLOYEE_DOCUMENT_BUCKET,
  cleanText,
  errorStatus,
  jsonResponse,
  requireEmployeeHrAccess,
} from '../../../../lib/opc-employee-api';

export const prerender = false;

function safeFilename(value: unknown) {
  return String(value || 'dokument')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 160);
}

export const GET: APIRoute = async ({ request, locals, cookies }) => {
  try {
    const url = new URL(request.url);
    const documentId = cleanText(url.searchParams.get('documentId'));
    if (!documentId) {
      return jsonResponse({ success: false, error: 'Dokument-ID fehlt.' }, 400);
    }

    const { supabase } = await requireEmployeeHrAccess({ request, locals, cookies });
    const { data: document, error } = await supabase
      .from('opc_employee_documents')
      .select('id,employee_id,storage_bucket,storage_path,file_name,title,mime_type')
      .eq('id', documentId)
      .maybeSingle();

    if (error) {
      throw new Error(`Dokument konnte nicht geladen werden: ${error.message}`);
    }
    if (!document) {
      return jsonResponse({ success: false, error: 'Dokument wurde nicht gefunden.' }, 404);
    }

    const bucket = cleanText(document.storage_bucket) || EMPLOYEE_DOCUMENT_BUCKET;
    const path = cleanText(document.storage_path);
    if (!path) {
      return jsonResponse({ success: false, error: 'Dokument hat keinen Speicherpfad.' }, 409);
    }

    const filename = safeFilename(document.file_name || document.title || 'dokument');
    const { data: signed, error: signedError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 5 * 60, {
        download: filename || true,
      });

    if (signedError || !signed?.signedUrl) {
      throw new Error(`Download-Link konnte nicht erstellt werden: ${signedError?.message || 'Keine URL erhalten.'}`);
    }

    return new Response(null, {
      status: 302,
      headers: {
        Location: signed.signedUrl,
        'Cache-Control': 'private, no-store, max-age=0',
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error: any) {
    console.error('[opc/employees/document-download] GET failed', error);
    return jsonResponse(
      { success: false, error: error?.message || 'Dokument konnte nicht heruntergeladen werden.' },
      errorStatus(error),
    );
  }
};

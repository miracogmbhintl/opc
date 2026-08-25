import type { APIRoute } from 'astro';
import {
  authenticateOpcClientPortalRequest,
  opcClientPortalJson,
} from '../../../../lib/opc-client-portal-server';
import { OPC_OFFICE_BUCKET } from '../../../../lib/opc-office-types';

export const prerender = false;

function clean(value: unknown) {
  return String(value ?? '').trim();
}

function metadata(row: Record<string, any> | null | undefined) {
  const value = row?.metadata;
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : {};
}

function isClientVisibleDocument(row: Record<string, any>) {
  if (metadata(row).client_visible === false) return false;
  const status = clean(row.status).toLowerCase();
  return !['internal', 'private', 'draft', 'deleted'].includes(status);
}

function requestWithCookieBearer(request: Request, cookieToken: string) {
  if (request.headers.get('authorization')) return request;
  if (!cookieToken) return request;

  const headers = new Headers(request.headers);
  headers.set('Authorization', `Bearer ${cookieToken}`);

  return new Request(request.url, {
    method: request.method,
    headers,
  });
}

export const GET: APIRoute = async ({ request, locals, cookies }) => {
  try {
    const url = new URL(request.url);
    const documentId = clean(url.searchParams.get('document_id'));

    if (!documentId) {
      return opcClientPortalJson({ ok: false, error: 'Dokument-ID fehlt.' }, 400);
    }

    const cookieToken = clean(cookies.get('sb-access-token')?.value);
    const authRequest = requestWithCookieBearer(request, cookieToken);
    const authenticated = await authenticateOpcClientPortalRequest(authRequest, locals);

    if ('error' in authenticated) {
      return opcClientPortalJson(
        { ok: false, error: authenticated.error },
        authenticated.status,
      );
    }

    const { serviceClient, access } = authenticated;

    if (!access.permissions.canViewReports) {
      return opcClientPortalJson(
        { ok: false, error: 'Keine Berechtigung für Kundendokumente.' },
        403,
      );
    }

    const { data: document, error: documentError } = await serviceClient
      .from('opc_documents')
      .select('*')
      .eq('id', documentId)
      .eq('client_id', access.clientId)
      .maybeSingle();

    if (documentError) {
      throw new Error(`Dokument konnte nicht geladen werden: ${documentError.message}`);
    }

    if (!document || !isClientVisibleDocument(document)) {
      return opcClientPortalJson({ ok: false, error: 'Dokument nicht gefunden.' }, 404);
    }

    let version: Record<string, any> | null = null;

    if (document.current_version_id) {
      const currentResult = await serviceClient
        .from('opc_document_versions')
        .select('*')
        .eq('id', document.current_version_id)
        .eq('document_id', documentId)
        .maybeSingle();

      if (currentResult.error) {
        throw new Error(`Dokumentversion konnte nicht geladen werden: ${currentResult.error.message}`);
      }

      version = currentResult.data || null;
    }

    if (!version) {
      const latestResult = await serviceClient
        .from('opc_document_versions')
        .select('*')
        .eq('document_id', documentId)
        .order('version_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestResult.error) {
        throw new Error(`Dokumentversion konnte nicht geladen werden: ${latestResult.error.message}`);
      }

      version = latestResult.data || null;
    }

    const bucket = clean(version?.storage_bucket || document.storage_bucket || OPC_OFFICE_BUCKET);
    const storagePath = clean(version?.storage_path || document.storage_path);
    const fileName = clean(version?.file_name || document.file_name) || true;

    if (!bucket || !storagePath) {
      return opcClientPortalJson(
        { ok: false, error: 'Für dieses Dokument ist keine Datei hinterlegt.' },
        409,
      );
    }

    const { data: signed, error: signedError } = await serviceClient.storage
      .from(bucket)
      .createSignedUrl(storagePath, 5 * 60, { download: fileName });

    if (signedError || !signed?.signedUrl) {
      throw new Error(
        `Download konnte nicht vorbereitet werden: ${signedError?.message || 'Keine URL erhalten.'}`,
      );
    }

    return new Response(null, {
      status: 302,
      headers: {
        Location: signed.signedUrl,
        'Cache-Control': 'private, no-store, max-age=0',
        Pragma: 'no-cache',
        'Referrer-Policy': 'no-referrer',
      },
    });
  } catch (error: any) {
    console.error('[opc/client-portal/document-download] failed', error);
    return opcClientPortalJson(
      { ok: false, error: error?.message || 'Dokument konnte nicht heruntergeladen werden.' },
      500,
    );
  }
};

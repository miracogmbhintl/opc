import type { APIRoute } from 'astro';
import {
  getOpcOfficeDocumentAccess,
  officeErrorResponse,
  officeJson,
  OpcOfficeHttpError,
  requireOpcOfficeAuth,
} from '../../../../../lib/opc-office-auth';
import { OPC_OFFICE_BUCKET } from '../../../../../lib/opc-office-types';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals, cookies, params }) => {
  try {
    const documentId = String(params.id || '').trim();

    if (!documentId) {
      throw new OpcOfficeHttpError('Missing document ID.', 400);
    }

    const auth = await requireOpcOfficeAuth({ request, locals, cookies });
    const { document, access } = await getOpcOfficeDocumentAccess(auth, documentId);

    if (!access.canDownload) {
      throw new OpcOfficeHttpError('You do not have permission to download this document.', 403);
    }

    if (!document.storage_path) {
      throw new OpcOfficeHttpError('This document does not have a stored file.', 409);
    }

    const { data, error } = await auth.admin.storage
      .from(document.storage_bucket || OPC_OFFICE_BUCKET)
      .createSignedUrl(document.storage_path, 5 * 60, {
        download: document.file_name || true,
      });

    if (error || !data?.signedUrl) {
      throw new Error(`Download URL could not be created: ${error?.message || 'No URL returned.'}`);
    }

    await auth.admin.from('opc_document_activity').insert({
      document_id: documentId,
      action: 'downloaded',
      actor_user_id: auth.user.id,
      actor_role: auth.role,
      metadata: {
        current_version_number: document.current_version_number,
      },
    });

    return officeJson({
      success: true,
      fileName: document.file_name,
      signedUrl: data.signedUrl,
      expiresIn: 300,
    });
  } catch (error) {
    return officeErrorResponse(error);
  }
};

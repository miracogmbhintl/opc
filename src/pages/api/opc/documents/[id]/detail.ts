import type { APIRoute } from 'astro';
import {
  getOpcOfficeDocumentAccess,
  officeErrorResponse,
  officeJson,
  OpcOfficeHttpError,
  requireOpcOfficeAuth,
} from '../../../../../lib/opc-office-auth';

export const prerender = false;

export const GET: APIRoute = async ({ request, locals, cookies, params }) => {
  try {
    const documentId = String(params.id || '').trim();

    if (!documentId) {
      throw new OpcOfficeHttpError('Missing document ID.', 400);
    }

    const auth = await requireOpcOfficeAuth({ request, locals, cookies });
    const { document, access } = await getOpcOfficeDocumentAccess(auth, documentId);

    if (!access.canView) {
      throw new OpcOfficeHttpError('You do not have access to this document.', 403);
    }

    const [{ data: versions, error: versionsError }, { data: links, error: linksError }] =
      await Promise.all([
        auth.admin
          .from('opc_document_versions')
          .select(
            'id, version_number, file_name, file_extension, mime_type, file_size_bytes, version_source, euro_office_status, created_by, metadata, created_at',
          )
          .eq('document_id', documentId)
          .order('version_number', { ascending: false })
          .limit(100),
        auth.admin
          .from('opc_document_links')
          .select('id, entity_type, entity_id, relationship, label, metadata, created_at')
          .eq('document_id', documentId)
          .order('created_at', { ascending: false }),
      ]);

    if (versionsError) {
      throw new Error(`Versions could not be loaded: ${versionsError.message}`);
    }

    if (linksError) {
      throw new Error(`Document links could not be loaded: ${linksError.message}`);
    }

    await auth.admin.from('opc_document_activity').insert({
      document_id: documentId,
      action: 'viewed',
      actor_user_id: auth.user.id,
      actor_role: auth.role,
      metadata: { source: 'document_detail' },
    });

    return officeJson({
      success: true,
      document,
      versions: versions || [],
      links: links || [],
      access,
    });
  } catch (error) {
    return officeErrorResponse(error);
  }
};

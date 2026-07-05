import type { APIRoute } from 'astro';
import {
  getOpcOfficeDocumentAccess,
  officeErrorResponse,
  officeJson,
  OpcOfficeHttpError,
  requireOpcOfficeAuth,
} from '../../../../../lib/opc-office-auth';
import { createOfficeCallbackToken, signOfficeJwt } from '../../../../../lib/opc-office-jwt';
import {
  getEuroOfficeDocumentType,
  normalizeOfficeExtension,
  OPC_OFFICE_BUCKET,
} from '../../../../../lib/opc-office-types';
import {
  getOpcOfficeConfig,
  getOpcPublicOrigin,
} from '../../../../../lib/opc-server-env';

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

    if (!document.storage_path) {
      throw new OpcOfficeHttpError('This document does not have a stored file version.', 409);
    }

    const office = getOpcOfficeConfig(locals);
    const publicOrigin = getOpcPublicOrigin(locals, request);
    const extension = normalizeOfficeExtension(document.file_extension);
    const editorKey = `${String(document.document_key).replace(/-/g, '')}-${document.current_version_number || 0}`;
    const { data: signedFile, error: signedFileError } = await auth.admin.storage
      .from(document.storage_bucket || OPC_OFFICE_BUCKET)
      .createSignedUrl(document.storage_path, 60 * 60);

    if (signedFileError || !signedFile?.signedUrl) {
      throw new Error(`Signed document URL could not be created: ${signedFileError?.message || 'No URL returned.'}`);
    }

    const callbackToken = await createOfficeCallbackToken({
      documentId,
      editorKey,
      secret: office.jwtSecret,
    });
    const callbackUrl = `${publicOrigin}/api/opc/documents/${documentId}/callback?token=${encodeURIComponent(callbackToken)}`;
    const editable = access.canEdit && extension !== 'pdf';

    const unsignedConfig = {
      documentType: getEuroOfficeDocumentType(document.document_kind),
      document: {
        fileType: extension,
        key: editorKey,
        title: document.file_name || document.title,
        url: signedFile.signedUrl,
        permissions: {
          edit: editable,
          download: access.canDownload,
          print: access.canDownload,
          review: editable,
          comment: editable,
          copy: true,
          fillForms: editable,
          modifyContentControl: editable,
          modifyFilter: editable,
        },
      },
      editorConfig: {
        callbackUrl,
        lang: 'de',
        mode: editable ? 'edit' : 'view',
        user: {
          id: auth.user.id,
          name: auth.userName,
          group: auth.role,
        },
        coEditing: {
          mode: 'fast',
          change: true,
        },
        customization: {
          autosave: true,
          forcesave: true,
          compactHeader: false,
          compactToolbar: false,
          help: false,
          plugins: true,
          chat: false,
          comments: true,
          feedback: false,
          goback: {
            url: `${publicOrigin}/dokumente/${documentId}`,
          },
        },
      },
    };

    const token = await signOfficeJwt(unsignedConfig, office.jwtSecret);

    await auth.admin.from('opc_document_activity').insert({
      document_id: documentId,
      action: 'opened_in_editor',
      actor_user_id: auth.user.id,
      actor_role: auth.role,
      metadata: {
        editor_key: editorKey,
        mode: editable ? 'edit' : 'view',
      },
    });

    return officeJson({
      success: true,
      document: {
        id: document.id,
        title: document.title,
        fileName: document.file_name,
        extension,
        currentVersionNumber: document.current_version_number,
      },
      access,
      scriptUrl: office.apiScriptUrl,
      config: {
        ...unsignedConfig,
        token,
      },
    });
  } catch (error) {
    return officeErrorResponse(error);
  }
};

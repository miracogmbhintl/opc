import type { APIRoute } from 'astro';
import {
  EMPLOYEE_DOCUMENT_BUCKET,
  cleanText,
  errorStatus,
  jsonResponse,
  requireEmployeeHrAccess,
  sanitizeFileName,
  throwOnError,
} from '../../../../lib/opc-employee-api';

export const prerender = false;

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const OWNER_ONLY_TYPES = new Set([
  'employment_contract',
  'contract_addendum',
  'tax_document',
  'insurance_document',
]);

export const POST: APIRoute = async ({ request, locals, cookies }) => {
  let uploadedPath: string | null = null;

  try {
    const { supabase, access } = await requireEmployeeHrAccess({ request, locals, cookies });
    const form = await request.formData();
    const employeeId = cleanText(form.get('employeeId'));
    const documentType = cleanText(form.get('documentType')) || 'other';
    const title = cleanText(form.get('title'));
    const documentSubtype = cleanText(form.get('documentSubtype'));
    const validFrom = cleanText(form.get('validFrom'));
    const validUntil = cleanText(form.get('validUntil'));
    const notes = cleanText(form.get('notes'));
    const file = form.get('file');

    if (!employeeId) {
      return jsonResponse({ success: false, error: 'Mitarbeiter-ID fehlt.' }, 400);
    }

    if (!(file instanceof File) || !file.name || file.size === 0) {
      return jsonResponse({ success: false, error: 'Bitte eine Datei auswählen.' }, 400);
    }

    if (file.size > MAX_FILE_SIZE) {
      return jsonResponse({ success: false, error: 'Die Datei ist grösser als 50 MB.' }, 400);
    }

    if (OWNER_ONLY_TYPES.has(documentType) && !access.isOwner) {
      return jsonResponse(
        { success: false, error: 'Dieser Dokumenttyp darf nur durch Owner hochgeladen werden.' },
        403,
      );
    }

    const employeeResponse = await supabase
      .from('opc_employees')
      .select('id,employee_number,legal_first_name,legal_last_name')
      .eq('id', employeeId)
      .maybeSingle();
    throwOnError(employeeResponse.error, 'Mitarbeiter konnte nicht geprüft werden');

    if (!employeeResponse.data) {
      return jsonResponse({ success: false, error: 'Mitarbeiter wurde nicht gefunden.' }, 404);
    }

    const safeName = sanitizeFileName(file.name);
    const folder = employeeResponse.data.employee_number || employeeId;
    uploadedPath = `${folder}/${documentType}/${Date.now()}-${safeName}`;

    const uploadResponse = await supabase.storage
      .from(EMPLOYEE_DOCUMENT_BUCKET)
      .upload(uploadedPath, file, {
        contentType: file.type || 'application/octet-stream',
        cacheControl: '3600',
        upsert: false,
      });
    throwOnError(uploadResponse.error, 'Datei konnte nicht hochgeladen werden');

    const accessScope = OWNER_ONLY_TYPES.has(documentType) ? 'payroll_owner' : 'staff_hr';
    const documentResponse = await supabase
      .from('opc_employee_documents')
      .insert({
        employee_id: employeeId,
        document_type: documentType,
        document_subtype: documentSubtype,
        access_scope: accessScope,
        title: title || file.name,
        storage_bucket: EMPLOYEE_DOCUMENT_BUCKET,
        storage_path: uploadedPath,
        file_name: file.name,
        mime_type: file.type || null,
        file_size_bytes: file.size,
        valid_from: validFrom,
        valid_until: validUntil,
        verification_status: 'unverified',
        notes,
        created_by: access.user.id,
        updated_by: access.user.id,
        metadata: {
          source: 'mitarbeiter-detail',
          uploaded_by_role: access.role,
        },
      })
      .select('*')
      .single();
    throwOnError(documentResponse.error, 'Dokumentmetadaten konnten nicht gespeichert werden');

    const signedResponse = await supabase.storage
      .from(EMPLOYEE_DOCUMENT_BUCKET)
      .createSignedUrl(uploadedPath, 60 * 60);

    return jsonResponse(
      {
        success: true,
        message: 'Dokument wurde hochgeladen.',
        document: {
          ...documentResponse.data,
          signed_url: signedResponse.error ? null : signedResponse.data?.signedUrl || null,
        },
      },
      201,
    );
  } catch (error: any) {
    console.error('[opc/employees/upload-document] POST failed', error);

    if (uploadedPath) {
      try {
        const { supabase } = await requireEmployeeHrAccess({ request, locals, cookies });
        await supabase.storage.from(EMPLOYEE_DOCUMENT_BUCKET).remove([uploadedPath]);
      } catch (cleanupError) {
        console.error('[opc/employees/upload-document] cleanup failed', cleanupError);
      }
    }

    return jsonResponse(
      { success: false, error: error?.message || 'Dokument konnte nicht hochgeladen werden.' },
      errorStatus(error),
    );
  }
};

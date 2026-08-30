import { guardAndConsumeExportRequest } from '../../../../lib/opc-data-export-security';
import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

import {
  getOpcServerEnvValue,
} from '../../../../lib/opc-server-env';

import {
  buildOpcDataExportFiles,
  getDataExportScopeLabel,
  normalizeDataExportScope,
} from '../../../../lib/opc-data-export';

import {
  buildOpcDataExportEmailHtml,
} from '../../../../lib/opc-data-export-email';

export const prerender = false;

const FRIENDLY_DENIAL =
  'Diese Datenexporte werden aus Sicherheitsgründen ausschließlich an verifizierte Eigentümer der Gesellschaft per E-Mail übermittelt. Wenn Ihr Benutzerkonto als Owner hinterlegt ist, erhalten Sie die angeforderten Daten automatisch an Ihre hinterlegte E-Mail-Adresse.';

function json(
  body: Record<string, unknown>,
  status = 200,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type':
        'application/json; charset=utf-8',
      'Cache-Control':
        'private, no-store, max-age=0',
    },
  });
}

function clean(value: unknown) {
  return String(value || '').trim();
}

function getConfig(locals: any) {
  const supabaseUrl =
    clean(
      getOpcServerEnvValue(
        locals,
        'SUPABASE_URL',
      ),
    ) ||
    clean(
      getOpcServerEnvValue(
        locals,
        'PUBLIC_SUPABASE_URL',
      ),
    );

  const serviceRoleKey = clean(
    getOpcServerEnvValue(
      locals,
      'SUPABASE_SERVICE_ROLE_KEY',
    ),
  );

  if (!supabaseUrl) {
    throw new Error(
      'Supabase URL fehlt.',
    );
  }

  if (
    !serviceRoleKey ||
    serviceRoleKey.startsWith(
      'sb_publishable_',
    )
  ) {
    throw new Error(
      'Server Service-Role-Konfiguration fehlt.',
    );
  }

  return {
    supabaseUrl:
      supabaseUrl.replace(/\/$/, ''),
    serviceRoleKey,
  };
}

function getToken(
  request: Request,
  cookies: any,
) {
  const authorization =
    request.headers.get(
      'authorization',
    ) || '';

  const bearer = authorization
    .replace(/^Bearer\s+/i, '')
    .trim();

  return (
    bearer ||
    cookies.get('sb-access-token')
      ?.value ||
    ''
  );
}

async function isVerifiedOwner(
  supabase: any,
  userId: string,
) {
  const { data, error } =
    await supabase
      .from('opc_staff_roles')
      .select(
        'id,role,status,can_access_portal',
      )
      .eq('user_id', userId);

  if (error) {
    throw new Error(
      `Owner-Prüfung fehlgeschlagen: ${error.message}`,
    );
  }

  return (data || []).some(
    (row: any) => {
      const role = String(
        row.role || '',
      )
        .trim()
        .toLowerCase();

      const status = String(
        row.status || '',
      )
        .trim()
        .toLowerCase();

      return (
        role === 'owner' &&
        ['active', 'aktiv', 'enabled']
          .includes(status) &&
        row.can_access_portal === true
      );
    },
  );
}

function textToBase64(value: string) {
  const bytes =
    new TextEncoder().encode(value);

  let binary = '';

  for (
    let index = 0;
    index < bytes.length;
    index += 0x8000
  ) {
    binary += String.fromCharCode(
      ...bytes.subarray(
        index,
        Math.min(
          index + 0x8000,
          bytes.length,
        ),
      ),
    );
  }

  return btoa(binary);
}

async function invokeMailer(
  input: {
    supabaseUrl: string;
    serviceRoleKey: string;
    payload: Record<string, unknown>;
  },
) {
  const functions = [
    'opc-send-document-email',
    'opc-send-document-smtp',
  ];

  const failures: string[] = [];

  for (const functionName of functions) {
    try {
      const response = await fetch(
        `${input.supabaseUrl}/functions/v1/${functionName}`,
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
            Authorization:
              `Bearer ${input.serviceRoleKey}`,
            apikey:
              input.serviceRoleKey,
          },
          body: JSON.stringify(
            input.payload,
          ),
        },
      );

      const text =
        await response.text();

      let data: any = null;

      try {
        data = text
          ? JSON.parse(text)
          : null;
      } catch {
        data = { raw: text };
      }

      if (
        !response.ok ||
        data?.ok === false
      ) {
        throw new Error(
          data?.error ||
            data?.raw ||
            `HTTP ${response.status}`,
        );
      }

      return data || { ok: true };
    } catch (error: any) {
      failures.push(
        `${functionName}: ${
          error?.message ||
          String(error)
        }`,
      );
    }
  }

  throw new Error(
    failures.join(' | '),
  );
}

function partitionFiles(
  files: Array<{
    filename: string;
    content: string;
    rowCount: number;
  }>,
) {
  const MAX_RAW_BYTES =
    7 * 1024 * 1024;

  const batches: typeof files[] = [];
  let current: typeof files = [];
  let currentBytes = 0;

  for (const file of files) {
    const bytes =
      new TextEncoder()
        .encode(file.content)
        .byteLength;

    if (
      current.length > 0 &&
      currentBytes + bytes >
        MAX_RAW_BYTES
    ) {
      batches.push(current);
      current = [];
      currentBytes = 0;
    }

    current.push(file);
    currentBytes += bytes;
  }

  if (current.length) {
    batches.push(current);
  }

  return batches;
}

export const POST: APIRoute =
  async ({
    request,
    locals,
    cookies,
  }) => {
  // OPC_EXPORT_DUAL_VERIFICATION_V1
  // The guard runs before any business export rows are loaded or CSV files are generated.
  const exportSecurityBlock = await guardAndConsumeExportRequest(
    request.clone(),
    locals,
  );
  if (exportSecurityBlock) return exportSecurityBlock;

    let auditId = '';

    try {
      const body =
        await request
          .json()
          .catch(() => ({}));

      const scope =
        normalizeDataExportScope(
          body?.scope,
        );

      if (!scope) {
        return json(
          {
            success: false,
            error:
              'Ungültiger Exportbereich.',
          },
          400,
        );
      }

      const config =
        getConfig(locals);

      const supabase =
        createClient(
          config.supabaseUrl,
          config.serviceRoleKey,
          {
            auth: {
              persistSession: false,
              autoRefreshToken: false,
            },
          },
        );

      const token =
        getToken(
          request,
          cookies,
        );

      if (!token) {
        return json(
          {
            success: false,
            error:
              'Nicht authentifiziert.',
          },
          401,
        );
      }

      const {
        data: { user },
        error: userError,
      } =
        await supabase.auth.getUser(
          token,
        );

      if (
        userError ||
        !user
      ) {
        return json(
          {
            success: false,
            error:
              'Die Sitzung ist nicht mehr gültig.',
          },
          401,
        );
      }

      const recipient =
        clean(user.email);

      if (!recipient) {
        return json(
          {
            success: false,
            error:
              'Im authentifizierten Benutzerkonto ist keine E-Mail-Adresse vorhanden.',
          },
          400,
        );
      }

      const {
        data: audit,
        error: auditError,
      } =
        await supabase
          .from(
            'opc_data_export_audit',
          )
          .insert({
            actor_user_id: user.id,
            actor_email: recipient,
            scope,
            status: 'requested',
          })
          .select('id')
          .single();

      if (
        auditError ||
        !audit?.id
      ) {
        throw new Error(
          `Export-Audit konnte nicht erstellt werden: ${
            auditError?.message ||
            'unbekannter Fehler'
          }`,
        );
      }

      auditId = audit.id;

      const owner =
        await isVerifiedOwner(
          supabase,
          user.id,
        );

      if (!owner) {
        await supabase
          .from(
            'opc_data_export_audit',
          )
          .update({
            status: 'denied',
            completed_at:
              new Date()
                .toISOString(),
          })
          .eq('id', auditId);

        return json(
          {
            success: false,
            sent: false,
            message:
              FRIENDLY_DENIAL,
          },
          403,
        );
      }

      const files =
        await buildOpcDataExportFiles(
          supabase,
          scope,
        );

      const rowCount =
        files.reduce(
          (sum, file) =>
            sum + file.rowCount,
          0,
        );

      const batches =
        partitionFiles(files);

      const scopeLabel =
        getDataExportScopeLabel(
          scope,
        );

      const generatedAt =
        new Intl.DateTimeFormat(
          'de-CH',
          {
            timeZone:
              'Europe/Zurich',
            dateStyle: 'medium',
            timeStyle: 'short',
          },
        ).format(new Date());

      for (
        let index = 0;
        index < batches.length;
        index += 1
      ) {
        const batch =
          batches[index];

        const suffix =
          batches.length > 1
            ? ` – Teil ${
                index + 1
              }/${batches.length}`
            : '';

        await invokeMailer({
          ...config,
          payload: {
            to: recipient,
            subject:
              `Orange Pro Clean – Datenexport ${scopeLabel}${suffix}`,
            html:
              buildOpcDataExportEmailHtml(
                {
                  scopeLabel,
                  recipientEmail:
                    recipient,
                  generatedAt,
                  fileNames:
                    batch.map(
                      (file) =>
                        file.filename,
                    ),
                  rowCount:
                    batch.reduce(
                      (
                        total,
                        file,
                      ) =>
                        total +
                        file.rowCount,
                      0,
                    ),
                  batchNumber:
                    index + 1,
                  batchCount:
                    batches.length,
                },
              ),
            attachments:
              batch.map(
                (file) => ({
                  filename:
                    file.filename,
                  contentBase64:
                    textToBase64(
                      file.content,
                    ),
                  contentType:
                    'text/csv; charset=utf-8',
                }),
              ),
            metadata: {
              type:
                'owner_data_export',
              export_audit_id:
                auditId,
              scope,
            },
          },
        });
      }

      await supabase
        .from(
          'opc_data_export_audit',
        )
        .update({
          status: 'sent',
          row_count: rowCount,
          file_count:
            files.length,
          email_batch_count:
            batches.length,
          file_names:
            files.map(
              (file) =>
                file.filename,
            ),
          completed_at:
            new Date()
              .toISOString(),
        })
        .eq('id', auditId);

      return json({
        success: true,
        sent: true,
        recipient,
        scope,
        rowCount,
        fileCount:
          files.length,
        emailBatchCount:
          batches.length,
        message:
          `Der Datenexport wurde an ${recipient} gesendet.`,
      });
    } catch (error: any) {
      const message =
        error?.message ||
        'Der Datenexport konnte nicht erstellt werden.';

      console.error(
        '[opc/data-export/email] failed:',
        message,
      );

      try {
        if (auditId) {
          const config =
            getConfig(locals);

          const supabase =
            createClient(
              config.supabaseUrl,
              config.serviceRoleKey,
            );

          await supabase
            .from(
              'opc_data_export_audit',
            )
            .update({
              status: 'failed',
              error_message:
                message.slice(
                  0,
                  1500,
                ),
              completed_at:
                new Date()
                  .toISOString(),
            })
            .eq('id', auditId);
        }
      } catch {
      }

      return json(
        {
          success: false,
          error: message,
        },
        500,
      );
    }
  };

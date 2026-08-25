import { supabase } from './supabase';

// OPC_INSPECTION_MEDIA_RELIABILITY_20260812
export const INSPECTION_MEDIA_API_PATH = '/api/opc/inspection-media';

type ApiOptions = {
  attempts?: number;
  timeoutMs?: number;
};

type UploadFailure = {
  fileName: string;
  message: string;
};

type UploadProgress = {
  completed: number;
  total: number;
  uploaded: number;
  failed: number;
  currentFile: string;
};

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function createUploadToken(index: number) {
  const uuid =
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`;

  return `opc-${uuid}`;
}

async function getAccessToken(forceRefresh = false) {
  if (!supabase) {
    throw new Error('Supabase ist nicht verfügbar.');
  }

  if (forceRefresh) {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) throw error;

    const refreshedToken = data.session?.access_token;
    if (refreshedToken) return refreshedToken;
  }

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) throw error;

  if (!session?.access_token) {
    throw new Error('Die Sitzung ist abgelaufen. Bitte neu anmelden.');
  }

  return session.access_token;
}

function apiError(
  message: string,
  status = 0,
  retryable = false,
) {
  const error = new Error(message) as Error & {
    status?: number;
    retryable?: boolean;
  };

  error.status = status;
  error.retryable = retryable;
  return error;
}

export async function inspectionMediaApiFetch(
  path: string,
  init: RequestInit = {},
  options: ApiOptions = {},
) {
  const attempts = Math.max(1, options.attempts ?? 3);
  const timeoutMs = Math.max(5000, options.timeoutMs ?? 30000);

  let lastError: any = null;
  let forceRefresh = false;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
      const accessToken = await getAccessToken(forceRefresh);
      forceRefresh = false;

      const headers = new Headers(init.headers || {});
      headers.set('Authorization', `Bearer ${accessToken}`);

      const response = await fetch(path, {
        ...init,
        credentials: 'include',
        headers,
        signal: controller.signal,
      });

      const payload = await response.json().catch(() => null);

      if (response.ok && payload?.success) {
        return payload;
      }

      const message = payload?.error || `Anfrage fehlgeschlagen (${response.status}).`;

      if (response.status === 401 && attempt < attempts) {
        forceRefresh = true;
        lastError = apiError(message, response.status, true);
      } else {
        const retryable =
          response.status === 408 ||
          response.status === 429 ||
          response.status >= 500;

        const error = apiError(message, response.status, retryable);

        if (!retryable || attempt >= attempts) {
          throw error;
        }

        lastError = error;
      }
    } catch (error: any) {
      const status = Number(error?.status || 0);
      const explicitlyNonRetryable = error?.retryable === false;

      if (
        explicitlyNonRetryable ||
        (
          status > 0 &&
          status !== 408 &&
          status !== 429 &&
          status < 500 &&
          status !== 401
        ) ||
        attempt >= attempts
      ) {
        throw error;
      }

      lastError = error;
    } finally {
      window.clearTimeout(timeout);
    }

    await sleep(attempt === 1 ? 650 : 1400);
  }

  throw lastError || new Error('Anfrage fehlgeschlagen.');
}

export async function fetchInspectionMediaPayload(
  inspectionId: string,
) {
  return inspectionMediaApiFetch(
    `${INSPECTION_MEDIA_API_PATH}?inspection_id=${encodeURIComponent(inspectionId)}`,
    {
      method: 'GET',
      cache: 'no-store',
    },
    {
      attempts: 3,
      timeoutMs: 30000,
    },
  );
}

async function verifyInspectionUpload(
  inspectionId: string,
  uploadToken: string,
  file: File,
) {
  try {
    const payload = await inspectionMediaApiFetch(
      `${INSPECTION_MEDIA_API_PATH}?inspection_id=${encodeURIComponent(inspectionId)}`,
      {
        method: 'GET',
        cache: 'no-store',
      },
      {
        attempts: 1,
        timeoutMs: 30000,
      },
    );

    const rows = Array.isArray(payload?.media) ? payload.media : [];
    const objectMarker = `/${uploadToken}-`;

    return rows.some((row: any) => {
      const objectPath = String(row?.object_path || '');
      const fileName = String(row?.file_name || '');

      return (
        objectPath.includes(objectMarker) &&
        (!fileName || fileName === file.name)
      );
    });
  } catch {
    return false;
  }
}

export async function uploadInspectionMediaFiles(
  inspectionId: string,
  files: File[],
  onProgress?: (
    progress: UploadProgress,
  ) => void,
) {
  let uploadedCount = 0;
  const failedFiles: UploadFailure[] = [];

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const uploadToken = createUploadToken(index);

    const body = new FormData();
    body.set('inspection_id', inspectionId);
    body.set('upload_token', uploadToken);
    body.append('files', file);

    try {
      await inspectionMediaApiFetch(
        INSPECTION_MEDIA_API_PATH,
        {
          method: 'POST',
          body,
        },
        {
          attempts: 3,
          timeoutMs: 120000,
        },
      );

      uploadedCount += 1;
    } catch (error: any) {
      const status = Number(error?.status || 0);

      // A mobile upload can complete on the server while the response is lost.
      // Because the server embeds this unique token in object_path, confirm the
      // result before telling the user the upload failed or retrying later.
      if (status !== 401 && status !== 403) {
        const alreadyUploaded = await verifyInspectionUpload(
          inspectionId,
          uploadToken,
          file,
        );

        if (alreadyUploaded) {
          uploadedCount += 1;

          onProgress?.({
            completed: index + 1,
            total: files.length,
            uploaded: uploadedCount,
            failed: failedFiles.length,
            currentFile: file.name,
          });

          continue;
        }
      }

      const message =
        error?.name === 'AbortError'
          ? 'Upload-Zeitüberschreitung'
          : error?.message || 'Upload fehlgeschlagen';

      failedFiles.push({
        fileName: file.name,
        message,
      });

      if (status === 401 || status === 403) {
        for (let remaining = index + 1; remaining < files.length; remaining += 1) {
          failedFiles.push({
            fileName: files[remaining].name,
            message,
          });
        }

        onProgress?.({
          completed: files.length,
          total: files.length,
          uploaded: uploadedCount,
          failed: failedFiles.length,
          currentFile: file.name,
        });

        break;
      }
    }

    onProgress?.({
      completed: index + 1,
      total: files.length,
      uploaded: uploadedCount,
      failed: failedFiles.length,
      currentFile: file.name,
    });
  }

  return {
    uploadedCount,
    failedFiles,
  };
}

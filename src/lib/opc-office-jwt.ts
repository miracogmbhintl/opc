type JsonRecord = Record<string, unknown>;

function encodeBase64Url(bytes: Uint8Array) {
  let binary = '';

  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function encodeJson(value: unknown) {
  return encodeBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

async function importSecret(secret: string, usage: KeyUsage[]) {
  if (!secret || secret.length < 24) {
    throw new Error('EURO_OFFICE_JWT_SECRET must contain at least 24 characters.');
  }

  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    usage,
  );
}

export async function signOfficeJwt(payload: JsonRecord, secret: string) {
  const header = encodeJson({ alg: 'HS256', typ: 'JWT' });
  const body = encodeJson(payload);
  const unsignedToken = `${header}.${body}`;
  const key = await importSecret(secret, ['sign']);
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(unsignedToken),
  );

  return `${unsignedToken}.${encodeBase64Url(new Uint8Array(signature))}`;
}

export async function verifyOfficeJwt<T extends JsonRecord = JsonRecord>(
  token: string,
  secret: string,
): Promise<T> {
  const parts = String(token || '').split('.');

  if (parts.length !== 3) {
    throw new Error('Invalid office token.');
  }

  const [headerPart, bodyPart, signaturePart] = parts;
  const header = JSON.parse(new TextDecoder().decode(decodeBase64Url(headerPart)));

  if (header?.alg !== 'HS256') {
    throw new Error('Unsupported office token algorithm.');
  }

  const key = await importSecret(secret, ['verify']);
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    decodeBase64Url(signaturePart),
    new TextEncoder().encode(`${headerPart}.${bodyPart}`),
  );

  if (!valid) {
    throw new Error('Invalid office token signature.');
  }

  const payload = JSON.parse(
    new TextDecoder().decode(decodeBase64Url(bodyPart)),
  ) as T;

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = Number(payload?.exp || 0);

  if (expiresAt && expiresAt < now) {
    throw new Error('Office token expired.');
  }

  return payload;
}

export async function createOfficeCallbackToken({
  documentId,
  editorKey,
  secret,
  expiresInSeconds = 12 * 60 * 60,
}: {
  documentId: string;
  editorKey: string;
  secret: string;
  expiresInSeconds?: number;
}) {
  const now = Math.floor(Date.now() / 1000);

  return signOfficeJwt(
    {
      purpose: 'office_callback',
      documentId,
      editorKey,
      iat: now,
      exp: now + expiresInSeconds,
    },
    secret,
  );
}

export type RuntimeEnv = Record<string, string | undefined>;

export function getRuntimeEnv(context?: any): RuntimeEnv {
  const runtimeEnv = context?.locals?.runtime?.env || context?.locals?.env || {};
  const metaEnv = ((import.meta as any).env || {}) as RuntimeEnv;
  const processEnv = ((globalThis as any).process?.env || {}) as RuntimeEnv;

  return {
    ...runtimeEnv,
    ...processEnv,
    ...metaEnv,
  };
}

export function getEnvValue(env: RuntimeEnv, keys: string[]): string {
  for (const key of keys) {
    const value = env[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }

  return '';
}

export function getGoogleClientId(env: RuntimeEnv): string {
  return getEnvValue(env, ['GOOGLE_CLIENT_ID', 'PUBLIC_GOOGLE_CLIENT_ID']);
}

export function getGoogleClientSecret(env: RuntimeEnv): string {
  return getEnvValue(env, ['GOOGLE_CLIENT_SECRET']);
}

export function getGoogleRedirectUri(env: RuntimeEnv, requestUrl?: string): string {
  const configured = getEnvValue(env, ['GOOGLE_REDIRECT_URI']);
  if (configured) return configured;

  if (requestUrl) {
    const url = new URL(requestUrl);
    return `${url.origin}/api/integrations/google/callback`;
  }

  return '';
}

export function getGoogleScopes(): string[] {
  return [
    'openid',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
  ];
}

function toBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  const base64 =
    typeof btoa === 'function'
      ? btoa(binary)
      : (globalThis as any).Buffer.from(bytes).toString('base64');

  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function randomBase64Url(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  globalThis.crypto.getRandomValues(bytes);

  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  const base64 =
    typeof btoa === 'function'
      ? btoa(binary)
      : (globalThis as any).Buffer.from(bytes).toString('base64');

  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export async function createCodeChallenge(verifier: string): Promise<string> {
  const encoded = new TextEncoder().encode(verifier);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', encoded);
  return toBase64Url(digest);
}

export async function buildGoogleAuthUrl(params: {
  env: RuntimeEnv;
  requestUrl: string;
  state: string;
  codeVerifier: string;
}): Promise<string> {
  const clientId = getGoogleClientId(params.env);
  const redirectUri = getGoogleRedirectUri(params.env, params.requestUrl);
  const codeChallenge = await createCodeChallenge(params.codeVerifier);

  if (!clientId) {
    throw Object.assign(new Error('GOOGLE_CLIENT_ID fehlt.'), { status: 500 });
  }

  if (!redirectUri) {
    throw Object.assign(new Error('GOOGLE_REDIRECT_URI fehlt.'), { status: 500 });
  }

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');

  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', getGoogleScopes().join(' '));
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('state', params.state);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('include_granted_scopes', 'true');

  return url.toString();
}

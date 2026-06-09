import type { SupabaseClient } from '@supabase/supabase-js';

type AttachmentInput = {
  filename: string;
  contentBase64: string;
  contentType?: string;
};

type SendDocumentEmailInput = {
  to: string;
  subject: string;
  html: string;
  cc?: string;
  bcc?: string;
  attachments?: AttachmentInput[];
  metadata?: Record<string, unknown>;
};

function clean(value: unknown) {
  return String(value || '').trim();
}

function getApiUrl() {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api/opc/send-document-email`;
  }

  return '/api/opc/send-document-email';
}

function makeHelpfulError(message: string) {
  const text = clean(message);

  if (/edge function/i.test(text) || /functions\/v1/i.test(text) || /fetch failed/i.test(text)) {
    return `Dokumenten-E-Mail konnte nicht über die Versand-API gesendet werden. ${text}`;
  }

  if (/recipient/i.test(text) || /empfänger/i.test(text)) {
    return text;
  }

  return text || 'E-Mail konnte nicht gesendet werden.';
}

export async function sendDocumentEmail(supabase: SupabaseClient, payload: SendDocumentEmailInput) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  const response = await fetch(getApiUrl(), {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null) as any;

  if (!response.ok || data?.ok === false) {
    throw new Error(makeHelpfulError(data?.error || data?.details || `HTTP ${response.status}`));
  }

  return data;
}

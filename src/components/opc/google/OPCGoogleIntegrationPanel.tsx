import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  Link2,
  RefreshCcw,
  ShieldAlert,
  Video,
  XCircle,
} from 'lucide-react';

type Variant = 'settings' | 'calendar';

type GoogleStatus = {
  connected?: boolean;
  email?: string | null;
  calendarId?: string | null;
  lastSyncAt?: string | null;
  scopes?: string[];
  error?: string;
};

const BRAND = {
  black: '#111111',
  text: '#111111',
  muted: '#6B7280',
  faint: '#9CA3AF',
  border: '#E5E7EB',
  soft: '#FAFAFA',
  green: '#15803D',
  red: '#B91C1C',
  orange: '#F7931F',
  blue: '#1C53BC',
};

const pageFont =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Inter, "Helvetica Neue", Arial, sans-serif';

const cardStyle: CSSProperties = {
  border: `1px solid ${BRAND.border}`,
  background: '#FFFFFF',
  borderRadius: '20px',
  padding: '22px',
  boxShadow: '0 1px 2px rgba(15, 17, 21, 0.04)',
};

const buttonBase: CSSProperties = {
  height: '42px',
  padding: '0 15px',
  borderRadius: '13px',
  border: `1px solid ${BRAND.border}`,
  background: '#FFFFFF',
  color: BRAND.text,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  fontFamily: pageFont,
  fontSize: '13px',
  fontWeight: 780,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

function formatDate(value?: string | null) {
  if (!value) return 'Noch nicht synchronisiert';

  try {
    return new Intl.DateTimeFormat('de-CH', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

async function safeJsonFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      data?.error ||
      data?.message ||
      (response.status === 404
        ? 'Backend-Route für Google Integration wurde noch nicht eingerichtet.'
        : `Google Anfrage fehlgeschlagen: ${response.status}`);
    throw new Error(message);
  }

  return data as T;
}

export default function OPCGoogleIntegrationPanel({ variant }: { variant: Variant }) {
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const connected = Boolean(status?.connected);

  const helperText = useMemo(() => {
    if (variant === 'calendar') {
      return 'Google Kalender, Meet-Links und externe Synchronisation direkt aus dem Kalender steuern.';
    }

    return 'Google Kalender und Meet zentral für das Portal verbinden. Diese Verbindung kann später für Termine, Einladungen und Meet-Links verwendet werden.';
  }, [variant]);

  async function loadStatus() {
    setLoading(true);
    setMessage('');

    try {
      const data = await safeJsonFetch<GoogleStatus>('/api/integrations/google/status');
      setStatus(data);
    } catch (error: any) {
      setStatus({
        connected: false,
        error: error?.message || 'Google Status konnte nicht geladen werden.',
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStatus();
  }, []);

  async function handleConnect() {
    setBusyAction('connect');
    setMessage('');

    try {
      const data = await safeJsonFetch<{ url?: string; authUrl?: string }>('/api/integrations/google/auth-url', {
        method: 'POST',
      });

      const targetUrl = data.url || data.authUrl;

      if (!targetUrl) {
        throw new Error('Google Auth URL wurde vom Backend nicht zurückgegeben.');
      }

      window.location.href = targetUrl;
    } catch (error: any) {
      setMessage(error?.message || 'Google Verbindung konnte nicht gestartet werden.');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDisconnect() {
    setBusyAction('disconnect');
    setMessage('');

    try {
      await safeJsonFetch('/api/integrations/google/disconnect', {
        method: 'POST',
      });

      setStatus({
        connected: false,
      });
      setMessage('Google Verbindung wurde getrennt.');
    } catch (error: any) {
      setMessage(error?.message || 'Google Verbindung konnte nicht getrennt werden.');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSync() {
    setBusyAction('sync');
    setMessage('');

    try {
      const data = await safeJsonFetch<GoogleStatus>('/api/integrations/google/sync-calendar', {
        method: 'POST',
      });

      setStatus((prev) => ({
        ...prev,
        ...data,
        connected: data.connected ?? prev?.connected ?? true,
        lastSyncAt: data.lastSyncAt || new Date().toISOString(),
      }));

      setMessage('Google Kalender wurde synchronisiert.');
    } catch (error: any) {
      setMessage(error?.message || 'Google Sync konnte nicht ausgeführt werden.');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCreateMeet() {
    setBusyAction('meet');
    setMessage('');

    try {
      const data = await safeJsonFetch<{ meetUrl?: string; url?: string }>('/api/integrations/google/create-meet', {
        method: 'POST',
      });

      const meetUrl = data.meetUrl || data.url;

      if (meetUrl) {
        window.open(meetUrl, '_blank', 'noopener,noreferrer');
      }

      setMessage(meetUrl ? 'Google Meet wurde geöffnet.' : 'Google Meet Anfrage wurde ausgeführt.');
    } catch (error: any) {
      setMessage(error?.message || 'Google Meet konnte nicht erstellt werden.');
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <section style={cardStyle}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '18px',
          marginBottom: '18px',
        }}
      >
        <div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '9px',
              marginBottom: '8px',
            }}
          >
            <span
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '12px',
                background: '#FFF7ED',
                color: BRAND.orange,
                border: '1px solid #FED7AA',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CalendarDays size={18} />
            </span>
            <h3
              style={{
                margin: 0,
                color: BRAND.text,
                fontFamily: pageFont,
                fontSize: '18px',
                fontWeight: 850,
                letterSpacing: '-0.02em',
              }}
            >
              Google Kalender & Meet
            </h3>
          </div>

          <p
            style={{
              margin: 0,
              color: BRAND.muted,
              fontFamily: pageFont,
              fontSize: '13px',
              lineHeight: 1.55,
              maxWidth: '720px',
              fontWeight: 560,
            }}
          >
            {helperText}
          </p>
        </div>

        <span
          style={{
            minHeight: '32px',
            padding: '0 11px',
            borderRadius: '999px',
            border: `1px solid ${connected ? '#BBF7D0' : '#FECACA'}`,
            background: connected ? '#F0FDF4' : '#FEF2F2',
            color: connected ? BRAND.green : BRAND.red,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
            fontSize: '12px',
            fontWeight: 800,
            whiteSpace: 'nowrap',
          }}
        >
          {connected ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
          {loading ? 'Prüfen...' : connected ? 'Verbunden' : 'Nicht verbunden'}
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: '12px',
          marginBottom: '18px',
        }}
      >
        <div style={{ padding: '14px', borderRadius: '15px', background: BRAND.soft, border: `1px solid ${BRAND.border}` }}>
          <div style={{ fontSize: '11px', color: BRAND.faint, fontWeight: 800, marginBottom: '7px', textTransform: 'uppercase' }}>
            Konto
          </div>
          <div style={{ fontSize: '13px', color: BRAND.text, fontWeight: 760, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {status?.email || 'Kein Google Konto verbunden'}
          </div>
        </div>

        <div style={{ padding: '14px', borderRadius: '15px', background: BRAND.soft, border: `1px solid ${BRAND.border}` }}>
          <div style={{ fontSize: '11px', color: BRAND.faint, fontWeight: 800, marginBottom: '7px', textTransform: 'uppercase' }}>
            Kalender
          </div>
          <div style={{ fontSize: '13px', color: BRAND.text, fontWeight: 760, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {status?.calendarId || 'Standard-Kalender noch nicht gesetzt'}
          </div>
        </div>

        <div style={{ padding: '14px', borderRadius: '15px', background: BRAND.soft, border: `1px solid ${BRAND.border}` }}>
          <div style={{ fontSize: '11px', color: BRAND.faint, fontWeight: 800, marginBottom: '7px', textTransform: 'uppercase' }}>
            Letzter Sync
          </div>
          <div style={{ fontSize: '13px', color: BRAND.text, fontWeight: 760 }}>
            {formatDate(status?.lastSyncAt)}
          </div>
        </div>
      </div>

      {(status?.error || message) && (
        <div
          style={{
            marginBottom: '16px',
            padding: '12px 13px',
            borderRadius: '14px',
            border: `1px solid ${connected ? '#BFDBFE' : '#FED7AA'}`,
            background: connected ? '#EFF6FF' : '#FFF7ED',
            color: connected ? BRAND.blue : '#9A3412',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '9px',
            fontSize: '13px',
            fontWeight: 650,
            lineHeight: 1.45,
          }}
        >
          <ShieldAlert size={16} style={{ marginTop: 1, flexShrink: 0 }} />
          <span>{message || status?.error}</span>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        <button
          type="button"
          onClick={handleConnect}
          disabled={busyAction === 'connect'}
          style={{
            ...buttonBase,
            borderColor: BRAND.black,
            background: BRAND.black,
            color: '#FFFFFF',
            cursor: busyAction === 'connect' ? 'wait' : 'pointer',
          }}
        >
          <Link2 size={15} />
          {connected ? 'Google neu verbinden' : 'Google verbinden'}
        </button>

        <button
          type="button"
          onClick={handleSync}
          disabled={!connected || busyAction === 'sync'}
          style={{
            ...buttonBase,
            opacity: connected ? 1 : 0.45,
            cursor: connected ? (busyAction === 'sync' ? 'wait' : 'pointer') : 'not-allowed',
          }}
        >
          <RefreshCcw size={15} />
          Kalender synchronisieren
        </button>

        <button
          type="button"
          onClick={handleCreateMeet}
          disabled={!connected || busyAction === 'meet'}
          style={{
            ...buttonBase,
            opacity: connected ? 1 : 0.45,
            cursor: connected ? (busyAction === 'meet' ? 'wait' : 'pointer') : 'not-allowed',
          }}
        >
          <Video size={15} />
          Meet erstellen
        </button>

        {connected && (
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={busyAction === 'disconnect'}
            style={{
              ...buttonBase,
              color: BRAND.red,
              cursor: busyAction === 'disconnect' ? 'wait' : 'pointer',
            }}
          >
            <ExternalLink size={15} />
            Verbindung trennen
          </button>
        )}
      </div>
    </section>
  );
}

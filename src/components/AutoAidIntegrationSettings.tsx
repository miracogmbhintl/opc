import { useEffect, useState, type CSSProperties } from 'react';
import { AlertTriangle, CheckCircle2, Eye, EyeOff, KeyRound, Save, Satellite } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';

type IngestMode = 'pull_only' | 'push_only' | 'pull_and_push';

type AutoAidSettings = {
  enabled: boolean;
  api_base_url: string;
  api_key_configured: boolean;
  api_key_last4: string;
  api_key_set_at: string | null;
  pull_interval_minutes: number;
  ingest_mode: IngestMode;
  settings: Record<string, unknown>;
};

const BRAND = {
  text: '#111827',
  muted: '#6B7280',
  border: '#E5E7EB',
  black: '#0F1115',
  card: '#FFFFFF',
  soft: '#FAFAFA',
  green: '#166534',
  greenBg: '#F0FDF4',
  red: '#B91C1C',
  redBg: '#FEF2F2',
  orange: '#ff6a00',
};

const pageFont =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", "Helvetica Neue", Segoe UI, Roboto, sans-serif';

const cardStyle: CSSProperties = {
  background: BRAND.card,
  border: `1px solid ${BRAND.border}`,
  borderRadius: '20px',
  boxShadow: '0 1px 2px rgba(15, 17, 21, 0.04)',
};

const inputStyle: CSSProperties = {
  width: '100%',
  height: '46px',
  borderRadius: '14px',
  border: `1px solid ${BRAND.border}`,
  background: '#FFFFFF',
  color: BRAND.text,
  padding: '0 14px',
  outline: 'none',
  boxSizing: 'border-box',
  fontSize: '14px',
  fontWeight: 650,
  fontFamily: pageFont,
};

const primaryButtonStyle: CSSProperties = {
  minHeight: '46px',
  padding: '0 16px',
  borderRadius: '14px',
  border: `1px solid ${BRAND.black}`,
  background: BRAND.black,
  color: '#FFFFFF',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  fontSize: '13px',
  fontWeight: 820,
  fontFamily: pageFont,
  cursor: 'pointer',
};

function StatusMessage({ type, message }: { type: 'success' | 'error'; message: string }) {
  if (!message) return null;

  const isSuccess = type === 'success';

  return (
    <div
      style={{
        marginBottom: '14px',
        padding: '13px 15px',
        borderRadius: '14px',
        border: `1px solid ${isSuccess ? '#BBF7D0' : '#FCA5A5'}`,
        background: isSuccess ? BRAND.greenBg : BRAND.redBg,
        color: isSuccess ? BRAND.green : BRAND.red,
        fontSize: '14px',
        fontWeight: 660,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}
    >
      {isSuccess ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
      {message}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label
      style={{
        display: 'block',
        marginBottom: '8px',
        color: BRAND.text,
        fontSize: '13px',
        fontWeight: 820,
        letterSpacing: '-0.01em',
      }}
    >
      {children}
    </label>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        padding: '15px 16px',
        borderRadius: '16px',
        border: `1px solid ${BRAND.border}`,
        background: '#FFFFFF',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: pageFont,
      }}
    >
      <span>
        <span style={{ display: 'block', color: BRAND.text, fontSize: '14px', fontWeight: 820, marginBottom: '4px' }}>
          {label}
        </span>
        <span style={{ display: 'block', color: BRAND.muted, fontSize: '13px', fontWeight: 650, lineHeight: 1.45 }}>
          {description}
        </span>
      </span>
      <span
        style={{
          width: '46px',
          height: '26px',
          borderRadius: '999px',
          background: checked ? BRAND.black : '#E5E7EB',
          padding: '3px',
          boxSizing: 'border-box',
          flexShrink: 0,
          transition: 'background 0.18s ease',
        }}
      >
        <span
          style={{
            display: 'block',
            width: '20px',
            height: '20px',
            borderRadius: '999px',
            background: '#FFFFFF',
            transform: checked ? 'translateX(20px)' : 'translateX(0)',
            transition: 'transform 0.18s ease',
          }}
        />
      </span>
    </button>
  );
}

export default function AutoAidIntegrationSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [enabled, setEnabled] = useState(false);
  const [apiBaseUrl, setApiBaseUrl] = useState('https://api.autoaid.de');
  const [apiKey, setApiKey] = useState('');
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);
  const [apiKeyLast4, setApiKeyLast4] = useState('');
  const [apiKeySetAt, setApiKeySetAt] = useState<string | null>(null);
  const [pullInterval, setPullInterval] = useState('15');
  const [ingestMode, setIngestMode] = useState<IngestMode>('pull_and_push');

  async function getSessionToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return session?.access_token || '';
  }

  async function apiFetch(path: string, options: RequestInit = {}) {
    const token = await getSessionToken();

    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token
          ? {
              Authorization: `Bearer ${token}`,
              'X-OPC-Auth-Token': token,
            }
          : {}),
        ...(options.headers || {}),
      },
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok || payload?.success === false) {
      throw new Error(payload?.error || 'AutoAid Aktion konnte nicht ausgeführt werden.');
    }

    return payload;
  }

  function applySettings(settings: AutoAidSettings) {
    setEnabled(Boolean(settings.enabled));
    setApiBaseUrl(settings.api_base_url || 'https://api.autoaid.de');
    setApiKeyConfigured(Boolean(settings.api_key_configured));
    setApiKeyLast4(settings.api_key_last4 || '');
    setApiKeySetAt(settings.api_key_set_at || null);
    setPullInterval(String(settings.pull_interval_minutes || 15));
    setIngestMode(settings.ingest_mode || 'pull_and_push');
    setApiKey('');
  }

  async function loadSettings() {
    setLoading(true);
    setError('');

    try {
      const payload = await apiFetch('/api/integrations/autoaid/settings');
      applySettings(payload.settings as AutoAidSettings);
    } catch (err: any) {
      setError(err?.message || 'AutoAid Einstellungen konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSettings();
  }, []);

  async function handleSave() {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const payload = await apiFetch('/api/integrations/autoaid/settings', {
        method: 'POST',
        body: JSON.stringify({
          enabled,
          api_base_url: apiBaseUrl,
          api_key: apiKey,
          pull_interval_minutes: Number(pullInterval),
          ingest_mode: ingestMode,
        }),
      });

      applySettings(payload.settings as AutoAidSettings);
      setSuccess('AutoAid Einstellungen gespeichert.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err?.message || 'AutoAid Einstellungen konnten nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  }

  async function handleClearKey() {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const payload = await apiFetch('/api/integrations/autoaid/settings', {
        method: 'POST',
        body: JSON.stringify({
          enabled,
          api_base_url: apiBaseUrl,
          pull_interval_minutes: Number(pullInterval),
          ingest_mode: ingestMode,
          clear_api_key: true,
        }),
      });

      applySettings(payload.settings as AutoAidSettings);
      setSuccess('AutoAid API-Key entfernt.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err?.message || 'API-Key konnte nicht entfernt werden.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: '32px', fontFamily: pageFont }}>
      <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
        <div style={{ marginBottom: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <span
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '15px',
                background: '#FFF7ED',
                color: BRAND.orange,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Satellite size={21} />
            </span>
            <div>
              <h1 style={{ margin: 0, color: BRAND.text, fontSize: '28px', fontWeight: 860, letterSpacing: '-0.04em' }}>
                AutoAid Integration
              </h1>
              <p style={{ margin: '4px 0 0', color: BRAND.muted, fontSize: '14px', fontWeight: 650 }}>
                Owner-Bereich für AutoAid API-Key, Pulling und spätere Fuhrpark-Telemetrie.
              </p>
            </div>
          </div>
        </div>

        <StatusMessage type="error" message={error} />
        <StatusMessage type="success" message={success} />

        <div style={{ ...cardStyle, padding: '24px', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '18px', marginBottom: '22px' }}>
            <div>
              <h2 style={{ margin: '0 0 6px', color: BRAND.text, fontSize: '18px', fontWeight: 840, letterSpacing: '-0.035em' }}>
                Verbindung
              </h2>
              <p style={{ margin: 0, color: BRAND.muted, fontSize: '13px', fontWeight: 650, lineHeight: 1.45 }}>
                Der API-Key wird serverseitig gespeichert und im Frontend nur maskiert angezeigt.
              </p>
            </div>
            <span
              style={{
                padding: '8px 11px',
                borderRadius: '999px',
                background: apiKeyConfigured ? BRAND.greenBg : '#F9FAFB',
                color: apiKeyConfigured ? BRAND.green : BRAND.muted,
                fontSize: '12px',
                fontWeight: 820,
                whiteSpace: 'nowrap',
              }}
            >
              {apiKeyConfigured ? `Key endet mit ${apiKeyLast4}` : 'Kein Key gesetzt'}
            </span>
          </div>

          {loading ? (
            <div style={{ color: BRAND.muted, fontSize: '14px', fontWeight: 650 }}>AutoAid Einstellungen werden geladen...</div>
          ) : (
            <div style={{ display: 'grid', gap: '18px' }}>
              <Toggle
                checked={enabled}
                onChange={setEnabled}
                label="AutoAid aktivieren"
                description="Aktiviert Pulling, Push-Ingest und spätere Fahrzeugstatus-Verarbeitung für OPC."
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: '16px' }}>
                <div>
                  <FieldLabel>AutoAid API Base URL</FieldLabel>
                  <input value={apiBaseUrl} onChange={(event) => setApiBaseUrl(event.target.value)} style={inputStyle} />
                </div>

                <div>
                  <FieldLabel>Pull-Intervall Minuten</FieldLabel>
                  <input
                    type="number"
                    min="1"
                    max="1440"
                    value={pullInterval}
                    onChange={(event) => setPullInterval(event.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <FieldLabel>AutoAid API-Key</FieldLabel>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                    placeholder={apiKeyConfigured ? `Neuen Key eintragen, aktueller Key endet mit ${apiKeyLast4}` : 'AutoAid API-Key eintragen'}
                    style={{ ...inputStyle, paddingRight: '48px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: '32px',
                      height: '32px',
                      borderRadius: '9px',
                      border: 'none',
                      background: 'transparent',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: BRAND.muted,
                    }}
                  >
                    {showApiKey ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
                <div style={{ marginTop: '8px', color: BRAND.muted, fontSize: '12px', fontWeight: 650 }}>
                  Leer lassen, wenn der bestehende Key unverändert bleiben soll.
                  {apiKeySetAt ? ` Zuletzt gesetzt: ${new Date(apiKeySetAt).toLocaleString('de-CH')}.` : ''}
                </div>
              </div>

              <div>
                <FieldLabel>Ingest-Modus</FieldLabel>
                <select value={ingestMode} onChange={(event) => setIngestMode(event.target.value as IngestMode)} style={inputStyle}>
                  <option value="pull_and_push">Pulling + Push Webhook</option>
                  <option value="pull_only">Nur Pulling</option>
                  <option value="push_only">Nur Push Webhook</option>
                </select>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px',
                  paddingTop: '18px',
                  borderTop: `1px solid ${BRAND.border}`,
                }}
              >
                <button
                  type="button"
                  onClick={handleClearKey}
                  disabled={saving || !apiKeyConfigured}
                  style={{
                    minHeight: '44px',
                    padding: '0 14px',
                    borderRadius: '14px',
                    border: `1px solid ${BRAND.border}`,
                    background: '#FFFFFF',
                    color: apiKeyConfigured ? BRAND.red : BRAND.muted,
                    fontSize: '13px',
                    fontWeight: 820,
                    fontFamily: pageFont,
                    cursor: saving || !apiKeyConfigured ? 'not-allowed' : 'pointer',
                  }}
                >
                  API-Key entfernen
                </button>

                <button type="button" onClick={handleSave} disabled={saving} style={{ ...primaryButtonStyle, opacity: saving ? 0.65 : 1 }}>
                  {saving ? <KeyRound size={17} /> : <Save size={17} />}
                  {saving ? 'Speichern...' : 'AutoAid speichern'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={{ ...cardStyle, padding: '18px 20px', background: BRAND.soft }}>
          <div style={{ color: BRAND.text, fontSize: '14px', fontWeight: 820, marginBottom: '6px' }}>
            Nächster technischer Schritt
          </div>
          <div style={{ color: BRAND.muted, fontSize: '13px', fontWeight: 650, lineHeight: 1.5 }}>
            Nach dem Eintragen des Keys wird der Pull-Worker Geräte, Fahrzeuge, Trips und Events in die neuen
            Fuhrpark-Tabellen schreiben. Die Live Map und Tagesrouten lesen danach nur noch aus den normalisierten OPC-Tabellen.
          </div>
        </div>
      </div>
    </div>
  );
}

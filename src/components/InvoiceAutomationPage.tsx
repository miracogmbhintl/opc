import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Loader2,
  RefreshCw,
  Send,
  ShieldAlert,
  StopCircle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';
import MirakaDashboardShell from './MirakaDashboardShell';
import { OPCPageShell, opcResponsiveStyle } from './opc/OPCPageTop';

type AutomationStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'manual_review';

type AutomationRow = {
  id: string;
  service_job_id: string;
  invoice_id?: string | null;
  status: AutomationStatus;
  scheduled_for?: string | null;
  created_at?: string | null;
  attempt_count?: number | null;
  blocker_code?: string | null;
  blocker_message?: string | null;
  error_message?: string | null;
  job_title?: string | null;
  job_type?: string | null;
  job_status?: string | null;
  planned_start?: string | null;
  actual_end?: string | null;
  service_category?: string | null;
  billable_amount?: number | string | null;
  client_name?: string | null;
  client_number?: string | null;
  client_email?: string | null;
  site_name?: string | null;
  site_address?: string | null;
  site_postal_code?: string | null;
  site_city?: string | null;
  invoice_number?: string | null;
  invoice_status?: string | null;
  invoice_total_chf?: number | string | null;
  invoice_sent_at?: string | null;
};

type FilterStatus = 'all' | AutomationStatus;

const pageFont =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Inter, "Helvetica Neue", Arial, sans-serif';

const cardStyle: CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #E5E7EB',
  borderRadius: 18,
  boxShadow: '0 1px 2px rgba(15, 17, 21, 0.04)',
};

const statusLabels: Record<AutomationStatus, string> = {
  pending: 'Geplant',
  processing: 'Wird verarbeitet',
  completed: 'Versendet',
  failed: 'Fehlgeschlagen',
  cancelled: 'Gestoppt',
  manual_review: 'Manuell prüfen',
};

const statusTone: Record<AutomationStatus, { bg: string; text: string; border: string }> = {
  pending: { bg: '#FFFBEB', text: '#92400E', border: '#FDE68A' },
  processing: { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  completed: { bg: '#ECFDF5', text: '#047857', border: '#A7F3D0' },
  failed: { bg: '#FEF2F2', text: '#B91C1C', border: '#FECACA' },
  cancelled: { bg: '#F3F4F6', text: '#4B5563', border: '#D1D5DB' },
  manual_review: { bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA' },
};

function clean(value: unknown) {
  return String(value ?? '').trim();
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('de-CH', {
    timeZone: 'Europe/Zurich',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatMoney(value?: number | string | null) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: 'CHF',
  }).format(Number.isFinite(amount) ? amount : 0);
}

function StatusBadge({ status }: { status: AutomationStatus }) {
  const tone = statusTone[status] || statusTone.pending;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        minHeight: 28,
        padding: '0 11px',
        borderRadius: 999,
        border: `1px solid ${tone.border}`,
        background: tone.bg,
        color: tone.text,
        fontSize: 12,
        fontWeight: 800,
        whiteSpace: 'nowrap',
      }}
    >
      {statusLabels[status] || status}
    </span>
  );
}

function Metric({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div style={{ ...cardStyle, padding: 17, minHeight: 92, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <div>
        <strong style={{ display: 'block', fontSize: 24, lineHeight: 1, marginBottom: 10 }}>{value}</strong>
        <span style={{ color: '#6B7280', fontSize: 13, fontWeight: 700 }}>{label}</span>
      </div>
      <div style={{ width: 38, height: 38, borderRadius: 13, border: '1px solid #E5E7EB', display: 'grid', placeItems: 'center' }}>
        {icon}
      </div>
    </div>
  );
}

export default function InvoiceAutomationPage() {
  const [rows, setRows] = useState<AutomationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [search, setSearch] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);

  useEffect(() => {
    void loadRows();
  }, []);

  async function loadRows(silent = false) {
    if (silent) setRefreshing(true);
    else setLoading(true);

    setErrorMessage('');

    try {
      const response = await supabase
        .from('opc_invoice_automation_overview')
        .select('*')
        .order('scheduled_for', { ascending: false })
        .limit(500);

      if (response.error) throw response.error;
      setRows((response.data || []) as AutomationRow[]);
    } catch (error: any) {
      setErrorMessage(error?.message || 'Rechnungsautomatisierungen konnten nicht geladen werden.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function runAction(row: AutomationRow, action: 'cancel' | 'retry' | 'schedule_now' | 'manual_review') {
    if (actionId) return;

    const descriptions: Record<typeof action, string> = {
      cancel: 'Diese Automatisierung wirklich stoppen?',
      retry: 'Diesen Versand erneut in die Queue stellen?',
      schedule_now: 'Diese Rechnung zur sofortigen Verarbeitung freigeben?',
      manual_review: 'Diese Automatisierung zur manuellen Prüfung markieren?',
    };

    if (!window.confirm(descriptions[action])) return;

    setActionId(row.id);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const sessionResponse = await supabase.auth.getSession();
      const token = sessionResponse.data.session?.access_token;
      if (!token) throw new Error('Sitzung ist abgelaufen. Bitte neu anmelden.');

      const response = await fetch(`${baseUrl}/api/opc/invoice-automation-action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          automation_id: row.id,
          action,
        }),
      });

      const data = await response.json().catch(() => null) as any;
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.error || `HTTP ${response.status}`);
      }

      setSuccessMessage('Automatisierung wurde aktualisiert.');
      await loadRows(true);
    } catch (error: any) {
      setErrorMessage(error?.message || 'Aktion ist fehlgeschlagen.');
    } finally {
      setActionId(null);
    }
  }

  const filteredRows = useMemo(() => {
    const query = clean(search).toLowerCase();

    return rows.filter((row) => {
      if (filter !== 'all' && row.status !== filter) return false;
      if (!query) return true;

      const haystack = [
        row.client_name,
        row.client_number,
        row.client_email,
        row.job_title,
        row.service_category,
        row.site_name,
        row.site_address,
        row.invoice_number,
        row.blocker_message,
        row.error_message,
      ]
        .map(clean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [filter, rows, search]);

  const pendingCount = rows.filter((row) => row.status === 'pending').length;
  const reviewCount = rows.filter((row) => row.status === 'manual_review').length;
  const failedCount = rows.filter((row) => row.status === 'failed').length;
  const completedCount = rows.filter((row) => row.status === 'completed').length;

  return (
    <MirakaDashboardShell
      requiredRole={['owner', 'admin', 'dispatch']}
      currentPath="/rechnungsautomationen"
      fullWidth
      hideTopBar
    >
      <OPCPageShell>
        <div style={{ fontFamily: pageFont, color: '#111827', paddingBottom: 140 }}>
          <div className="opc-auto-header">
            <div>
              <p className="opc-auto-eyebrow">Buchhaltung</p>
              <h1>Rechnungsautomatisierungen</h1>
              <span>Geplante, versendete und zu prüfende Rechnungen aus abgeschlossenen Einsätzen.</span>
            </div>
            <button type="button" className="opc-auto-button" onClick={() => loadRows(true)} disabled={refreshing}>
              {refreshing ? <Loader2 size={16} className="opc-spin" /> : <RefreshCw size={16} />}
              Aktualisieren
            </button>
          </div>

          <div className="opc-auto-metrics">
            <Metric label="Geplant" value={pendingCount} icon={<CalendarClock size={17} />} />
            <Metric label="Manuell prüfen" value={reviewCount} icon={<ShieldAlert size={17} />} />
            <Metric label="Fehlgeschlagen" value={failedCount} icon={<AlertTriangle size={17} />} />
            <Metric label="Versendet" value={completedCount} icon={<CheckCircle2 size={17} />} />
          </div>

          <section style={{ ...cardStyle, padding: 15, marginBottom: 16 }} className="opc-auto-filters">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Kunde, Einsatz, Rechnung oder Fehler suchen..."
            />
            <select value={filter} onChange={(event) => setFilter(event.target.value as FilterStatus)}>
              <option value="all">Alle Status</option>
              <option value="pending">Geplant</option>
              <option value="processing">Wird verarbeitet</option>
              <option value="manual_review">Manuell prüfen</option>
              <option value="failed">Fehlgeschlagen</option>
              <option value="completed">Versendet</option>
              <option value="cancelled">Gestoppt</option>
            </select>
          </section>

          {errorMessage ? <div className="opc-auto-alert error">{errorMessage}</div> : null}
          {successMessage ? <div className="opc-auto-alert success">{successMessage}</div> : null}

          {loading ? (
            <div style={{ ...cardStyle, padding: 28, textAlign: 'center', color: '#6B7280' }}>
              Rechnungsautomatisierungen werden geladen.
            </div>
          ) : filteredRows.length === 0 ? (
            <div style={{ ...cardStyle, padding: 28, textAlign: 'center', color: '#6B7280' }}>
              Keine Automatisierungen gefunden.
            </div>
          ) : (
            <div className="opc-auto-list">
              {filteredRows.map((row) => {
                const busy = actionId === row.id;
                const location = [row.site_name, row.site_address, [row.site_postal_code, row.site_city].filter(Boolean).join(' ')]
                  .filter(Boolean)
                  .join(' · ');
                const reason = clean(row.blocker_message) || clean(row.error_message);

                return (
                  <article key={row.id} style={cardStyle} className="opc-auto-card">
                    <div className="opc-auto-card-main">
                      <div className="opc-auto-card-copy">
                        <div className="opc-auto-card-title-row">
                          <h2>{row.client_name || 'Unbekannter Kunde'}</h2>
                          <StatusBadge status={row.status} />
                        </div>
                        <p>{row.job_title || row.service_category || 'Abgeschlossener Einsatz'}</p>
                        <div className="opc-auto-meta">
                          <span><Clock3 size={14} /> Versand: {formatDateTime(row.scheduled_for)}</span>
                          <span>Einsatz: {formatDateTime(row.actual_end || row.planned_start)}</span>
                          {row.client_number ? <span>Kundennummer: {row.client_number}</span> : null}
                          {row.client_email ? <span>{row.client_email}</span> : null}
                          {location ? <span>{location}</span> : null}
                          <span>Versuche: {Number(row.attempt_count || 0)}</span>
                        </div>
                        {reason ? <div className="opc-auto-reason">{reason}</div> : null}
                      </div>

                      <div className="opc-auto-amount">
                        <strong>{formatMoney(row.invoice_total_chf || row.billable_amount)}</strong>
                        <span>{row.invoice_number || 'Noch keine Rechnung'}</span>
                      </div>
                    </div>

                    <div className="opc-auto-actions">
                      <a href={`${baseUrl}/einsatz/${row.service_job_id}`} className="opc-auto-link">
                        Einsatz <ExternalLink size={14} />
                      </a>
                      {row.invoice_id ? (
                        <a href={`${baseUrl}/rechnung/${row.invoice_id}`} className="opc-auto-link">
                          Rechnung <ExternalLink size={14} />
                        </a>
                      ) : null}

                      {['failed', 'manual_review', 'cancelled'].includes(row.status) ? (
                        <button disabled={busy} onClick={() => runAction(row, 'retry')}>
                          <RefreshCw size={14} /> Erneut planen
                        </button>
                      ) : null}

                      {row.status === 'pending' ? (
                        <button disabled={busy} onClick={() => runAction(row, 'schedule_now')}>
                          <Send size={14} /> Jetzt freigeben
                        </button>
                      ) : null}

                      {['pending', 'failed', 'processing'].includes(row.status) ? (
                        <button disabled={busy} onClick={() => runAction(row, 'manual_review')}>
                          <ShieldAlert size={14} /> Prüfen
                        </button>
                      ) : null}

                      {['pending', 'failed', 'manual_review'].includes(row.status) ? (
                        <button disabled={busy} onClick={() => runAction(row, 'cancel')} className="danger">
                          <StopCircle size={14} /> Stoppen
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <style>{`${opcResponsiveStyle}
          .opc-auto-header { display:flex; align-items:flex-start; justify-content:space-between; gap:18px; margin-bottom:16px; }
          .opc-auto-header h1 { margin:0; font-size:34px; line-height:1.02; letter-spacing:-.045em; }
          .opc-auto-header span { display:block; margin-top:8px; color:#6B7280; font-size:14px; font-weight:650; }
          .opc-auto-eyebrow { margin:0 0 7px; color:#9CA3AF; font-size:12px; font-weight:850; letter-spacing:.08em; text-transform:uppercase; }
          .opc-auto-button, .opc-auto-actions button, .opc-auto-link { min-height:42px; border:1px solid #E5E7EB; border-radius:13px; background:#FFF; color:#111827; padding:0 13px; display:inline-flex; align-items:center; justify-content:center; gap:7px; font:800 13px ${pageFont}; text-decoration:none; cursor:pointer; }
          .opc-auto-button:disabled, .opc-auto-actions button:disabled { opacity:.55; cursor:not-allowed; }
          .opc-auto-metrics { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin-bottom:14px; }
          .opc-auto-filters { display:grid; grid-template-columns:minmax(0,1fr) 240px; gap:10px; }
          .opc-auto-filters input, .opc-auto-filters select { width:100%; height:46px; border:1px solid #E5E7EB; border-radius:13px; padding:0 13px; background:#FFF; color:#111827; font:700 14px ${pageFont}; outline:none; box-sizing:border-box; }
          .opc-auto-alert { margin-bottom:14px; padding:13px 15px; border-radius:13px; font-size:13px; font-weight:750; }
          .opc-auto-alert.error { border:1px solid #FECACA; background:#FEF2F2; color:#B91C1C; }
          .opc-auto-alert.success { border:1px solid #A7F3D0; background:#ECFDF5; color:#047857; }
          .opc-auto-list { display:grid; gap:12px; }
          .opc-auto-card { padding:17px; }
          .opc-auto-card-main { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:18px; align-items:start; }
          .opc-auto-card-title-row { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
          .opc-auto-card h2 { margin:0; font-size:18px; letter-spacing:-.02em; }
          .opc-auto-card-copy > p { margin:7px 0 0; color:#4B5563; font-size:14px; font-weight:700; }
          .opc-auto-meta { margin-top:12px; display:flex; flex-wrap:wrap; gap:8px 14px; color:#6B7280; font-size:12px; font-weight:650; }
          .opc-auto-meta span { display:inline-flex; align-items:center; gap:5px; }
          .opc-auto-reason { margin-top:12px; padding:11px 12px; border:1px solid #FED7AA; border-radius:12px; background:#FFF7ED; color:#9A3412; font-size:12px; line-height:1.45; font-weight:700; }
          .opc-auto-amount { min-width:170px; text-align:right; }
          .opc-auto-amount strong { display:block; font-size:19px; }
          .opc-auto-amount span { display:block; margin-top:5px; color:#6B7280; font-size:12px; font-weight:700; }
          .opc-auto-actions { margin-top:15px; padding-top:13px; border-top:1px solid #E5E7EB; display:flex; flex-wrap:wrap; gap:8px; }
          .opc-auto-actions .danger { color:#B91C1C; border-color:#FECACA; background:#FEF2F2; }
          .opc-spin { animation:opc-spin 1s linear infinite; }
          @keyframes opc-spin { to { transform:rotate(360deg); } }
          @media (max-width:1000px) { .opc-auto-metrics { grid-template-columns:repeat(2,minmax(0,1fr)); } }
          @media (max-width:720px) {
            .opc-auto-header { flex-direction:column; }
            .opc-auto-button { width:100%; }
            .opc-auto-metrics { grid-template-columns:1fr 1fr; }
            .opc-auto-filters { grid-template-columns:1fr; }
            .opc-auto-card-main { grid-template-columns:1fr; }
            .opc-auto-amount { min-width:0; text-align:left; }
            .opc-auto-actions { display:grid; grid-template-columns:1fr; }
            .opc-auto-actions > * { width:100%; }
          }
        `}</style>
      </OPCPageShell>
    </MirakaDashboardShell>
  );
}

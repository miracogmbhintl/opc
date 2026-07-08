import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ClipboardCheck,
  Copy,
  ExternalLink,
  FileText,
  Loader2,
  PauseCircle,
  RefreshCw,
  RotateCcw,
  Settings2,
  ShieldCheck,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';
import MirakaDashboardShell from './MirakaDashboardShell';
import { OPCPageShell, opcResponsiveStyle } from './opc/OPCPageTop';

type Row = Record<string, any> & {
  id: string;
  service_job_id: string;
  status: string;
};

type Action = 'approve_manual' | 'hold' | 'reopen' | 'mark_sent';
type Filter = 'review' | 'approved' | 'hold' | 'completed' | 'all';

const font =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Inter, "Helvetica Neue", Arial, sans-serif';

function clean(value: unknown) {
  return String(value ?? '').trim();
}

function formatDateTime(value: unknown) {
  if (!value) return '—';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('de-CH', {
    timeZone: 'Europe/Zurich',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function formatDate(value: unknown) {
  if (!value) return '—';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('de-CH', {
    timeZone: 'Europe/Zurich',
    dateStyle: 'short',
  }).format(date);
}

function formatMoney(value: unknown) {
  const amount = Number(value || 0);

  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: 'CHF',
  }).format(Number.isFinite(amount) ? amount : 0);
}

function rowBucket(row: Row): Filter {
  const billing = clean(row.billing_status).toLowerCase();
  const blocker = clean(row.blocker_code).toLowerCase();

  if (row.status === 'completed' || billing === 'invoice_sent' || row.invoice_sent_at) {
    return 'completed';
  }

  if (billing === 'billing_blocked' || blocker === 'billing_on_hold') {
    return 'hold';
  }

  if (billing === 'ready_for_billing' || blocker === 'approved_for_manual_billing') {
    return 'approved';
  }

  return 'review';
}

function rowLabel(row: Row) {
  const bucket = rowBucket(row);

  if (bucket === 'approved') return 'Freigegeben';
  if (bucket === 'hold') return 'Zurückgestellt';
  if (bucket === 'completed') return 'Erledigt';

  return 'Bereit zur Prüfung';
}

function createEmailTemplate(row: Row) {
  const greeting = clean(row.client_name) || 'Guten Tag';
  const invoiceNumber = clean(row.invoice_number) || '[Rechnungsnummer]';
  const jobName = clean(row.job_title) || clean(row.service_category) || 'abgeschlossenen Einsatz';
  const serviceDate = formatDate(row.actual_end || row.planned_start);
  const subject = `Ihre Rechnung ${invoiceNumber} – Orange Pro Clean GmbH`;

  const plain = `${greeting}

Im Anhang finden Sie unsere Rechnung ${invoiceNumber} für den ${jobName} vom ${serviceDate}.

Bei Fragen stehen wir Ihnen gerne zur Verfügung.

Mit freundlichen Grüssen
Orange Pro Clean GmbH
info@orangeproclean.ch
www.orangeproclean.ch`;

  const html = `<p>${greeting}</p>
<p>Im Anhang finden Sie unsere Rechnung <strong>${invoiceNumber}</strong> für den ${jobName} vom ${serviceDate}.</p>
<p>Bei Fragen stehen wir Ihnen gerne zur Verfügung.</p>
<p>Mit freundlichen Grüssen<br>Orange Pro Clean GmbH<br>info@orangeproclean.ch<br>www.orangeproclean.ch</p>`;

  return { subject, plain, html };
}

async function copyText(value: string) {
  await navigator.clipboard.writeText(value);
}

export default function ManualBillingApprovalPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState<Filter>('review');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [openTemplate, setOpenTemplate] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function loadRows(silent = false) {
    if (!silent) setLoading(true);
    setError('');

    const response = await supabase
      .from('opc_invoice_automation_overview')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (response.error) {
      setError(response.error.message);
    } else {
      setRows((response.data || []) as Row[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    void loadRows();
  }, []);

  async function runAction(row: Row, action: Action) {
    const prompts: Record<Action, string> = {
      approve_manual: 'Zur manuellen Rechnungsstellung freigeben?',
      hold: 'Diesen Einsatz zurückstellen?',
      reopen: 'Diesen Einsatz erneut zur Prüfung öffnen?',
      mark_sent: 'Bestätigen, dass die Rechnung manuell versendet wurde?',
    };

    if (!window.confirm(prompts[action])) return;

    setBusyId(row.id);
    setMessage('');
    setError('');

    try {
      const sessionResponse = await supabase.auth.getSession();
      const token = sessionResponse.data.session?.access_token;

      if (!token) {
        throw new Error('Sitzung ist abgelaufen.');
      }

      const response = await fetch(`${baseUrl}/api/opc/manual-billing-action`, {
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

      const data = await response.json().catch(() => null);

      if (!response.ok || data?.ok === false) {
        throw new Error(data?.error || `HTTP ${response.status}`);
      }

      setMessage('Freigabestatus wurde aktualisiert.');
      await loadRows(true);
    } catch (reason: any) {
      setError(reason?.message || 'Aktion ist fehlgeschlagen.');
    } finally {
      setBusyId('');
    }
  }

  const counts = useMemo(() => {
    const result = {
      review: 0,
      approved: 0,
      hold: 0,
      completed: 0,
      all: rows.length,
    };

    rows.forEach((row) => {
      const bucket = rowBucket(row);
      if (bucket !== 'all') result[bucket] += 1;
    });

    return result;
  }, [rows]);

  const visibleRows = useMemo(() => {
    const query = search.toLowerCase().trim();

    return rows.filter((row) => {
      if (filter !== 'all' && rowBucket(row) !== filter) return false;
      if (!query) return true;

      return [
        row.client_name,
        row.client_number,
        row.client_email,
        row.job_title,
        row.service_category,
        row.site_name,
        row.invoice_number,
      ]
        .map(clean)
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [filter, rows, search]);

  return (
    <MirakaDashboardShell
      requiredRole={['owner']}
      currentPath="/rechnungsautomationen"
      fullWidth
      hideTopBar
    >
      <OPCPageShell>
        <main className="manual-billing-page">
          <header>
            <div>
              <small>INHABERBEREICH</small>
              <h1>Automationen & Rechnungsfreigaben</h1>
              <p>Abgeschlossene Einsätze prüfen und anschliessend manuell verrechnen.</p>
            </div>

            <button onClick={() => void loadRows(true)}>
              <RefreshCw size={16} />
              Aktualisieren
            </button>
          </header>

          <section className="settings-card">
            <div className="settings-heading">
              <Settings2 size={18} />
              <div>
                <strong>Automationseinstellungen</strong>
                <span>Sicherer manueller Modus</span>
              </div>
            </div>

            <div className="settings-grid">
              <div>
                <span>Automatischer Versand</span>
                <strong className="off">Deaktiviert</strong>
              </div>
              <div>
                <span>Inhaber-Freigabe</span>
                <strong className="on">Aktiv</strong>
              </div>
              <div>
                <span>Rechnungserstellung</span>
                <strong>Manuell</strong>
              </div>
              <div>
                <span>E-Mail</span>
                <strong>Copy & Paste</strong>
              </div>
            </div>

            <p>
              Die Queue erzeugt nur den Hinweis „bereit zur Verrechnung“. Sie versendet nichts automatisch.
            </p>
          </section>

          <section className="metrics">
            <button onClick={() => setFilter('review')}>
              <ClipboardCheck size={17} />
              <b>{counts.review}</b>
              <span>Zur Prüfung</span>
            </button>

            <button onClick={() => setFilter('approved')}>
              <ShieldCheck size={17} />
              <b>{counts.approved}</b>
              <span>Freigegeben</span>
            </button>

            <button onClick={() => setFilter('hold')}>
              <PauseCircle size={17} />
              <b>{counts.hold}</b>
              <span>Zurückgestellt</span>
            </button>

            <button onClick={() => setFilter('completed')}>
              <CheckCircle2 size={17} />
              <b>{counts.completed}</b>
              <span>Erledigt</span>
            </button>
          </section>

          <section className="filters">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Kunde, Einsatz oder Rechnung suchen..."
            />

            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as Filter)}
            >
              <option value="review">Zur Prüfung</option>
              <option value="approved">Freigegeben</option>
              <option value="hold">Zurückgestellt</option>
              <option value="completed">Erledigt</option>
              <option value="all">Alle</option>
            </select>
          </section>

          {error ? <div className="alert error">{error}</div> : null}
          {message ? <div className="alert success">{message}</div> : null}

          {loading ? (
            <div className="empty">
              <Loader2 className="spin" size={18} />
              Freigaben werden geladen.
            </div>
          ) : visibleRows.length === 0 ? (
            <div className="empty">Keine Einträge in diesem Bereich.</div>
          ) : (
            <section className="list">
              {visibleRows.map((row) => {
                const state = rowBucket(row);
                const template = createEmailTemplate(row);
                const location = [
                  row.site_name,
                  row.site_address,
                  row.site_postal_code,
                  row.site_city,
                ]
                  .filter(Boolean)
                  .join(' · ');

                return (
                  <article key={row.id}>
                    <div className="card-top">
                      <div>
                        <div className="title-row">
                          <h2>{row.client_name || 'Unbekannter Kunde'}</h2>
                          <em className={state}>{rowLabel(row)}</em>
                        </div>

                        <h3>{row.job_title || row.service_category || 'Abgeschlossener Einsatz'}</h3>
                        <p>Einsatz: {formatDateTime(row.actual_end || row.planned_start)}</p>
                        {row.client_email ? <p>{row.client_email}</p> : null}
                        {location ? <p>{location}</p> : null}

                        {row.blocker_message || row.error_message ? (
                          <div className="reason">
                            {row.blocker_message || row.error_message}
                          </div>
                        ) : null}
                      </div>

                      <div className="amount">
                        <b>{formatMoney(row.invoice_total_chf || row.billable_amount)}</b>
                        <span>{row.invoice_number || 'Noch keine Rechnung'}</span>
                      </div>
                    </div>

                    <div className="actions">
                      <a href={`${baseUrl}/einsatz/${row.service_job_id}`}>
                        Einsatz
                        <ExternalLink size={14} />
                      </a>

                      {row.invoice_id ? (
                        <a href={`${baseUrl}/rechnung/${row.invoice_id}`}>
                          Rechnung / PDF
                          <ExternalLink size={14} />
                        </a>
                      ) : (
                        <a href={`${baseUrl}/einsatz/${row.service_job_id}`}>
                          Rechnung erstellen
                          <FileText size={14} />
                        </a>
                      )}

                      <button
                        onClick={() => setOpenTemplate(openTemplate === row.id ? '' : row.id)}
                      >
                        <Copy size={14} />
                        E-Mail-Vorlage
                      </button>

                      {state === 'review' ? (
                        <>
                          <button
                            className="primary"
                            disabled={busyId === row.id}
                            onClick={() => void runAction(row, 'approve_manual')}
                          >
                            <ShieldCheck size={14} />
                            Freigeben
                          </button>

                          <button
                            disabled={busyId === row.id}
                            onClick={() => void runAction(row, 'hold')}
                          >
                            <PauseCircle size={14} />
                            Zurückstellen
                          </button>
                        </>
                      ) : null}

                      {state === 'approved' ? (
                        <>
                          <button
                            className="primary"
                            disabled={busyId === row.id}
                            onClick={() => void runAction(row, 'mark_sent')}
                          >
                            <CheckCircle2 size={14} />
                            Rechnung gesendet
                          </button>

                          <button
                            disabled={busyId === row.id}
                            onClick={() => void runAction(row, 'reopen')}
                          >
                            <RotateCcw size={14} />
                            Erneut prüfen
                          </button>
                        </>
                      ) : null}

                      {state === 'hold' ? (
                        <button
                          disabled={busyId === row.id}
                          onClick={() => void runAction(row, 'reopen')}
                        >
                          <RotateCcw size={14} />
                          Wieder öffnen
                        </button>
                      ) : null}
                    </div>

                    {openTemplate === row.id ? (
                      <div className="template">
                        <div className="template-head">
                          <div>
                            <strong>Vorläufige E-Mail-Vorlage</strong>
                            <span>
                              Das definitive OPC-Format kann später eingesetzt werden.
                            </span>
                          </div>

                          <div>
                            <button onClick={() => void copyText(template.subject)}>
                              Betreff kopieren
                            </button>
                            <button onClick={() => void copyText(template.plain)}>
                              Text kopieren
                            </button>
                            <button onClick={() => void copyText(template.html)}>
                              HTML kopieren
                            </button>
                          </div>
                        </div>

                        <label>
                          Betreff
                          <input readOnly value={template.subject} />
                        </label>

                        <label>
                          Text
                          <textarea readOnly rows={8} value={template.plain} />
                        </label>

                        <label>
                          HTML
                          <textarea readOnly rows={7} value={template.html} />
                        </label>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </section>
          )}
        </main>

        <style>{`${opcResponsiveStyle}
          .manual-billing-page { font-family:${font}; color:#111827; padding-bottom:130px; }
          .manual-billing-page header { display:flex; justify-content:space-between; gap:16px; align-items:flex-start; margin-bottom:16px; }
          .manual-billing-page h1 { margin:4px 0 6px; font-size:34px; letter-spacing:-.045em; }
          .manual-billing-page header p { margin:0; color:#6B7280; font-weight:650; }
          .manual-billing-page small { color:#9CA3AF; font-weight:850; letter-spacing:.08em; }
          .manual-billing-page button, .manual-billing-page a { min-height:42px; border:1px solid #E5E7EB; border-radius:13px; background:#FFF; color:#111827; padding:0 13px; display:inline-flex; align-items:center; justify-content:center; gap:7px; font:800 13px ${font}; text-decoration:none; cursor:pointer; }
          .manual-billing-page button:disabled { opacity:.5; }
          .manual-billing-page .primary { background:#111827; border-color:#111827; color:#FFF; }
          .settings-card, .filters, .list article, .empty { background:#FFF; border:1px solid #E5E7EB; border-radius:18px; box-shadow:0 1px 2px rgba(15,17,21,.04); }
          .settings-card { padding:18px; margin-bottom:14px; }
          .settings-heading { display:flex; gap:10px; align-items:center; }
          .settings-heading div { display:grid; }
          .settings-heading span, .settings-card > p { color:#6B7280; font-size:12px; font-weight:650; }
          .settings-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-top:14px; }
          .settings-grid div { border:1px solid #E5E7EB; border-radius:13px; padding:12px; display:grid; gap:7px; }
          .settings-grid span { font-size:12px; color:#6B7280; font-weight:700; }
          .settings-grid .off { color:#B91C1C; }
          .settings-grid .on { color:#047857; }
          .metrics { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:14px; }
          .metrics button { height:86px; display:grid; grid-template-columns:auto 1fr; grid-template-rows:1fr 1fr; text-align:left; }
          .metrics b { font-size:24px; }
          .metrics span { grid-column:1/3; color:#6B7280; }
          .filters { padding:14px; display:grid; grid-template-columns:1fr 230px; gap:10px; margin-bottom:14px; }
          .filters input, .filters select { height:46px; border:1px solid #E5E7EB; border-radius:13px; padding:0 13px; font:700 14px ${font}; }
          .alert { padding:12px 14px; border-radius:13px; margin-bottom:14px; font-weight:750; font-size:13px; }
          .alert.error { background:#FEF2F2; color:#B91C1C; }
          .alert.success { background:#ECFDF5; color:#047857; }
          .empty { padding:28px; text-align:center; color:#6B7280; display:flex; justify-content:center; gap:8px; }
          .list { display:grid; gap:12px; }
          .list article { padding:17px; }
          .card-top { display:grid; grid-template-columns:1fr auto; gap:16px; }
          .title-row { display:flex; gap:9px; align-items:center; flex-wrap:wrap; }
          .title-row h2 { margin:0; font-size:18px; }
          .title-row em { font-style:normal; border-radius:999px; padding:6px 9px; font-size:11px; font-weight:800; background:#FFFBEB; color:#92400E; }
          .title-row em.approved { background:#ECFDF5; color:#047857; }
          .title-row em.hold { background:#FFF7ED; color:#C2410C; }
          .title-row em.completed { background:#F3F4F6; color:#374151; }
          .card-top h3 { margin:7px 0; color:#4B5563; font-size:14px; }
          .card-top p { margin:4px 0; color:#6B7280; font-size:12px; font-weight:650; }
          .amount { text-align:right; display:grid; gap:5px; }
          .amount b { font-size:19px; }
          .amount span { font-size:12px; color:#6B7280; }
          .reason { margin-top:10px; padding:10px; border-radius:11px; background:#FFF7ED; color:#9A3412; font-size:12px; font-weight:700; }
          .actions { display:flex; flex-wrap:wrap; gap:8px; border-top:1px solid #E5E7EB; margin-top:14px; padding-top:13px; }
          .template { margin-top:14px; padding:14px; border-radius:14px; background:#FAFAFA; border:1px solid #E5E7EB; display:grid; gap:11px; }
          .template-head { display:flex; justify-content:space-between; gap:10px; }
          .template-head > div { display:flex; gap:7px; flex-wrap:wrap; }
          .template-head > div:first-child { display:grid; }
          .template-head span { font-size:12px; color:#6B7280; }
          .template label { display:grid; gap:5px; font-size:12px; font-weight:800; color:#6B7280; }
          .template input, .template textarea { border:1px solid #D1D5DB; border-radius:11px; padding:10px; background:#FFF; font:650 13px ${font}; resize:vertical; }
          .spin { animation:spin 1s linear infinite; }
          @keyframes spin { to { transform:rotate(360deg); } }
          @media(max-width:900px) {
            .settings-grid, .metrics { grid-template-columns:repeat(2,1fr); }
          }
          @media(max-width:680px) {
            .manual-billing-page header, .template-head { flex-direction:column; }
            .settings-grid, .metrics, .filters, .card-top { grid-template-columns:1fr; }
            .amount { text-align:left; }
            .actions { display:grid; }
            .actions > * { width:100%; }
          }
        `}</style>
      </OPCPageShell>
    </MirakaDashboardShell>
  );
}

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

type Resolution = 'insert' | 'keep' | 'replace' | 'review';

type ExistingEntry = {
  id: string;
  status: string;
  clock_in_local: string | null;
  clock_out_local: string | null;
  break_minutes: number;
  total_minutes: number;
  employee_note: string | null;
  recording_method: string | null;
  payroll_used: boolean;
};

type ImportRow = {
  id: string;
  source_row_number: number;
  employee_id: string | null;
  employee_number: string | null;
  employee_name: string | null;
  work_date: string | null;
  clock_in_local: string | null;
  clock_out_local: string | null;
  clock_out_next_day: boolean;
  break_minutes: number;
  total_minutes: number | null;
  note: string | null;
  existing_entries: ExistingEntry[];
  conflict_fields: any;
  conflict_type: string;
  locked_reason: string | null;
  override_allowed: boolean;
  recommended_action: string;
  resolution: Resolution;
  issues: string[];
  metadata?: {
    employee_match?: {
      method?: string | null;
      confidence?: number;
      reasons?: string[];
      candidates?: Array<{
        employee_id: string;
        employee_number: string | null;
        employee_name: string;
        confidence: number;
        reasons: string[];
        active_staff: boolean;
        active_contract: boolean;
        active_payroll_profile: boolean;
        history_count: number;
        overlapping_work_days: number;
        last_work_date: string | null;
      }>;
    };
  };
};

const BRAND = {
  text: '#111827',
  muted: '#6B7280',
  faint: '#9CA3AF',
  border: '#E5E7EB',
  borderStrong: '#D1D5DB',
  black: '#0F1115',
  card: '#FFFFFF',
  soft: '#FAFAFA',
  green: '#166534',
  red: '#B91C1C',
  amber: '#92400E',
};

const pageFont =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", "Helvetica Neue", Segoe UI, Roboto, sans-serif';

const cardStyle: CSSProperties = {
  background: BRAND.card,
  border: `1px solid ${BRAND.border}`,
  borderRadius: 20,
  boxShadow: '0 1px 2px rgba(15, 17, 21, 0.04)',
};

const primaryButton: CSSProperties = {
  height: 46,
  borderRadius: 14,
  border: '1px solid #0F1115',
  background: '#0F1115',
  color: '#FFFFFF',
  fontFamily: pageFont,
  fontSize: 13,
  fontWeight: 820,
  padding: '0 18px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  cursor: 'pointer',
};

const secondaryButton: CSSProperties = {
  ...primaryButton,
  background: '#FFFFFF',
  color: '#111827',
  border: `1px solid ${BRAND.borderStrong}`,
};

const fieldStyle: CSSProperties = {
  height: 46,
  borderRadius: 14,
  border: `1px solid ${BRAND.border}`,
  background: '#FFFFFF',
  color: BRAND.text,
  padding: '0 13px',
  fontFamily: pageFont,
  fontSize: 14,
  fontWeight: 650,
  outline: 'none',
  boxSizing: 'border-box',
};

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function defaultRange() {
  const now = new Date();
  const from = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const to = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`;
  return { from, to };
}

function conflictLabel(type: string) {
  const map: Record<string, string> = {
    new: 'Neu',
    exact_match: 'Bereits identisch',
    time_conflict: 'Zeitkonflikt',
    locked_conflict: 'Gesperrter Konflikt',
    multiple_existing: 'Mehrere bestehende Zeiten',
    employee_unmatched: 'Mitarbeiter nicht gefunden',
    employee_ambiguous: 'Mitarbeiter nicht eindeutig',
    invalid: 'Ungültige Zeile',
  };
  return map[type] || type;
}

function conflictTone(type: string) {
  if (type === 'new') return { bg: '#F0FDF4', text: '#166534', border: '#BBF7D0' };
  if (type === 'exact_match') return { bg: '#F9FAFB', text: '#6B7280', border: '#E5E7EB' };
  if (type === 'time_conflict') return { bg: '#FFFBEB', text: '#92400E', border: '#FDE68A' };
  return { bg: '#FEF2F2', text: '#B91C1C', border: '#FECACA' };
}

function matchMethodLabel(method?: string | null) {
  const labels: Record<string, string> = {
    employee_number: 'Mitarbeiter-Nr.',
    email: 'E-Mail',
    exact_name: 'Name exakt',
    exact_name_deep_resolved: 'Name + Systemaktivität',
    fuzzy_name_high_confidence: 'Name sehr ähnlich',
    fuzzy_name_operational: 'Name + Systemaktivität',
    unique_first_name_deep: 'Vorname + Systemaktivität',
  };
  return method ? labels[method] || 'Systemabgleich' : 'Systemabgleich';
}

function StatusPill({ type }: { type: string }) {
  const tone = conflictTone(type);
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        minHeight: 28,
        borderRadius: 999,
        padding: '0 11px',
        border: `1px solid ${tone.border}`,
        background: tone.bg,
        color: tone.text,
        fontSize: 12,
        fontWeight: 780,
        whiteSpace: 'nowrap',
      }}
    >
      {conflictLabel(type)}
    </span>
  );
}

function diffText(label: string, value: number | null | undefined) {
  if (value === null || value === undefined || value === 0) return null;
  return `${label} ${value > 0 ? '+' : ''}${value} Min.`;
}

function formatElapsed(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return `${pad(minutes)}:${pad(remainder)}`;
}

function analysisStage(seconds: number) {
  if (seconds < 12) return 'Datei wird hochgeladen';
  if (seconds < 45) return 'Arbeitsblätter und Zeitzeilen werden gelesen';
  if (seconds < 105) return 'Zeitangaben werden strukturiert';
  return 'Mitarbeiter und bestehende Zeiten werden abgeglichen';
}

function analysisHint(seconds: number) {
  if (seconds < 45) return 'Die Datei wird vorbereitet und sicher verarbeitet.';
  if (seconds < 120) return 'Bei umfangreichen Excel-Dateien dauert die Analyse meist etwa 1–3 Minuten.';
  if (seconds < 210) return 'Der Abgleich läuft weiter. Bitte diese Seite geöffnet lassen.';
  return 'Die Datei ist umfangreich. Die Verarbeitung läuft weiterhin und wird nicht doppelt gestartet.';
}

async function accessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error('Nicht eingeloggt.');
  return token;
}

export default function TimeImportExportPanel() {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const initialRange = useMemo(() => defaultRange(), []);

  const [file, setFile] = useState<File | null>(null);
  const [batch, setBatch] = useState<any>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [documentNotes, setDocumentNotes] = useState<string[]>([]);
  const [busy, setBusy] = useState<'prepare' | 'commit' | 'export' | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [analysisStartedAt, setAnalysisStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [lastAnalysisSeconds, setLastAnalysisSeconds] = useState<number | null>(null);
  const [exportFrom, setExportFrom] = useState(initialRange.from);
  const [exportTo, setExportTo] = useState(initialRange.to);

  const counts = useMemo(() => {
    return {
      total: rows.length,
      fresh: rows.filter((row) => row.conflict_type === 'new').length,
      exact: rows.filter((row) => row.conflict_type === 'exact_match').length,
      conflicts: rows.filter((row) =>
        ['time_conflict', 'locked_conflict', 'multiple_existing'].includes(row.conflict_type),
      ).length,
      blocked: rows.filter((row) =>
        ['locked_conflict', 'employee_unmatched', 'employee_ambiguous', 'invalid'].includes(row.conflict_type),
      ).length,
      review: rows.filter((row) => row.resolution === 'review').length,
      actionable: rows.filter((row) => ['insert', 'replace'].includes(row.resolution)).length,
    };
  }, [rows]);

  useEffect(() => {
    if (busy !== 'prepare' || !analysisStartedAt) return;

    const update = () => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - analysisStartedAt) / 1000)));
    };

    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [busy, analysisStartedAt]);

  function updateRow(id: string, patch: Partial<ImportRow>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function applyGlobal(mode: 'review' | 'keep' | 'upload') {
    setRows((current) =>
      current.map((row) => {
        if (row.conflict_type === 'new') return { ...row, resolution: 'insert' };
        if (row.conflict_type === 'exact_match') return { ...row, resolution: 'keep' };

        if (mode === 'keep') return { ...row, resolution: 'keep' };

        if (mode === 'upload') {
          return {
            ...row,
            resolution: row.override_allowed && row.existing_entries.length === 1 ? 'replace' : 'keep',
          };
        }

        if (row.conflict_type === 'time_conflict' && row.override_allowed) {
          return { ...row, resolution: 'review' };
        }

        return { ...row, resolution: 'keep' };
      }),
    );
  }

  async function prepare() {
    if (!file) {
      setError('Bitte zuerst eine Zeitdatei auswählen.');
      return;
    }

    const startedAt = Date.now();
    setAnalysisStartedAt(startedAt);
    setElapsedSeconds(0);
    setLastAnalysisSeconds(null);
    setBusy('prepare');
    setError('');
    setMessage('');

    try {
      const token = await accessToken();
      const form = new FormData();
      form.append('file', file);

      const response = await fetch('/api/opc/time-import/prepare', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      const body = await response.json();
      if (!response.ok) throw new Error(body?.error || 'Zeitdatei konnte nicht verarbeitet werden.');

      setBatch(body.batch);
      setRows(body.rows || []);
      setDocumentNotes(body.documentNotes || []);
      setMessage(
        `${body.rows?.length || 0} Zeitzeilen erkannt. Konflikte wurden mit bestehenden Clock-in/Clock-out-Daten verglichen.`,
      );
    } catch (err: any) {
      setError(err?.message || 'Zeitimport konnte nicht vorbereitet werden.');
    } finally {
      setLastAnalysisSeconds(Math.max(1, Math.round((Date.now() - startedAt) / 1000)));
      setAnalysisStartedAt(null);
      setBusy(null);
    }
  }

  async function commit() {
    const unresolved = rows.filter((row) => row.resolution === 'review');
    if (unresolved.length) {
      setError(`${unresolved.length} Konflikt(e) müssen zuerst entschieden werden.`);
      return;
    }

    if (!batch?.id) {
      setError('Kein vorbereiteter Import vorhanden.');
      return;
    }

    setBusy('commit');
    setError('');
    setMessage('');

    try {
      const token = await accessToken();
      const resolutions = rows.map((row) => ({
        row_id: row.id,
        action: row.resolution,
        target_entry_id:
          row.resolution === 'replace' && row.existing_entries.length === 1
            ? row.existing_entries[0].id
            : null,
        clock_in_local: row.clock_in_local,
        clock_out_local: row.clock_out_local,
        clock_out_next_day: row.clock_out_next_day,
        break_minutes: Number(row.break_minutes || 0),
        note: row.note || null,
      }));

      const response = await fetch('/api/opc/time-import/commit', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ batchId: batch.id, resolutions }),
      });

      const body = await response.json();
      if (!response.ok) throw new Error(body?.error || 'Zeitimport konnte nicht gespeichert werden.');

      setMessage(
        `Import abgeschlossen: ${body?.result?.inserted || 0} neu, ${body?.result?.replaced || 0} ersetzt, ${body?.result?.kept || 0} behalten.`,
      );
      setRows([]);
      setBatch(null);
      setFile(null);
      setDocumentNotes([]);
      if (fileRef.current) fileRef.current.value = '';
    } catch (err: any) {
      setError(err?.message || 'Zeitimport konnte nicht gespeichert werden.');
    } finally {
      setBusy(null);
    }
  }

  async function downloadExport() {
    setBusy('export');
    setError('');
    setMessage('');

    try {
      const token = await accessToken();
      const response = await fetch(
        `/api/opc/time-import/export?from=${encodeURIComponent(exportFrom)}&to=${encodeURIComponent(exportTo)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error || 'Zeiten konnten nicht exportiert werden.');
      }

      const blob = await response.blob();
      const disposition = response.headers.get('content-disposition') || '';
      const match = disposition.match(/filename="([^"]+)"/i);
      const filename = match?.[1] || `Zeiterfassung_${exportFrom}_${exportTo}.csv`;

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      setMessage('Zeiterfassung wurde als CSV exportiert.');
    } catch (err: any) {
      setError(err?.message || 'Export fehlgeschlagen.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 18, fontFamily: pageFont, color: BRAND.text }}>
      <div className="opc-ai-time-two-column" style={{ display: 'grid', gridTemplateColumns: '1.15fr .85fr', gap: 18 }}>
        <section style={{ ...cardStyle, padding: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 820, letterSpacing: '-0.025em' }}>
            KI-Zeitimport
          </div>
          <div style={{ marginTop: 5, fontSize: 13, color: BRAND.muted, fontWeight: 650 }}>
            CSV, TSV, XLSX, XLS, PDF oder TXT · maximal 15 MB
          </div>

          <div
            style={{
              marginTop: 18,
              padding: 18,
              borderRadius: 16,
              border: `1px dashed ${BRAND.borderStrong}`,
              background: BRAND.soft,
            }}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.tsv,.xlsx,.xls,.pdf,.txt"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
              style={{ width: '100%', fontFamily: pageFont, fontSize: 13 }}
            />
            {file && (
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 9 }}>
                <FileSpreadsheet size={18} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 780 }}>{file.name}</div>
                  <div style={{ fontSize: 12, color: BRAND.muted, marginTop: 2 }}>
                    {(file.size / 1024).toFixed(1)} KB
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => void prepare()}
            disabled={busy !== null}
            style={{
              ...primaryButton,
              marginTop: 14,
              minWidth: busy === 'prepare' ? 230 : undefined,
              opacity: busy && busy !== 'prepare' ? 0.6 : 1,
            }}
          >
            {busy === 'prepare' ? <Loader2 size={17} className="spin" /> : <Upload size={17} />}
            {busy === 'prepare'
              ? `Analyse läuft · ${formatElapsed(elapsedSeconds)}`
              : 'Datei analysieren'}
          </button>

          {busy === 'prepare' && (
            <div
              style={{
                marginTop: 12,
                borderRadius: 14,
                border: `1px solid ${BRAND.border}`,
                background: '#FFFFFF',
                padding: '13px 14px',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto minmax(0, 1fr) auto',
                  gap: 11,
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 11,
                    display: 'grid',
                    placeItems: 'center',
                    background: BRAND.soft,
                    border: `1px solid ${BRAND.border}`,
                  }}
                >
                  <Loader2 size={17} className="spin" />
                </div>

                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 820 }}>
                    {analysisStage(elapsedSeconds)}
                  </div>
                  <div style={{ marginTop: 3, fontSize: 11, color: BRAND.muted, fontWeight: 650, lineHeight: 1.4 }}>
                    {analysisHint(elapsedSeconds)}
                  </div>
                </div>

                <div
                  style={{
                    minWidth: 64,
                    height: 32,
                    borderRadius: 999,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 10px',
                    background: BRAND.soft,
                    border: `1px solid ${BRAND.border}`,
                    color: BRAND.text,
                    fontSize: 12,
                    fontWeight: 820,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {formatElapsed(elapsedSeconds)}
                </div>
              </div>

              <div
                className="opc-ai-analysis-track"
                style={{
                  position: 'relative',
                  height: 3,
                  borderRadius: 999,
                  background: '#EEF0F3',
                  overflow: 'hidden',
                  marginTop: 11,
                }}
              >
                <div className="opc-ai-analysis-pulse" />
              </div>
            </div>
          )}
        </section>

        <section style={{ ...cardStyle, padding: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 820, letterSpacing: '-0.025em' }}>
            Zeiten exportieren
          </div>
          <div style={{ marginTop: 5, fontSize: 13, color: BRAND.muted, fontWeight: 650 }}>
            Saubere CSV ohne interne Datenbank-IDs.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 18 }}>
            <label style={{ display: 'grid', gap: 7, fontSize: 12, fontWeight: 760, color: BRAND.muted }}>
              Von
              <input
                type="date"
                value={exportFrom}
                onChange={(event) => setExportFrom(event.target.value)}
                style={fieldStyle}
              />
            </label>
            <label style={{ display: 'grid', gap: 7, fontSize: 12, fontWeight: 760, color: BRAND.muted }}>
              Bis
              <input
                type="date"
                value={exportTo}
                onChange={(event) => setExportTo(event.target.value)}
                style={fieldStyle}
              />
            </label>
          </div>

          <button
            type="button"
            onClick={() => void downloadExport()}
            disabled={busy !== null}
            style={{ ...secondaryButton, marginTop: 14, opacity: busy ? 0.6 : 1 }}
          >
            {busy === 'export' ? <Loader2 size={17} className="spin" /> : <Download size={17} />}
            CSV herunterladen
          </button>
        </section>
      </div>

      {error && (
        <div
          style={{
            border: '1px solid #FECACA',
            background: '#FEF2F2',
            color: BRAND.red,
            borderRadius: 14,
            padding: '12px 14px',
            fontSize: 13,
            fontWeight: 720,
          }}
        >
          {error}
        </div>
      )}

      {message && (
        <div
          style={{
            border: '1px solid #BBF7D0',
            background: '#F0FDF4',
            color: BRAND.green,
            borderRadius: 14,
            padding: '12px 14px',
            fontSize: 13,
            fontWeight: 720,
          }}
        >
          {message}
        </div>
      )}

      {rows.length > 0 && (
        <section style={{ ...cardStyle, padding: 20 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 14,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div style={{ fontSize: 18, fontWeight: 840, letterSpacing: '-0.035em' }}>
                Analyseergebnis
              </div>
              <div style={{ marginTop: 5, fontSize: 13, color: BRAND.muted, fontWeight: 650 }}>
                {rows.length} Zeitzeilen erkannt und mit bestehenden Clock-in/Clock-out-Daten verglichen.
              </div>
            </div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                minHeight: 32,
                padding: '0 11px',
                borderRadius: 999,
                background: '#F9FAFB',
                border: `1px solid ${BRAND.border}`,
                color: BRAND.muted,
                fontSize: 12,
                fontWeight: 760,
              }}
            >
              <ShieldCheck size={15} />
              {lastAnalysisSeconds ? `Analyse ${formatElapsed(lastAnalysisSeconds)}` : 'Keine automatische Payroll-Freigabe'}
            </div>
          </div>

          <div style={{ display: 'grid', gap: 16, marginTop: 18 }}>
          <div className="opc-ai-time-metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 12 }}>
            {[
              ['Erkannt', counts.total],
              ['Neu', counts.fresh],
              ['Identisch', counts.exact],
              ['Konflikte', counts.conflicts],
              ['Gesperrt', counts.blocked],
            ].map(([label, value]) => (
              <div key={String(label)} style={{ ...cardStyle, padding: 16, minHeight: 82 }}>
                <div style={{ fontSize: 24, fontWeight: 840, letterSpacing: '-0.04em' }}>{value}</div>
                <div style={{ marginTop: 4, fontSize: 12, color: BRAND.muted, fontWeight: 720 }}>{label}</div>
              </div>
            ))}
          </div>

          <section style={{ ...cardStyle, padding: 20 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 14,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <div style={{ fontSize: 16, fontWeight: 820, letterSpacing: '-0.025em' }}>
                  Konfliktbehandlung
                </div>
                <div style={{ marginTop: 5, fontSize: 13, color: BRAND.muted, fontWeight: 650 }}>
                  Upload bevorzugen ersetzt nur einzelne, nicht gesperrte bestehende Zeiteinträge.
                  Genehmigte, aktive oder bereits abgerechnete Zeiten bleiben geschützt.
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" onClick={() => applyGlobal('review')} style={{ ...secondaryButton, height: 40 }}>
                  Einzeln prüfen
                </button>
                <button type="button" onClick={() => applyGlobal('keep')} style={{ ...secondaryButton, height: 40 }}>
                  Bestehende behalten
                </button>
                <button type="button" onClick={() => applyGlobal('upload')} style={{ ...secondaryButton, height: 40 }}>
                  Upload bevorzugen
                </button>
              </div>
            </div>
          </section>

          {documentNotes.length > 0 && (
            <section style={{ ...cardStyle, padding: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 800 }}>Hinweise aus der Datei</div>
              <div style={{ marginTop: 8, display: 'grid', gap: 5, color: BRAND.muted, fontSize: 12, fontWeight: 650 }}>
                {documentNotes.map((note, index) => <div key={index}>• {note}</div>)}
              </div>
            </section>
          )}

          <div style={{ display: 'grid', gap: 12 }}>
            {rows.map((row) => {
              const existing = row.existing_entries?.[0] || null;
              const diffs = row.conflict_fields?.differences || {};
              const diffLabels = [
                diffText('Start', diffs.clock_in_minutes),
                diffText('Ende', diffs.clock_out_minutes),
                diffText('Pause', diffs.break_minutes),
                diffText('Netto', diffs.total_minutes),
              ].filter(Boolean);

              const canReplace = row.override_allowed && row.existing_entries.length === 1;

              return (
                <section key={row.id} style={{ ...cardStyle, padding: 18 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 14,
                      alignItems: 'flex-start',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <div style={{ fontSize: 15, fontWeight: 820 }}>
                          {row.employee_name || 'Nicht zugeordnet'}
                        </div>
                        <StatusPill type={row.conflict_type} />
                      </div>
                      <div style={{ marginTop: 5, fontSize: 12, color: BRAND.muted, fontWeight: 670 }}>
                        {row.employee_number || 'Keine Mitarbeiter-Nr.'} · {row.work_date || 'Kein Datum'} · Quelldatei-Zeile {row.source_row_number}
                      </div>

                      {row.employee_id && row.metadata?.employee_match && (
                        <div
                          style={{
                            marginTop: 7,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 7,
                            flexWrap: 'wrap',
                            fontSize: 11,
                            fontWeight: 720,
                            color: BRAND.muted,
                          }}
                        >
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              minHeight: 24,
                              padding: '0 8px',
                              borderRadius: 999,
                              border: `1px solid ${BRAND.border}`,
                              background: BRAND.soft,
                              color: BRAND.text,
                            }}
                          >
                            {matchMethodLabel(row.metadata.employee_match.method)}
                            {' · '}
                            {Math.round(row.metadata.employee_match.confidence || 0)}%
                          </span>
                          {(row.metadata.employee_match.reasons || []).slice(0, 3).map((reason) => (
                            <span key={reason}>{reason}</span>
                          ))}
                        </div>
                      )}

                      {!row.employee_id && (row.metadata?.employee_match?.candidates?.length || 0) > 0 && (
                        <div
                          style={{
                            marginTop: 8,
                            padding: '9px 10px',
                            borderRadius: 12,
                            border: `1px solid ${BRAND.border}`,
                            background: BRAND.soft,
                            display: 'grid',
                            gap: 5,
                          }}
                        >
                          <div style={{ fontSize: 11, fontWeight: 800, color: BRAND.text }}>
                            Wahrscheinlichste OPC-Mitarbeiter
                          </div>
                          {(row.metadata?.employee_match?.candidates || []).slice(0, 3).map((candidate) => (
                            <div
                              key={candidate.employee_id}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                gap: 10,
                                fontSize: 11,
                                color: BRAND.muted,
                                fontWeight: 680,
                              }}
                            >
                              <span>
                                {candidate.employee_name}
                                {candidate.employee_number ? ` · ${candidate.employee_number}` : ''}
                              </span>
                              <span style={{ fontWeight: 800, color: BRAND.text }}>
                                {candidate.confidence}%
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => updateRow(row.id, { resolution: 'keep' })}
                        style={{
                          ...secondaryButton,
                          height: 38,
                          borderColor: row.resolution === 'keep' ? BRAND.black : BRAND.borderStrong,
                        }}
                      >
                        System behalten
                      </button>
                      {row.conflict_type === 'new' && (
                        <button
                          type="button"
                          onClick={() => updateRow(row.id, { resolution: 'insert' })}
                          style={{
                            ...secondaryButton,
                            height: 38,
                            borderColor: row.resolution === 'insert' ? BRAND.black : BRAND.borderStrong,
                          }}
                        >
                          Neu übernehmen
                        </button>
                      )}
                      {canReplace && (
                        <button
                          type="button"
                          onClick={() => updateRow(row.id, { resolution: 'replace' })}
                          style={{
                            ...secondaryButton,
                            height: 38,
                            borderColor: row.resolution === 'replace' ? BRAND.black : BRAND.borderStrong,
                          }}
                        >
                          Upload übernehmen
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="opc-ai-time-compare" style={{ display: 'grid', gridTemplateColumns: existing ? '1fr 1fr' : '1fr', gap: 12, marginTop: 16 }}>
                    {existing && (
                      <div style={{ borderRadius: 14, background: BRAND.soft, border: `1px solid ${BRAND.border}`, padding: 14 }}>
                        <div style={{ fontSize: 12, color: BRAND.muted, fontWeight: 800, marginBottom: 9 }}>
                          BESTEHEND IM SYSTEM
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
                          {[
                            ['Start', existing.clock_in_local || '—'],
                            ['Ende', existing.clock_out_local || '—'],
                            ['Pause', `${existing.break_minutes || 0} Min.`],
                            ['Netto', `${existing.total_minutes || 0} Min.`],
                          ].map(([label, value]) => (
                            <div key={String(label)}>
                              <div style={{ fontSize: 11, color: BRAND.faint, fontWeight: 720 }}>{label}</div>
                              <div style={{ marginTop: 3, fontSize: 13, fontWeight: 790 }}>{value}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{ marginTop: 9, fontSize: 11, color: BRAND.muted, fontWeight: 680 }}>
                          Status: {existing.status}{existing.payroll_used ? ' · bereits in Payroll verwendet' : ''}
                        </div>
                      </div>
                    )}

                    <div style={{ borderRadius: 14, background: '#FFFFFF', border: `1px solid ${BRAND.border}`, padding: 14 }}>
                      <div style={{ fontSize: 12, color: BRAND.muted, fontWeight: 800, marginBottom: 9 }}>
                        HOCHGELADENE ZEIT
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
                        <label style={{ display: 'grid', gap: 4 }}>
                          <span style={{ fontSize: 11, color: BRAND.faint, fontWeight: 720 }}>Start</span>
                          <input
                            type="time"
                            value={row.clock_in_local || ''}
                            disabled={row.resolution === 'keep'}
                            onChange={(event) => updateRow(row.id, { clock_in_local: event.target.value })}
                            style={{ ...fieldStyle, height: 38, minWidth: 0, width: '100%' }}
                          />
                        </label>
                        <label style={{ display: 'grid', gap: 4 }}>
                          <span style={{ fontSize: 11, color: BRAND.faint, fontWeight: 720 }}>Ende</span>
                          <input
                            type="time"
                            value={row.clock_out_local || ''}
                            disabled={row.resolution === 'keep'}
                            onChange={(event) => updateRow(row.id, { clock_out_local: event.target.value })}
                            style={{ ...fieldStyle, height: 38, minWidth: 0, width: '100%' }}
                          />
                        </label>
                        <label style={{ display: 'grid', gap: 4 }}>
                          <span style={{ fontSize: 11, color: BRAND.faint, fontWeight: 720 }}>Pause Min.</span>
                          <input
                            type="number"
                            min={0}
                            value={row.break_minutes || 0}
                            disabled={row.resolution === 'keep'}
                            onChange={(event) =>
                              updateRow(row.id, { break_minutes: Math.max(0, Number(event.target.value || 0)) })
                            }
                            style={{ ...fieldStyle, height: 38, minWidth: 0, width: '100%' }}
                          />
                        </label>
                        <div>
                          <div style={{ fontSize: 11, color: BRAND.faint, fontWeight: 720 }}>Netto erkannt</div>
                          <div style={{ marginTop: 10, fontSize: 13, fontWeight: 790 }}>
                            {row.total_minutes ?? '—'} Min.
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {diffLabels.length > 0 && (
                    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 11 }}>
                      {diffLabels.map((label) => (
                        <span
                          key={label}
                          style={{
                            borderRadius: 999,
                            padding: '5px 9px',
                            background: '#FFFBEB',
                            color: BRAND.amber,
                            border: '1px solid #FDE68A',
                            fontSize: 11,
                            fontWeight: 760,
                          }}
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  )}

                  {row.locked_reason && (
                    <div style={{ marginTop: 11, display: 'flex', gap: 7, color: BRAND.red, fontSize: 12, fontWeight: 720 }}>
                      <AlertTriangle size={15} style={{ flex: '0 0 auto' }} />
                      {row.locked_reason}
                    </div>
                  )}

                  {row.issues?.length > 0 && (
                    <div style={{ marginTop: 8, color: BRAND.muted, fontSize: 11, fontWeight: 650 }}>
                      {row.issues.join(' · ')}
                    </div>
                  )}

                  {row.resolution === 'review' && (
                    <div style={{ marginTop: 10, color: BRAND.amber, fontSize: 12, fontWeight: 760 }}>
                      Entscheidung erforderlich.
                    </div>
                  )}
                </section>
              );
            })}
          </div>

          <section style={{ ...cardStyle, padding: 20 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 14,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 820 }}>
                  {counts.review > 0
                    ? `${counts.review} Konflikt(e) noch offen`
                    : counts.actionable === 0
                      ? 'Keine Zeile ist aktuell zum Import freigegeben'
                      : `${counts.actionable} Zeile(n) werden übernommen`}
                </div>
                <div style={{ marginTop: 4, fontSize: 12, color: BRAND.muted, fontWeight: 650 }}>
                  {counts.actionable === 0
                    ? 'Bitte zuerst Mitarbeiterzuordnung oder Konflikte prüfen. Mit «System behalten» wird nichts verändert.'
                    : 'Der Import wird atomar gespeichert. Bei einem neuen Konflikt wird nichts teilweise geschrieben.'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void commit()}
                disabled={busy !== null || counts.review > 0 || counts.actionable === 0}
                style={{
                  ...primaryButton,
                  opacity: busy !== null || counts.review > 0 || counts.actionable === 0 ? 0.45 : 1,
                }}
              >
                {busy === 'commit' ? <Loader2 size={17} className="spin" /> : <CheckCircle2 size={17} />}
                Import bestätigen
              </button>
            </div>
          </section>
          </div>
        </section>
      )}

      <style>{`
        @keyframes opc-ai-spin { to { transform: rotate(360deg); } }
        @keyframes opc-ai-analysis-move {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(380%); }
        }
        .spin { animation: opc-ai-spin .8s linear infinite; }
        .opc-ai-analysis-pulse {
          position: absolute;
          inset: 0 auto 0 0;
          width: 28%;
          border-radius: 999px;
          background: #0F1115;
          animation: opc-ai-analysis-move 1.55s ease-in-out infinite;
        }
        @media (max-width: 980px) {
          .opc-ai-time-two-column { grid-template-columns: 1fr !important; }
          .opc-ai-time-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          .opc-ai-time-compare { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 620px) {
          .opc-ai-time-metrics { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </div>
  );
}

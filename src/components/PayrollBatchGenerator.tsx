import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';
import {
  buildPayrollHtml,
  downloadBase64Pdf,
  renderHtmlToPdfBase64,
} from '../lib/opc-document-html';

type JsonRow = Record<string, any>;

type EmployeeRow = {
  id: string;
  employee_id: string | null;
  source: 'hr' | 'portal_only';
  employee_number: string | null;
  display_name: string;
  status: string;
  payroll_in_scope: boolean | null;
};

type EmployeesPayload = {
  success: boolean;
  canManagePayroll?: boolean;
  employees?: EmployeeRow[];
  error?: string;
};

type PreviewPayload = {
  success: boolean;
  payroll?: JsonRow;
  filename?: string;
  summary?: JsonRow;
  error?: string;
};

type TargetKind = 'payroll' | 'special' | 'repayment';

type PayrollTarget = {
  key: string;
  name: string;
  aliases?: string[];
  kind?: TargetKind;
  expectedHours?: number;
  expectedHourlyRate?: number;
  expectedGross?: number;
  expectedNet?: number;
  note?: string;
};

type PeriodPreset = {
  id: 'july-2026' | 'august-2026';
  label: string;
  from: string;
  to: string;
  sourceLabel: string;
  targets: PayrollTarget[];
};

type ReconciliationResult = {
  target: PayrollTarget;
  employee: EmployeeRow | null;
  preview: PreviewPayload | null;
  differences: string[];
  error?: string;
  checking?: boolean;
};

const JULY_TARGETS: PayrollTarget[] = [
  { key: 'july-pravin', name: 'Pravin Manotheepan', expectedGross: 6803.5, expectedNet: 6000 },
  { key: 'july-sara-batista', name: 'Sara Batista', expectedGross: 5000, expectedNet: 4151 },
  { key: 'july-filip', name: 'Filip Andjekovic', expectedGross: 4031.13, expectedNet: 3491.76 },
  { key: 'july-sebastian', name: 'Sebastian Jasari', aliases: ['Sebastien Jasari'], expectedGross: 3201, expectedNet: 2772.71 },
  { key: 'july-maria', name: 'Maria Varela Malpica', expectedGross: 1930.5, expectedNet: 1757.14 },
  { key: 'july-luciano', name: 'Luciano Morangi', aliases: ['Luciano Marangi'], expectedGross: 1529, expectedNet: 1194.42 },
  { key: 'july-emine', name: 'Emine Ziberi', aliases: ['Emine Zieberi'], expectedGross: 1350.8, expectedNet: 1170.06 },
  { key: 'july-herminia', name: 'Herminia Monteiro', expectedGross: 762, expectedNet: 693.57 },
  { key: 'july-ylercio', name: 'Ylercio Zabila Do Espírito Santo', expectedGross: 660, expectedNet: 571.69 },
  { key: 'july-migel', name: 'Migel Mirkovic', expectedGross: 469.5, expectedNet: 427.34 },
];

const AUGUST_TARGETS: PayrollTarget[] = [
  { key: 'aug-filip', name: 'Filip Andjekovic', expectedHours: 148.2, expectedHourlyRate: 26.5, expectedGross: 4184.81 },
  { key: 'aug-sebastian', name: 'Sebastian Jasari', aliases: ['Sebastien Jasari'], expectedHours: 143, expectedHourlyRate: 23, expectedGross: 3486.85 },
  { key: 'aug-herminia', name: 'Herminia Monteiro', expectedHours: 167, expectedHourlyRate: 25, expectedGross: 3903.17 },
  { key: 'aug-luciano', name: 'Luciano Morangi', aliases: ['Luciano Marangi'], expectedHours: 13, expectedHourlyRate: 22, expectedGross: 400.12 },
  { key: 'aug-maria', name: 'Maria Varela Malpica', expectedHours: 74, expectedHourlyRate: 23, expectedGross: 1757.62 },
  { key: 'aug-emine', name: 'Emine Ziberi', aliases: ['Emine Zieberi'], expectedHours: 101, expectedHourlyRate: 22, expectedGross: 2210.59 },
  { key: 'aug-sara-isabel', name: 'Sara Isabel', expectedHours: 43.33, expectedHourlyRate: 22, expectedGross: 944.04 },
  { key: 'aug-sara-batista', name: 'Sara Batista', expectedHours: 180, expectedHourlyRate: 25, expectedGross: 4151 },
  { key: 'aug-daniele', name: 'Daniele', kind: 'special', expectedGross: 480, note: 'Separater August-Eintrag ohne Stundenangabe in der CSV.' },
  { key: 'aug-pravin', name: 'Pravin Manotheepan', kind: 'special', expectedGross: 1500, note: 'Separater August-Eintrag ohne Stundenangabe in der CSV.' },
  { key: 'aug-frank', name: 'Frank Rückzahlung', kind: 'repayment', expectedGross: 2000, note: 'Als Rückzahlung erfasst; bewusst nicht als Lohnabrechnung behandeln.' },
];

const PERIODS: PeriodPreset[] = [
  {
    id: 'july-2026',
    label: 'Juli · 24.06.–23.07.2026',
    from: '2026-06-24',
    to: '2026-07-23',
    sourceLabel: 'CSV: Stundenerfassung Mitarbeiter 24 Juni bis 23 Juli',
    targets: JULY_TARGETS,
  },
  {
    id: 'august-2026',
    label: 'August · 24.07.–24.08.2026',
    from: '2026-07-24',
    to: '2026-08-24',
    sourceLabel: 'CSV: AUGUST Stundenzettel – Personalabteilung',
    targets: AUGUST_TARGETS,
  },
];

const BRAND = {
  orange: '#ff6a00',
  black: '#0f1115',
  text: '#111827',
  muted: '#6b7280',
  border: '#e5e7eb',
  soft: '#f8fafc',
  success: '#047857',
  successBg: '#ecfdf5',
  successBorder: '#a7f3d0',
  warning: '#b45309',
  warningBg: '#fffbeb',
  warningBorder: '#fde68a',
  danger: '#b91c1c',
  dangerBg: '#fef2f2',
  dangerBorder: '#fecaca',
};

const cardStyle: CSSProperties = {
  background: '#fff',
  border: `1px solid ${BRAND.border}`,
  borderRadius: 18,
  boxShadow: '0 1px 2px rgba(15, 17, 21, 0.04)',
};

function normalizeName(value: unknown) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function chf(value: unknown) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: 'CHF',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function hours(value: unknown) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat('de-CH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function near(a: unknown, b: unknown, tolerance: number) {
  const left = Number(a);
  const right = Number(b);
  return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) <= tolerance;
}

async function accessToken() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Keine aktive Sitzung gefunden. Bitte zuerst im OPC-Portal anmelden.');
  return token;
}

async function requestJson<T>(path: string): Promise<T> {
  const token = await accessToken();
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || `Anfrage fehlgeschlagen (${response.status}).`);
  return payload as T;
}

function employeeCandidates(target: PayrollTarget) {
  return [target.name, ...(target.aliases || [])].map(normalizeName).filter(Boolean);
}

function findEmployee(target: PayrollTarget, employees: EmployeeRow[]) {
  const names = employeeCandidates(target);
  const exact = employees.find((employee) => names.includes(normalizeName(employee.display_name)));
  if (exact) return exact;

  const targetTokens = new Set(normalizeName(target.name).split(' ').filter(Boolean));
  const scored = employees
    .map((employee) => {
      const tokens = normalizeName(employee.display_name).split(' ').filter(Boolean);
      const overlap = tokens.filter((token) => targetTokens.has(token)).length;
      const score = overlap / Math.max(targetTokens.size, tokens.length, 1);
      return { employee, score };
    })
    .filter((row) => row.score >= 0.67)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 1 || (scored[0] && scored[1] && scored[0].score > scored[1].score)) {
    return scored[0]?.employee || null;
  }
  return null;
}

function differencesFor(target: PayrollTarget, summary: JsonRow) {
  const differences: string[] = [];
  if (target.expectedHours != null && !near(summary.totalHours, target.expectedHours, 0.03)) {
    differences.push(`Stunden CSV ${hours(target.expectedHours)} ≠ Portal ${hours(summary.totalHours)}`);
  }
  if (target.expectedGross != null && !near(summary.grossSalary, target.expectedGross, 0.05)) {
    differences.push(`Brutto CSV ${chf(target.expectedGross)} ≠ Portal ${chf(summary.grossSalary)}`);
  }
  if (target.expectedNet != null && !near(summary.netSalary, target.expectedNet, 0.05)) {
    differences.push(`Netto CSV ${chf(target.expectedNet)} ≠ Portal ${chf(summary.netSalary)}`);
  }
  return differences;
}

function statusFor(result: ReconciliationResult | undefined) {
  if (!result) return 'open';
  if (result.checking) return 'checking';
  if (result.error || !result.employee || !result.preview) return 'error';
  if (result.differences.length) return 'warning';
  return 'success';
}

export default function PayrollBatchGenerator() {
  const [periodId, setPeriodId] = useState<PeriodPreset['id']>('july-2026');
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [canManagePayroll, setCanManagePayroll] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [checkingAll, setCheckingAll] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [results, setResults] = useState<Record<string, ReconciliationResult>>({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const period = useMemo(() => PERIODS.find((item) => item.id === periodId) || PERIODS[0], [periodId]);

  async function loadEmployees() {
    setLoadingEmployees(true);
    setError('');
    try {
      const payload = await requestJson<EmployeesPayload>('/api/opc/employees?mode=summary');
      const rows = (payload.employees || []).filter((row) => row.source === 'hr' && row.employee_id);
      setEmployees(rows);
      setCanManagePayroll(payload.canManagePayroll === true);
      if (payload.canManagePayroll !== true) {
        setError('Dieses Konto hat keine Payroll-Berechtigung.');
      }
    } catch (reason: any) {
      setError(reason?.message || 'Mitarbeiter konnten nicht geladen werden.');
    } finally {
      setLoadingEmployees(false);
    }
  }

  useEffect(() => {
    void loadEmployees();
  }, []);

  useEffect(() => {
    setResults({});
    setMessage('');
    setError('');
  }, [periodId]);

  async function reconcileTarget(target: PayrollTarget) {
    if (target.kind === 'repayment') {
      const result: ReconciliationResult = {
        target,
        employee: null,
        preview: null,
        differences: [],
        error: 'Rückzahlung – kein Payroll-PDF vorgesehen.',
      };
      setResults((current) => ({ ...current, [target.key]: result }));
      return result;
    }

    const employee = findEmployee(target, employees);
    if (!employee?.employee_id) {
      const result: ReconciliationResult = {
        target,
        employee: null,
        preview: null,
        differences: [],
        error: 'Kein eindeutiger Mitarbeiter im Portal gefunden.',
      };
      setResults((current) => ({ ...current, [target.key]: result }));
      return result;
    }

    setResults((current) => ({
      ...current,
      [target.key]: { target, employee, preview: null, differences: [], checking: true },
    }));

    try {
      const query = new URLSearchParams({ from: period.from, to: period.to });
      const preview = await requestJson<PreviewPayload>(
        `/api/opc/employees/${employee.employee_id}/payroll-preview?${query.toString()}`,
      );
      const result: ReconciliationResult = {
        target,
        employee,
        preview,
        differences: differencesFor(target, preview.summary || {}),
      };
      setResults((current) => ({ ...current, [target.key]: result }));
      return result;
    } catch (reason: any) {
      const result: ReconciliationResult = {
        target,
        employee,
        preview: null,
        differences: [],
        error: reason?.message || 'Lohnabrechnung konnte nicht berechnet werden.',
      };
      setResults((current) => ({ ...current, [target.key]: result }));
      return result;
    }
  }

  async function reconcileAll() {
    if (!canManagePayroll || checkingAll) return;
    setCheckingAll(true);
    setMessage('');
    setError('');
    try {
      for (const target of period.targets) {
        await reconcileTarget(target);
      }
      setMessage('Abgleich abgeschlossen. Grüne Positionen stimmen mit den CSV-Sollwerten überein.');
    } finally {
      setCheckingAll(false);
    }
  }

  async function downloadResult(result: ReconciliationResult) {
    if (!result.preview?.payroll || !result.employee?.employee_id) {
      throw new Error('Für diese Position liegt noch keine berechnete Payroll-Vorschau vor.');
    }
    const filename =
      result.preview.filename ||
      `Lohnabrechnung_${result.employee.employee_number || result.employee.employee_id}_${period.from}_${period.to}.pdf`;
    const html = buildPayrollHtml(result.preview.payroll as any);
    const rendered = await renderHtmlToPdfBase64(html, filename);
    if (!rendered?.base64) throw new Error('PDF-Renderer hat keine PDF-Datei zurückgegeben.');
    downloadBase64Pdf(rendered.base64, rendered.filename || filename);
  }

  async function downloadOne(target: PayrollTarget) {
    setError('');
    setMessage('');
    try {
      let result = results[target.key];
      if (!result?.preview) result = await reconcileTarget(target);
      if (!result || result.error) throw new Error(result?.error || 'Abrechnung nicht verfügbar.');
      await downloadResult(result);
      setMessage(`${target.name}: PDF wurde erzeugt.`);
    } catch (reason: any) {
      setError(reason?.message || 'PDF konnte nicht erzeugt werden.');
    }
  }

  async function downloadMatching() {
    if (downloadingAll) return;
    setDownloadingAll(true);
    setMessage('');
    setError('');
    try {
      const ready: ReconciliationResult[] = [];
      for (const target of period.targets) {
        if (target.kind === 'repayment') continue;
        let result = results[target.key];
        if (!result?.preview && !result?.error) result = await reconcileTarget(target);
        if (result?.preview?.payroll && !result.error && result.differences.length === 0) ready.push(result);
      }

      if (!ready.length) {
        throw new Error('Es gibt noch keine vollständig übereinstimmenden Abrechnungen zum Herunterladen.');
      }

      for (const result of ready) {
        await downloadResult(result);
        await new Promise((resolve) => window.setTimeout(resolve, 220));
      }
      setMessage(`${ready.length} übereinstimmende Lohnabrechnung(en) wurden erzeugt. Falls Chrome fragt, bitte mehrere Downloads erlauben.`);
    } catch (reason: any) {
      setError(reason?.message || 'Batch-Download konnte nicht abgeschlossen werden.');
    } finally {
      setDownloadingAll(false);
    }
  }

  const stats = useMemo(() => {
    let success = 0;
    let warning = 0;
    let errorCount = 0;
    for (const target of period.targets) {
      const status = statusFor(results[target.key]);
      if (status === 'success') success += 1;
      if (status === 'warning') warning += 1;
      if (status === 'error') errorCount += 1;
    }
    return { success, warning, error: errorCount };
  }, [period, results]);

  return (
    <div style={{ fontFamily: '-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter",sans-serif', color: BRAND.text, paddingBottom: 48 }}>
      <div style={{ ...cardStyle, padding: 24, marginBottom: 18, borderTop: `4px solid ${BRAND.orange}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
              <ShieldCheck size={20} color={BRAND.orange} />
              <strong style={{ fontSize: 18 }}>Lohnabrechnung · CSV-Abgleich & Batch-PDF</strong>
            </div>
            <div style={{ color: BRAND.muted, maxWidth: 820, lineHeight: 1.55 }}>
              Verwendet dieselbe Payroll-Vorschau, dieselbe HTML-Vorlage und denselben PDF-Renderer wie die Mitarbeiteransicht. PDFs werden erst nach dem Abgleich sichtbar als korrekt, abweichend oder nicht zuordenbar markiert.
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadEmployees()}
            disabled={loadingEmployees}
            style={{ border: `1px solid ${BRAND.border}`, borderRadius: 12, background: '#fff', padding: '10px 14px', fontWeight: 700, cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'center' }}
          >
            {loadingEmployees ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />}
            Mitarbeiter neu laden
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        {PERIODS.map((item) => {
          const active = item.id === period.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setPeriodId(item.id)}
              style={{
                border: `1px solid ${active ? BRAND.orange : BRAND.border}`,
                background: active ? '#fff7ed' : '#fff',
                color: active ? '#c2410c' : BRAND.text,
                borderRadius: 999,
                padding: '10px 16px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {error ? (
        <div style={{ background: BRAND.dangerBg, border: `1px solid ${BRAND.dangerBorder}`, color: BRAND.danger, borderRadius: 14, padding: '12px 14px', marginBottom: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
          <AlertTriangle size={17} /> {error}
        </div>
      ) : null}
      {message ? (
        <div style={{ background: BRAND.successBg, border: `1px solid ${BRAND.successBorder}`, color: BRAND.success, borderRadius: 14, padding: '12px 14px', marginBottom: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
          <CheckCircle2 size={17} /> {message}
        </div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12, marginBottom: 18 }}>
        {[
          { label: 'CSV-Positionen', value: period.targets.length, icon: <FileText size={18} /> },
          { label: 'Übereinstimmend', value: stats.success, icon: <CheckCircle2 size={18} /> },
          { label: 'Abweichungen', value: stats.warning, icon: <AlertTriangle size={18} /> },
          { label: 'Nicht verfügbar', value: stats.error, icon: <Users size={18} /> },
        ].map((item) => (
          <div key={item.label} style={{ ...cardStyle, padding: 16 }}>
            <div style={{ color: BRAND.muted, display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>{item.icon}{item.label}</div>
            <div style={{ fontSize: 26, fontWeight: 850, marginTop: 6 }}>{item.value}</div>
          </div>
        ))}
      </div>

      <div style={{ ...cardStyle, padding: 18, marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <strong>{period.label}</strong>
            <div style={{ color: BRAND.muted, marginTop: 4, fontSize: 13 }}>{period.sourceLabel}</div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              disabled={!canManagePayroll || checkingAll || loadingEmployees}
              onClick={() => void reconcileAll()}
              style={{ border: 0, borderRadius: 12, background: BRAND.black, color: '#fff', padding: '11px 16px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, opacity: !canManagePayroll ? 0.5 : 1 }}
            >
              {checkingAll ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />}
              Alle abgleichen
            </button>
            <button
              type="button"
              disabled={!canManagePayroll || downloadingAll || loadingEmployees}
              onClick={() => void downloadMatching()}
              style={{ border: 0, borderRadius: 12, background: BRAND.orange, color: '#fff', padding: '11px 16px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, opacity: !canManagePayroll ? 0.5 : 1 }}
            >
              {downloadingAll ? <Loader2 size={16} className="spin" /> : <Download size={16} />}
              Passende PDFs herunterladen
            </button>
          </div>
        </div>
      </div>

      <div style={{ ...cardStyle, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1120 }}>
            <thead>
              <tr style={{ background: BRAND.soft, textAlign: 'left' }}>
                {['Status', 'CSV-Mitarbeiter', 'Portal-Zuordnung', 'Stunden CSV / Portal', 'Brutto CSV / Portal', 'Netto CSV / Portal', 'Hinweis / Differenz', 'PDF'].map((label) => (
                  <th key={label} style={{ padding: '12px 14px', borderBottom: `1px solid ${BRAND.border}`, fontSize: 12, color: BRAND.muted, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {period.targets.map((target) => {
                const result = results[target.key];
                const status = statusFor(result);
                const summary = result?.preview?.summary || {};
                const special = target.kind === 'special';
                const repayment = target.kind === 'repayment';
                const statusConfig =
                  status === 'success'
                    ? { label: 'Korrekt', bg: BRAND.successBg, color: BRAND.success, border: BRAND.successBorder }
                    : status === 'warning'
                      ? { label: 'Differenz', bg: BRAND.warningBg, color: BRAND.warning, border: BRAND.warningBorder }
                      : status === 'error'
                        ? { label: repayment ? 'Ausgenommen' : 'Prüfen', bg: BRAND.dangerBg, color: BRAND.danger, border: BRAND.dangerBorder }
                        : status === 'checking'
                          ? { label: 'Prüfung', bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' }
                          : { label: 'Offen', bg: '#f3f4f6', color: BRAND.muted, border: BRAND.border };

                return (
                  <tr key={target.key} style={{ borderBottom: `1px solid ${BRAND.border}` }}>
                    <td style={{ padding: 14, verticalAlign: 'top' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: statusConfig.bg, color: statusConfig.color, border: `1px solid ${statusConfig.border}`, borderRadius: 999, padding: '5px 9px', fontSize: 12, fontWeight: 800 }}>
                        {status === 'checking' ? <Loader2 size={13} className="spin" /> : status === 'success' ? <CheckCircle2 size={13} /> : status === 'warning' || status === 'error' ? <AlertTriangle size={13} /> : null}
                        {statusConfig.label}
                      </span>
                    </td>
                    <td style={{ padding: 14, verticalAlign: 'top' }}>
                      <strong>{target.name}</strong>
                      {special ? <div style={{ color: BRAND.warning, fontSize: 12, marginTop: 4 }}>Separater CSV-Eintrag</div> : null}
                      {repayment ? <div style={{ color: BRAND.danger, fontSize: 12, marginTop: 4 }}>Keine Lohnposition</div> : null}
                    </td>
                    <td style={{ padding: 14, verticalAlign: 'top' }}>
                      {result?.employee ? (
                        <><strong>{result.employee.display_name}</strong><div style={{ color: BRAND.muted, fontSize: 12, marginTop: 3 }}>{result.employee.employee_number || result.employee.employee_id}</div></>
                      ) : <span style={{ color: BRAND.muted }}>–</span>}
                    </td>
                    <td style={{ padding: 14, verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                      {target.expectedHours != null ? <><strong>{hours(target.expectedHours)} h</strong><div style={{ color: BRAND.muted, fontSize: 12 }}>{result?.preview ? `${hours(summary.totalHours)} h` : 'Portal: –'}</div></> : <span style={{ color: BRAND.muted }}>keine CSV-Stunden</span>}
                    </td>
                    <td style={{ padding: 14, verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                      {target.expectedGross != null ? <><strong>{chf(target.expectedGross)}</strong><div style={{ color: BRAND.muted, fontSize: 12 }}>{result?.preview ? chf(summary.grossSalary) : 'Portal: –'}</div></> : '–'}
                    </td>
                    <td style={{ padding: 14, verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                      {target.expectedNet != null ? <><strong>{chf(target.expectedNet)}</strong><div style={{ color: BRAND.muted, fontSize: 12 }}>{result?.preview ? chf(summary.netSalary) : 'Portal: –'}</div></> : <span style={{ color: BRAND.muted }}>nicht in CSV</span>}
                    </td>
                    <td style={{ padding: 14, verticalAlign: 'top', maxWidth: 360 }}>
                      {result?.error ? <span style={{ color: BRAND.danger }}>{result.error}</span> : result?.differences?.length ? (
                        <div style={{ color: BRAND.warning }}>{result.differences.map((item) => <div key={item}>{item}</div>)}</div>
                      ) : result?.preview ? (
                        <span style={{ color: BRAND.success }}>CSV und Portal stimmen innerhalb der Toleranz überein.</span>
                      ) : (
                        <span style={{ color: BRAND.muted }}>{target.note || (target.expectedHourlyRate != null ? `CSV-Stundenlohn: ${chf(target.expectedHourlyRate)}/h` : 'Noch nicht abgeglichen.')}</span>
                      )}
                      {target.note && result?.preview ? <div style={{ color: BRAND.muted, fontSize: 12, marginTop: 5 }}>{target.note}</div> : null}
                      {result?.preview?.summary?.warnings?.length ? <div style={{ color: BRAND.warning, fontSize: 12, marginTop: 5 }}>{result.preview.summary.warnings.join(' · ')}</div> : null}
                    </td>
                    <td style={{ padding: 14, verticalAlign: 'top' }}>
                      {!repayment ? (
                        <button
                          type="button"
                          disabled={!canManagePayroll || status === 'checking'}
                          onClick={() => void downloadOne(target)}
                          style={{ border: `1px solid ${BRAND.border}`, borderRadius: 10, background: '#fff', padding: '8px 10px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                        >
                          <Download size={14} /> PDF
                        </button>
                      ) : <span style={{ color: BRAND.muted }}>–</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 14, color: BRAND.muted, fontSize: 13, lineHeight: 1.55 }}>
        Automatischer Batch-Download nimmt nur Positionen mit vollständiger Übereinstimmung. Abweichende Positionen bleiben einzeln downloadbar, damit sie vor einer definitiven Lohnabrechnung bewusst geprüft werden können.
      </div>
    </div>
  );
}

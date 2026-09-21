import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Banknote,
  Calculator,
  CheckCircle2,
  ChevronDown,
  Download,
  FileCheck2,
  Loader2,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';
import {
  buildPayrollHtml,
  downloadBase64Pdf,
  renderHtmlToPdfBase64,
} from '../lib/opc-document-html';

type JsonRow = Record<string, any>;

type Props = {
  employeeId: string;
  employee?: JsonRow;
  onSaved?: () => void | Promise<void>;
};

type SettingsPayload = {
  success: boolean;
  employee?: JsonRow;
  contracts?: JsonRow[];
  payrollProfiles?: JsonRow[];
  activeRuleSet?: JsonRow | null;
  currentPermit?: JsonRow | null;
  error?: string;
};

type PreviewPayload = {
  success: boolean;
  payroll?: JsonRow;
  filename?: string;
  summary?: JsonRow;
  error?: string;
};

type EntryRateRow = JsonRow & {
  draftHourlyRate?: string;
};

type EntryRatesPayload = {
  success: boolean;
  entries?: EntryRateRow[];
  error?: string;
};

type PayrollInputMode = 'time_entries' | 'manual';

type ManualBucketRow = {
  id?: string;
  hours: string;
  hourlyRateChf: string;
  cleaningCategory: 'maintenance' | 'special' | 'other';
  label: string;
  notes: string;
};

type ManualBucketsPayload = {
  success: boolean;
  mode?: PayrollInputMode;
  buckets?: JsonRow[];
  trackedMinutes?: number;
  trackedHours?: number;
  error?: string;
};

type SourceTaxAssessment = {
  kind: 'not_subject' | 'subject' | 'special_review' | 'unknown';
  title: string;
  detail: string;
  defaultSubject: boolean | null;
};

const money = new Intl.NumberFormat('de-CH', {
  style: 'currency',
  currency: 'CHF',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function todayIso() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function monthStartIso() {
  const today = todayIso();
  return `${today.slice(0, 7)}-01`;
}

function monthEndIso() {
  const start = new Date(`${monthStartIso()}T12:00:00Z`);
  start.setUTCMonth(start.getUTCMonth() + 1);
  start.setUTCDate(0);
  return start.toISOString().slice(0, 10);
}

function opcPayrollCycleBounds(reference = todayIso()) {
  const current = new Date(`${reference}T12:00:00Z`);
  const endMonthOffset = current.getUTCDate() > 23 ? 1 : 0;
  const end = new Date(Date.UTC(
    current.getUTCFullYear(),
    current.getUTCMonth() + endMonthOffset,
    23,
    12,
  ));
  const start = new Date(Date.UTC(
    end.getUTCFullYear(),
    end.getUTCMonth() - 1,
    24,
    12,
  ));
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  };
}

function calendarMonthBounds(value: string) {
  const month = String(value || monthStartIso()).slice(0, 7);
  const from = `${month}-01`;
  const end = new Date(`${from}T12:00:00Z`);
  end.setUTCMonth(end.getUTCMonth() + 1);
  end.setUTCDate(0);
  return { from, to: end.toISOString().slice(0, 10) };
}

function payrollMonthLabel(value: string) {
  const bounds = calendarMonthBounds(value);
  return new Intl.DateTimeFormat('de-CH', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${bounds.from}T12:00:00Z`));
}

function n(value: unknown) {
  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function text(value: unknown) {
  return String(value ?? '').trim();
}

function sourceTaxAssessment(permit?: JsonRow | null): SourceTaxAssessment {
  const permitType = text(permit?.permit_type).toLowerCase();

  if (permitType === 'swiss_citizen' || permitType === 'c' || permitType === 'not_required') {
    return {
      kind: 'not_subject',
      title: 'Quellensteuer voraussichtlich nicht erforderlich',
      detail: permitType === 'c'
        ? 'Ausweis C ist hinterlegt. Sonderfälle können weiterhin manuell abgebildet werden.'
        : 'Schweizer Bürger/in bzw. keine ausländerrechtliche Bewilligung erforderlich.',
      defaultSubject: false,
    };
  }

  if (['b', 'l', 's', 'other'].includes(permitType)) {
    return {
      kind: 'subject',
      title: 'Quellensteuer grundsätzlich prüfen / erfassen',
      detail: `Bewilligung ${permitType.toUpperCase()} ist hinterlegt. Das System schlägt Quellensteuerpflicht vor; Ausnahmen müssen dokumentiert werden.`,
      defaultSubject: true,
    };
  }

  if (permitType === 'g') {
    return {
      kind: 'special_review',
      title: 'Grenzgänger/in – Quellensteuer-Sonderprüfung erforderlich',
      detail: 'Bei Ausweis G muss der konkrete Grenzgänger-/DBA-Tarif manuell bestätigt werden.',
      defaultSubject: null,
    };
  }

  return {
    kind: 'unknown',
    title: 'Quellensteuerstatus noch nicht bestimmbar',
    detail: 'Bewilligung fehlt, ist ausstehend oder nicht eindeutig. Vor Abschluss des Lohnlaufs muss die Prüfung bestätigt werden.',
    defaultSubject: null,
  };
}

function manualBucketDraft(row?: JsonRow | null, fallbackRate = ''): ManualBucketRow {
  return {
    id: text(row?.id) || undefined,
    hours: row?.hours == null ? '' : String(row.hours),
    hourlyRateChf: row?.hourly_rate_chf == null
      ? (fallbackRate || '')
      : String(row.hourly_rate_chf),
    cleaningCategory: ['maintenance', 'special', 'other'].includes(text(row?.cleaning_category))
      ? text(row?.cleaning_category) as ManualBucketRow['cleaningCategory']
      : 'maintenance',
    label: text(row?.label),
    notes: text(row?.notes),
  };
}

function activeRow(rows: JsonRow[]) {
  const today = todayIso();
  return rows
    .filter((row) => text(row.status || 'active').toLowerCase() === 'active')
    .filter((row) => text(row.valid_from || '0000-01-01') <= today)
    .filter((row) => text(row.valid_until || '9999-12-31') >= today)
    .sort((a, b) => text(b.valid_from).localeCompare(text(a.valid_from)))[0] ||
    rows[0] ||
    null;
}


async function accessToken() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Keine aktive Sitzung gefunden.');
  return token;
}

async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await accessToken();
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Accept', 'application/json');
  if (init.body) headers.set('Content-Type', 'application/json');

  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || 'Anfrage fehlgeschlagen.');
  return payload as T;
}

function emptyContract(employee?: JsonRow): JsonRow {
  return {
    salary_type: 'hourly',
    status: 'active',
    valid_from: employee?.entry_date || monthStartIso(),
    valid_until: '',
    hourly_rate_chf: '',
    monthly_salary_chf: '',
    weekly_hours: '',
    employment_percentage: '',
    holiday_pay_percentage: '0',
    public_holiday_percentage: '0',
    thirteenth_salary_percentage: '0',
    monthly_salary_includes_13th: false,
    rate_composition: 'base_excluding_supplements',
    is_gav_applicable: true,
    ordinary_work_canton_code: '',
    workload_model: 'variable_hours',
    fixed_salary_covers_variable_hours: false,
  };
}

function contractDraft(row: JsonRow | null, employee?: JsonRow) {
  if (!row) return emptyContract(employee);
  return {
    ...emptyContract(employee),
    ...row,
    hourly_rate_chf: row.hourly_rate_chf ?? '',
    monthly_salary_chf: row.monthly_salary_chf ?? '',
    weekly_hours: row.weekly_hours ?? '',
    employment_percentage: row.employment_percentage ?? '',
    holiday_pay_percentage: row.holiday_pay_percentage ?? 0,
    public_holiday_percentage: row.public_holiday_percentage ?? 0,
    thirteenth_salary_percentage: row.thirteenth_salary_percentage ?? 0,
    valid_until: row.valid_until || '',
  };
}

function emptyProfile(employee?: JsonRow): JsonRow {
  return {
    status: 'active',
    valid_from: employee?.entry_date || monthStartIso(),
    valid_until: '',
    source_tax_subject: false,
    source_tax_canton: '',
    source_tax_tariff_code: '',
    source_tax_rate: '0',
    source_tax_fixed_amount_chf: '0',
    church_tax: false,
    nbu_employee_rate: '0',
    nbu_employer_rate: '0',
    ktg_employee_rate: '0',
    ktg_employer_rate: '0',
    gav_employee_rate: '0',
    gav_employer_rate: '0',
    bvg_employee_amount_chf: '0',
    bvg_employer_amount_chf: '0',
    family_allowance_chf: '0',
    expense_reimbursement_chf: '0',
    advance_deduction_chf: '0',
    other_employee_deduction_chf: '0',
    other_employer_cost_chf: '0',
    other_adjustment_chf: '0',
    monthly_salary_proration_method: 'working_days',
    pay_thirteenth_monthly: false,
    notes: '',
  };
}

function profileDraft(row: JsonRow | null, employee?: JsonRow, _permit?: JsonRow | null) {
  const draft = row
    ? { ...emptyProfile(employee), ...row, valid_until: row.valid_until || '' }
    : emptyProfile(employee);

  // Do not silently mutate the saved Quellensteuer status while loading the UI.
  // The recommendation card must remain a recommendation until the owner
  // explicitly clicks "Empfehlung übernehmen". This makes the action visible,
  // auditable and prevents a no-op button when a B/L/S permit is present.
  return { ...draft, metadata: { ...(draft.metadata || {}) } };
}

function Input({ label, children }: { label: string; children: ReactNode }) {
  return <label className="opc-payroll-field"><span>{label}</span>{children}</label>;
}

function Value({ label, value }: { label: string; value: ReactNode }) {
  return <div className="opc-payroll-value"><span>{label}</span><strong>{value}</strong></div>;
}

function PayrollCollapsiblePanel({
  icon,
  title,
  subtitle,
  children,
  defaultOpen = false,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      className={`opc-payroll-panel opc-payroll-collapsible ${open ? 'open' : 'closed'}`}
      data-opc-payroll-collapse="OPC_PAYROLL_COLLAPSIBLE_WORKFLOW_20260905"
    >
      <button
        type="button"
        className="opc-payroll-collapsible-head"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <div className="opc-payroll-collapsible-copy">
          {icon}
          <div><strong>{title}</strong><span>{subtitle}</span></div>
        </div>
        <ChevronDown size={17} />
      </button>
      {open ? <div className="opc-payroll-collapsible-body">{children}</div> : null}
    </div>
  );
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function accrualPdfAppendix(payrollDocument: JsonRow) {
  const items = Array.isArray(payrollDocument?.payroll?.accruals)
    ? payrollDocument.payroll.accruals.filter((item: JsonRow) => item?.status === 'accrued' && item?.code === 'VACATION_PAY_ACCRUAL')
    : [];
  if (!items.length) return '';

  const rows = items.map((item: JsonRow) => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;font-weight:700;">${escapeHtml(item.label || item.code || 'Lohnguthaben')}</td>
      <td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;text-align:right;">${escapeHtml(item.basis || '')}</td>
      <td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;text-align:right;">${escapeHtml(item.rate || '')}</td>
      <td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;text-align:right;">CHF ${n(item.openingBalance).toFixed(2)}</td>
      <td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;text-align:right;">CHF ${n(item.periodAccrual ?? item.amount).toFixed(2)}</td>
      <td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;text-align:right;">CHF ${n(item.periodPayout).toFixed(2)}</td>
      <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:800;">CHF ${n(item.closingBalance).toFixed(2)}</td>
    </tr>
  `).join('');

  return `
    <section class="page opc-payroll-accrual-page" style="page-break-before:always;box-sizing:border-box;width:210mm;min-height:297mm;padding:22mm 18mm 24mm;font-family:Arial,Helvetica,sans-serif;color:#111827;background:#fff;">
      <div style="font-size:11px;font-weight:800;letter-spacing:.04em;color:#6b7280;margin-bottom:8px;">ORANGE PRO CLEAN GMBH · LOHNABRECHNUNG</div>
      <h2 style="font-size:20px;margin:0 0 8px;">Ferien- und Lohnguthaben</h2>
      <p style="font-size:11px;line-height:1.5;color:#4b5563;margin:0 0 18px;">
        Diese Guthaben werden separat geführt und sind nicht Bestandteil der aktuellen Auszahlung, solange keine Auszahlung des Guthabens gebucht wurde.
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:10px;">
        <thead>
          <tr>
            <th style="text-align:left;padding:7px 0;border-bottom:2px solid #111827;">Guthabenart</th>
            <th style="text-align:right;padding:7px 6px;border-bottom:2px solid #111827;">Basis</th>
            <th style="text-align:right;padding:7px 6px;border-bottom:2px solid #111827;">Satz</th>
            <th style="text-align:right;padding:7px 6px;border-bottom:2px solid #111827;">Vortrag</th>
            <th style="text-align:right;padding:7px 6px;border-bottom:2px solid #111827;">Zugang</th>
            <th style="text-align:right;padding:7px 6px;border-bottom:2px solid #111827;">Auszahlung</th>
            <th style="text-align:right;padding:7px 0;border-bottom:2px solid #111827;">Neuer Saldo</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
  `;
}

function appendAccrualPdfAppendix(html: string, payrollDocument: JsonRow) {
  const appendix = accrualPdfAppendix(payrollDocument);
  if (!appendix) return html;
  return html.includes('</body>')
    ? html.replace('</body>', `${appendix}</body>`)
    : `${html}${appendix}`;
}

export default function PayrollOwnerPanel({ employeeId, employee: employeeProp, onSaved }: Props) {
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [contract, setContract] = useState<JsonRow>(() => emptyContract(employeeProp));
  const [profile, setProfile] = useState<JsonRow>(() => emptyProfile(employeeProp));
  const [periodFrom, setPeriodFrom] = useState(() => opcPayrollCycleBounds().from);
  const [periodTo, setPeriodTo] = useState(() => opcPayrollCycleBounds().to);
  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingContract, setSavingContract] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [entryRates, setEntryRates] = useState<EntryRateRow[]>([]);
  const [entryRatesLoaded, setEntryRatesLoaded] = useState(false);
  const [loadingEntryRates, setLoadingEntryRates] = useState(false);
  const [savingEntryRates, setSavingEntryRates] = useState(false);
  const [payrollInputMode, setPayrollInputMode] = useState<PayrollInputMode>('time_entries');
  const [manualBuckets, setManualBuckets] = useState<ManualBucketRow[]>([]);
  const [manualReason, setManualReason] = useState('');
  const [trackedHours, setTrackedHours] = useState(0);
  const [loadingManualBuckets, setLoadingManualBuckets] = useState(false);
  const [savingManualBuckets, setSavingManualBuckets] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const employee = settings?.employee || employeeProp || {};
  const activeRuleSet = settings?.activeRuleSet || null;
  const currentPermit = settings?.currentPermit || null;
  const taxAssessment = useMemo(() => sourceTaxAssessment(currentPermit), [currentPermit]);
  const profileMetadata = (profile.metadata || {}) as JsonRow;
  const taxReviewConfirmed = profileMetadata.source_tax_review_confirmed === true;
  const taxRecommendationApplied = taxAssessment.defaultSubject != null
    && profile.source_tax_subject === (taxAssessment.defaultSubject === true)
    && text(profileMetadata.source_tax_auto_basis) === (text(currentPermit?.permit_type) || 'unknown');


  async function load() {
    setLoading(true);
    setError('');
    try {
      const payload = await requestJson<SettingsPayload>(`/api/opc/employees/${employeeId}/payroll-settings`);
      setSettings(payload);
      setContract(contractDraft(activeRow(payload.contracts || []), payload.employee || employeeProp));
      setProfile(profileDraft(activeRow(payload.payrollProfiles || []), payload.employee || employeeProp, payload.currentPermit));
    } catch (reason: any) {
      setError(reason?.message || 'Payroll-Daten konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [employeeId]);

  const salaryType = text(contract.salary_type || 'hourly');

  useEffect(() => {
    if (salaryType !== 'monthly') return;

    const contractStart = text(contract.valid_from);
    let anchor = periodFrom || contractStart || monthStartIso();
    let bounds = calendarMonthBounds(anchor);

    if (contractStart && bounds.to < contractStart) {
      anchor = contractStart;
      bounds = calendarMonthBounds(anchor);
    }

    if (periodFrom !== bounds.from) setPeriodFrom(bounds.from);
    if (periodTo !== bounds.to) setPeriodTo(bounds.to);
    setPreview(null);
    setEntryRates([]);
    setEntryRatesLoaded(false);
    setManualBuckets([]);
    setPayrollInputMode('time_entries');
  }, [salaryType, employeeId, contract.valid_from]);

  const ruleText = useMemo(() => {
    if (!activeRuleSet) return 'Kein aktiver Regelsatz';
    return `Regelsatz ${activeRuleSet.rule_year}: AHV ${activeRuleSet.ahv_employee_rate}% / ALV ${activeRuleSet.alv_employee_rate}%`;
  }, [activeRuleSet]);

  function setContractField(key: string, value: unknown) {
    setContract((current) => ({ ...current, [key]: value }));
    setPreview(null);
  }

  function setProfileField(key: string, value: unknown) {
    setProfile((current) => ({ ...current, [key]: value }));
    setPreview(null);
  }

  function setProfileMetadataField(key: string, value: unknown) {
    setProfile((current) => ({
      ...current,
      metadata: {
        ...(current.metadata || {}),
        [key]: value,
      },
    }));
    setPreview(null);
  }

  async function applySourceTaxRecommendation() {
    if (taxAssessment.defaultSubject == null || savingProfile) return;

    const recommendationSubject = taxAssessment.defaultSubject === true;
    const nextProfile = {
      ...profile,
      source_tax_subject: recommendationSubject,
      metadata: {
        ...(profile.metadata || {}),
        source_tax_review_confirmed: false,
        source_tax_auto_basis: text(currentPermit?.permit_type) || 'unknown',
        source_tax_auto_applied_at: new Date().toISOString(),
      },
    };

    // Update immediately so the checkbox visibly changes on click.
    setProfile(nextProfile);
    setPreview(null);
    setError('');
    setMessage('');
    setSavingProfile(true);

    try {
      const payload = await requestJson<SettingsPayload>(`/api/opc/employees/${employeeId}/payroll-settings`, {
        method: 'PUT',
        body: JSON.stringify({ action: 'save_profile', profile: nextProfile }),
      });
      setSettings(payload);
      setProfile(profileDraft(activeRow(payload.payrollProfiles || []), payload.employee || employee, payload.currentPermit));
      setMessage(
        recommendationSubject
          ? 'Quellensteuer-Empfehlung übernommen und gespeichert. Kanton, Tarifcode und Satz/Fixbetrag prüfen und den Prüfstatus anschliessend bestätigen.'
          : 'Quellensteuer-Empfehlung übernommen und gespeichert. Sonderfälle können weiterhin manuell dokumentiert werden.',
      );
      await onSaved?.();
    } catch (reason: any) {
      // Reloading restores the persisted value if saving fails.
      setError(reason?.message || 'Quellensteuer-Empfehlung konnte nicht gespeichert werden.');
      await load();
    } finally {
      setSavingProfile(false);
    }
  }

  async function saveContract() {
    setSavingContract(true);
    setError('');
    setMessage('');
    try {
      const payload = await requestJson<SettingsPayload>(`/api/opc/employees/${employeeId}/payroll-settings`, {
        method: 'PUT',
        body: JSON.stringify({ action: 'save_contract', contract }),
      });
      setSettings(payload);
      setContract(contractDraft(activeRow(payload.contracts || []), payload.employee || employee));
      setMessage('Arbeitsvertrag wurde gespeichert.');
      await onSaved?.();
    } catch (reason: any) {
      setError(reason?.message || 'Arbeitsvertrag konnte nicht gespeichert werden.');
    } finally {
      setSavingContract(false);
    }
  }

  async function saveProfile() {
    setSavingProfile(true);
    setError('');
    setMessage('');
    try {
      const payload = await requestJson<SettingsPayload>(`/api/opc/employees/${employeeId}/payroll-settings`, {
        method: 'PUT',
        body: JSON.stringify({ action: 'save_profile', profile }),
      });
      setSettings(payload);
      setProfile(profileDraft(activeRow(payload.payrollProfiles || []), payload.employee || employee, payload.currentPermit));
      setMessage('Abgaben- und Auszahlungsprofil wurde gespeichert.');
      await onSaved?.();
    } catch (reason: any) {
      setError(reason?.message || 'Payroll-Profil konnte nicht gespeichert werden.');
    } finally {
      setSavingProfile(false);
    }
  }

  async function loadManualBuckets() {
    if (salaryType !== 'hourly' || !periodFrom || !periodTo || periodFrom > periodTo) return;
    setLoadingManualBuckets(true);
    try {
      const query = new URLSearchParams({ from: periodFrom, to: periodTo });
      const payload = await requestJson<ManualBucketsPayload>(
        `/api/opc/employees/${employeeId}/payroll-manual-buckets?${query.toString()}`,
      );
      const rows = (payload.buckets || []).map((row) =>
        manualBucketDraft(row, String(contract.hourly_rate_chf || '')),
      );
      setManualBuckets(rows);
      setPayrollInputMode(payload.mode === 'manual' ? 'manual' : 'time_entries');
      setTrackedHours(n(payload.trackedHours));
    } catch (reason: any) {
      setError(reason?.message || 'Manuelle Stundenbasis konnte nicht geladen werden.');
    } finally {
      setLoadingManualBuckets(false);
    }
  }

  useEffect(() => {
    if (salaryType !== 'hourly' || !periodFrom || !periodTo || periodFrom > periodTo) return;
    void loadManualBuckets();
  }, [employeeId, salaryType, periodFrom, periodTo]);

  function setManualBucket(index: number, key: keyof ManualBucketRow, value: string) {
    setManualBuckets((rows) => rows.map((row, rowIndex) =>
      rowIndex === index ? { ...row, [key]: value } : row,
    ));
    setPreview(null);
  }

  function addManualBucket() {
    setManualBuckets((rows) => [
      ...rows,
      manualBucketDraft(null, String(contract.hourly_rate_chf || '')),
    ]);
    setPayrollInputMode('manual');
    setPreview(null);
  }

  function removeManualBucket(index: number) {
    setManualBuckets((rows) => rows.filter((_, rowIndex) => rowIndex !== index));
    setPreview(null);
  }

  async function persistManualBuckets(showMessage = true) {
    if (payrollInputMode !== 'manual') return true;
    if (!manualBuckets.length) {
      setError('Im manuellen Modus muss mindestens ein Stundenansatz erfasst werden.');
      return false;
    }

    const invalid = manualBuckets.find((row) =>
      n(row.hours) <= 0 || n(row.hourlyRateChf) <= 0,
    );
    if (invalid) {
      setError('Jede manuelle Lohnzeile benötigt positive Stunden und einen positiven Stundenansatz.');
      return false;
    }

    setSavingManualBuckets(true);
    setError('');
    try {
      const payload = await requestJson<ManualBucketsPayload>(
        `/api/opc/employees/${employeeId}/payroll-manual-buckets`,
        {
          method: 'PUT',
          body: JSON.stringify({
            mode: 'manual',
            periodFrom,
            periodTo,
            reason: manualReason || null,
            buckets: manualBuckets.map((row, index) => ({
              id: row.id || null,
              hours: n(row.hours),
              hourlyRateChf: n(row.hourlyRateChf),
              cleaningCategory: row.cleaningCategory,
              label: row.label || null,
              notes: row.notes || null,
              sortOrder: (index + 1) * 10,
            })),
          }),
        },
      );
      setManualBuckets((payload.buckets || []).map((row) =>
        manualBucketDraft(row, String(contract.hourly_rate_chf || '')),
      ));
      setTrackedHours(n(payload.trackedHours));
      if (showMessage) setMessage('Manuelle Stundenbasis wurde gespeichert.');
      return true;
    } catch (reason: any) {
      setError(reason?.message || 'Manuelle Stundenbasis konnte nicht gespeichert werden.');
      return false;
    } finally {
      setSavingManualBuckets(false);
    }
  }

  async function switchToTimeEntries() {
    setSavingManualBuckets(true);
    setError('');
    try {
      const payload = await requestJson<ManualBucketsPayload>(
        `/api/opc/employees/${employeeId}/payroll-manual-buckets`,
        {
          method: 'PUT',
          body: JSON.stringify({
            mode: 'time_entries',
            periodFrom,
            periodTo,
          }),
        },
      );
      setPayrollInputMode('time_entries');
      setManualBuckets([]);
      setTrackedHours(n(payload.trackedHours));
      setPreview(null);
      setMessage('Lohnlauf verwendet wieder die genehmigte Zeiterfassung.');
    } catch (reason: any) {
      setError(reason?.message || 'Zeiterfassungsmodus konnte nicht aktiviert werden.');
    } finally {
      setSavingManualBuckets(false);
    }
  }

  async function loadEntryRates() {
    if (!periodFrom || !periodTo || periodFrom > periodTo) {
      setError('Bitte einen gültigen Abrechnungszeitraum wählen.');
      return;
    }
    setLoadingEntryRates(true);
    setError('');
    try {
      const query = new URLSearchParams({ from: periodFrom, to: periodTo });
      const payload = await requestJson<EntryRatesPayload>(
        `/api/opc/employees/${employeeId}/payroll-entry-rates?${query.toString()}`,
      );
      setEntryRates((payload.entries || []).map((entry) => ({
        ...entry,
        draftHourlyRate: entry.pay_rate?.hourly_rate_chf == null
          ? ''
          : String(entry.pay_rate.hourly_rate_chf),
      })));
      setEntryRatesLoaded(true);
    } catch (reason: any) {
      setError(reason?.message || 'Individuelle Stundenansätze konnten nicht geladen werden.');
    } finally {
      setLoadingEntryRates(false);
    }
  }

  function setEntryRate(timeEntryId: string, value: string) {
    setEntryRates((rows) => rows.map((row) =>
      String(row.id) === timeEntryId ? { ...row, draftHourlyRate: value } : row,
    ));
    setPreview(null);
  }

  async function saveEntryRates() {
    setSavingEntryRates(true);
    setError('');
    setMessage('');
    try {
      const payload = await requestJson<{ success: boolean; saved: number; deleted: number }>(
        `/api/opc/employees/${employeeId}/payroll-entry-rates`,
        {
          method: 'PUT',
          body: JSON.stringify({
            rates: entryRates.map((row) => ({
              timeEntryId: row.id,
              hourlyRateChf: row.draftHourlyRate || null,
              contractId: row.pay_rate?.contract_id || contract.id || null,
              rateSource: 'manual',
              notes: row.pay_rate?.notes || null,
            })),
          }),
        },
      );
      setMessage(`${payload.saved} individuelle Ansätze gespeichert, ${payload.deleted} entfernt.`);
      await loadEntryRates();
    } catch (reason: any) {
      setError(reason?.message || 'Individuelle Stundenansätze konnten nicht gespeichert werden.');
    } finally {
      setSavingEntryRates(false);
    }
  }

  function changePeriod(field: 'from' | 'to', value: string) {
    if (field === 'from') setPeriodFrom(value);
    else setPeriodTo(value);
    setPreview(null);
    setEntryRates([]);
    setEntryRatesLoaded(false);
  }

  function changePayrollMonth(value: string) {
    const bounds = calendarMonthBounds(`${value}-01`);
    setPeriodFrom(bounds.from);
    setPeriodTo(bounds.to);
    setPreview(null);
    setEntryRates([]);
    setEntryRatesLoaded(false);
  }

  async function calculate(download = false, zeroPayroll = false) {
    if (!periodFrom || !periodTo || periodFrom > periodTo) {
      setError('Bitte einen gültigen Abrechnungszeitraum wählen.');
      return null;
    }
    if (!zeroPayroll && salaryType === 'hourly' && payrollInputMode === 'manual') {
      const saved = await persistManualBuckets(false);
      if (!saved) return null;
    }
    setCalculating(true);
    setError('');
    setMessage('');
    try {
      const query = new URLSearchParams({ from: periodFrom, to: periodTo });
      const endpoint = zeroPayroll ? 'payroll-preview-zero' : 'payroll-preview';
      const payload = await requestJson<PreviewPayload>(
        `/api/opc/employees/${employeeId}/${endpoint}?${query.toString()}`,
      );
      setPreview(payload);
      if (download && payload.payroll) {
        const filename = payload.filename || `Lohnabrechnung_${employee.employee_number || employeeId}_${periodFrom}_${periodTo}.pdf`;
        const baseHtml = buildPayrollHtml(payload.payroll as any);
        const html = appendAccrualPdfAppendix(baseHtml, payload.payroll as JsonRow);
        const rendered = await renderHtmlToPdfBase64(html, filename);
        downloadBase64Pdf(rendered.base64, rendered.filename || filename);
        setMessage(zeroPayroll ? 'Nullsummen-Lohnabrechnung wurde erstellt und heruntergeladen.' : 'Lohnabrechnung wurde berechnet und heruntergeladen.');
      } else {
        setMessage(zeroPayroll ? 'Nullsummen-Lohnabrechnung wurde berechnet.' : 'Lohnabrechnung wurde berechnet.');
      }
      return payload;
    } catch (reason: any) {
      setError(reason?.message || 'Lohnabrechnung konnte nicht berechnet werden.');
      return null;
    } finally {
      setCalculating(false);
    }
  }

  async function finalize() {
    if (salaryType === 'hourly' && payrollInputMode === 'manual') {
      const saved = await persistManualBuckets(false);
      if (!saved) return;
    }
    setFinalizing(true);
    setError('');
    setMessage('');
    try {
      const payload = await requestJson<PreviewPayload & { run?: JsonRow }>(`/api/opc/payroll-runs/finalize`, {
        method: 'POST',
        body: JSON.stringify({ employeeId, periodFrom, periodTo }),
      });
      setPreview(payload);
      setMessage(`Lohnlauf ${payload.run?.run_number || ''} wurde abgeschlossen und unveränderbar gespeichert.`.trim());
    } catch (reason: any) {
      setError(reason?.message || 'Lohnlauf konnte nicht abgeschlossen werden.');
    } finally {
      setFinalizing(false);
    }
  }

  if (loading) {
    return <div className="opc-payroll-loading"><Loader2 size={16} className="spin" /> Payroll wird geladen.</div>;
  }

  return (
    <div className="opc-payroll-phase1">
      <div className="opc-payroll-banner">
        <ShieldCheck size={18} />
        <div><strong>Payroll · Owner</strong><span>{ruleText}</span></div>
      </div>
      {error ? <div className="opc-payroll-alert error">{error}</div> : null}
      {message ? <div className="opc-payroll-alert success"><CheckCircle2 size={15} />{message}</div> : null}

      <PayrollCollapsiblePanel
        icon={<Banknote size={17} />}
        title="Arbeitsvertrag und Lohnart"
        subtitle="Vertragliche Werte werden zeitlich versioniert gespeichert."
      >
        <div className="opc-payroll-grid four">
          <Input label="Lohnart"><select value={salaryType} onChange={(e) => setContractField('salary_type', e.target.value)}><option value="hourly">Stundenlohn</option><option value="monthly">Fix-/Monatslohn</option></select></Input>
          <Input label="Gültig ab"><input type="date" value={contract.valid_from || ''} onChange={(e) => setContractField('valid_from', e.target.value)} /></Input>
          <Input label="Gültig bis"><input type="date" value={contract.valid_until || ''} onChange={(e) => setContractField('valid_until', e.target.value)} /></Input>
          <Input label="Beschäftigungsgrad %"><input type="number" min="0" max="100" step="0.01" value={contract.employment_percentage ?? ''} onChange={(e) => setContractField('employment_percentage', e.target.value)} /></Input>
          {salaryType === 'hourly' ? (
            <Input label="Stundenlohn CHF"><input type="number" min="0" step="0.05" value={contract.hourly_rate_chf ?? ''} onChange={(e) => setContractField('hourly_rate_chf', e.target.value)} /></Input>
          ) : (
            <Input label="Monatslohn CHF"><input type="number" min="0" step="0.05" value={contract.monthly_salary_chf ?? ''} onChange={(e) => setContractField('monthly_salary_chf', e.target.value)} /></Input>
          )}
          <Input label="Wochenstunden"><input type="number" min="0" step="0.01" value={contract.weekly_hours ?? ''} onChange={(e) => setContractField('weekly_hours', e.target.value)} /></Input>
          <Input label="Ferienentschädigung %"><input type="number" min="0" step="0.01" value={contract.holiday_pay_percentage ?? ''} onChange={(e) => setContractField('holiday_pay_percentage', e.target.value)} /></Input>
          <Input label="Feiertagszuschlag %"><input type="number" min="0" step="0.01" value={contract.public_holiday_percentage ?? ''} onChange={(e) => setContractField('public_holiday_percentage', e.target.value)} /></Input>
          <Input label="13. Monatslohn %"><input type="number" min="0" step="0.01" value={contract.thirteenth_salary_percentage ?? ''} onChange={(e) => setContractField('thirteenth_salary_percentage', e.target.value)} /></Input>
          <Input label="Arbeitskanton"><input maxLength={2} value={contract.ordinary_work_canton_code || ''} onChange={(e) => setContractField('ordinary_work_canton_code', e.target.value.toUpperCase())} /></Input>
          <Input label="Lohnzusammensetzung"><select value={contract.rate_composition || 'base_excluding_supplements'} onChange={(e) => setContractField('rate_composition', e.target.value)}><option value="base_excluding_supplements">Grundlohn plus Zuschläge</option><option value="all_inclusive">Ansatz inklusive Zuschläge</option></select></Input>
          <Input label="GAV anwendbar"><select value={contract.is_gav_applicable === false ? 'no' : 'yes'} onChange={(e) => setContractField('is_gav_applicable', e.target.value === 'yes')}><option value="yes">Ja</option><option value="no">Nein</option></select></Input>
        </div>
        <div className="opc-payroll-checks">
          <label><input type="checkbox" checked={contract.monthly_salary_includes_13th === true} onChange={(e) => setContractField('monthly_salary_includes_13th', e.target.checked)} /> Monatslohn enthält 13. Monatslohn</label>
          <label><input type="checkbox" checked={contract.fixed_salary_covers_variable_hours === true} onChange={(e) => setContractField('fixed_salary_covers_variable_hours', e.target.checked)} /> Fixlohn deckt variable Stunden</label>
        </div>
        <button className="opc-payroll-button primary" type="button" disabled={savingContract} onClick={() => void saveContract()}>{savingContract ? <Loader2 size={15} className="spin" /> : <Save size={15} />} Vertrag speichern</button>
      </PayrollCollapsiblePanel>

      {salaryType === 'hourly' ? (
        <PayrollCollapsiblePanel
          icon={<Calculator size={17} />}
          title="Stundenbasis für diesen Lohnlauf"
          subtitle="Zeiterfassung oder manuelle Stunden × Stundenansatz; Original-Zeiteinträge bleiben unverändert."
        >

          <div className="opc-payroll-mode-switch">
            <button
              type="button"
              className={`opc-payroll-mode-button ${payrollInputMode === 'time_entries' ? 'active' : ''}`}
              disabled={savingManualBuckets}
              onClick={() => void switchToTimeEntries()}
            >
              Aus Zeiterfassung übernehmen
            </button>
            <button
              type="button"
              className={`opc-payroll-mode-button ${payrollInputMode === 'manual' ? 'active' : ''}`}
              disabled={loadingManualBuckets}
              onClick={() => {
                setPayrollInputMode('manual');
                if (!manualBuckets.length) addManualBucket();
                setPreview(null);
              }}
            >
              Manuell erfassen / Lohnabgleich
            </button>
          </div>

          {payrollInputMode === 'manual' ? (
            <>
              <div className="opc-payroll-manual-summary">
                <Value label="Zeiterfassung im Zeitraum" value={`${trackedHours.toFixed(2)} h`} />
                <Value
                  label="Manuell erfasste Stunden"
                  value={`${manualBuckets.reduce((sum, row) => sum + n(row.hours), 0).toFixed(2)} h`}
                />
                <Value
                  label="Differenz"
                  value={`${(manualBuckets.reduce((sum, row) => sum + n(row.hours), 0) - trackedHours).toFixed(2)} h`}
                />
                <Value
                  label="Manueller Grundlohn"
                  value={money.format(manualBuckets.reduce((sum, row) => sum + n(row.hours) * n(row.hourlyRateChf), 0))}
                />
              </div>

              <div className="opc-payroll-manual-table-wrap">
                <table className="opc-payroll-manual-table">
                  <thead>
                    <tr>
                      <th>Stunden</th>
                      <th>Stundenansatz CHF</th>
                      <th>Kategorie</th>
                      <th>Bezeichnung / Hinweis</th>
                      <th>Betrag</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {manualBuckets.map((row, index) => (
                      <tr key={row.id || `manual-${index}`}>
                        <td><input type="number" min="0" step="0.01" value={row.hours} onChange={(e) => setManualBucket(index, 'hours', e.target.value)} /></td>
                        <td><input type="number" min="0" step="0.05" value={row.hourlyRateChf} onChange={(e) => setManualBucket(index, 'hourlyRateChf', e.target.value)} /></td>
                        <td>
                          <select value={row.cleaningCategory} onChange={(e) => setManualBucket(index, 'cleaningCategory', e.target.value)}>
                            <option value="maintenance">Unterhaltsreinigung</option>
                            <option value="special">Spezial-/Bau-/Umzugsreinigung</option>
                            <option value="other">Andere / manuell prüfen</option>
                          </select>
                        </td>
                        <td><input value={row.label} placeholder="z. B. Excel-Abgleich / Sonderansatz" onChange={(e) => setManualBucket(index, 'label', e.target.value)} /></td>
                        <td><strong>{money.format(n(row.hours) * n(row.hourlyRateChf))}</strong></td>
                        <td>
                          <button className="opc-payroll-icon-button" type="button" title="Zeile entfernen" onClick={() => removeManualBucket(index)}>
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="opc-payroll-manual-actions">
                <button className="opc-payroll-button" type="button" onClick={addManualBucket}><Plus size={15} /> Stundensatz hinzufügen</button>
                <button className="opc-payroll-button primary" type="button" disabled={savingManualBuckets} onClick={() => void persistManualBuckets(true)}>
                  {savingManualBuckets ? <Loader2 size={15} className="spin" /> : <Save size={15} />} Manuelle Stunden speichern
                </button>
              </div>

              <Input label="Abweichungs-/Abgleichgrund (optional)">
                <input
                  value={manualReason}
                  placeholder="z. B. Monatsabschluss gemäss geprüfter Stundenliste"
                  onChange={(e) => setManualReason(e.target.value)}
                />
              </Input>

              <div className={`opc-payroll-reconciliation ${Math.abs(manualBuckets.reduce((sum, row) => sum + n(row.hours), 0) - trackedHours) <= 0.01 ? 'ok' : 'error'}`}>
                <strong>Stundenabgleich</strong>
                <span>
                  Zeiterfassung {trackedHours.toFixed(2)} h · Manuell {manualBuckets.reduce((sum, row) => sum + n(row.hours), 0).toFixed(2)} h ·
                  Differenz {(manualBuckets.reduce((sum, row) => sum + n(row.hours), 0) - trackedHours).toFixed(2)} h.
                </span>
                {Math.abs(manualBuckets.reduce((sum, row) => sum + n(row.hours), 0) - trackedHours) > 0.01
                  ? <span>Eine Abweichung ist zulässig, bleibt aber im Lohnlauf-Snapshot und sollte begründet werden.</span>
                  : <span>Manuelle Stunden stimmen mit der Zeiterfassung überein.</span>}
              </div>
            </>
          ) : (
            <>
              <div className="opc-payroll-rate-actions">
                <button className="opc-payroll-button" type="button" disabled={loadingEntryRates} onClick={() => void loadEntryRates()}>{loadingEntryRates ? <Loader2 size={15} className="spin" /> : <Calculator size={15} />} Zeiteinträge laden</button>
                {entryRatesLoaded ? <button className="opc-payroll-button primary" type="button" disabled={savingEntryRates} onClick={() => void saveEntryRates()}>{savingEntryRates ? <Loader2 size={15} className="spin" /> : <Save size={15} />} Ansätze speichern</button> : null}
              </div>
              {entryRatesLoaded ? (
                entryRates.length ? (
                  <div className="opc-payroll-rate-table-wrap">
                    <table className="opc-payroll-rate-table">
                      <thead><tr><th>Datum</th><th>Objekt / Leistung</th><th>Stunden</th><th>Abweichender Satz CHF</th></tr></thead>
                      <tbody>{entryRates.map((row) => {
                        const metadata = row.metadata || {};
                        const objectName = metadata.object_name || metadata.service_type || 'Ohne Objektangabe';
                        return <tr key={row.id}><td>{row.work_date}</td><td><strong>{objectName}</strong>{metadata.service_type && metadata.service_type !== objectName ? <span>{metadata.service_type}</span> : null}</td><td>{(n(row.total_minutes) / 60).toFixed(2)}</td><td><input type="number" min="0" step="0.05" placeholder={contract.hourly_rate_chf ? `Vertrag ${money.format(n(contract.hourly_rate_chf))}` : 'Vertragslohn'} value={row.draftHourlyRate || ''} onChange={(event) => setEntryRate(String(row.id), event.target.value)} /></td></tr>;
                      })}</tbody>
                    </table>
                  </div>
                ) : <div className="opc-payroll-empty">Im gewählten Zeitraum bestehen keine genehmigten Zeiteinträge.</div>
              ) : <div className="opc-payroll-empty">Zeiteinträge laden, um gemischte Tarife pro Einsatz zu erfassen.</div>}
            </>
          )}
        </PayrollCollapsiblePanel>
      ) : null}

      <PayrollCollapsiblePanel
        icon={<Calculator size={17} />}
        title="Sozialabgaben und Auszahlung"
        subtitle="Arbeitnehmer- und Arbeitgeberanteile sowie Quellensteuer und weitere Abzüge."
      >

        <div className="opc-payroll-grid four">
          <Input label="Gültig ab"><input type="date" value={profile.valid_from || ''} onChange={(e) => setProfileField('valid_from', e.target.value)} /></Input>
          <Input label="Gültig bis"><input type="date" value={profile.valid_until || ''} onChange={(e) => setProfileField('valid_until', e.target.value)} /></Input>
          <Input label="AHV/IV/EO Arbeitnehmer %">
            <input
              type="number"
              readOnly
              aria-readonly="true"
              value={activeRuleSet?.ahv_employee_rate ?? ''}
              title={`Globaler Payroll-Regelsatz ${activeRuleSet?.rule_year || ''}`}
            />
          </Input>
          <Input label="AHV/IV/EO Arbeitgeber %">
            <input
              type="number"
              readOnly
              aria-readonly="true"
              value={activeRuleSet?.ahv_employer_rate ?? ''}
              title={`Globaler Payroll-Regelsatz ${activeRuleSet?.rule_year || ''}`}
            />
          </Input>
          <Input label="ALV Arbeitnehmer %">
            <input
              type="number"
              readOnly
              aria-readonly="true"
              value={activeRuleSet?.alv_employee_rate ?? ''}
              title={`Globaler Payroll-Regelsatz ${activeRuleSet?.rule_year || ''}`}
            />
          </Input>
          <Input label="ALV Arbeitgeber %">
            <input
              type="number"
              readOnly
              aria-readonly="true"
              value={activeRuleSet?.alv_employer_rate ?? ''}
              title={`Globaler Payroll-Regelsatz ${activeRuleSet?.rule_year || ''}`}
            />
          </Input>
          <Input label="NBU Arbeitnehmer %"><input type="number" min="0" step="0.0001" value={profile.nbu_employee_rate ?? 0} onChange={(e) => setProfileField('nbu_employee_rate', e.target.value)} /></Input>
          <Input label="NBU Arbeitgeber %"><input type="number" min="0" step="0.0001" value={profile.nbu_employer_rate ?? 0} onChange={(e) => setProfileField('nbu_employer_rate', e.target.value)} /></Input>
          <Input label="KTG Arbeitnehmer %"><input type="number" min="0" step="0.0001" value={profile.ktg_employee_rate ?? 0} onChange={(e) => setProfileField('ktg_employee_rate', e.target.value)} /></Input>
          <Input label="KTG Arbeitgeber %"><input type="number" min="0" step="0.0001" value={profile.ktg_employer_rate ?? 0} onChange={(e) => setProfileField('ktg_employer_rate', e.target.value)} /></Input>
          <Input label="GAV Arbeitnehmer %"><input type="number" min="0" step="0.0001" value={profile.gav_employee_rate ?? 0} onChange={(e) => setProfileField('gav_employee_rate', e.target.value)} /></Input>
          <Input label="GAV Arbeitgeber %"><input type="number" min="0" step="0.0001" value={profile.gav_employer_rate ?? 0} onChange={(e) => setProfileField('gav_employer_rate', e.target.value)} /></Input>
          <Input label="BVG Arbeitnehmer CHF"><input type="number" min="0" step="0.05" value={profile.bvg_employee_amount_chf ?? 0} onChange={(e) => setProfileField('bvg_employee_amount_chf', e.target.value)} /></Input>
          <Input label="BVG Arbeitgeber CHF"><input type="number" min="0" step="0.05" value={profile.bvg_employer_amount_chf ?? 0} onChange={(e) => setProfileField('bvg_employer_amount_chf', e.target.value)} /></Input>
          <Input label="Vorschuss CHF"><input type="number" min="0" step="0.05" value={profile.advance_deduction_chf ?? 0} onChange={(e) => setProfileField('advance_deduction_chf', e.target.value)} /></Input>
          <Input label="Weitere Abzüge CHF"><input type="number" min="0" step="0.05" value={profile.other_employee_deduction_chf ?? 0} onChange={(e) => setProfileField('other_employee_deduction_chf', e.target.value)} /></Input>
          <Input label="Spesen/Rückerstattung CHF"><input type="number" step="0.05" value={profile.expense_reimbursement_chf ?? 0} onChange={(e) => setProfileField('expense_reimbursement_chf', e.target.value)} /></Input>
          <Input label="Weitere Arbeitgeberkosten CHF"><input type="number" min="0" step="0.05" value={profile.other_employer_cost_chf ?? 0} onChange={(e) => setProfileField('other_employer_cost_chf', e.target.value)} /></Input>
          <Input label="Weitere Bezüge/Abzüge CHF"><input type="number" step="0.05" value={profile.other_adjustment_chf ?? 0} onChange={(e) => setProfileField('other_adjustment_chf', e.target.value)} /></Input>
          <Input label="Fixlohn-Anteil"><select value={profile.monthly_salary_proration_method || 'working_days'} onChange={(e) => setProfileField('monthly_salary_proration_method', e.target.value)}><option value="working_days">Arbeitstage</option><option value="calendar_days">Kalendertage</option><option value="none">Keine Kürzung</option></select></Input>
          {salaryType === 'hourly' ? (
            <Input label="Ferienentschädigung Auszahlung">
              <select
                value={profile.metadata?.pay_vacation_monthly === true ? 'monthly' : 'accrual'}
                onChange={(e) =>
                  setProfileMetadataField(
                    'pay_vacation_monthly',
                    e.target.value === 'monthly',
                  )
                }
              >
                <option value="accrual">Rückstellung · nicht monatlich ausbezahlt</option>
                <option value="monthly">Monatlich auszahlen</option>
              </select>
            </Input>
          ) : null}
        </div>
        <div className={`opc-payroll-tax-review ${taxAssessment.kind}`}>
          <div>
            <strong>{taxAssessment.title}</strong>
            <span>{taxAssessment.detail}</span>
            <span>Bewilligung: {text(currentPermit?.permit_type).toUpperCase() || 'nicht erfasst'} · Zivilstand: {text(employee.civil_status) || 'nicht erfasst'}</span>
          </div>
          {taxAssessment.defaultSubject != null ? (
            <button
              className="opc-payroll-button"
              type="button"
              disabled={savingProfile || taxRecommendationApplied}
              onClick={() => void applySourceTaxRecommendation()}
            >
              {savingProfile ? <Loader2 size={15} className="spin" /> : taxRecommendationApplied ? <CheckCircle2 size={15} /> : null}
              {taxRecommendationApplied ? 'Empfehlung übernommen' : 'Empfehlung übernehmen'}
            </button>
          ) : null}
        </div>

        {taxRecommendationApplied ? (
          <div className="opc-payroll-tax-applied">
            <CheckCircle2 size={17} />
            <div>
              <strong>Quellensteuer-Empfehlung gespeichert</strong>
              <span>
                Quellensteuerpflicht ist aktiviert. Kanton, Tarifcode, Satz/Fixbetrag und Prüfstatus müssen noch geprüft bzw. ergänzt werden.
              </span>
            </div>
          </div>
        ) : null}

        <div className="opc-payroll-tax-grid">
          <label><input type="checkbox" checked={profile.source_tax_subject === true} onChange={(e) => setProfileField('source_tax_subject', e.target.checked)} /> Quellensteuerpflichtig</label>
          <Input label="Kanton"><input maxLength={2} value={profile.source_tax_canton || ''} onChange={(e) => setProfileField('source_tax_canton', e.target.value.toUpperCase())} /></Input>
          <Input label="Tarifcode"><input value={profile.source_tax_tariff_code || ''} onChange={(e) => setProfileField('source_tax_tariff_code', e.target.value)} /></Input>
          <Input label="Satz %"><input type="number" min="0" step="0.0001" value={profile.source_tax_rate ?? 0} onChange={(e) => setProfileField('source_tax_rate', e.target.value)} /></Input>
          <Input label="Fixbetrag CHF"><input type="number" min="0" step="0.05" value={profile.source_tax_fixed_amount_chf ?? 0} onChange={(e) => setProfileField('source_tax_fixed_amount_chf', e.target.value)} /></Input>
        </div>

        <div className="opc-payroll-grid four opc-payroll-tax-context">
          <Input label="Kinder / Unterhaltspflichten">
            <input type="number" min="0" step="1" value={profileMetadata.source_tax_children_count ?? 0} onChange={(e) => setProfileMetadataField('source_tax_children_count', e.target.value)} />
          </Input>
          <Input label="Erwerbstätigkeit Ehepartner/in">
            <select value={profileMetadata.source_tax_spouse_employment || 'unknown'} onChange={(e) => setProfileMetadataField('source_tax_spouse_employment', e.target.value)}>
              <option value="unknown">Nicht erfasst</option>
              <option value="not_applicable">Nicht anwendbar</option>
              <option value="not_working">Nicht erwerbstätig</option>
              <option value="working">Erwerbstätig</option>
            </select>
          </Input>
          <Input label="Prüf-/Ausnahmegrund">
            <input value={profileMetadata.source_tax_review_note || ''} placeholder="z. B. Ehepartner CH/C, Grenzgängerregel" onChange={(e) => setProfileMetadataField('source_tax_review_note', e.target.value)} />
          </Input>
          <Input label="Prüfstatus">
            <select value={taxReviewConfirmed ? 'confirmed' : 'open'} onChange={(e) => setProfileMetadataField('source_tax_review_confirmed', e.target.value === 'confirmed')}>
              <option value="open">Offen</option>
              <option value="confirmed">Geprüft / bestätigt</option>
            </select>
          </Input>
        </div>

        <div className="opc-payroll-checks">
          <label><input type="checkbox" checked={profile.church_tax === true} onChange={(e) => setProfileField('church_tax', e.target.checked)} /> Kirchensteuer im Tarif berücksichtigen</label>
          <label><input type="checkbox" checked={profile.pay_thirteenth_monthly === true} onChange={(e) => setProfileField('pay_thirteenth_monthly', e.target.checked)} /> Anteil 13. Monatslohn monatlich auszahlen</label>
        </div>
        <button className="opc-payroll-button primary" type="button" disabled={savingProfile} onClick={() => void saveProfile()}>{savingProfile ? <Loader2 size={15} className="spin" /> : <Save size={15} />} Abgabenprofil speichern</button>
      </PayrollCollapsiblePanel>

      <div className="opc-payroll-panel opc-payroll-panel-always-open">
        <div className="opc-payroll-panel-title"><FileCheck2 size={17} /><div><strong>Lohnabrechnung</strong><span>Vorschau berechnen, PDF herunterladen oder als abgeschlossenen Lohnlauf speichern. Standard-Abrechnungsperiode: 24. des Vormonats bis 23. des Folgemonats.</span></div></div>
        <div className={`opc-payroll-period ${salaryType === 'monthly' ? 'monthly' : ''}`}>
          {salaryType === 'monthly' ? (
            <Input label="Abrechnungsmonat">
              <input
                type="month"
                value={periodFrom.slice(0, 7)}
                onChange={(e) => changePayrollMonth(e.target.value)}
              />
            </Input>
          ) : (
            <>
              <Input label="Von"><input type="date" value={periodFrom} onChange={(e) => changePeriod('from', e.target.value)} /></Input>
              <Input label="Bis"><input type="date" value={periodTo} onChange={(e) => changePeriod('to', e.target.value)} /></Input>
            </>
          )}
          <button className="opc-payroll-button" type="button" disabled={calculating} onClick={() => void calculate(false)}>{calculating ? <Loader2 size={15} className="spin" /> : <Calculator size={15} />} Berechnen</button>
          <button className="opc-payroll-button" type="button" disabled={calculating} onClick={() => void calculate(true)}><Download size={15} /> PDF</button>
          <button className="opc-payroll-button" type="button" disabled={calculating} onClick={() => void calculate(true, true)}><Download size={15} /> PDF Nullsumme</button>
          <button className="opc-payroll-button dark" type="button" disabled={finalizing} onClick={() => void finalize()}>{finalizing ? <Loader2 size={15} className="spin" /> : <FileCheck2 size={15} />} Abschliessen</button>
        </div>

        {preview?.summary ? (
          <>
            <div className="opc-payroll-values">
              <Value label="Lohnart" value={preview.summary.salaryType === 'monthly' ? 'Fix-/Monatslohn' : 'Stundenlohn'} />
              <Value
                label={preview.summary.salaryType === 'monthly'
                  ? 'Abrechnungsmonat'
                  : preview.summary.payrollInputMode === 'manual'
                    ? 'Manuelle Abrechnungsstunden'
                    : 'Genehmigte Stunden'}
                value={preview.summary.salaryType === 'monthly'
                  ? payrollMonthLabel(periodFrom)
                  : `${n(preview.summary.totalHours).toFixed(2)} h`}
              />
              <Value label="Bruttolohn" value={money.format(n(preview.summary.grossSalary))} />
              <Value label="Arbeitnehmerabzüge" value={money.format(n(preview.summary.employeeDeductions))} />
              <Value label="Nettolohn" value={money.format(n(preview.summary.netSalary))} />
              <Value label="Auszahlung" value={money.format(n(preview.summary.payout))} />
              <Value label="Arbeitgeberbeiträge" value={money.format(n(preview.summary.employerContributions))} />
              <Value label="Arbeitgeberkosten" value={money.format(n(preview.summary.totalEmployerCost))} />
              {preview.summary.salaryType === 'monthly' ? null : (
                <Value label="Kosten pro Stunde" value={preview.summary.employerCostPerHour == null ? 'Nicht berechenbar' : money.format(n(preview.summary.employerCostPerHour))} />
              )}
            </div>
            {Array.isArray(preview.summary.accruals) && preview.summary.accruals.some((item: JsonRow) => item?.status === 'accrued' && item?.code === 'VACATION_PAY_ACCRUAL') ? (
              <div className="opc-payroll-accruals">
                <strong>Ferien- und Lohnguthaben</strong>
                <span className="opc-payroll-accrual-note">Separat geführt; nicht in der aktuellen Auszahlung enthalten.</span>
                {preview.summary.accruals.filter((item: JsonRow) => item?.status === 'accrued' && item?.code === 'VACATION_PAY_ACCRUAL').map((item: JsonRow) => (
                  <div className="opc-payroll-accrual-card" key={item.code || item.label}>
                    <div className="opc-payroll-accrual-title">
                      <strong>{item.label || item.code}</strong>
                      <span>Basis {money.format(n(item.basisAmount))} · {n(item.rate).toFixed(2)} %</span>
                    </div>
                    <div className="opc-payroll-accrual-grid">
                      <Value label="Vortrag" value={money.format(n(item.openingBalance))} />
                      <Value label="Zugang aktuelle Periode" value={money.format(n(item.periodAccrual ?? item.amount))} />
                      <Value label="Ausbezahlt" value={money.format(n(item.periodPayout))} />
                      <Value label="Neuer Saldo" value={money.format(n(item.closingBalance))} />
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      <style>{`
        .opc-payroll-phase1{display:grid;gap:12px;color:#111827;width:100%;max-width:100%;min-width:0;overflow:hidden;box-sizing:border-box}.opc-payroll-collapsible.closed{padding:10px 12px}.opc-payroll-collapsible-head{width:100%;border:0;background:transparent;padding:0;color:#111827;display:flex;align-items:center;justify-content:space-between;gap:12px;cursor:pointer;text-align:left;font-family:inherit}.opc-payroll-collapsible-copy{display:flex;align-items:flex-start;gap:8px;min-width:0}.opc-payroll-collapsible-copy>div{display:grid;gap:3px;min-width:0}.opc-payroll-collapsible-copy strong{font-size:12px}.opc-payroll-collapsible-copy span{font-size:10px;color:#6b7280;font-weight:650;line-height:1.35}.opc-payroll-collapsible-head>svg{flex:0 0 auto;transition:transform .18s ease}.opc-payroll-collapsible.open .opc-payroll-collapsible-head>svg{transform:rotate(180deg)}.opc-payroll-collapsible-body{margin-top:12px}.opc-payroll-panel-always-open{box-shadow:0 0 0 1px rgba(17,24,39,.02)}.opc-payroll-banner{display:flex;gap:10px;align-items:center;border:1px solid #d1d5db;background:#f9fafb;border-radius:14px;padding:12px}.opc-payroll-banner>div{display:grid;gap:3px}.opc-payroll-banner strong{font-size:12px}.opc-payroll-banner span{font-size:10px;color:#6b7280;font-weight:650}.opc-payroll-loading{display:flex;align-items:center;gap:8px;padding:14px;border:1px solid #e5e7eb;border-radius:14px;font-size:11px;font-weight:700}.opc-payroll-alert{display:flex;align-items:center;gap:7px;border-radius:12px;padding:10px 12px;font-size:11px;font-weight:700}.opc-payroll-alert.error{background:#fef2f2;border:1px solid #fecaca;color:#991b1b}.opc-payroll-alert.success{background:#f0fdf4;border:1px solid #bbf7d0;color:#166534}.opc-payroll-panel{border:1px solid #e5e7eb;border-radius:15px;padding:13px;background:#fff;width:100%;max-width:100%;min-width:0;overflow:hidden;box-sizing:border-box}.opc-payroll-panel-title{display:flex;align-items:flex-start;gap:8px;margin-bottom:12px}.opc-payroll-panel-title>div{display:grid;gap:3px}.opc-payroll-panel-title strong{font-size:12px}.opc-payroll-panel-title span{font-size:10px;color:#6b7280;font-weight:650}.opc-payroll-grid{display:grid;gap:8px;width:100%;max-width:100%;min-width:0;box-sizing:border-box}.opc-payroll-grid.four{grid-template-columns:repeat(4,minmax(0,1fr))}.opc-payroll-grid>*{min-width:0;max-width:100%;}.opc-payroll-tax-grid>*{min-width:0;max-width:100%;}.opc-payroll-period>*{min-width:0;max-width:100%;}.opc-payroll-values>*{min-width:0;max-width:100%;}.opc-payroll-field{display:grid;gap:5px;min-width:0;max-width:100%;box-sizing:border-box}.opc-payroll-field>span{font-size:9px;color:#6b7280;font-weight:800}.opc-payroll-field input,.opc-payroll-field select{width:100%;max-width:100%;min-width:0;min-height:39px;box-sizing:border-box;border:1px solid #d1d5db;border-radius:11px;background:#fff;padding:8px 9px;font:700 11px inherit;color:#111827;outline:none}.opc-payroll-field input:focus,.opc-payroll-field select:focus{border-color:#111827}.opc-payroll-checks{display:flex;flex-wrap:wrap;gap:12px;margin:11px 0}.opc-payroll-checks label,.opc-payroll-tax-grid>label{display:flex;align-items:center;gap:7px;font-size:10px;font-weight:750;color:#374151}.opc-payroll-tax-grid{display:grid;grid-template-columns:minmax(0,1.15fr) repeat(4,minmax(0,1fr));gap:8px;align-items:end;margin-top:10px;width:100%;max-width:100%;min-width:0;box-sizing:border-box}.opc-payroll-button{min-width:0;max-width:100%;box-sizing:border-box;min-height:39px;border:1px solid #d1d5db;border-radius:11px;background:#fff;color:#111827;padding:8px 12px;font:800 10px inherit;display:inline-flex;align-items:center;justify-content:center;gap:7px;cursor:pointer}.opc-payroll-button.primary,.opc-payroll-button.dark{background:#111827;border-color:#111827;color:#fff}.opc-payroll-button:disabled{opacity:.55;cursor:not-allowed}.opc-payroll-period{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;align-items:end;width:100%;max-width:100%;min-width:0;box-sizing:border-box}.opc-payroll-period.monthly{grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}.opc-payroll-values{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;width:100%;max-width:100%;min-width:0;box-sizing:border-box;margin-top:12px;padding-top:12px;border-top:1px solid #e5e7eb}.opc-payroll-value{border:1px solid #e5e7eb;border-radius:12px;padding:10px;display:grid;gap:4px}.opc-payroll-value span{font-size:9px;color:#6b7280;font-weight:800}.opc-payroll-value strong{font-size:12px}.opc-payroll-warnings{margin-top:10px;border:1px solid #fde68a;background:#fffbeb;color:#92400e;border-radius:12px;padding:10px;font-size:10px;font-weight:700;display:grid;gap:4px}.opc-payroll-accruals{margin-top:10px;border:1px solid #cbd5e1;background:#f8fafc;border-radius:12px;padding:12px;font-size:10px;display:grid;gap:9px}.opc-payroll-accruals>strong{font-size:11px}.opc-payroll-accrual-note{color:#64748b;font-size:9px;font-weight:650}.opc-payroll-accrual-card{display:grid;gap:8px;border-top:1px solid #e2e8f0;padding-top:9px}.opc-payroll-accrual-title{display:flex;justify-content:space-between;gap:10px;align-items:baseline}.opc-payroll-accrual-title>strong{font-size:10px}.opc-payroll-accrual-title>span{color:#64748b;font-size:9px}.opc-payroll-accrual-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.opc-payroll-accrual-grid .opc-payroll-value{background:#fff}.opc-payroll-reconciliation{margin-top:10px;border-radius:12px;padding:10px;font-size:10px;display:grid;gap:4px}.opc-payroll-reconciliation.ok{border:1px solid #bbf7d0;background:#f0fdf4;color:#166534}.opc-payroll-reconciliation.error{border:1px solid #fecaca;background:#fef2f2;color:#991b1b}.opc-payroll-rate-actions{display:flex;gap:8px;margin-bottom:10px}.opc-payroll-rate-table-wrap{overflow:auto;border:1px solid #e5e7eb;border-radius:12px}.opc-payroll-rate-table{width:100%;border-collapse:collapse;min-width:680px}.opc-payroll-rate-table th,.opc-payroll-rate-table td{text-align:left;padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:10px}.opc-payroll-rate-table th{background:#f9fafb;color:#6b7280;font-size:9px}.opc-payroll-rate-table td:nth-child(2){display:grid;gap:2px}.opc-payroll-rate-table td span{color:#6b7280}.opc-payroll-rate-table input{width:100%;min-height:34px;border:1px solid #d1d5db;border-radius:9px;padding:6px 8px;font:700 10px inherit}.opc-payroll-empty{border:1px dashed #d1d5db;border-radius:12px;padding:12px;color:#6b7280;font-size:10px;font-weight:700}.opc-payroll-rate-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px;width:100%;max-width:100%;min-width:0;box-sizing:border-box}.opc-payroll-rate-summary>div{border:1px solid #e5e7eb;border-radius:11px;padding:9px;display:grid;gap:3px}.opc-payroll-rate-summary strong{font-size:10px}.opc-payroll-rate-summary span{font-size:9px;color:#6b7280}.opc-payroll-mode-switch{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:12px}.opc-payroll-mode-button{min-height:42px;border:1px solid #d1d5db;border-radius:11px;background:#fff;font:800 10px inherit;color:#374151;cursor:pointer}.opc-payroll-mode-button.active{background:#111827;color:#fff;border-color:#111827}.opc-payroll-manual-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:10px}.opc-payroll-manual-table-wrap{overflow:auto;border:1px solid #e5e7eb;border-radius:12px;margin-bottom:10px}.opc-payroll-manual-table{width:100%;border-collapse:collapse;min-width:920px}.opc-payroll-manual-table th,.opc-payroll-manual-table td{padding:8px;border-bottom:1px solid #e5e7eb;font-size:9px;text-align:left}.opc-payroll-manual-table th{background:#f9fafb;color:#6b7280;font-weight:800}.opc-payroll-manual-table input,.opc-payroll-manual-table select{width:100%;box-sizing:border-box;min-height:34px;border:1px solid #d1d5db;border-radius:9px;padding:6px 8px;font:700 10px inherit;background:#fff}.opc-payroll-manual-actions{display:flex;gap:8px;margin-bottom:10px}.opc-payroll-icon-button{border:1px solid #e5e7eb;border-radius:9px;background:#fff;min-width:34px;min-height:34px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer}.opc-payroll-tax-review{display:flex;justify-content:space-between;align-items:center;gap:12px;border-radius:12px;padding:10px 12px;margin-top:10px;border:1px solid #d1d5db;background:#f9fafb}.opc-payroll-tax-review>div{display:grid;gap:3px}.opc-payroll-tax-review strong{font-size:10px}.opc-payroll-tax-review span{font-size:9px;color:#64748b;font-weight:650}.opc-payroll-tax-review.subject,.opc-payroll-tax-review.special_review,.opc-payroll-tax-review.unknown{border-color:#fde68a;background:#fffbeb}.opc-payroll-tax-review.not_subject{border-color:#bbf7d0;background:#f0fdf4}.opc-payroll-tax-applied{display:flex;align-items:flex-start;gap:9px;margin-top:8px;padding:10px 12px;border:1px solid #86efac;background:#f0fdf4;color:#166534;border-radius:12px}.opc-payroll-tax-applied>div{display:grid;gap:3px}.opc-payroll-tax-applied strong{font-size:10px}.opc-payroll-tax-applied span{font-size:9px;font-weight:650;color:#166534}.opc-payroll-tax-context{margin-top:8px}@media(max-width:1280px){.opc-payroll-grid.four{grid-template-columns:repeat(2,minmax(0,1fr))}.opc-payroll-tax-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.opc-payroll-tax-grid>label{grid-column:1/-1}.opc-payroll-period{grid-template-columns:repeat(2,minmax(0,1fr))}.opc-payroll-period .opc-payroll-button{width:100%}.opc-payroll-values{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:640px){.opc-payroll-grid.four,.opc-payroll-tax-grid,.opc-payroll-period,.opc-payroll-values,.opc-payroll-accrual-grid,.opc-payroll-mode-switch,.opc-payroll-manual-summary{grid-template-columns:1fr}.opc-payroll-accrual-title,.opc-payroll-tax-review{display:grid}.opc-payroll-manual-actions{display:grid}}
      `}</style>
    </div>
  );
}

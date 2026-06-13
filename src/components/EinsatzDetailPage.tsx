import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Coffee,
  Loader2,
  LogIn,
  LogOut,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
} from 'lucide-react';
import MirakaDashboardShell from './MirakaDashboardShell';
import { supabase } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';

interface EinsatzDetailPageProps {
  jobId: string;
}

type JsonRecord = Record<string, any>;
type JsonArray = JsonRecord[];

type AccessState = {
  loading: boolean;
  userId: string | null;
  staffId: string | null;
  employeeId: string | null;
  email: string | null;
  displayName: string | null;
  role: string | null;
  canEdit: boolean;
  isAssigned: boolean;
};

type EmployeeOption = {
  id: string;
  user_id?: string | null;
  employee_id?: string | null;
  display_name?: string | null;
  email?: string | null;
  phone_e164?: string | null;
  phone_raw?: string | null;
  whatsapp_wa_id?: string | null;
  role?: string | null;
  status?: string | null;
};

type NoteRow = {
  key: string;
  title: string;
  body: string;
  visibility: 'internal' | 'client' | 'action' | 'system';
};

interface JobDetail {
  job_id: string;
  title?: string | null;
  job_type?: string | null;
  status?: string | null;
  priority?: string | null;
  planned_start?: string | null;
  planned_end?: string | null;
  actual_start?: string | null;
  actual_end?: string | null;
  service_category?: string | null;
  service_description?: string | null;
  estimated_hours?: string | number | null;
  final_hours?: string | number | null;
  billable_amount?: string | number | null;
  currency?: string | null;
  dispatcher_notes?: string | null;
  employee_notes?: string | null;
  client_notes?: string | null;
  internal_notes?: string | null;
  report_required?: boolean | null;
  report_approved?: boolean | null;
  report_approved_at?: string | null;
  report_approved_by?: string | null;
  client_id?: string | null;
  billing_name?: string | null;
  company_name?: string | null;
  full_name?: string | null;
  email?: string | null;
  phone_raw?: string | null;
  phone_e164?: string | null;
  client_site_id?: string | null;
  site_name?: string | null;
  site_type?: string | null;
  address_text?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
  access_notes?: string | null;
  cleaning_notes?: string | null;
  billing_notes?: string | null;
  service_requirements?: any;
  assignments?: JsonArray | null;
  time_logs?: JsonArray | null;
  media?: JsonArray | null;
  damage_reports?: JsonArray | null;
  report?: JsonRecord | null;
  activity_timeline?: JsonArray | null;
  conversation_messages?: JsonArray | null;
}

type EditDraft = {
  title: string;
  service_category: string;
  service_description: string;
  status: string;
  priority: string;
  planned_start: string;
  planned_end: string;
  estimated_hours: string;
  final_hours: string;
  billable_amount: string;
  dispatcher_notes: string;
  employee_notes: string;
  client_notes: string;
  internal_notes: string;
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
  orange: '#92400E',
};

const pageFont =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", "Helvetica Neue", Segoe UI, Roboto, sans-serif';

const cardStyle: CSSProperties = {
  background: BRAND.card,
  border: `1px solid ${BRAND.border}`,
  borderRadius: '20px',
  boxShadow: '0 1px 2px rgba(15, 17, 21, 0.04)',
};

const statusLabels: Record<string, string> = {
  scheduled: 'Geplant',
  assigned: 'Zugewiesen',
  pending: 'Offen',
  confirmed: 'Bestätigt',
  on_site: 'Vor Ort',
  'on-site': 'Vor Ort',
  onsite: 'Vor Ort',
  in_progress: 'In Arbeit',
  'in-progress': 'In Arbeit',
  started: 'Gestartet',
  running: 'Läuft',
  completed: 'Abgeschlossen',
  report_pending: 'Bericht offen',
  report_approved: 'Bericht freigegeben',
  cancelled: 'Storniert',
  draft: 'Entwurf',
  approved: 'Freigegeben',
  sent_to_client: 'An Kunde gesendet',
  submitted: 'Eingereicht',
  active: 'Aktiv',
  open: 'Aktiv',
  on_break: 'Pause',
  rejected: 'Abgelehnt',
  before_photo: 'Vorher',
  after_photo: 'Nachher',
  damage_photo: 'Schaden',
  general_photo: 'Allgemein',
  document: 'Dokument',
  signature: 'Unterschrift',
  other: 'Sonstiges',
};

const statusStyles: Record<string, { background: string; color: string; border: string }> = {
  scheduled: { background: '#FFFBEB', color: '#92400E', border: '#FDE68A' },
  assigned: { background: '#FFFBEB', color: '#92400E', border: '#FDE68A' },
  pending: { background: '#F8FAFC', color: '#374151', border: '#E5E7EB' },
  confirmed: { background: '#F5F3FF', color: '#5B21B6', border: '#DDD6FE' },
  on_site: { background: '#ECFDF5', color: '#047857', border: '#A7F3D0' },
  'on-site': { background: '#ECFDF5', color: '#047857', border: '#A7F3D0' },
  onsite: { background: '#ECFDF5', color: '#047857', border: '#A7F3D0' },
  in_progress: { background: '#ECFDF5', color: '#047857', border: '#A7F3D0' },
  'in-progress': { background: '#ECFDF5', color: '#047857', border: '#A7F3D0' },
  started: { background: '#ECFDF5', color: '#047857', border: '#A7F3D0' },
  running: { background: '#ECFDF5', color: '#047857', border: '#A7F3D0' },
  completed: { background: '#F3F4F6', color: '#111827', border: '#D1D5DB' },
  report_pending: { background: '#FFFBEB', color: '#92400E', border: '#FDE68A' },
  report_approved: { background: '#F3F4F6', color: '#111827', border: '#D1D5DB' },
  cancelled: { background: '#FEF2F2', color: '#991B1B', border: '#FECACA' },
  draft: { background: '#F3F4F6', color: '#374151', border: '#E5E7EB' },
  approved: { background: '#F3F4F6', color: '#111827', border: '#D1D5DB' },
  sent_to_client: { background: '#F3F4F6', color: '#111827', border: '#D1D5DB' },
  submitted: { background: '#F3F4F6', color: '#111827', border: '#D1D5DB' },
  active: { background: '#ECFDF5', color: '#047857', border: '#A7F3D0' },
  open: { background: '#ECFDF5', color: '#047857', border: '#A7F3D0' },
  on_break: { background: '#ECFEFF', color: '#155E75', border: '#A5F3FC' },
  rejected: { background: '#FEF2F2', color: '#991B1B', border: '#FECACA' },
};

function normalize(value?: string | null) {
  return String(value || '').trim().toLowerCase();
}

function roleKey(role?: string | null) {
  const clean = normalize(role);

  if (clean === 'owner' || clean === 'inhaber') return 'owner';
  if (clean === 'admin' || clean === 'administrator') return 'admin';
  if (clean === 'dispatch' || clean === 'dispatcher' || clean === 'disposition') return 'dispatch';
  if (clean === 'employee' || clean === 'mitarbeiter') return 'employee';
  if (clean === 'client' || clean === 'kunde' || clean === 'customer') return 'client';

  return clean || 'employee';
}

function isEmployeeRole(role?: string | null) {
  return roleKey(role) === 'employee';
}

function isClientRole(role?: string | null) {
  return roleKey(role) === 'client';
}

function isOwnerOrAdminRole(role?: string | null) {
  const clean = roleKey(role);
  return clean === 'owner' || clean === 'admin';
}

function isManagerRole(role?: string | null) {
  return ['owner', 'admin', 'dispatch', 'manager'].includes(roleKey(role));
}

function formatStatus(status?: string | null) {
  const clean = normalize(status);
  if (!clean) return 'Unbekannt';
  return statusLabels[clean] || clean.replaceAll('_', ' ');
}

function getStatusStyle(status?: string | null) {
  const clean = normalize(status);

  return (
    statusStyles[clean] || {
      background: '#F3F4F6',
      color: '#374151',
      border: '#E5E7EB',
    }
  );
}

function pad(num: number) {
  return String(num).padStart(2, '0');
}

function formatDate(value?: string | null) {
  if (!value) return 'Nicht hinterlegt';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Nicht hinterlegt';

  return new Intl.DateTimeFormat('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatShortDate(value?: string | null) {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function formatTime(value?: string | null) {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('de-CH', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatMinutes(minutes?: number | null) {
  const safe = Math.max(0, Number(minutes || 0));
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  return `${hours}h ${pad(mins)}m`;
}

function toDateTimeLocal(value?: string | null) {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);

  return local.toISOString().slice(0, 16);
}

function fromDateTimeLocal(value: string) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
}

function asArray(value: unknown): JsonArray {
  return Array.isArray(value) ? (value as JsonArray) : [];
}

function getDisplayName(job: JobDetail) {
  return job.billing_name || job.company_name || job.full_name || job.site_name || 'Unbekannter Kunde';
}

function joinAddress(job: JobDetail) {
  return [job.address_text, job.postal_code, job.city, job.country].filter(Boolean).join(', ');
}

function getMapsUrl(job: JobDetail) {
  const query = joinAddress(job) || job.site_name || getDisplayName(job);
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function cleanNullable(value: string) {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function cleanNumber(value: string) {
  const trimmed = value.trim().replace(',', '.');
  if (!trimmed) return null;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function safeFileName(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
}

function compactPayload(payload: JsonRecord) {
  const copy: JsonRecord = { ...payload };

  Object.keys(copy).forEach((key) => {
    if (copy[key] === null || copy[key] === undefined || copy[key] === '') {
      delete copy[key];
    }
  });

  return copy;
}

function safeMetadata(value: unknown): JsonRecord {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...(value as JsonRecord) };
  }

  return {};
}

function getBreakStartedAt(log: JsonRecord | null) {
  const metadata = safeMetadata(log?.metadata);
  return metadata.break_started_at || null;
}

function getBreakMinutes(log: JsonRecord | null) {
  const metadata = safeMetadata(log?.metadata);
  return Number(metadata.break_minutes || 0);
}

function appendManualNote(existing: unknown, note?: string | null) {
  const clean = note?.trim();
  if (!clean) return existing ? String(existing) : null;

  return [existing ? String(existing) : '', clean].filter(Boolean).join('\n\n');
}

function extractManualActionNotes(raw: unknown) {
  const text = String(raw || '').trim();
  if (!text) return '';

  const autoActionRegex =
    /^\[[^\]]+\]\s*(Einsatz gestartet|Pause gestartet|Pause beendet|Einsatz abgeschlossen)(?::\s*(.*))?$/i;

  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .map((line) => {
      const match = line.match(autoActionRegex);
      if (!match) return line;
      return match[2]?.trim() || '';
    })
    .filter(Boolean)
    .join('\n');
}

async function tryInsertOne(table: string, variants: JsonRecord[]) {
  let lastError: any = null;

  for (const variant of variants) {
    const payload = compactPayload(variant);

    try {
      const response = await supabase.from(table).insert(payload).select('*').limit(1);

      if (!response.error) {
        return {
          data: Array.isArray(response.data) ? response.data[0] : null,
          payload,
          error: null,
        };
      }

      lastError = response.error;
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    lastError?.message || `${table}: Insert konnte mit keiner Spalten-Variante erstellt werden.`,
  );
}

async function tryUpdateOne(table: string, idColumn: string, idValue: string, variants: JsonRecord[]) {
  let lastError: any = null;

  for (const variant of variants) {
    const payload = compactPayload(variant);

    try {
      const response = await supabase
        .from(table)
        .update(payload)
        .eq(idColumn, idValue)
        .select('*')
        .limit(1);

      if (!response.error && Array.isArray(response.data) && response.data.length > 0) {
        return {
          data: response.data[0],
          payload,
          error: null,
        };
      }

      if (!response.error) {
        lastError = new Error(`${table}: Keine Zeile wurde aktualisiert (${idColumn}=${idValue}).`);
        continue;
      }

      lastError = response.error;
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    lastError?.message || `${table}: Update konnte mit keiner Spalten-Variante gespeichert werden.`,
  );
}

async function tryUpdateJobById(jobId: string, payload: JsonRecord) {
  const clean = compactPayload({
    ...payload,
    updated_at: new Date().toISOString(),
  });

  const attempts = [
    { table: 'opc_service_jobs', column: 'id' },
    { table: 'opc_service_jobs', column: 'job_id' },
    { table: 'opc_jobs', column: 'id' },
    { table: 'opc_jobs', column: 'job_id' },
  ];

  let lastError: any = null;
  let sawWritableTable = false;

  for (const attempt of attempts) {
    try {
      const response = await supabase
        .from(attempt.table)
        .update(clean)
        .eq(attempt.column, jobId)
        .select('id')
        .limit(1);

      if (!response.error && Array.isArray(response.data) && response.data.length > 0) {
        return response.data[0];
      }

      if (!response.error) {
        sawWritableTable = true;
        lastError = new Error(`${attempt.table}: Keine Zeile mit ${attempt.column}=${jobId} aktualisiert.`);
        continue;
      }

      lastError = response.error;
    } catch (error) {
      lastError = error;
    }
  }

  if (sawWritableTable) {
    throw new Error(
      `Einsatz konnte nicht aktualisiert werden. Es wurde keine passende Zeile für diese Einsatz-ID gefunden: ${jobId}.`,
    );
  }

  throw new Error(lastError?.message || 'Einsatz konnte nicht aktualisiert werden.');
}

function getAssignmentEmployeeId(assignment: JsonRecord) {
  return (
    assignment.employee_id ||
    assignment.staff_id ||
    assignment.staff_role_id ||
    assignment.user_id ||
    assignment.employee_user_id ||
    assignment.assigned_to ||
    null
  );
}

function getTimeLogEmployeeId(log: JsonRecord) {
  const metadata = safeMetadata(log.metadata);

  return (
    log.employee_id ||
    log.staff_id ||
    log.staff_role_id ||
    log.user_id ||
    log.employee_user_id ||
    metadata.employee_id ||
    metadata.staff_role_id ||
    metadata.user_id ||
    null
  );
}

function isOwnTimeLog(log: JsonRecord, access: AccessState) {
  const ownIds = [access.staffId, access.userId, access.employeeId].filter(Boolean).map(String);
  const logOwner = getTimeLogEmployeeId(log);

  return Boolean(logOwner && ownIds.includes(String(logOwner)));
}

function isOpenLog(log: JsonRecord) {
  const ended = log.ended_at || log.end_time || log.clock_out_at || log.finished_at;
  const status = normalize(log.status);

  return !ended && !['submitted', 'completed', 'approved', 'rejected', 'closed'].includes(status);
}

function getPrimaryAssignee(job: JobDetail, access: AccessState) {
  const assignments = asArray(job.assignments);
  const ownIds = [access.staffId, access.userId, access.employeeId].filter(Boolean).map(String);

  return (
    assignments.find((assignment) => {
      const assignmentId = getAssignmentEmployeeId(assignment);
      return assignmentId && ownIds.includes(String(assignmentId));
    }) ||
    assignments[0] ||
    null
  );
}

function getAssignmentDisplayName(assignment: JsonRecord | null) {
  if (!assignment) return 'Disposition';

  return (
    assignment.assigned_by_name ||
    assignment.dispatcher_name ||
    assignment.created_by_name ||
    assignment.assigned_by_display_name ||
    assignment.assigned_by ||
    'Disposition'
  );
}

function getOnSiteContact(job: JobDetail) {
  return (
    (job as any).site_contact_name ||
    (job as any).contact_name ||
    (job as any).person_of_contact ||
    (job as any).onsite_contact_name ||
    job.full_name ||
    getDisplayName(job)
  );
}

function getOnSitePhone(job: JobDetail) {
  return (
    (job as any).site_contact_phone ||
    (job as any).contact_phone ||
    job.phone_e164 ||
    job.phone_raw ||
    ''
  );
}

function plannedStartGate(job: JobDetail) {
  if (!job.planned_start) {
    return {
      allowed: true,
      needsConfirm: false,
      message: '',
    };
  }

  const planned = new Date(job.planned_start);

  if (Number.isNaN(planned.getTime())) {
    return {
      allowed: true,
      needsConfirm: false,
      message: '',
    };
  }

  const now = new Date();
  const earliest = new Date(planned.getTime() - 10 * 60 * 1000);

  if (now < earliest) {
    return {
      allowed: false,
      needsConfirm: false,
      message: `Dieser Einsatz ist für ${formatDate(job.planned_start)} geplant. Du kannst ihn frühestens 10 Minuten vorher starten.`,
    };
  }

  if (now < planned) {
    return {
      allowed: true,
      needsConfirm: true,
      message: `Der Einsatz ist für ${formatDate(job.planned_start)} geplant. Möchtest du ihn jetzt bereits starten?`,
    };
  }

  return {
    allowed: true,
    needsConfirm: false,
    message: '',
  };
}

function liveMinutesFromLog(log: JsonRecord | null) {
  if (!log?.started_at && !log?.start_time && !log?.clock_in_at) return 0;

  const startedAt = log.started_at || log.start_time || log.clock_in_at;
  const endedAt = log.ended_at || log.end_time || log.clock_out_at || log.finished_at;

  if (endedAt) return Number(log.duration_minutes || log.total_minutes || 0);

  const start = new Date(startedAt).getTime();

  if (Number.isNaN(start)) return 0;

  let activeBreakMinutes = 0;
  const breakStartedAt = getBreakStartedAt(log);

  if (breakStartedAt) {
    const breakStart = new Date(breakStartedAt).getTime();
    if (!Number.isNaN(breakStart)) {
      activeBreakMinutes = Math.max(0, Math.floor((Date.now() - breakStart) / 60000));
    }
  }

  return Math.max(
    0,
    Math.floor((Date.now() - start) / 60000) -
      getBreakMinutes(log) -
      activeBreakMinutes,
  );
}

function renderRequirements(value: any) {
  if (!value) return 'Keine Checkliste oder Hinweise hinterlegt.';

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return `• ${item}`;
        if (item?.label) return `• ${item.label}`;
        if (item?.title) return `• ${item.title}`;
        if (item?.name) return `• ${item.name}`;
        return `• ${JSON.stringify(item)}`;
      })
      .join('\n');
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value);
    if (!entries.length) return 'Keine Checkliste oder Hinweise hinterlegt.';

    return entries
      .map(([key, item]) => {
        if (typeof item === 'boolean') return `• ${key}: ${item ? 'Ja' : 'Nein'}`;
        if (typeof item === 'string' || typeof item === 'number') return `• ${key}: ${item}`;
        return `• ${key}: ${JSON.stringify(item)}`;
      })
      .join('\n');
  }

  return String(value);
}

function getJobVisualState(job: JobDetail | null, activeTimeLog: JsonRecord | null) {
  if (activeTimeLog) {
    return {
      key: 'active',
      label: 'Aktiv',
      color: '#16A34A',
      background: '#DCFCE7',
      border: '#86EFAC',
    };
  }

  const status = normalize(job?.status);

  if (['completed', 'approved', 'report_approved', 'sent_to_client', 'submitted'].includes(status)) {
    return {
      key: 'finished',
      label: 'Abgeschlossen',
      color: '#111827',
      background: '#F3F4F6',
      border: '#D1D5DB',
    };
  }

  if (['scheduled', 'assigned', 'confirmed', 'pending', 'draft', 'report_pending'].includes(status)) {
    return {
      key: 'planned',
      label: 'Geplant',
      color: '#F59E0B',
      background: '#FEF3C7',
      border: '#FDE68A',
    };
  }

  if (['cancelled', 'rejected', 'inactive'].includes(status)) {
    return {
      key: 'inactive',
      label: 'Inaktiv',
      color: '#DC2626',
      background: '#FEE2E2',
      border: '#FECACA',
    };
  }

  return {
    key: 'inactive',
    label: 'Inaktiv',
    color: '#DC2626',
    background: '#FEE2E2',
    border: '#FECACA',
  };
}

function canCompleteJob(job: JobDetail | null, activeTimeLog: JsonRecord | null) {
  if (!job) return false;

  const status = normalize(job.status);

  if (['completed', 'approved', 'report_approved', 'sent_to_client', 'cancelled', 'rejected'].includes(status)) {
    return false;
  }

  if (!job.planned_end) {
    return Boolean(activeTimeLog);
  }

  const end = new Date(job.planned_end).getTime();

  if (Number.isNaN(end)) {
    return Boolean(activeTimeLog);
  }

  const twentyMinutesBeforeEnd = end - 20 * 60 * 1000;

  return Date.now() >= twentyMinutesBeforeEnd;
}


function buildAssignmentPayloadVariants({
  jobId,
  employee,
  note,
  assignedByUserId,
  assignedByStaffId,
}: {
  jobId: string;
  employee: EmployeeOption;
  note?: string | null;
  assignedByUserId?: string | null;
  assignedByStaffId?: string | null;
}) {
  const now = new Date().toISOString();

  const employeeStaffId = employee.id;
  const employeeUserId = employee.user_id || null;
  const employeeExternalId = employee.employee_id || null;

  return [
    {
      job_id: jobId,
      employee_id: employeeExternalId || employeeStaffId,
      status: 'assigned',
      notes: note || null,
      assigned_by: assignedByStaffId || assignedByUserId || null,
      created_at: now,
      updated_at: now,
    },
    {
      job_id: jobId,
      staff_role_id: employeeStaffId,
      status: 'assigned',
      notes: note || null,
      assigned_by: assignedByStaffId || assignedByUserId || null,
      created_at: now,
      updated_at: now,
    },
    {
      job_id: jobId,
      staff_id: employeeStaffId,
      status: 'assigned',
      notes: note || null,
      assigned_by: assignedByStaffId || assignedByUserId || null,
      created_at: now,
      updated_at: now,
    },
    {
      job_id: jobId,
      user_id: employeeUserId,
      status: 'assigned',
      notes: note || null,
      assigned_by: assignedByStaffId || assignedByUserId || null,
      created_at: now,
      updated_at: now,
    },
    {
      job_id: jobId,
      assigned_to: employeeUserId || employeeExternalId || employeeStaffId,
      status: 'assigned',
      notes: note || null,
      assigned_by: assignedByStaffId || assignedByUserId || null,
      created_at: now,
      updated_at: now,
    },
    {
      job_id: jobId,
      employee_id: employeeExternalId || employeeStaffId,
      status: 'assigned',
      created_at: now,
    },
    {
      job_id: jobId,
      staff_role_id: employeeStaffId,
      status: 'assigned',
      created_at: now,
    },
    {
      job_id: jobId,
      user_id: employeeUserId,
      status: 'assigned',
      created_at: now,
    },
  ];
}

function buildMediaPayloadVariants({
  jobId,
  phase,
  file,
  publicUrl,
  bucketName,
  filePath,
  uploader,
  uploadedByUserId,
}: {
  jobId: string;
  phase: 'before' | 'after';
  file: File;
  publicUrl: string;
  bucketName: string;
  filePath: string;
  uploader?: string | null;
  uploadedByUserId?: string | null;
}) {
  const now = new Date().toISOString();
  const mediaType = phase === 'before' ? 'before_photo' : 'after_photo';

  return [
    {
      job_id: jobId,
      media_type: mediaType,
      file_url: publicUrl,
      storage_bucket: bucketName,
      storage_path: filePath,
      mime_type: file.type || null,
      file_size: file.size,
      uploaded_by: uploader || uploadedByUserId || null,
      uploaded_by_user_id: uploadedByUserId || null,
      created_at: now,
      updated_at: now,
    },
    {
      job_id: jobId,
      media_type: mediaType,
      public_url: publicUrl,
      storage_bucket: bucketName,
      storage_path: filePath,
      mime_type: file.type || null,
      size_bytes: file.size,
      uploaded_by_user_id: uploadedByUserId || null,
      created_at: now,
      updated_at: now,
    },
    {
      job_id: jobId,
      media_type: mediaType,
      file_url: publicUrl,
      storage_path: filePath,
      uploaded_by: uploader || uploadedByUserId || null,
      created_at: now,
    },
    {
      job_id: jobId,
      media_type: mediaType,
      media_url: publicUrl,
      file_path: filePath,
      content_type: file.type || null,
      size_bytes: file.size,
      created_at: now,
    },
    {
      job_id: jobId,
      media_type: mediaType,
      url: publicUrl,
      path: filePath,
      created_at: now,
    },
  ];
}

function buildClockInPayload({
  jobId,
  assignmentId,
  access,
  note,
}: {
  jobId: string;
  assignmentId?: string | null;
  access: AccessState;
  note?: string | null;
}) {
  const now = new Date().toISOString();

  return {
    job_id: jobId,
    assignment_id: assignmentId || null,
    employee_id: access.employeeId || access.staffId,
    employee_name: access.displayName || access.email || 'Mitarbeiter',
    started_at: now,
    status: 'draft',
    notes: appendManualNote('', note),
    metadata: {
      source: 'einsatz_detail',
      action: 'clock_in',
      user_id: access.userId,
      staff_role_id: access.staffId,
      employee_id: access.employeeId,
      break_minutes: 0,
      break_started_at: null,
      created_via: 'portal',
      timeline: [
        {
          action: 'clock_in',
          at: now,
          by: access.userId,
        },
      ],
    },
    created_at: now,
    updated_at: now,
  };
}

function getMediaUrl(item: JsonRecord) {
  return item.file_url || item.public_url || item.media_url || item.url || item.signed_url || '';
}

function getMediaPath(item: JsonRecord) {
  return String(item.storage_path || item.file_path || item.path || item.file_name || item.original_filename || '');
}

function isImageMedia(item: JsonRecord) {
  const mime = String(item.mime_type || item.content_type || item.file_type || '').toLowerCase();
  const path = getMediaPath(item).toLowerCase();
  const url = getMediaUrl(item).toLowerCase();

  return (
    mime.startsWith('image/') ||
    /\.(png|jpe?g|webp|gif|heic|heif|avif)(\?|$)/i.test(path) ||
    /\.(png|jpe?g|webp|gif|heic|heif|avif)(\?|$)/i.test(url)
  );
}

function isVideoMedia(item: JsonRecord) {
  const mime = String(item.mime_type || item.content_type || item.file_type || '').toLowerCase();
  const path = getMediaPath(item).toLowerCase();
  const url = getMediaUrl(item).toLowerCase();

  return (
    mime.startsWith('video/') ||
    /\.(mp4|mov|webm|m4v|avi)(\?|$)/i.test(path) ||
    /\.(mp4|mov|webm|m4v|avi)(\?|$)/i.test(url)
  );
}

function StatusBadge({ status }: { status?: string | null }) {
  const style = getStatusStyle(status);

  return (
    <span
      className="opc-status-badge"
      style={{ background: style.background, color: style.color, borderColor: style.border }}
    >
      {formatStatus(status)}
    </span>
  );
}

function HeroStatusDot({ state }: { state: ReturnType<typeof getJobVisualState> }) {
  return (
    <div
      className="opc-hero-status-dot"
      style={{
        background: state.background,
        borderColor: state.border,
      }}
      aria-label={state.label}
      title={state.label}
    >
      <span style={{ background: state.color }} />
    </div>
  );
}

function MetricCard({ label, value, helper, icon }: { label: string; value: ReactNode; helper?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="opc-metric-card">
      <div>
        <div className="opc-metric-value">{value}</div>
        <div className="opc-metric-label">{label}</div>
        {helper ? <div className="opc-metric-helper">{helper}</div> : null}
      </div>
      {icon ? <div className="opc-metric-icon">{icon}</div> : null}
    </div>
  );
}

function MiniField({ label, value }: { label: string; value: ReactNode }) {
  const hasValue =
    value !== null &&
    value !== undefined &&
    value !== '' &&
    !(Array.isArray(value) && value.length === 0);

  return (
    <div className="opc-mini-field">
      <span>{label}</span>
      <strong>{hasValue ? value : 'Nicht hinterlegt'}</strong>
    </div>
  );
}

function DetailCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="opc-detail-card">
      <h3>{title}</h3>
      <div className="opc-detail-card-body">{children}</div>
    </section>
  );
}

function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="opc-split-header">
      <h2>{title}</h2>
      {action}
    </div>
  );
}

function inputStyle(): CSSProperties {
  return {
    width: '100%',
    minHeight: 42,
    border: `1px solid ${BRAND.border}`,
    borderRadius: 14,
    padding: '10px 12px',
    fontSize: 14,
    fontWeight: 650,
    color: BRAND.text,
    outline: 'none',
    background: '#FFFFFF',
    fontFamily: pageFont,
    boxSizing: 'border-box',
  };
}

function ContactButtons({ person }: { person: JsonRecord | EmployeeOption }) {
  const phone = person.phone_e164 || person.phone_raw || person.employee_phone || person.phone || '';
  const email = person.email || person.employee_email || '';
  const whatsapp = person.whatsapp_wa_id || phone || '';

  return (
    <div className="opc-contact-buttons">
      {phone ? (
        <a href={`tel:${phone}`} className="opc-icon-button" title="Anrufen">
          <Phone size={15} />
        </a>
      ) : null}

      {email ? (
        <a href={`mailto:${email}`} className="opc-icon-button" title="E-Mail">
          <Mail size={15} />
        </a>
      ) : null}

      {whatsapp ? (
        <a
          href={`https://wa.me/${String(whatsapp).replace(/\D/g, '')}`}
          target="_blank"
          rel="noreferrer"
          className="opc-icon-button"
          title="WhatsApp"
        >
          <MessageCircle size={15} />
        </a>
      ) : null}
    </div>
  );
}

export default function EinsatzDetailPage({ jobId }: EinsatzDetailPageProps) {
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [databaseError, setDatabaseError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [employeesLoaded, setEmployeesLoaded] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [assignmentNote, setAssignmentNote] = useState('');
  const [actionNoteDraft, setActionNoteDraft] = useState('');
  const [internalNoteDraft, setInternalNoteDraft] = useState('');
  const [clientNoteDraft, setClientNoteDraft] = useState('');
  const [uploadingPhase, setUploadingPhase] = useState<'before' | 'after' | null>(null);
  const [showAllNotes, setShowAllNotes] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [startConfirmOpen, setStartConfirmOpen] = useState(false);
  const [pendingClockIn, setPendingClockIn] = useState(false);
  const [tick, setTick] = useState(0);

  const detailStripRef = useRef<HTMLDivElement | null>(null);

  const [access, setAccess] = useState<AccessState>({
    loading: true,
    userId: null,
    staffId: null,
    employeeId: null,
    email: null,
    displayName: null,
    role: null,
    canEdit: false,
    isAssigned: false,
  });

  const assignments = useMemo(() => asArray(job?.assignments), [job]);
  const timeLogs = useMemo(() => asArray(job?.time_logs), [job]);
  const media = useMemo(() => asArray(job?.media), [job]);
  const damageReports = useMemo(() => asArray(job?.damage_reports), [job]);
  const report = job?.report || null;

  const employeeMode = isEmployeeRole(access.role) && !access.canEdit;
  const clientMode = isClientRole(access.role);
  const canWriteClientNotes = isOwnerOrAdminRole(access.role);
  const canSeeAllJobTimes = isOwnerOrAdminRole(access.role);

  const beforeMedia = useMemo(
    () =>
      media.filter((item) => {
        const phase = String(
          item.media_type || item.media_phase || item.photo_kind || item.section || item.phase || '',
        ).toLowerCase();

        return phase === 'before_photo' || phase.includes('before') || phase.includes('vorher');
      }),
    [media],
  );

  const afterMedia = useMemo(
    () =>
      media.filter((item) => {
        const phase = String(
          item.media_type || item.media_phase || item.photo_kind || item.section || item.phase || '',
        ).toLowerCase();

        return phase === 'after_photo' || phase.includes('after') || phase.includes('nachher');
      }),
    [media],
  );

  const otherMedia = useMemo(
    () =>
      media.filter((item) => {
        const phase = String(
          item.media_type || item.media_phase || item.photo_kind || item.section || item.phase || '',
        ).toLowerCase();

        return (
          phase !== 'before_photo' &&
          phase !== 'after_photo' &&
          !phase.includes('before') &&
          !phase.includes('vorher') &&
          !phase.includes('after') &&
          !phase.includes('nachher')
        );
      }),
    [media],
  );

  const visibleTimeLogs = useMemo(() => {
    if (clientMode) return [];
    if (canSeeAllJobTimes) return timeLogs;
    return timeLogs.filter((log) => isOwnTimeLog(log, access));
  }, [access, canSeeAllJobTimes, clientMode, timeLogs]);

  const activeTimeLog = useMemo(() => {
    return (
      timeLogs.find((log) => {
        return isOpenLog(log) && isOwnTimeLog(log, access);
      }) || null
    );
  }, [access, timeLogs]);

  const ownAssignment = useMemo(() => (job ? getPrimaryAssignee(job, access) : null), [job, access]);
  const ownAssignmentId = ownAssignment?.id || ownAssignment?.assignment_id || null;
  const isJobOnBreak = Boolean(getBreakStartedAt(activeTimeLog));
  const showCompleteButton = canCompleteJob(job, activeTimeLog);
  const heroState = getJobVisualState(job, activeTimeLog);

  const allNotes = useMemo<NoteRow[]>(() => {
    if (!job) return [];

    const rows: NoteRow[] = [];

    if (!clientMode && access.canEdit && job.internal_notes) {
      rows.push({
        key: 'internal',
        title: 'Interne Notizen',
        body: job.internal_notes,
        visibility: 'internal',
      });
    }

    if (!clientMode && access.canEdit && job.dispatcher_notes) {
      rows.push({
        key: 'dispatcher',
        title: 'Dispo-Notizen',
        body: job.dispatcher_notes,
        visibility: 'internal',
      });
    }

    if (!clientMode && access.canEdit && job.employee_notes) {
      rows.push({
        key: 'employee',
        title: 'Mitarbeiter-Notizen',
        body: job.employee_notes,
        visibility: 'internal',
      });
    }

    if (job.client_notes) {
      rows.push({
        key: 'client',
        title: 'Kunden-Notizen',
        body: job.client_notes,
        visibility: 'client',
      });
    }

    if (!clientMode) {
      visibleTimeLogs.forEach((log, index) => {
        const manualNote = extractManualActionNotes(log.notes || log.employee_note || log.note);

        if (manualNote) {
          rows.push({
            key: `time-log-${log.id || index}`,
            title: `Aktionsnotiz${log.employee_name ? ` · ${log.employee_name}` : ''}`,
            body: manualNote,
            visibility: 'action',
          });
        }
      });
    }

    if (!clientMode && access.canEdit) {
      damageReports.forEach((damage, index) => {
        const note = damage.description || damage.notes;

        if (note) {
          rows.push({
            key: `damage-${damage.id || index}`,
            title: damage.title || damage.damage_type || 'Schaden / Problem',
            body: String(note),
            visibility: 'system',
          });
        }
      });
    }

    return rows;
  }, [access.canEdit, clientMode, damageReports, job, visibleTimeLogs]);

  const visibleNotes = useMemo(() => {
    if (clientMode) return allNotes.filter((note) => note.visibility === 'client');
    return allNotes;
  }, [allNotes, clientMode]);

  const filteredEmployees = useMemo(() => {
    const search = employeeSearch.trim().toLowerCase();
    const assignedIds = new Set(
      assignments
        .map((assignment) => String(getAssignmentEmployeeId(assignment) || ''))
        .filter(Boolean),
    );

    return employees
      .filter((employee) => {
        const values = [
          employee.display_name,
          employee.email,
          employee.phone_e164,
          employee.phone_raw,
          employee.role,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return !search || values.includes(search);
      })
      .map((employee) => ({
        ...employee,
        alreadyAssigned:
          assignedIds.has(String(employee.id)) ||
          (employee.user_id ? assignedIds.has(String(employee.user_id)) : false) ||
          (employee.employee_id ? assignedIds.has(String(employee.employee_id)) : false),
      }));
  }, [assignments, employeeSearch, employees]);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((current) => current + 1), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const scrollDetailStrip = (direction: 'left' | 'right') => {
    const node = detailStripRef.current;
    if (!node) return;

    const amount = Math.max(300, Math.round(node.clientWidth * 0.8));
    node.scrollBy({ left: direction === 'right' ? amount : -amount, behavior: 'smooth' });
  };

  const makeEditDraft = useCallback((source: JobDetail): EditDraft => {
    return {
      title: source.title || '',
      service_category: source.service_category || '',
      service_description: source.service_description || '',
      status: source.status || 'scheduled',
      priority: source.priority || 'normal',
      planned_start: toDateTimeLocal(source.planned_start),
      planned_end: toDateTimeLocal(source.planned_end),
      estimated_hours:
        source.estimated_hours !== null && source.estimated_hours !== undefined
          ? String(source.estimated_hours)
          : '',
      final_hours:
        source.final_hours !== null && source.final_hours !== undefined ? String(source.final_hours) : '',
      billable_amount:
        source.billable_amount !== null && source.billable_amount !== undefined
          ? String(source.billable_amount)
          : '',
      dispatcher_notes: source.dispatcher_notes || '',
      employee_notes: source.employee_notes || '',
      client_notes: source.client_notes || '',
      internal_notes: source.internal_notes || '',
    };
  }, []);

  const getAccessForJob = useCallback(async (sourceJob: JobDetail): Promise<AccessState> => {
    const fallback: AccessState = {
      loading: false,
      userId: null,
      staffId: null,
      employeeId: null,
      email: null,
      displayName: null,
      role: null,
      canEdit: false,
      isAssigned: false,
    };

    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user || null;

    if (!user) return fallback;

    let profileRole = '';

    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role,opc_staff_role,staff_role')
        .eq('id', user.id)
        .maybeSingle();

      profileRole = String(profile?.role || profile?.opc_staff_role || profile?.staff_role || '').toLowerCase();
    } catch {
      profileRole = '';
    }

    const metadataRole = String(
      user.user_metadata?.role || user.app_metadata?.role || user.user_metadata?.portal_role || '',
    ).toLowerCase();

    let staffRow: JsonRecord | null = null;

    try {
      const { data, error } = await supabase
        .from('opc_staff_roles')
        .select('id,user_id,employee_id,role,status,can_manage_jobs,can_view_all_jobs,email,display_name')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!error && Array.isArray(data) && data.length > 0) {
        staffRow = data[0] as JsonRecord;
      }
    } catch {
      staffRow = null;
    }

    if (!staffRow && user.email) {
      try {
        const { data, error } = await supabase
          .from('opc_staff_roles')
          .select('id,user_id,employee_id,role,status,can_manage_jobs,can_view_all_jobs,email,display_name')
          .ilike('email', String(user.email))
          .order('created_at', { ascending: false })
          .limit(1);

        if (!error && Array.isArray(data) && data.length > 0) {
          staffRow = data[0] as JsonRecord;
        }
      } catch {
        staffRow = null;
      }
    }

    const role = String(staffRow?.role || profileRole || metadataRole || '').toLowerCase();
    const staffId = staffRow?.id ? String(staffRow.id) : null;
    const employeeId = staffRow?.employee_id ? String(staffRow.employee_id) : null;

    const assignedIds = asArray(sourceJob.assignments).map((assignment) =>
      String(getAssignmentEmployeeId(assignment) || ''),
    );

    const ownIds = [staffId, user.id, employeeId].filter(Boolean).map(String);
    const isAssigned = ownIds.some((id) => assignedIds.includes(id));

    const canEdit =
      isManagerRole(role) ||
      staffRow?.can_manage_jobs === true ||
      staffRow?.can_view_all_jobs === true;

    return {
      loading: false,
      userId: user.id,
      staffId,
      employeeId,
      email: user.email || (staffRow?.email ? String(staffRow.email) : null),
      displayName:
        (staffRow?.display_name ? String(staffRow.display_name) : null) ||
        user.user_metadata?.display_name ||
        user.user_metadata?.full_name ||
        user.email ||
        null,
      role: role || null,
      canEdit,
      isAssigned,
    };
  }, []);

  const loadJob = useCallback(
    async (showLoader = true) => {
      if (!jobId) {
        setDatabaseError('Keine Einsatz-ID vorhanden.');
        setLoading(false);
        return;
      }

      if (showLoader) setLoading(true);
      setDatabaseError(null);

      try {
        const { data, error } = await supabase
          .from('opc_job_detail_view')
          .select('*')
          .eq('job_id', jobId)
          .single();

        if (error) {
          throw new Error(`Database error: ${error.message}`);
        }

        const loadedJob = data as JobDetail;
        setJob(loadedJob);
        setEditDraft(makeEditDraft(loadedJob));

        const accessState = await getAccessForJob(loadedJob);
        setAccess(accessState);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Einsatz konnte nicht geladen werden.';
        setDatabaseError(message);
        setJob(null);
        setAccess((current) => ({ ...current, loading: false }));
      } finally {
        if (showLoader) setLoading(false);
      }
    },
    [getAccessForJob, jobId, makeEditDraft],
  );

  useEffect(() => {
    void loadJob(true);
  }, [loadJob]);

  const loadEmployees = useCallback(async () => {
    if (employeesLoaded || !access.canEdit) return;

    try {
      const queries = [
        supabase
          .from('opc_staff_roles')
          .select('id,user_id,employee_id,display_name,email,phone_e164,phone_raw,whatsapp_wa_id,role,status')
          .in('status', ['active', 'aktiv'])
          .order('display_name', { ascending: true }),

        supabase
          .from('opc_staff_roles')
          .select('id,user_id,employee_id,display_name,email,phone_e164,phone_raw,whatsapp_wa_id,role,status')
          .order('display_name', { ascending: true }),
      ];

      for (const query of queries) {
        const { data, error } = await query;

        if (!error && Array.isArray(data)) {
          const employeeRows = (data as EmployeeOption[]).filter((employee) => {
            const role = normalize(employee.role);
            const status = normalize(employee.status);

            const isEmployee =
              role === 'employee' ||
              role === 'mitarbeiter' ||
              role === 'cleaner' ||
              role === 'reinigung' ||
              role === '';

            const isActive =
              !status ||
              status === 'active' ||
              status === 'aktiv' ||
              status === 'enabled';

            return employee.id && isActive && isEmployee;
          });

          setEmployees(employeeRows);
          setEmployeesLoaded(true);
          return;
        }
      }

      setEmployees([]);
      setEmployeesLoaded(true);
    } catch {
      setEmployees([]);
      setEmployeesLoaded(true);
    }
  }, [access.canEdit, employeesLoaded]);

  useEffect(() => {
    if (editMode || assignModalOpen) {
      void loadEmployees();
    }
  }, [assignModalOpen, editMode, loadEmployees]);

  const updateDraft = (field: keyof EditDraft, value: string) => {
    setEditDraft((current) => (current ? { ...current, [field]: value } : current));
  };

  async function updateJobRecord(payload: JsonRecord) {
    if (!job) return;
    await tryUpdateJobById(job.job_id, payload);
  }

  async function runJobAction(action: string, callback: () => Promise<void>) {
    setActionLoading(action);
    setActionError(null);
    setActionMessage(null);

    try {
      await callback();
      await loadJob(false);
    } catch (error: any) {
      setActionError(error?.message || 'Aktion konnte nicht ausgeführt werden.');
    } finally {
      setActionLoading(null);
    }
  }

  const handleSaveJob = async () => {
    if (!job || !editDraft || !access.canEdit) return;

    setSaving(true);
    setActionMessage(null);
    setActionError(null);

    const payload: JsonRecord = {
      title: cleanNullable(editDraft.title),
      service_category: cleanNullable(editDraft.service_category),
      service_description: cleanNullable(editDraft.service_description),
      status: cleanNullable(editDraft.status),
      priority: cleanNullable(editDraft.priority),
      planned_start: fromDateTimeLocal(editDraft.planned_start),
      planned_end: fromDateTimeLocal(editDraft.planned_end),
      estimated_hours: cleanNumber(editDraft.estimated_hours),
      final_hours: cleanNumber(editDraft.final_hours),
      billable_amount: cleanNumber(editDraft.billable_amount),
      dispatcher_notes: cleanNullable(editDraft.dispatcher_notes),
      employee_notes: cleanNullable(editDraft.employee_notes),
      client_notes: cleanNullable(editDraft.client_notes),
      internal_notes: cleanNullable(editDraft.internal_notes),
    };

    try {
      await updateJobRecord(payload);

      setJob((current) =>
        current
          ? {
              ...current,
              ...payload,
              planned_start: payload.planned_start ?? current.planned_start,
              planned_end: payload.planned_end ?? current.planned_end,
            }
          : current,
      );
      setEditMode(false);
      await loadJob(false);
      setActionMessage('Einsatz wurde gespeichert.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Einsatz konnte nicht gespeichert werden.';
      setActionError(`Speichern fehlgeschlagen: ${message}`);
    } finally {
      setSaving(false);
    }
  };

  const syncAssignmentToCalendar = async (employee: EmployeeOption, assignmentId?: string | null) => {
    if (!job || !job.planned_start) return;

    const title = job.title || `${job.service_category || 'Einsatz'} · ${getDisplayName(job)}`;
    const start = job.planned_start;
    const end =
      job.planned_end ||
      new Date(
        new Date(job.planned_start).getTime() + Number(job.estimated_hours || 2) * 60 * 60 * 1000,
      ).toISOString();

    const location = joinAddress(job);
    const description = [
      `Kunde: ${getDisplayName(job)}`,
      job.service_category ? `Service: ${job.service_category}` : '',
      job.service_description ? `Beschreibung: ${job.service_description}` : '',
      assignmentNote.trim() ? `Zuweisungsnotiz: ${assignmentNote.trim()}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const apiPayload = {
      job_id: job.job_id,
      assignment_id: assignmentId || null,
      employee_staff_role_id: employee.id,
      employee_user_id: employee.user_id || null,
      title,
      start_time: start,
      end_time: end,
      location,
      description,
    };

    const endpointCandidates = [
      `${baseUrl}/api/opc/calendar/sync-job-assignment`,
      `${baseUrl}/api/opc/calendar/create-job-event`,
      `${baseUrl}/api/opc/google-calendar/sync-job`,
    ];

    for (const endpoint of endpointCandidates) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(apiPayload),
        });

        if (response.ok) return;
      } catch {
        // Calendar sync is best effort.
      }
    }
  };

  const handleAddAssignment = async (employeeId = selectedEmployeeId) => {
    if (!job || !employeeId || !access.canEdit) return;

    const selected = employees.find((employee) => employee.id === employeeId);
    if (!selected) return;

    setSaving(true);
    setActionMessage(null);
    setActionError(null);

    try {
      const variants = buildAssignmentPayloadVariants({
        jobId: job.job_id,
        employee: selected,
        note: cleanNullable(assignmentNote),
        assignedByUserId: access.userId,
        assignedByStaffId: access.staffId,
      });

      const inserted = await tryInsertOne('opc_job_assignments', variants);
      const insertedAssignmentId = inserted.data?.id || inserted.data?.assignment_id || null;

      try {
        await tryUpdateJobById(job.job_id, {
          status: 'assigned',
        });
      } catch {
        // Assignment exists. Status fallback must not block the user.
      }

      void syncAssignmentToCalendar(selected, insertedAssignmentId).catch(() => undefined);

      setSelectedEmployeeId('');
      setAssignmentNote('');
      setAssignModalOpen(false);
      setEmployeeSearch('');
      await loadJob(false);
      setActionMessage('Mitarbeiter wurde zugewiesen. Kalender-Sync wurde ausgelöst.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Zuweisung konnte nicht erstellt werden.';
      setActionError(`Zuweisung fehlgeschlagen: ${message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleInternalNote = async () => {
    if (!job || !internalNoteDraft.trim()) return;

    setSaving(true);
    setActionMessage(null);
    setActionError(null);

    const author = access.displayName || access.email || 'Mitarbeiter';
    const stamp = new Intl.DateTimeFormat('de-CH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date());

    const nextNotes = [job.internal_notes, `[${stamp}] ${author}: ${internalNoteDraft.trim()}`]
      .filter(Boolean)
      .join('\n\n');

    try {
      await updateJobRecord({ internal_notes: nextNotes });

      setInternalNoteDraft('');
      await loadJob(false);
      setActionMessage('Interne Notiz wurde gespeichert.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Interne Notiz konnte nicht gespeichert werden.';
      setActionError(`Notiz fehlgeschlagen: ${message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleClientNote = async () => {
    if (!job || !clientNoteDraft.trim() || !canWriteClientNotes) return;

    setSaving(true);
    setActionMessage(null);
    setActionError(null);

    const author = access.displayName || access.email || 'Admin';
    const stamp = new Intl.DateTimeFormat('de-CH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date());

    const nextNotes = [job.client_notes, `[${stamp}] ${author}: ${clientNoteDraft.trim()}`]
      .filter(Boolean)
      .join('\n\n');

    try {
      await updateJobRecord({ client_notes: nextNotes });

      setClientNoteDraft('');
      await loadJob(false);
      setActionMessage('Kunden-Notiz wurde gespeichert.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Kunden-Notiz konnte nicht gespeichert werden.';
      setActionError(`Kunden-Notiz fehlgeschlagen: ${message}`);
    } finally {
      setSaving(false);
    }
  };

  const performClockIn = async () => {
    if (!job) return;

    await runJobAction('clock_in', async () => {
      const payload = buildClockInPayload({
        jobId: job.job_id,
        assignmentId: ownAssignmentId,
        access,
        note: actionNoteDraft.trim() || null,
      });

      await tryInsertOne('opc_job_time_logs', [payload]);

      try {
        await updateJobRecord({
          status: 'in_progress',
          actual_start: job.actual_start || new Date().toISOString(),
        });
      } catch {
        // Job status update is best effort.
      }

      setActionNoteDraft('');
      setActionMessage('Einsatz gestartet.');
      setPendingClockIn(false);
      setStartConfirmOpen(false);
    });
  };

  const handleClockIn = async () => {
    if (!job) {
      setActionError('Einsatz konnte nicht geladen werden.');
      return;
    }

    const gate = plannedStartGate(job);

    if (!gate.allowed) {
      setActionError(gate.message);
      return;
    }

    if (gate.needsConfirm) {
      setPendingClockIn(true);
      setStartConfirmOpen(true);
      setActionMessage(gate.message);
      return;
    }

    await performClockIn();
  };

  const handleClockOut = async () => {
    if (!activeTimeLog || !job) {
      setActionError('Kein aktiver Einsatz-Zeitlog gefunden.');
      return;
    }

    await runJobAction('clock_out', async () => {
      const logId = activeTimeLog.id || activeTimeLog.time_log_id;
      const now = new Date().toISOString();
      const metadata = safeMetadata(activeTimeLog.metadata);
      const noteText = actionNoteDraft.trim() || null;
      const nextNotes = appendManualNote(activeTimeLog.notes, noteText);

      await tryUpdateOne('opc_job_time_logs', 'id', String(logId), [
        {
          ended_at: now,
          duration_minutes: liveMinutesFromLog(activeTimeLog),
          status: 'submitted',
          notes: nextNotes,
          metadata: {
            ...metadata,
            break_started_at: null,
            last_action: 'clock_out',
            submitted_at: now,
            submitted_by: access.userId,
            timeline: [
              ...asArray(metadata.timeline),
              {
                action: 'clock_out',
                at: now,
                by: access.userId,
              },
            ],
          },
          updated_at: now,
        },
      ]);

      try {
        await updateJobRecord({
          status: 'submitted',
          actual_end: now,
        });
      } catch {
        // Job status update is best effort.
      }

      setActionNoteDraft('');
      setActionMessage('Ausgestempelt und eingereicht.');
    });
  };

  const handleCompleteJob = async () => {
    if (!job) {
      setActionError('Einsatz konnte nicht geladen werden.');
      return;
    }

    if (!canCompleteJob(job, activeTimeLog)) {
      setActionError('Dieser Auftrag kann frühestens 20 Minuten vor der geplanten Endzeit abgeschlossen werden.');
      return;
    }

    await runJobAction('complete_job', async () => {
      const now = new Date().toISOString();

      if (activeTimeLog) {
        const logId = activeTimeLog.id || activeTimeLog.time_log_id;
        const metadata = safeMetadata(activeTimeLog.metadata);
        const noteText = actionNoteDraft.trim() || null;
        const nextNotes = appendManualNote(activeTimeLog.notes, noteText);

        await tryUpdateOne('opc_job_time_logs', 'id', String(logId), [
          {
            ended_at: now,
            duration_minutes: liveMinutesFromLog(activeTimeLog),
            status: 'completed',
            notes: nextNotes,
            metadata: {
              ...metadata,
              break_started_at: null,
              last_action: 'complete_job',
              completed_at: now,
              completed_by: access.userId,
              submitted_at: now,
              submitted_by: access.userId,
              timeline: [
                ...asArray(metadata.timeline),
                {
                  action: 'complete_job',
                  at: now,
                  by: access.userId,
                },
              ],
            },
            updated_at: now,
          },
        ]);
      }

      await updateJobRecord({
        status: 'completed',
        actual_end: now,
      });

      setJob((current) =>
        current
          ? {
              ...current,
              status: 'completed',
              actual_end: now,
            }
          : current,
      );

      try {
        await supabase
          .from('opc_job_assignments')
          .update({
            status: 'completed',
            confirmed_at: now,
            updated_at: now,
          })
          .eq('job_id', job.job_id);
      } catch {
        // Assignment status update is best effort.
      }
      setActionNoteDraft('');
      setActionMessage('Auftrag wurde abgeschlossen.');
    });
  };

  const handleStartJobBreak = async () => {
    if (!activeTimeLog) {
      setActionError('Kein aktiver Einsatz-Zeitlog gefunden.');
      return;
    }

    if (getBreakStartedAt(activeTimeLog)) {
      setActionMessage('Pause läuft bereits.');
      return;
    }

    await runJobAction('break_start', async () => {
      const logId = activeTimeLog.id || activeTimeLog.time_log_id;
      const now = new Date().toISOString();
      const metadata = safeMetadata(activeTimeLog.metadata);
      const noteText = actionNoteDraft.trim() || null;
      const nextNotes = appendManualNote(activeTimeLog.notes, noteText);

      await tryUpdateOne('opc_job_time_logs', 'id', String(logId), [
        {
          status: 'draft',
          notes: nextNotes,
          metadata: {
            ...metadata,
            break_started_at: now,
            last_action: 'break_start',
            break_started_by: access.userId,
            timeline: [
              ...asArray(metadata.timeline),
              {
                action: 'break_start',
                at: now,
                by: access.userId,
              },
            ],
          },
          updated_at: now,
        },
      ]);

      setActionNoteDraft('');
      setActionMessage('Pause gestartet.');
    });
  };

  const handleEndJobBreak = async () => {
    if (!activeTimeLog) {
      setActionError('Kein aktiver Einsatz-Zeitlog gefunden.');
      return;
    }

    const breakStartedAt = getBreakStartedAt(activeTimeLog);

    if (!breakStartedAt) {
      setActionMessage('Es läuft aktuell keine Pause.');
      return;
    }

    await runJobAction('break_end', async () => {
      const logId = activeTimeLog.id || activeTimeLog.time_log_id;
      const now = new Date().toISOString();
      const metadata = safeMetadata(activeTimeLog.metadata);
      const started = new Date(breakStartedAt).getTime();
      const additionalBreakMinutes = Number.isNaN(started)
        ? 0
        : Math.max(0, Math.floor((Date.now() - started) / 60000));
      const nextBreakMinutes = getBreakMinutes(activeTimeLog) + additionalBreakMinutes;
      const noteText = actionNoteDraft.trim() || null;
      const nextNotes = appendManualNote(activeTimeLog.notes, noteText);

      await tryUpdateOne('opc_job_time_logs', 'id', String(logId), [
        {
          status: 'draft',
          notes: nextNotes,
          metadata: {
            ...metadata,
            break_started_at: null,
            break_minutes: nextBreakMinutes,
            last_action: 'break_end',
            break_ended_by: access.userId,
            break_ended_at: now,
            timeline: [
              ...asArray(metadata.timeline),
              {
                action: 'break_end',
                at: now,
                by: access.userId,
              },
            ],
          },
          updated_at: now,
        },
      ]);

      setActionNoteDraft('');
      setActionMessage('Pause beendet.');
    });
  };

  const handleUploadMedia = async (phase: 'before' | 'after', event: ChangeEvent<HTMLInputElement>) => {
    if (!job) return;

    const files = Array.from(event.target.files || []);
    event.target.value = '';

    if (!files.length) return;

    setUploadingPhase(phase);
    setActionMessage(null);
    setActionError(null);

    const uploader = access.staffId || access.userId;
    const authFolder = access.userId || 'unknown-user';
    const bucketName = 'opc-job-media';

    try {
      for (const file of files) {
        const timestamp = Date.now();
        const cleanedName = safeFileName(file.name);
        const filePath = `${authFolder}/jobs/${job.job_id}/${phase}/${timestamp}-${cleanedName}`;

        const upload = await supabase.storage.from(bucketName).upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || undefined,
        });

        if (upload.error) {
          throw new Error(`Storage-Upload blockiert. Bucket: ${bucketName}. Fehler: ${upload.error.message}`);
        }

        const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);
        const publicUrl = publicUrlData.publicUrl;

        const variants = buildMediaPayloadVariants({
          jobId: job.job_id,
          phase,
          file,
          publicUrl,
          bucketName,
          filePath,
          uploader,
          uploadedByUserId: access.userId,
        });

        await tryInsertOne('opc_job_media', variants);
      }

      await loadJob(false);
      setActionMessage(phase === 'before' ? 'Vorher-Medien hochgeladen.' : 'Nachher-Medien hochgeladen.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload fehlgeschlagen.';
      setActionError(`Upload fehlgeschlagen: ${message}`);
    } finally {
      setUploadingPhase(null);
    }
  };

  const renderMediaList = (items: JsonArray, emptyText: string) => {
    if (!items.length) {
      return <div className="opc-empty-box">{emptyText}</div>;
    }

    return (
      <div className="opc-media-grid">
        {items.map((item, index) => {
          const url = getMediaUrl(item);
          const label =
            item.media_type ||
            item.file_type ||
            item.photo_kind ||
            item.media_phase ||
            item.section ||
            'Datei';
          const name =
            item.file_name ||
            item.original_filename ||
            item.storage_path ||
            item.file_path ||
            item.path ||
            'Öffnen';

          return (
            <a
              key={item.id || item.media_id || item.storage_path || item.file_path || index}
              className="opc-media-item"
              href={url || '#'}
              target="_blank"
              rel="noreferrer"
            >
              <div className="opc-media-preview">
                {url && isImageMedia(item) ? (
                  <img src={url} alt={String(name)} loading="lazy" />
                ) : url && isVideoMedia(item) ? (
                  <video src={url} muted playsInline preload="metadata" />
                ) : (
                  <div className="opc-media-placeholder">{String(label).slice(0, 2).toUpperCase()}</div>
                )}
              </div>

              <div className="opc-media-copy">
                <span>{formatStatus(String(label))}</span>
                <strong>{String(name)}</strong>
              </div>
            </a>
          );
        })}
      </div>
    );
  };

  const renderAssignedEmployees = () => (
    <section className="opc-section-card" style={cardStyle}>
      <SectionHeader title="Zugewiesene Mitarbeiter" />

      {assignments.length === 0 ? (
        <div className="opc-empty-box">Keine Mitarbeiter zugewiesen.</div>
      ) : (
        <div className="opc-assignment-list">
          {assignments.map((assignment, index) => (
            <div key={assignment.id || assignment.assignment_id || index} className="opc-assignment-card">
              <div>
                <strong>{assignment.employee_name || assignment.display_name || assignment.email || 'Mitarbeiter'}</strong>
                <span>{assignment.phone_e164 || assignment.email || 'Kontakt nicht hinterlegt'}</span>
              </div>

              <div className="opc-assignment-actions">
                <StatusBadge status={assignment.assignment_status || assignment.status || 'assigned'} />
                <ContactButtons person={assignment} />
              </div>
            </div>
          ))}
        </div>
      )}

      {access.canEdit ? (
        <div className="opc-admin-box opc-admin-box-compact">
          <button
            type="button"
            className="opc-btn opc-btn-dark opc-full-btn"
            disabled={saving}
            onClick={() => {
              setAssignModalOpen(true);
              void loadEmployees();
            }}
          >
            + Mitarbeiter zuweisen
          </button>
        </div>
      ) : null}
    </section>
  );

  const renderJobTimeActionCard = () => {
    if (clientMode) return null;

    const showAction = access.canEdit || access.isAssigned || employeeMode;

    if (!showAction) return null;

    return (
      <section className="opc-time-action-card" style={cardStyle}>
        <div className="opc-time-card-header">Zeit erfassen</div>

        <div className="opc-time-card-body">
          <label className="opc-note-label">
            Aktionsnotiz
            <textarea
              style={{ ...inputStyle(), minHeight: 92, resize: 'vertical' }}
              placeholder={
                activeTimeLog
                  ? 'Optional. Beispiel: Abschnitt abgeschlossen, Material aufgefüllt.'
                  : 'Optional. Beispiel: Vor Ort angekommen, Material vorbereitet.'
              }
              value={actionNoteDraft}
              onChange={(event) => setActionNoteDraft(event.target.value)}
            />
          </label>

          <div className="opc-time-media-row">
            <label className="opc-time-upload-button">
              {uploadingPhase === 'before' ? 'Lädt...' : 'Vorher Foto/Video'}
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                disabled={uploadingPhase !== null}
                onChange={(event) => void handleUploadMedia('before', event)}
              />
            </label>

            <label className="opc-time-upload-button">
              {uploadingPhase === 'after' ? 'Lädt...' : 'Nachher Foto/Video'}
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                disabled={uploadingPhase !== null}
                onChange={(event) => void handleUploadMedia('after', event)}
              />
            </label>
          </div>

          <div className="opc-time-action-buttons">
            {!activeTimeLog ? (
              <button
                type="button"
                onClick={() => void handleClockIn()}
                disabled={Boolean(actionLoading)}
                className="opc-time-black-button"
              >
                {actionLoading === 'clock_in' ? <Loader2 size={17} className="spin" /> : <LogIn size={17} />}
                Einstempeln
              </button>
            ) : null}

            {activeTimeLog && !isJobOnBreak ? (
              <button
                type="button"
                onClick={() => void handleStartJobBreak()}
                disabled={Boolean(actionLoading)}
                className="opc-time-secondary-button"
              >
                {actionLoading === 'break_start' ? <Loader2 size={17} className="spin" /> : <Coffee size={17} />}
                Pause starten
              </button>
            ) : null}

            {activeTimeLog && isJobOnBreak ? (
              <button
                type="button"
                onClick={() => void handleEndJobBreak()}
                disabled={Boolean(actionLoading)}
                className="opc-time-secondary-button"
              >
                {actionLoading === 'break_end' ? <Loader2 size={17} className="spin" /> : <Coffee size={17} />}
                Pause beenden
              </button>
            ) : null}

            {showCompleteButton ? (
              <button
                type="button"
                onClick={() => void handleCompleteJob()}
                disabled={Boolean(actionLoading)}
                className="opc-time-complete-button"
              >
                {actionLoading === 'complete_job' ? <Loader2 size={17} className="spin" /> : <CheckCircle2 size={17} />}
                Auftrag abgeschlossen
              </button>
            ) : null}

            {activeTimeLog && !showCompleteButton ? (
              <button
                type="button"
                onClick={() => void handleClockOut()}
                disabled={Boolean(actionLoading)}
                className="opc-time-danger-button"
              >
                {actionLoading === 'clock_out' ? <Loader2 size={17} className="spin" /> : <LogOut size={17} />}
                Ausstempeln
              </button>
            ) : null}
          </div>
        </div>
      </section>
    );
  };

  const renderTimeEntriesCard = () => {
    if (clientMode) return null;

    return (
      <section className="opc-section-card" style={cardStyle}>
        <SectionHeader title="Zeiterfassung" />

        {visibleTimeLogs.length === 0 ? (
          <div className="opc-empty-box">Keine sichtbaren Zeiten vorhanden.</div>
        ) : (
          <>
            <div className="opc-time-table opc-time-table-desktop">
              {visibleTimeLogs.map((log, index) => {
                const isActive = isOpenLog(log);
                const total = isActive ? liveMinutesFromLog(log) : Number(log.duration_minutes || 0);
                const onBreak = Boolean(getBreakStartedAt(log));

                return (
                  <div
                    key={log.id || index}
                    className="opc-time-row"
                    style={{ borderBottom: index < visibleTimeLogs.length - 1 ? '1px solid #F3F4F6' : 'none' }}
                  >
                    <div>
                      <div className="opc-row-title">{log.employee_name || 'Mitarbeiter'}</div>
                      <div className="opc-row-sub">{formatShortDate(log.started_at || log.created_at)}</div>
                    </div>

                    <div className="opc-date-cell">{formatTime(log.started_at)}</div>
                    <div className="opc-date-cell">{formatTime(log.ended_at)}</div>
                    <div className="opc-date-cell">{formatMinutes(getBreakMinutes(log))}</div>
                    <div className="opc-date-cell">{formatMinutes(total)}</div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <StatusBadge status={onBreak ? 'on_break' : isActive ? 'open' : log.status} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="opc-time-mobile-cards">
              {visibleTimeLogs.map((log) => {
                const isActive = isOpenLog(log);
                const total = isActive ? liveMinutesFromLog(log) : Number(log.duration_minutes || 0);
                const onBreak = Boolean(getBreakStartedAt(log));

                return (
                  <div key={log.id} className="opc-mobile-card">
                    <div className="opc-mobile-card-top">
                      <div>
                        <h3>{log.employee_name || 'Mitarbeiter'}</h3>
                        <p>{formatShortDate(log.started_at || log.created_at)}</p>
                      </div>

                      <StatusBadge status={onBreak ? 'on_break' : isActive ? 'open' : log.status} />
                    </div>

                    <div className="opc-mobile-card-lines">
                      <span>{formatTime(log.started_at)} – {formatTime(log.ended_at)}</span>
                      <span>Total: {formatMinutes(total)}</span>
                      <span>Pause: {formatMinutes(getBreakMinutes(log))}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>
    );
  };

  const renderMediaCard = () => (
    <section className="opc-section-card" style={cardStyle}>
      <SectionHeader title="Vorher / Nachher Medien" />

      <div className="opc-media-section">
        <div className="opc-media-header">
          <h3>Vorher</h3>
          {!clientMode ? (
            <label className="opc-upload-btn">
              {uploadingPhase === 'before' ? 'Lädt...' : 'Vorher hochladen'}
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                disabled={uploadingPhase !== null}
                onChange={(event) => void handleUploadMedia('before', event)}
              />
            </label>
          ) : null}
        </div>
        {renderMediaList(beforeMedia, 'Noch keine Vorher-Medien.')}
      </div>

      <div className="opc-media-section">
        <div className="opc-media-header">
          <h3>Nachher</h3>
          {!clientMode ? (
            <label className="opc-upload-btn">
              {uploadingPhase === 'after' ? 'Lädt...' : 'Nachher hochladen'}
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                disabled={uploadingPhase !== null}
                onChange={(event) => void handleUploadMedia('after', event)}
              />
            </label>
          ) : null}
        </div>
        {renderMediaList(afterMedia, 'Noch keine Nachher-Medien.')}
      </div>

      {otherMedia.length ? (
        <div className="opc-media-section">
          <div className="opc-media-header">
            <h3>Weitere Medien</h3>
          </div>
          {renderMediaList(otherMedia, 'Keine weiteren Medien.')}
        </div>
      ) : null}
    </section>
  );

  const renderNotesCard = () => (
    <section className="opc-section-card" style={cardStyle}>
      <SectionHeader
        title="Notizen"
        action={
          visibleNotes.length > 6 ? (
            <button type="button" className="opc-link-button" onClick={() => setShowAllNotes((current) => !current)}>
              {showAllNotes ? 'Weniger anzeigen' : `Alle ${visibleNotes.length} anzeigen`}
            </button>
          ) : null
        }
      />

      {visibleNotes.length === 0 ? (
        <div className="opc-empty-box">Keine Notizen vorhanden.</div>
      ) : (
        <div className="opc-message-list">
          {(showAllNotes ? visibleNotes : visibleNotes.slice(0, 6)).map((note) => (
            <div key={note.key} className="opc-message-card">
              <div className="opc-message-top">
                <strong>{note.title}</strong>
                <span>
                  {note.visibility === 'client'
                    ? 'Extern'
                    : note.visibility === 'action'
                      ? 'Aktion'
                      : note.visibility === 'system'
                        ? 'System'
                        : 'Intern'}
                </span>
              </div>
              <p>{note.body}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );

  const renderHero = (mode: 'admin' | 'employee') => {
    if (!job) return null;

    return (
      <section className="opc-hero-card" style={cardStyle}>
        <HeroStatusDot state={heroState} />

        <div className="opc-hero-main">
          <div>
            <div className="opc-eyebrow">{job.service_category || 'Einsatz'}</div>
            <h1>{job.title || `${job.service_category || 'Einsatz'} · ${getDisplayName(job)}`}</h1>
            <div className="opc-hero-meta">
              <span>{getDisplayName(job)}</span>
              <span>{job.site_name || joinAddress(job) || 'Standort nicht hinterlegt'}</span>
              <span>{formatDate(job.planned_start)}</span>
            </div>
          </div>
        </div>

        <div className={mode === 'admin' ? 'opc-hero-button-bar two' : 'opc-hero-button-bar one'}>
          <a className="opc-btn opc-btn-light" href={getMapsUrl(job)} target="_blank" rel="noreferrer">
            <MapPin size={16} />
            Navigation
          </a>

          {mode === 'admin' && access.canEdit ? (
            <button
              type="button"
              className="opc-btn opc-btn-dark"
              onClick={() => {
                setEditDraft(makeEditDraft(job));
                setEditMode((current) => !current);
              }}
            >
              {editMode ? 'Bearbeitung schliessen' : 'Einsatz bearbeiten'}
            </button>
          ) : null}
        </div>
      </section>
    );
  };

  const renderEmployeeExecutionView = () => {
    if (!job) return null;

    return (
      <>
        {renderHero('employee')}

        {!access.isAssigned ? (
          <div className="opc-warning-card">
            Dieser Einsatz ist nicht direkt deinem Mitarbeiterprofil zugewiesen. Sichtbarkeit hängt von deiner Berechtigung oder der Datenbank-Policy ab.
          </div>
        ) : null}

        <div className="opc-time-module-block">{renderJobTimeActionCard()}</div>

        <div className="opc-employee-execution-grid">
          <section className="opc-section-card" style={cardStyle}>
            <SectionHeader title="Kontakt & Standort" />

            <div className="opc-employee-info-grid">
              <MiniField label="Kunde" value={getDisplayName(job)} />
              <MiniField label="Standort" value={job.site_name} />
              <MiniField label="Adresse" value={joinAddress(job)} />
              <MiniField label="Kontakt vor Ort" value={getOnSiteContact(job)} />
              <MiniField
                label="Telefon"
                value={
                  getOnSitePhone(job) ? (
                    <a className="opc-inline-link" href={`tel:${getOnSitePhone(job)}`}>
                      {getOnSitePhone(job)}
                    </a>
                  ) : null
                }
              />
              <MiniField label="Zugewiesen durch" value={getAssignmentDisplayName(ownAssignment)} />
            </div>
          </section>

          {renderAssignedEmployees()}

          <section className="opc-section-card" style={cardStyle}>
            <SectionHeader title="Checkliste & Hinweise" />

            <div className="opc-note-box">
              {renderRequirements(job.service_requirements) !== 'Keine Checkliste oder Hinweise hinterlegt.'
                ? renderRequirements(job.service_requirements)
                : job.dispatcher_notes || job.access_notes || job.cleaning_notes || 'Keine Checkliste oder Hinweise hinterlegt.'}
            </div>
          </section>

          {renderMediaCard()}
        </div>

        {startConfirmOpen && pendingClockIn ? (
          <div className="opc-modal-backdrop" role="dialog" aria-modal="true">
            <div className="opc-assign-modal">
              <div className="opc-modal-header">
                <div>
                  <h2>Einsatz früher starten?</h2>
                  <p>{plannedStartGate(job).message}</p>
                </div>
                <button type="button" className="opc-modal-close" onClick={() => setStartConfirmOpen(false)}>
                  ×
                </button>
              </div>

              <div className="opc-modal-footer" style={{ gap: 8 }}>
                <button type="button" className="opc-btn opc-btn-light" onClick={() => setStartConfirmOpen(false)}>
                  Abbrechen
                </button>
                <button type="button" className="opc-btn opc-btn-dark" disabled={Boolean(actionLoading)} onClick={() => void performClockIn()}>
                  Ja, starten
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </>
    );
  };

  const renderAdminView = () => {
    if (!job) return null;

    return (
      <>
        {renderHero('admin')}

        <div className="opc-metrics-grid">
          <MetricCard label="Status" value={heroState.label} icon={<CheckCircle2 size={18} />} />
          <MetricCard label="Geplant" value={formatTime(job.planned_start)} helper={formatDate(job.planned_start)} icon={<CalendarDays size={18} />} />
          <MetricCard label="Dauer" value={job.estimated_hours ? `${job.estimated_hours} h` : '—'} icon={<Clock3 size={18} />} />
          <MetricCard label="Bericht" value={job.report_required ? 'Erforderlich' : 'Optional'} icon={<CheckCircle2 size={18} />} />
        </div>

        {editMode && access.canEdit && editDraft ? (
          <section className="opc-edit-panel" style={cardStyle}>
            <div className="opc-edit-header">
              <h2>Einsatz bearbeiten</h2>
              <div className="opc-edit-actions">
                <button type="button" className="opc-btn opc-btn-light" onClick={() => setEditMode(false)}>
                  Abbrechen
                </button>
                <button type="button" className="opc-btn opc-btn-dark" disabled={saving} onClick={handleSaveJob}>
                  {saving ? 'Speichert...' : 'Speichern'}
                </button>
              </div>
            </div>

            <div className="opc-form-grid">
              <label>
                Titel
                <input style={inputStyle()} value={editDraft.title} onChange={(event) => updateDraft('title', event.target.value)} />
              </label>
              <label>
                Service
                <input
                  style={inputStyle()}
                  value={editDraft.service_category}
                  onChange={(event) => updateDraft('service_category', event.target.value)}
                />
              </label>
              <label>
                Status
                <select style={inputStyle()} value={editDraft.status} onChange={(event) => updateDraft('status', event.target.value)}>
                  <option value="scheduled">Geplant</option>
                  <option value="assigned">Zugewiesen</option>
                  <option value="confirmed">Bestätigt</option>
                  <option value="on_site">Vor Ort</option>
                  <option value="in_progress">In Arbeit</option>
                  <option value="submitted">Eingereicht</option>
                  <option value="completed">Abgeschlossen</option>
                  <option value="approved">Freigegeben</option>
                  <option value="cancelled">Storniert</option>
                </select>
              </label>
              <label>
                Priorität
                <select style={inputStyle()} value={editDraft.priority} onChange={(event) => updateDraft('priority', event.target.value)}>
                  <option value="low">Niedrig</option>
                  <option value="normal">Normal</option>
                  <option value="high">Hoch</option>
                  <option value="urgent">Dringend</option>
                </select>
              </label>
              <label>
                Start
                <input
                  type="datetime-local"
                  style={inputStyle()}
                  value={editDraft.planned_start}
                  onChange={(event) => updateDraft('planned_start', event.target.value)}
                />
              </label>
              <label>
                Ende
                <input
                  type="datetime-local"
                  style={inputStyle()}
                  value={editDraft.planned_end}
                  onChange={(event) => updateDraft('planned_end', event.target.value)}
                />
              </label>
              <label>
                Geschätzte Stunden
                <input
                  style={inputStyle()}
                  value={editDraft.estimated_hours}
                  onChange={(event) => updateDraft('estimated_hours', event.target.value)}
                />
              </label>
              <label>
                Verrechenbarer Betrag
                <input
                  style={inputStyle()}
                  value={editDraft.billable_amount}
                  onChange={(event) => updateDraft('billable_amount', event.target.value)}
                />
              </label>
            </div>

            <div className="opc-form-grid opc-form-grid-notes">
              <label>
                Dispo-Notizen
                <textarea
                  style={{ ...inputStyle(), minHeight: 92, resize: 'vertical' }}
                  value={editDraft.dispatcher_notes}
                  onChange={(event) => updateDraft('dispatcher_notes', event.target.value)}
                />
              </label>
              <label>
                Interne Notizen
                <textarea
                  style={{ ...inputStyle(), minHeight: 92, resize: 'vertical' }}
                  value={editDraft.internal_notes}
                  onChange={(event) => updateDraft('internal_notes', event.target.value)}
                />
              </label>
            </div>
          </section>
        ) : null}

        <div className="opc-section-title-row">
          <h2 className="opc-section-title">Einsatzdaten</h2>
          <div className="opc-strip-arrows" aria-label="Einsatzdaten navigieren">
            <button type="button" onClick={() => scrollDetailStrip('left')} aria-label="Nach links">
              ←
            </button>
            <button type="button" onClick={() => scrollDetailStrip('right')} aria-label="Nach rechts">
              →
            </button>
          </div>
        </div>

        <div className="opc-detail-strip" ref={detailStripRef}>
          <DetailCard title="Einsatz">
            <MiniField label="Service" value={job.service_category || job.service_description} />
            <MiniField label="Status" value={<StatusBadge status={job.status} />} />
            <MiniField label="Priorität" value={job.priority || 'normal'} />
            <MiniField label="Bericht" value={job.report_required ? 'Erforderlich' : 'Optional'} />
          </DetailCard>

          <DetailCard title="Termin">
            <MiniField label="Start" value={formatDate(job.planned_start)} />
            <MiniField label="Ende" value={formatDate(job.planned_end)} />
            <MiniField label="Dauer" value={job.estimated_hours ? `${job.estimated_hours} h` : null} />
            <MiniField label="Finale Stunden" value={job.final_hours ? `${job.final_hours} h` : null} />
          </DetailCard>

          <DetailCard title="Kunde">
            <MiniField
              label="Name"
              value={
                job.client_id ? (
                  <a className="opc-inline-link" href={`${baseUrl}/kunden/${job.client_id}`}>
                    {getDisplayName(job)}
                  </a>
                ) : (
                  getDisplayName(job)
                )
              }
            />
            <MiniField label="Rechnung" value={job.billing_name} />
            <MiniField label="E-Mail" value={job.email ? <a className="opc-inline-link" href={`mailto:${job.email}`}>{job.email}</a> : null} />
            <MiniField label="Telefon" value={job.phone_e164 || job.phone_raw} />
          </DetailCard>

          <DetailCard title="Standort">
            <MiniField label="Standort" value={job.site_name} />
            <MiniField label="Adresse" value={joinAddress(job)} />
            <MiniField label="Typ" value={job.site_type} />
            <MiniField label="Betrag" value={job.billable_amount ? `${job.billable_amount} ${job.currency || 'CHF'}` : null} />
          </DetailCard>
        </div>

        <div className="opc-main-grid">
          <div className="opc-left-col">
            {!clientMode ? <div className="opc-time-module-block">{renderJobTimeActionCard()}</div> : null}

            {renderNotesCard()}

            <section className="opc-section-card" style={cardStyle}>
              <SectionHeader title="Bericht & Hinweise" />

              <div className="opc-two-col">
                <div>
                  <h3>Einsatzhinweise</h3>
                  <div className="opc-note-box">
                    {job.access_notes || job.cleaning_notes || renderRequirements(job.service_requirements)}
                  </div>
                </div>

                <div>
                  <h3>Bericht</h3>
                  {report ? (
                    <div className="opc-rows">
                      <MiniField label="Status" value={formatStatus(report.status)} />
                      <MiniField label="Titel" value={report.report_title} />
                      <MiniField label="Total" value={report.total_hours ? `${report.total_hours} h` : '0 h'} />
                      <MiniField label="Freigegeben" value={formatDate(report.approved_at)} />
                      <MiniField label="Zusammenfassung" value={report.report_summary} />
                    </div>
                  ) : (
                    <div className="opc-empty-box">Noch kein Bericht vorhanden.</div>
                  )}
                </div>
              </div>
            </section>

            {renderMediaCard()}
          </div>

          <aside className="opc-right-col">
            {renderAssignedEmployees()}

            {access.canEdit ? (
              <section className="opc-section-card" style={cardStyle}>
                <SectionHeader title="Notizen erfassen" />

                <div className="opc-notes-stack">
                  <label className="opc-note-label">
                    Interne Notiz
                    <textarea
                      style={{ ...inputStyle(), minHeight: 84, resize: 'vertical' }}
                      placeholder="Interne Notiz zum Einsatz. Für Team/Admin sichtbar."
                      value={internalNoteDraft}
                      onChange={(event) => setInternalNoteDraft(event.target.value)}
                    />
                  </label>

                  <button
                    type="button"
                    className="opc-btn opc-btn-light"
                    disabled={saving || !internalNoteDraft.trim()}
                    onClick={handleInternalNote}
                  >
                    Interne Notiz speichern
                  </button>

                  {canWriteClientNotes ? (
                    <>
                      <label className="opc-note-label">
                        Externe Kunden-Notiz
                        <textarea
                          style={{ ...inputStyle(), minHeight: 84, resize: 'vertical' }}
                          placeholder="Notiz für Kundenbericht / Kundenportal."
                          value={clientNoteDraft}
                          onChange={(event) => setClientNoteDraft(event.target.value)}
                        />
                      </label>

                      <button
                        type="button"
                        className="opc-btn opc-btn-light"
                        disabled={saving || !clientNoteDraft.trim()}
                        onClick={handleClientNote}
                      >
                        Kunden-Notiz speichern
                      </button>
                    </>
                  ) : null}
                </div>
              </section>
            ) : null}

            {renderTimeEntriesCard()}

            <section className="opc-section-card" style={cardStyle}>
              <SectionHeader title="Kurzinfo" />
              <div className="opc-rows compact">
                <MiniField label="Einsatz-ID" value={job.job_id} />
                <MiniField label="Client-ID" value={job.client_id} />
                <MiniField label="Site-ID" value={job.client_site_id} />
                <MiniField label="Adresse" value={joinAddress(job)} />
                <MiniField label="Zuweisungen" value={`${assignments.length} Zuweisung${assignments.length === 1 ? '' : 'en'}`} />
              </div>
            </section>
          </aside>
        </div>

        {startConfirmOpen && pendingClockIn ? (
          <div className="opc-modal-backdrop" role="dialog" aria-modal="true">
            <div className="opc-assign-modal">
              <div className="opc-modal-header">
                <div>
                  <h2>Einsatz früher starten?</h2>
                  <p>{plannedStartGate(job).message}</p>
                </div>
                <button type="button" className="opc-modal-close" onClick={() => setStartConfirmOpen(false)}>
                  ×
                </button>
              </div>

              <div className="opc-modal-footer" style={{ gap: 8 }}>
                <button type="button" className="opc-btn opc-btn-light" onClick={() => setStartConfirmOpen(false)}>
                  Abbrechen
                </button>
                <button type="button" className="opc-btn opc-btn-dark" disabled={Boolean(actionLoading)} onClick={() => void performClockIn()}>
                  Ja, starten
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </>
    );
  };

  return (
    <MirakaDashboardShell
      title="Einsatzdetails"
      requiredRole={['owner', 'admin', 'dispatch', 'employee', 'client']}
      currentPath="/einsaetze"
      hideTopBar={false}
      fullWidth={false}
    >
      <div className="opc-page" style={{ fontFamily: pageFont }}>
        <a href={`${baseUrl}/einsaetze`} className="opc-back-link">
          ← Zurück zu Einsätze
        </a>

        {loading && !job && <div className="opc-loading-card">Einsatz wird geladen.</div>}

        {!loading && databaseError && <div className="opc-error-card">{databaseError}</div>}

        {!loading && !databaseError && job && (
          <>
            {actionError ? <div className="opc-error-card">{actionError}</div> : null}
            {actionMessage ? <div className="opc-action-message">{actionMessage}</div> : null}
            {employeeMode ? renderEmployeeExecutionView() : renderAdminView()}
          </>
        )}
      </div>

      {assignModalOpen ? (
        <div className="opc-modal-backdrop" role="dialog" aria-modal="true" aria-label="Mitarbeiter zuweisen">
          <div className="opc-assign-modal">
            <div className="opc-modal-header">
              <div>
                <h2>Mitarbeiter zuweisen</h2>
                <p>Suche Mitarbeiter, wähle eine Person aus und füge sie dem Einsatz hinzu.</p>
              </div>
              <button
                type="button"
                className="opc-modal-close"
                onClick={() => {
                  setAssignModalOpen(false);
                  setEmployeeSearch('');
                }}
              >
                ×
              </button>
            </div>

            <div className="opc-modal-search-row">
              <input
                style={inputStyle()}
                autoFocus
                placeholder="Mitarbeiter suchen..."
                value={employeeSearch}
                onChange={(event) => setEmployeeSearch(event.target.value)}
              />
            </div>

            <textarea
              style={{ ...inputStyle(), minHeight: 76, resize: 'vertical' }}
              placeholder="Optionale Zuweisungsnotiz für diesen Einsatz"
              value={assignmentNote}
              onChange={(event) => setAssignmentNote(event.target.value)}
            />

            <div className="opc-employee-list">
              {!employeesLoaded ? (
                <div className="opc-empty-box">Mitarbeiter werden geladen.</div>
              ) : filteredEmployees.length === 0 ? (
                <div className="opc-empty-box">Keine Mitarbeiter gefunden.</div>
              ) : (
                filteredEmployees.map((employee) => (
                  <button
                    type="button"
                    key={employee.id}
                    className={`opc-employee-option ${employee.alreadyAssigned ? 'is-assigned' : ''}`}
                    disabled={saving || employee.alreadyAssigned}
                    onClick={() => void handleAddAssignment(employee.id)}
                  >
                    <span className="opc-employee-avatar">
                      {(employee.display_name || employee.email || '?').slice(0, 1).toUpperCase()}
                    </span>
                    <span className="opc-employee-copy">
                      <strong>{employee.display_name || employee.email || 'Mitarbeiter'}</strong>
                      <span>{employee.email || employee.phone_e164 || employee.phone_raw || employee.role || 'Kontakt nicht hinterlegt'}</span>
                    </span>
                    <span className="opc-employee-action">
                      {employee.alreadyAssigned ? 'Bereits zugewiesen' : saving ? 'Speichert...' : 'Zuweisen'}
                    </span>
                  </button>
                ))
              )}
            </div>

            <div className="opc-modal-footer">
              <button
                type="button"
                className="opc-btn opc-btn-light"
                onClick={() => {
                  setAssignModalOpen(false);
                  setEmployeeSearch('');
                }}
              >
                Schliessen
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <style>{`
        .opc-page {
          width: 100%;
          max-width: none;
          margin: 0;
          padding: 0 0 34px;
          color: ${BRAND.text};
          overflow-x: hidden;
        }

        .opc-back-link {
          display: inline-flex;
          align-items: center;
          height: 38px;
          padding: 0 14px;
          margin-bottom: 14px;
          border: 1px solid ${BRAND.border};
          border-radius: 999px;
          color: ${BRAND.text};
          text-decoration: none;
          font-size: 13px;
          font-weight: 760;
          background: #FFFFFF;
        }

        .opc-loading-card,
        .opc-error-card,
        .opc-action-message,
        .opc-warning-card {
          border-radius: 18px;
          padding: 16px 18px;
          font-size: 14px;
          font-weight: 720;
          margin-bottom: 14px;
        }

        .opc-loading-card {
          border: 1px solid ${BRAND.border};
          color: ${BRAND.muted};
          background: #FFFFFF;
        }

        .opc-error-card {
          border: 1px solid #FECACA;
          color: #991B1B;
          background: #FEF2F2;
        }

        .opc-action-message {
          border: 1px solid #BBF7D0;
          color: #166534;
          background: #F0FDF4;
        }

        .opc-warning-card {
          border: 1px solid #FDE68A;
          color: #92400E;
          background: #FFFBEB;
        }

        .opc-hero-card {
          position: relative;
          padding: 24px;
          margin-bottom: 14px;
        }

        .opc-hero-main {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          align-items: flex-start;
          padding-right: 64px;
        }

        .opc-hero-status-dot {
          position: absolute;
          top: 20px;
          right: 20px;
          width: 42px;
          height: 42px;
          border-radius: 999px;
          border: 1px solid;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .opc-hero-status-dot span {
          width: 18px;
          height: 18px;
          border-radius: 999px;
          display: block;
        }

        .opc-hero-button-bar {
          display: grid;
          gap: 10px;
          margin-top: 18px;
          width: 100%;
        }

        .opc-hero-button-bar.two {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .opc-hero-button-bar.one {
          grid-template-columns: minmax(0, 1fr);
        }

        .opc-hero-button-bar .opc-btn {
          width: 100%;
          height: 46px;
        }

        .opc-eyebrow {
          font-size: 12px;
          color: ${BRAND.muted};
          font-weight: 760;
          margin-bottom: 6px;
        }

        .opc-hero-card h1 {
          margin: 0;
          font-size: 29px;
          line-height: 1.05;
          font-weight: 860;
          letter-spacing: -0.045em;
          color: ${BRAND.text};
        }

        .opc-hero-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px 14px;
          margin-top: 9px;
          font-size: 13px;
          font-weight: 720;
          color: ${BRAND.muted};
        }

        .opc-status-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 31px;
          padding: 6px 12px;
          border: 1px solid;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 820;
          white-space: nowrap;
          text-transform: none;
        }

        .opc-metrics-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 18px;
        }

        .opc-metric-card {
          min-height: 74px;
          padding: 16px 18px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          background: #FFFFFF;
          border: 1px solid ${BRAND.border};
          border-radius: 18px;
          box-shadow: 0 1px 2px rgba(15,23,42,0.04);
        }

        .opc-metric-value {
          font-size: 22px;
          line-height: 1.05;
          font-weight: 860;
          letter-spacing: -0.035em;
          color: ${BRAND.text};
        }

        .opc-metric-label {
          margin-top: 5px;
          font-size: 12px;
          font-weight: 820;
          color: ${BRAND.muted};
        }

        .opc-metric-helper {
          margin-top: 4px;
          font-size: 11px;
          font-weight: 680;
          color: ${BRAND.faint};
        }

        .opc-metric-icon {
          width: 36px;
          height: 36px;
          border: 1px solid ${BRAND.border};
          border-radius: 13px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: ${BRAND.black};
          background: #FAFAFA;
          flex: 0 0 auto;
        }

        .opc-section-title {
          margin: 20px 0 10px;
          font-size: 19px;
          line-height: 1.15;
          font-weight: 860;
          color: ${BRAND.text};
          letter-spacing: -0.035em;
        }

        .opc-section-title-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-top: 18px;
        }

        .opc-section-title-row .opc-section-title {
          margin-top: 0;
        }

        .opc-strip-arrows {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          margin-bottom: 8px;
        }

        .opc-strip-arrows button {
          width: 36px;
          height: 36px;
          border: 1px solid ${BRAND.border};
          border-radius: 999px;
          background: #FFFFFF;
          color: ${BRAND.text};
          font-size: 16px;
          font-weight: 860;
          cursor: pointer;
          box-shadow: 0 1px 2px rgba(15,23,42,0.04);
        }

        .opc-detail-strip {
          display: flex;
          gap: 12px;
          overflow-x: auto;
          padding: 0 2px 10px;
          margin: 0 -2px 16px;
          scroll-snap-type: x mandatory;
          scrollbar-width: thin;
        }

        .opc-detail-card,
        .opc-section-card,
        .opc-edit-panel,
        .opc-time-action-card {
          background: #FFFFFF;
          border: 1px solid ${BRAND.border};
          border-radius: 20px;
          box-shadow: 0 1px 2px rgba(15,23,42,0.04);
        }

        .opc-detail-card {
          padding: 16px;
          min-width: 310px;
          flex: 0 0 310px;
          scroll-snap-align: start;
        }

        .opc-detail-card h3,
        .opc-section-card h3 {
          margin: 0 0 10px;
          font-size: 13px;
          font-weight: 860;
          color: ${BRAND.text};
          letter-spacing: -0.02em;
        }

        .opc-detail-card-body,
        .opc-rows,
        .opc-employee-info-grid {
          display: grid;
          gap: 0;
        }

        .opc-mini-field {
          display: grid;
          grid-template-columns: minmax(96px, 0.8fr) minmax(0, 1.2fr);
          gap: 10px;
          align-items: center;
          min-height: 34px;
          padding: 7px 0;
          border-top: 1px solid #F3F4F6;
        }

        .opc-mini-field:first-child {
          border-top: 0;
        }

        .opc-mini-field span {
          font-size: 12px;
          font-weight: 720;
          color: ${BRAND.muted};
        }

        .opc-mini-field strong {
          font-size: 12px;
          line-height: 1.35;
          font-weight: 820;
          color: ${BRAND.text};
          text-align: right;
          word-break: break-word;
          overflow-wrap: anywhere;
        }

        .opc-inline-link {
          color: ${BRAND.text};
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        .opc-main-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
          gap: 14px;
          align-items: start;
          width: 100%;
          max-width: 100%;
          overflow-x: hidden;
        }

        .opc-left-col,
        .opc-right-col,
        .opc-employee-execution-grid,
        .opc-time-module-block {
          display: grid;
          gap: 14px;
          min-width: 0;
          width: 100%;
          max-width: 100%;
        }

        .opc-right-col > *,
        .opc-left-col > * {
          min-width: 0;
          max-width: 100%;
        }

        .opc-section-card,
        .opc-edit-panel {
          padding: 16px;
          min-width: 0;
          width: 100%;
          max-width: 100%;
          overflow: hidden;
        }

        .opc-split-header,
        .opc-edit-header,
        .opc-media-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 13px;
        }

        .opc-split-header h2,
        .opc-edit-header h2 {
          margin: 0;
          font-size: 17px;
          line-height: 1.15;
          font-weight: 860;
          letter-spacing: -0.035em;
          color: ${BRAND.text};
        }

        .opc-two-col {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 12px;
        }

        .opc-note-box,
        .opc-empty-box {
          min-height: 48px;
          border: 1px solid #F3F4F6;
          border-radius: 14px;
          padding: 12px;
          background: #FAFAFA;
          color: ${BRAND.muted};
          font-size: 13px;
          line-height: 1.45;
          font-weight: 650;
          white-space: pre-wrap;
        }

        .opc-notes-stack {
          display: grid;
          gap: 10px;
        }

        .opc-note-label {
          display: grid;
          gap: 8px;
          font-size: 13px;
          font-weight: 760;
          color: ${BRAND.text};
        }

        .opc-message-list,
        .opc-assignment-list,
        .opc-small-list {
          display: grid;
          gap: 9px;
        }

        .opc-message-card,
        .opc-assignment-card,
        .opc-small-row {
          border: 1px solid #F3F4F6;
          border-radius: 14px;
          padding: 11px;
          background: #FAFAFA;
        }

        .opc-message-top,
        .opc-assignment-card {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: flex-start;
        }

        .opc-assignment-actions {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .opc-message-top strong,
        .opc-assignment-card strong,
        .opc-small-row strong {
          display: block;
          font-size: 12px;
          font-weight: 840;
          color: ${BRAND.text};
        }

        .opc-message-top span,
        .opc-assignment-card span,
        .opc-small-row span {
          display: block;
          margin-top: 3px;
          font-size: 11px;
          font-weight: 650;
          color: ${BRAND.muted};
        }

        .opc-message-card p {
          margin: 8px 0 0;
          font-size: 12px;
          line-height: 1.5;
          font-weight: 620;
          color: #374151;
          word-break: break-word;
          overflow-wrap: anywhere;
          white-space: pre-wrap;
        }

        .opc-link-button {
          border: 0;
          background: transparent;
          color: ${BRAND.text};
          font-size: 12px;
          font-weight: 780;
          cursor: pointer;
        }

        .opc-btn {
          height: 42px;
          border-radius: 14px;
          padding: 0 16px;
          border: 1px solid ${BRAND.border};
          font-size: 13px;
          font-weight: 820;
          font-family: inherit;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          white-space: nowrap;
          text-decoration: none;
        }

        .opc-btn:disabled,
        .opc-time-black-button:disabled,
        .opc-time-secondary-button:disabled,
        .opc-time-danger-button:disabled,
        .opc-time-complete-button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .opc-btn-dark {
          background: ${BRAND.black};
          color: #FFFFFF;
          border-color: ${BRAND.black};
        }

        .opc-btn-light {
          background: #FFFFFF;
          color: ${BRAND.text};
          border-color: ${BRAND.border};
        }

        .opc-full-btn {
          width: 100%;
        }

        .opc-admin-box {
          display: grid;
          gap: 9px;
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid #F3F4F6;
        }

        .opc-admin-box-compact {
          padding-top: 10px;
        }

        .opc-contact-buttons {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
          flex-wrap: wrap;
        }

        .opc-icon-button {
          width: 34px;
          height: 34px;
          border-radius: 12px;
          border: 1px solid ${BRAND.border};
          background: #FFFFFF;
          color: ${BRAND.text};
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
        }

        .opc-time-action-card {
          overflow: hidden;
        }

        .opc-time-card-header {
          padding: 18px 20px;
          border-bottom: 1px solid #F3F4F6;
          font-size: 15px;
          font-weight: 820;
          color: ${BRAND.text};
        }

        .opc-time-card-body {
          padding: 20px;
        }

        .opc-time-media-row {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin-top: 14px;
        }

        .opc-time-upload-button {
          position: relative;
          overflow: hidden;
          height: 44px;
          border-radius: 14px;
          border: 1px solid ${BRAND.border};
          background: #FFFFFF;
          color: ${BRAND.text};
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          font-size: 13px;
          font-weight: 760;
          cursor: pointer;
        }

        .opc-time-upload-button input {
          position: absolute;
          inset: 0;
          opacity: 0;
          cursor: pointer;
        }

        .opc-time-action-buttons {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 16px;
        }

        .opc-time-black-button,
        .opc-time-secondary-button,
        .opc-time-danger-button,
        .opc-time-complete-button {
          height: 48px;
          min-width: 176px;
          padding: 0 16px;
          border-radius: 14px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          font-size: 14px;
          font-weight: 760;
          font-family: inherit;
          cursor: pointer;
          white-space: nowrap;
        }

        .opc-time-black-button {
          border: 1px solid ${BRAND.black};
          background: ${BRAND.black};
          color: #FFFFFF;
        }

        .opc-time-secondary-button {
          border: 1px solid ${BRAND.border};
          background: #FFFFFF;
          color: ${BRAND.text};
        }

        .opc-time-danger-button {
          border: 1px solid #FCA5A5;
          background: #FEF2F2;
          color: ${BRAND.red};
        }

        .opc-time-complete-button {
          border: 1px solid ${BRAND.black};
          background: ${BRAND.black};
          color: #FFFFFF;
        }

        .opc-time-table {
          overflow: hidden;
        }

        .opc-time-row {
          width: 100%;
          display: grid;
          grid-template-columns: minmax(160px, 1.4fr) 90px 90px 90px 90px minmax(120px, 1fr);
          align-items: center;
          gap: 16px;
          padding: 16px 4px;
          border: none;
          background: #FFFFFF;
          font-family: inherit;
        }

        .opc-row-title {
          font-size: 15px;
          font-weight: 800;
          color: ${BRAND.text};
          letter-spacing: -0.015em;
          margin-bottom: 7px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .opc-row-sub {
          font-size: 13px;
          font-weight: 600;
          color: ${BRAND.muted};
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .opc-date-cell {
          font-size: 13px;
          font-weight: 760;
          color: ${BRAND.text};
          white-space: nowrap;
        }

        .opc-time-mobile-cards {
          display: none;
        }

        .opc-mobile-card {
          width: 100%;
          border: 1px solid ${BRAND.border};
          border-radius: 18px;
          background: #FFFFFF;
          padding: 16px;
          text-align: left;
          box-sizing: border-box;
        }

        .opc-mobile-card-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 12px;
        }

        .opc-mobile-card h3 {
          margin: 0 0 6px;
          font-size: 15px;
          line-height: 1.25;
          font-weight: 820;
          color: ${BRAND.text};
        }

        .opc-mobile-card p {
          margin: 0;
          font-size: 13px;
          font-weight: 600;
          color: ${BRAND.muted};
        }

        .opc-mobile-card-lines {
          display: grid;
          gap: 6px;
          font-size: 13px;
          font-weight: 560;
          color: ${BRAND.muted};
        }

        .opc-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(15, 23, 42, 0.38);
          backdrop-filter: blur(5px);
        }

        .opc-assign-modal {
          width: min(720px, 100%);
          max-height: min(760px, calc(100vh - 40px));
          overflow: hidden;
          display: grid;
          grid-template-rows: auto auto auto minmax(0, 1fr) auto;
          gap: 12px;
          padding: 18px;
          background: #FFFFFF;
          border: 1px solid ${BRAND.border};
          border-radius: 22px;
          box-shadow: 0 24px 70px rgba(15,23,42,0.22);
        }

        .opc-modal-header {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
        }

        .opc-modal-header h2 {
          margin: 0;
          font-size: 22px;
          line-height: 1.1;
          font-weight: 860;
          letter-spacing: -0.04em;
          color: ${BRAND.text};
        }

        .opc-modal-header p {
          margin: 6px 0 0;
          font-size: 13px;
          line-height: 1.45;
          font-weight: 650;
          color: ${BRAND.muted};
        }

        .opc-modal-close {
          width: 38px;
          height: 38px;
          border: 1px solid ${BRAND.border};
          border-radius: 999px;
          background: #FFFFFF;
          color: ${BRAND.text};
          font-size: 22px;
          line-height: 1;
          font-weight: 760;
          cursor: pointer;
        }

        .opc-modal-search-row {
          display: grid;
          gap: 8px;
        }

        .opc-employee-list {
          display: grid;
          gap: 9px;
          overflow: auto;
          padding-right: 2px;
        }

        .opc-employee-option {
          width: 100%;
          display: grid;
          grid-template-columns: 42px minmax(0, 1fr) auto;
          gap: 11px;
          align-items: center;
          border: 1px solid ${BRAND.border};
          border-radius: 16px;
          padding: 11px;
          background: #FFFFFF;
          color: ${BRAND.text};
          text-align: left;
          cursor: pointer;
          font-family: inherit;
        }

        .opc-employee-option:hover {
          background: #FAFAFA;
        }

        .opc-employee-option.is-assigned {
          opacity: 0.72;
          cursor: not-allowed;
          background: #FAFAFA;
        }

        .opc-employee-avatar {
          width: 42px;
          height: 42px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          background: ${BRAND.black};
          color: #FFFFFF;
          font-size: 14px;
          font-weight: 860;
        }

        .opc-employee-copy {
          display: grid;
          gap: 3px;
          min-width: 0;
        }

        .opc-employee-copy strong {
          font-size: 14px;
          font-weight: 840;
          color: ${BRAND.text};
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .opc-employee-copy span {
          font-size: 12px;
          font-weight: 650;
          color: ${BRAND.muted};
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .opc-employee-action {
          min-height: 34px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 12px;
          border-radius: 999px;
          background: ${BRAND.black};
          color: #FFFFFF;
          font-size: 12px;
          font-weight: 820;
          white-space: nowrap;
        }

        .opc-employee-option.is-assigned .opc-employee-action {
          background: #F3F4F6;
          color: ${BRAND.muted};
        }

        .opc-modal-footer {
          display: flex;
          justify-content: flex-end;
          padding-top: 2px;
        }

        .opc-edit-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .opc-form-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 11px;
        }

        .opc-form-grid-notes {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          margin-top: 11px;
        }

        .opc-form-grid label {
          display: grid;
          gap: 6px;
          font-size: 12px;
          font-weight: 820;
          color: #374151;
        }

        .opc-media-section {
          margin-top: 14px;
          padding-top: 13px;
          border-top: 1px solid #F3F4F6;
        }

        .opc-media-section:first-of-type {
          margin-top: 0;
          padding-top: 0;
          border-top: 0;
        }

        .opc-media-header {
          margin-bottom: 8px;
        }

        .opc-upload-btn {
          position: relative;
          overflow: hidden;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 34px;
          padding: 0 12px;
          border: 1px solid ${BRAND.border};
          border-radius: 999px;
          color: ${BRAND.text};
          background: #FFFFFF;
          font-size: 11px;
          font-weight: 820;
          cursor: pointer;
          white-space: nowrap;
        }

        .opc-upload-btn input {
          position: absolute;
          inset: 0;
          opacity: 0;
          cursor: pointer;
        }

        .opc-media-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .opc-media-item {
          display: grid;
          grid-template-columns: 86px minmax(0, 1fr);
          gap: 10px;
          min-height: 86px;
          border: 1px solid #F3F4F6;
          border-radius: 14px;
          padding: 8px;
          background: #FAFAFA;
          text-decoration: none;
          color: ${BRAND.text};
          overflow: hidden;
        }

        .opc-media-preview {
          width: 86px;
          height: 70px;
          border-radius: 11px;
          overflow: hidden;
          background: #F3F4F6;
          display: flex;
          align-items: center;
          justify-content: center;
          color: ${BRAND.muted};
          font-size: 12px;
          font-weight: 800;
        }

        .opc-media-preview img,
        .opc-media-preview video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .opc-media-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .opc-media-copy {
          min-width: 0;
          display: grid;
          align-content: center;
          gap: 4px;
        }

        .opc-media-copy span {
          font-size: 10px;
          font-weight: 760;
          color: ${BRAND.muted};
          text-transform: uppercase;
        }

        .opc-media-copy strong {
          font-size: 12px;
          font-weight: 820;
          color: ${BRAND.text};
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .opc-rows.compact .opc-mini-field {
          grid-template-columns: 92px minmax(0, 1fr);
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @media (max-width: 1180px) {
          .opc-main-grid {
            grid-template-columns: minmax(0, 1fr);
          }

          .opc-right-col {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            align-items: start;
          }

          .opc-form-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 980px) {
          .opc-time-table-desktop {
            display: none !important;
          }

          .opc-time-mobile-cards {
            display: flex !important;
            flex-direction: column;
            gap: 14px;
          }
        }

        @media (max-width: 740px) {
          .opc-page {
            max-width: none;
            width: 100%;
            padding: 0 8px 96px;
            box-sizing: border-box;
          }

          .opc-back-link {
            height: 34px;
            padding: 0 12px;
            margin-bottom: 10px;
            font-size: 12px;
          }

          .opc-hero-card {
            padding: 16px;
            border-radius: 18px !important;
            margin-bottom: 10px;
          }

          .opc-hero-main {
            display: grid;
            gap: 12px;
            padding-right: 54px;
          }

          .opc-hero-status-dot {
            top: 14px;
            right: 14px;
            width: 38px;
            height: 38px;
          }

          .opc-hero-status-dot span {
            width: 16px;
            height: 16px;
          }

          .opc-hero-card h1 {
            font-size: 22px;
            line-height: 1.1;
          }

          .opc-hero-meta {
            display: grid;
            gap: 4px;
            font-size: 12px;
          }

          .opc-hero-button-bar,
          .opc-hero-button-bar.two,
          .opc-hero-button-bar.one {
            grid-template-columns: 1fr;
            gap: 8px;
          }

          .opc-metrics-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
            margin-bottom: 14px;
          }

          .opc-metric-card {
            min-height: 96px;
            padding: 14px;
            border-radius: 16px;
          }

          .opc-metric-value {
            font-size: 20px;
          }

          .opc-metric-label {
            font-size: 11px;
          }

          .opc-metric-helper,
          .opc-metric-icon {
            display: none;
          }

          .opc-section-title {
            margin: 16px 0 8px;
            font-size: 17px;
          }

          .opc-detail-strip {
            gap: 10px;
            padding: 0 2px 8px;
            margin: 0 -2px 12px;
          }

          .opc-detail-card {
            min-width: min(304px, calc(100vw - 34px));
            flex-basis: min(304px, calc(100vw - 34px));
            padding: 14px;
            border-radius: 17px;
          }

          .opc-strip-arrows button {
            width: 34px;
            height: 34px;
          }

          .opc-main-grid,
          .opc-left-col,
          .opc-right-col,
          .opc-employee-execution-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 11px;
          }

          .opc-section-card,
          .opc-edit-panel,
          .opc-time-action-card {
            padding: 14px;
            border-radius: 18px !important;
          }

          .opc-time-action-card {
            padding: 0;
          }

          .opc-time-card-header {
            padding: 16px 18px;
          }

          .opc-time-card-body {
            padding: 14px;
          }

          .opc-split-header,
          .opc-edit-header {
            align-items: flex-start;
            margin-bottom: 10px;
          }

          .opc-split-header h2,
          .opc-edit-header h2 {
            font-size: 16px;
          }

          .opc-two-col,
          .opc-form-grid,
          .opc-form-grid-notes {
            grid-template-columns: 1fr;
            gap: 10px;
          }

          .opc-mini-field {
            grid-template-columns: 92px minmax(0, 1fr);
            min-height: 31px;
            padding: 6px 0;
          }

          .opc-mini-field span,
          .opc-mini-field strong {
            font-size: 11px;
          }

          .opc-message-card,
          .opc-assignment-card,
          .opc-small-row,
          .opc-note-box,
          .opc-empty-box {
            border-radius: 13px;
            padding: 10px;
          }

          .opc-message-top {
            display: grid;
            gap: 2px;
          }

          .opc-message-card p {
            max-height: 140px;
            overflow: auto;
            font-size: 11.5px;
          }

          .opc-edit-actions,
          .opc-time-action-buttons,
          .opc-time-media-row {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
          }

          .opc-btn,
          .opc-time-black-button,
          .opc-time-secondary-button,
          .opc-time-danger-button,
          .opc-time-complete-button {
            width: 100%;
            height: 42px;
            min-width: 0;
            border-radius: 13px;
          }

          .opc-time-upload-button {
            height: 42px;
            border-radius: 13px;
            font-size: 12px;
          }

          .opc-media-header {
            align-items: flex-start;
          }

          .opc-upload-btn {
            height: 32px;
            padding: 0 10px;
          }

          .opc-media-grid {
            grid-template-columns: 1fr;
          }

          .opc-media-item {
            grid-template-columns: 74px minmax(0, 1fr);
            min-height: 78px;
          }

          .opc-media-preview {
            width: 74px;
            height: 62px;
          }

          .opc-modal-backdrop {
            align-items: flex-end;
            padding: 10px;
          }

          .opc-assign-modal {
            width: 100%;
            max-height: calc(100vh - 20px);
            border-radius: 22px;
            padding: 14px;
          }

          .opc-modal-header h2 {
            font-size: 19px;
          }

          .opc-modal-header p {
            font-size: 12px;
          }

          .opc-employee-option {
            grid-template-columns: 38px minmax(0, 1fr);
            gap: 10px;
          }

          .opc-employee-avatar {
            width: 38px;
            height: 38px;
          }

          .opc-employee-action {
            grid-column: 1 / -1;
            width: 100%;
          }

          .opc-modal-footer .opc-btn {
            width: 100%;
          }
        }
      `}</style>
    </MirakaDashboardShell>
  );
}
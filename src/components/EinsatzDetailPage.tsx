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
  role?: string | null;
  status?: string | null;
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

const statusLabels: Record<string, string> = {
  scheduled: 'Geplant',
  assigned: 'Zugewiesen',
  pending: 'Offen',
  confirmed: 'Bestätigt',
  on_site: 'Vor Ort',
  'on-site': 'Vor Ort',
  in_progress: 'In Arbeit',
  'in-progress': 'In Arbeit',
  completed: 'Abgeschlossen',
  report_pending: 'Bericht offen',
  report_approved: 'Bericht freigegeben',
  cancelled: 'Storniert',
  draft: 'Entwurf',
  approved: 'Freigegeben',
  sent_to_client: 'An Kunde gesendet',
  submitted: 'Eingereicht',
  active: 'Aktiv',
};

const statusStyles: Record<string, { background: string; color: string; border: string }> = {
  scheduled: { background: '#F8FAFC', color: '#111827', border: '#E5E7EB' },
  assigned: { background: '#FFFBEB', color: '#92400E', border: '#FDE68A' },
  pending: { background: '#F8FAFC', color: '#374151', border: '#E5E7EB' },
  confirmed: { background: '#F5F3FF', color: '#5B21B6', border: '#DDD6FE' },
  on_site: { background: '#FEFCE8', color: '#854D0E', border: '#FEF08A' },
  'on-site': { background: '#FEFCE8', color: '#854D0E', border: '#FEF08A' },
  in_progress: { background: '#FFF7ED', color: '#9A3412', border: '#FED7AA' },
  'in-progress': { background: '#FFF7ED', color: '#9A3412', border: '#FED7AA' },
  completed: { background: '#ECFDF5', color: '#065F46', border: '#A7F3D0' },
  report_pending: { background: '#FFFBEB', color: '#92400E', border: '#FDE68A' },
  report_approved: { background: '#ECFDF5', color: '#047857', border: '#A7F3D0' },
  cancelled: { background: '#FEF2F2', color: '#991B1B', border: '#FECACA' },
  draft: { background: '#F3F4F6', color: '#374151', border: '#E5E7EB' },
  approved: { background: '#ECFDF5', color: '#047857', border: '#A7F3D0' },
  sent_to_client: { background: '#EEF2FF', color: '#3730A3', border: '#C7D2FE' },
  submitted: { background: '#FFFBEB', color: '#92400E', border: '#FDE68A' },
  active: { background: '#ECFDF5', color: '#047857', border: '#A7F3D0' },
};

const pageFont =
  'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const cardStyle: CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #E5E7EB',
  borderRadius: '20px',
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
};

function formatStatus(status?: string | null) {
  if (!status) return 'Unbekannt';
  return statusLabels[status] || status.replaceAll('_', ' ');
}

function getStatusStyle(status?: string | null) {
  return (
    statusStyles[status || ''] || {
      background: '#F3F4F6',
      color: '#374151',
      border: '#E5E7EB',
    }
  );
}

function formatDate(value?: string | null) {
  if (!value) return 'Nicht hinterlegt';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Nicht hinterlegt';
  }

  return new Intl.DateTimeFormat('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
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

function fileKind(file: File) {
  return file.type.startsWith('video') ? 'video' : 'image';
}

function safeFileName(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
}

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
  return log.employee_id || log.staff_id || log.staff_role_id || log.user_id || log.employee_user_id || null;
}

function isOpenLog(log: JsonRecord) {
  const ended = log.ended_at || log.end_time || log.clock_out_at || log.finished_at;
  const status = String(log.status || '').toLowerCase();
  return !ended && !['submitted', 'completed', 'approved', 'closed'].includes(status);
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="opc-section-title">{children}</h2>;
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

function MetricCard({ label, value, helper }: { label: string; value: ReactNode; helper?: ReactNode }) {
  return (
    <div className="opc-metric-card">
      <div>
        <div className="opc-metric-value">{value}</div>
        <div className="opc-metric-label">{label}</div>
        {helper ? <div className="opc-metric-helper">{helper}</div> : null}
      </div>
      <div className="opc-metric-icon">⌁</div>
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

function inputStyle(): CSSProperties {
  return {
    width: '100%',
    minHeight: 42,
    border: '1px solid #E5E7EB',
    borderRadius: 14,
    padding: '10px 12px',
    fontSize: 14,
    fontWeight: 650,
    color: '#111827',
    outline: 'none',
    background: '#FFFFFF',
    fontFamily: pageFont,
    boxSizing: 'border-box',
  };
}

export default function EinsatzDetailPage({ jobId }: EinsatzDetailPageProps) {
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [databaseError, setDatabaseError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [employeesLoaded, setEmployeesLoaded] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [assignmentNote, setAssignmentNote] = useState('');
  const [employeeNote, setEmployeeNote] = useState('');
  const [uploadingPhase, setUploadingPhase] = useState<'before' | 'after' | null>(null);
  const [showAllMessages, setShowAllMessages] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState('');
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
  const messages = useMemo(() => asArray(job?.conversation_messages), [job]);
  const report = job?.report || null;

  const beforeMedia = useMemo(
    () =>
      media.filter((item) => {
        const phase = String(item.media_phase || item.photo_kind || item.section || '').toLowerCase();
        return phase.includes('before') || phase.includes('vorher');
      }),
    [media],
  );

  const afterMedia = useMemo(
    () =>
      media.filter((item) => {
        const phase = String(item.media_phase || item.photo_kind || item.section || '').toLowerCase();
        return phase.includes('after') || phase.includes('nachher');
      }),
    [media],
  );

  const otherMedia = useMemo(
    () =>
      media.filter((item) => {
        const phase = String(item.media_phase || item.photo_kind || item.section || '').toLowerCase();
        return !phase.includes('before') && !phase.includes('vorher') && !phase.includes('after') && !phase.includes('nachher');
      }),
    [media],
  );

  const activeTimeLog = useMemo(() => {
    const ownIds = [access.staffId, access.userId].filter(Boolean).map(String);
    return (
      timeLogs.find((log) => {
        const logOwner = getTimeLogEmployeeId(log);
        return isOpenLog(log) && (!ownIds.length || ownIds.includes(String(logOwner)));
      }) || null
    );
  }, [access.staffId, access.userId, timeLogs]);

  const visibleMessages = showAllMessages ? messages : messages.slice(0, 6);

  const filteredEmployees = useMemo(() => {
    const search = employeeSearch.trim().toLowerCase();
    const assignedIds = new Set(
      assignments
        .map((assignment) => String(getAssignmentEmployeeId(assignment) || ''))
        .filter(Boolean),
    );

    return employees
      .filter((employee) => {
        const values = [employee.display_name, employee.email, employee.phone_e164, employee.role]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return !search || values.includes(search);
      })
      .map((employee) => ({
        ...employee,
        alreadyAssigned:
          assignedIds.has(String(employee.id)) ||
          (employee.user_id ? assignedIds.has(String(employee.user_id)) : false),
      }));
  }, [assignments, employeeSearch, employees]);

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
      estimated_hours: source.estimated_hours !== null && source.estimated_hours !== undefined ? String(source.estimated_hours) : '',
      final_hours: source.final_hours !== null && source.final_hours !== undefined ? String(source.final_hours) : '',
      billable_amount: source.billable_amount !== null && source.billable_amount !== undefined ? String(source.billable_amount) : '',
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
      email: null,
      displayName: null,
      role: null,
      canEdit: false,
      isAssigned: false,
    };

    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user || null;

    if (!user) {
      return fallback;
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
          .ilike('email', user.email)
          .limit(1);

        if (!error && Array.isArray(data) && data.length > 0) {
          staffRow = data[0] as JsonRecord;
        }
      } catch {
        staffRow = null;
      }
    }

    const role = String(staffRow?.role || metadataRole || '').toLowerCase();
    const staffId = staffRow?.id ? String(staffRow.id) : null;
    const assignedIds = asArray(sourceJob.assignments).map((assignment) => String(getAssignmentEmployeeId(assignment) || ''));
    const ownIds = [staffId, user.id].filter(Boolean).map(String);
    const isAssigned = ownIds.some((id) => assignedIds.includes(id));
    const canEdit =
      ['owner', 'admin', 'dispatch', 'manager'].includes(role) ||
      staffRow?.can_manage_jobs === true ||
      staffRow?.can_view_all_jobs === true;

    return {
      loading: false,
      userId: user.id,
      staffId,
      employeeId: staffRow?.employee_id ? String(staffRow.employee_id) : null,
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

  const loadJob = useCallback(async () => {
    if (!jobId) {
      setDatabaseError('Keine Einsatz-ID vorhanden.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setDatabaseError(null);
    setActionMessage(null);

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
      setLoading(false);
    }
  }, [getAccessForJob, jobId, makeEditDraft]);

  useEffect(() => {
    void loadJob();
  }, [loadJob]);

  const loadEmployees = useCallback(async () => {
    if (employeesLoaded || !access.canEdit) return;

    try {
      const { data, error } = await supabase
        .from('opc_staff_roles')
        .select('id,user_id,employee_id,display_name,email,phone_e164,role,status')
        .in('status', ['active', 'aktiv'])
        .order('display_name', { ascending: true });

      if (!error && Array.isArray(data)) {
        setEmployees(data as EmployeeOption[]);
        setEmployeesLoaded(true);
      }
    } catch {
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

  const handleSaveJob = async () => {
    if (!job || !editDraft || !access.canEdit) return;

    setSaving(true);
    setActionMessage(null);

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
      updated_at: new Date().toISOString(),
    };

    try {
      let response = await supabase.from('opc_jobs').update(payload).eq('id', job.job_id).select('id');

      if (response.error || !response.data || response.data.length === 0) {
        response = await supabase.from('opc_jobs').update(payload).eq('job_id', job.job_id).select('job_id');
      }

      if (response.error) {
        throw new Error(response.error.message);
      }

      setActionMessage('Einsatz wurde gespeichert.');
      setEditMode(false);
      await loadJob();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Einsatz konnte nicht gespeichert werden.';
      setActionMessage(`Speichern fehlgeschlagen: ${message}`);
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
      new Date(new Date(job.planned_start).getTime() + Number(job.estimated_hours || 2) * 60 * 60 * 1000).toISOString();
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

        if (response.ok) {
          return;
        }
      } catch {
        // Endpoint may not exist yet. Continue with direct calendar-table fallback.
      }
    }

    const calendarQueries: any[] = [
      employee.user_id
        ? supabase
            .from('opc_calendars')
            .select('id')
            .eq('owner_user_id', employee.user_id)
            .eq('calendar_type', 'employee')
            .limit(1)
        : null,
      employee.user_id
        ? supabase
            .from('opc_calendars')
            .select('id')
            .eq('user_id', employee.user_id)
            .eq('calendar_type', 'employee')
            .limit(1)
        : null,
      supabase
        .from('opc_calendars')
        .select('id')
        .eq('staff_role_id', employee.id)
        .eq('calendar_type', 'employee')
        .limit(1),
    ].filter(Boolean);

    let calendarId: string | null = null;

    for (const query of calendarQueries) {
      try {
        const { data, error } = await query;
        if (!error && Array.isArray(data) && data[0]?.id) {
          calendarId = String(data[0].id);
          break;
        }
      } catch {
        // Ignore calendar lookup fallbacks.
      }
    }

    if (!calendarId) return;

    const eventPayloads: JsonRecord[] = [
      {
        calendar_id: calendarId,
        job_id: job.job_id,
        assignment_id: assignmentId || null,
        title,
        starts_at: start,
        ends_at: end,
        location,
        description,
        event_type: 'job',
        source_type: 'job_assignment',
        created_at: new Date().toISOString(),
      },
      {
        calendar_id: calendarId,
        job_id: job.job_id,
        assignment_id: assignmentId || null,
        title,
        start_time: start,
        end_time: end,
        location,
        description,
        type: 'job',
        source: 'job_assignment',
        created_at: new Date().toISOString(),
      },
      {
        calendar_id: calendarId,
        job_id: job.job_id,
        assignment_id: assignmentId || null,
        title,
        planned_start: start,
        planned_end: end,
        location,
        description,
        created_at: new Date().toISOString(),
      },
    ];

    for (const payload of eventPayloads) {
      try {
        const { data, error } = await supabase.from('opc_calendar_events').insert(payload).select('id').limit(1);
        if (!error) {
          const eventId = Array.isArray(data) && data[0]?.id ? String(data[0].id) : null;

          if (eventId) {
            try {
              await fetch(`${baseUrl}/api/opc/calendar/sync-google-event`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ calendar_event_id: eventId, calendar_id: calendarId }),
              });
            } catch {
              // Google sync stays best-effort. The assignment must not fail because of it.
            }
          }

          return;
        }
      } catch {
        // Continue with next known schema variant.
      }
    }
  };

  const handleAddAssignment = async (employeeId = selectedEmployeeId) => {
    if (!job || !employeeId || !access.canEdit) return;

    const selected = employees.find((employee) => employee.id === employeeId);
    if (!selected) return;

    setSaving(true);
    setActionMessage(null);

    const base = {
      job_id: job.job_id,
      status: 'assigned',
      assignment_status: 'assigned',
      notes: cleanNullable(assignmentNote),
      created_at: new Date().toISOString(),
    };

    const variants: JsonRecord[] = [
      { ...base, employee_id: selected.id },
      { ...base, employee_id: selected.user_id || selected.id },
      { ...base, staff_role_id: selected.id },
      { ...base, staff_id: selected.id },
      { ...base, user_id: selected.user_id || selected.id },
      { ...base, assigned_to: selected.user_id || selected.id },
    ];

    try {
      let lastError: string | null = null;
      let insertedAssignmentId: string | null = null;

      for (const payload of variants) {
        const response = await supabase.from('opc_job_assignments').insert(payload).select('*').limit(1);
        if (!response.error) {
          const row = Array.isArray(response.data) ? response.data[0] : null;
          insertedAssignmentId = row?.id || row?.assignment_id || null;

          void syncAssignmentToCalendar(selected, insertedAssignmentId).catch(() => undefined);

          setSelectedEmployeeId('');
          setAssignmentNote('');
          setAssignModalOpen(false);
          setEmployeeSearch('');
          setActionMessage('Mitarbeiter wurde zugewiesen. Kalender-Sync wurde ausgelöst.');
          await loadJob();
          setSaving(false);
          return;
        }
        lastError = response.error.message;
      }

      throw new Error(lastError || 'Zuweisung konnte nicht erstellt werden.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Zuweisung konnte nicht erstellt werden.';
      setActionMessage(`Zuweisung fehlgeschlagen: ${message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleEmployeeNote = async () => {
    if (!job || !employeeNote.trim()) return;

    setSaving(true);
    setActionMessage(null);

    const author = access.displayName || access.email || 'Mitarbeiter';
    const stamp = new Intl.DateTimeFormat('de-CH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date());
    const nextNotes = [job.employee_notes, `[${stamp}] ${author}: ${employeeNote.trim()}`]
      .filter(Boolean)
      .join('\n\n');

    try {
      let response = await supabase
        .from('opc_jobs')
        .update({ employee_notes: nextNotes, updated_at: new Date().toISOString() })
        .eq('id', job.job_id)
        .select('id');

      if (response.error || !response.data || response.data.length === 0) {
        response = await supabase
          .from('opc_jobs')
          .update({ employee_notes: nextNotes, updated_at: new Date().toISOString() })
          .eq('job_id', job.job_id)
          .select('job_id');
      }

      if (response.error) {
        throw new Error(response.error.message);
      }

      setEmployeeNote('');
      setActionMessage('Notiz wurde gespeichert.');
      await loadJob();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Notiz konnte nicht gespeichert werden.';
      setActionMessage(`Notiz fehlgeschlagen: ${message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleClockIn = async () => {
    if (!job) return;

    setSaving(true);
    setActionMessage(null);

    const now = new Date().toISOString();
    const noteText = employeeNote.trim() || null;

    try {
      const rpcResult = await supabase.rpc('opc_clock_in_job', {
        p_job_id: job.job_id,
        p_employee_note: noteText,
      });

      if (!rpcResult.error) {
        setEmployeeNote('');
        setActionMessage('Eingestempelt.');
        await loadJob();
        return;
      }

      const functionMissing =
        rpcResult.error.message.includes('Could not find the function') ||
        rpcResult.error.message.includes('function public.opc_clock_in_job') ||
        rpcResult.error.message.includes('PGRST202');

      if (!functionMissing) {
        throw new Error(rpcResult.error.message);
      }

      const payload: JsonRecord = {
        job_id: job.job_id,
        user_id: access.userId,
        staff_role_id: access.staffId,
        employee_id: access.employeeId,
        employee_name: access.displayName,
        work_date: localDateString(),
        clock_in_at: now,
        status: 'submitted',
        employee_note: noteText,
        created_at: now,
        updated_at: now,
      };

      Object.keys(payload).forEach((key) => {
        if (payload[key] === null || payload[key] === undefined || payload[key] === '') {
          delete payload[key];
        }
      });

      const { error } = await supabase.from('opc_job_time_logs').insert(payload);
      if (error) {
        throw new Error(error.message);
      }

      setEmployeeNote('');
      setActionMessage('Eingestempelt.');
      await loadJob();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Einstempeln fehlgeschlagen.';
      setActionMessage(`Einstempeln fehlgeschlagen: ${message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleClockOut = async () => {
    if (!activeTimeLog) return;

    setSaving(true);
    setActionMessage(null);

    const logId = activeTimeLog.id || activeTimeLog.time_log_id;
    const now = new Date().toISOString();
    const noteText = employeeNote.trim() || activeTimeLog.employee_note || null;

    try {
      const rpcResult = await supabase.rpc('opc_clock_out_job', {
        p_time_entry_id: logId,
        p_employee_note: noteText,
      });

      if (!rpcResult.error) {
        setEmployeeNote('');
        setActionMessage('Ausgestempelt und eingereicht.');
        await loadJob();
        return;
      }

      const functionMissing =
        rpcResult.error.message.includes('Could not find the function') ||
        rpcResult.error.message.includes('function public.opc_clock_out_job') ||
        rpcResult.error.message.includes('PGRST202');

      if (!functionMissing) {
        throw new Error(rpcResult.error.message);
      }

      const payload: JsonRecord = {
        clock_out_at: now,
        status: 'submitted',
        submitted_at: now,
        updated_at: now,
        employee_note: noteText,
      };

      Object.keys(payload).forEach((key) => {
        if (payload[key] === null || payload[key] === undefined || payload[key] === '') {
          delete payload[key];
        }
      });

      const { error } = await supabase.from('opc_job_time_logs').update(payload).eq('id', logId);
      if (error) {
        throw new Error(error.message);
      }

      setEmployeeNote('');
      setActionMessage('Ausgestempelt und eingereicht.');
      await loadJob();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ausstempeln fehlgeschlagen.';
      setActionMessage(`Ausstempeln fehlgeschlagen: ${message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleUploadMedia = async (phase: 'before' | 'after', event: ChangeEvent<HTMLInputElement>) => {
    if (!job) return;

    const files = Array.from(event.target.files || []);
    event.target.value = '';

    if (!files.length) return;

    setUploadingPhase(phase);
    setActionMessage(null);

    const uploader = access.staffId || access.userId;
    const authFolder = access.userId || 'unknown-user';

    try {
      for (const file of files) {
        const timestamp = Date.now();
        const cleanedName = safeFileName(file.name);
        const bucketName = 'opc-job-media';
        const filePath = `${authFolder}/jobs/${job.job_id}/${phase}/${timestamp}-${cleanedName}`;

        const upload = await supabase.storage.from(bucketName).upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type,
        });

        if (upload.error) {
          throw new Error(
            `Storage-RLS blockiert den Upload in ${bucketName}. Bitte die neue SQL-Policy ausführen. Supabase: ${upload.error.message}`,
          );
        }

        const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);
        const publicUrl = publicUrlData.publicUrl;
        const mediaKind = fileKind(file);
        const now = new Date().toISOString();

        const rpcResult = await supabase.rpc('opc_register_job_media', {
          p_job_id: job.job_id,
          p_phase: phase,
          p_file_url: publicUrl,
          p_storage_bucket: bucketName,
          p_storage_path: filePath,
          p_filename: file.name,
          p_mime_type: file.type || null,
          p_media_type: mediaKind,
          p_file_size: file.size,
        });

        if (!rpcResult.error) {
          continue;
        }

        const functionMissing =
          rpcResult.error.message.includes('Could not find the function') ||
          rpcResult.error.message.includes('function public.opc_register_job_media') ||
          rpcResult.error.message.includes('PGRST202');

        if (!functionMissing) {
          throw new Error(rpcResult.error.message);
        }

        const payload: JsonRecord = {
          job_id: job.job_id,
          media_phase: phase,
          file_url: publicUrl,
          filename: file.name,
          mime_type: file.type || null,
          media_type: mediaKind,
          file_size: file.size,
          storage_bucket: bucketName,
          storage_path: filePath,
          uploaded_by: uploader,
          uploaded_by_user_id: access.userId,
          created_at: now,
        };

        Object.keys(payload).forEach((key) => {
          if (payload[key] === null || payload[key] === undefined || payload[key] === '') {
            delete payload[key];
          }
        });

        const { error } = await supabase.from('opc_job_media').insert(payload);
        if (error) {
          throw new Error(
            `Datei wurde hochgeladen, aber der Medien-Datenbankeintrag wurde blockiert. Bitte die neue SQL-Policy ausführen. Supabase: ${error.message}`,
          );
        }
      }

      setActionMessage(phase === 'before' ? 'Vorher-Medien hochgeladen.' : 'Nachher-Medien hochgeladen.');
      await loadJob();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload fehlgeschlagen.';
      setActionMessage(`Upload fehlgeschlagen: ${message}`);
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
          const url = item.file_url || item.public_url || item.url || item.signed_url;
          return (
            <a
              key={item.id || item.media_id || index}
              className="opc-media-item"
              href={url || '#'}
              target="_blank"
              rel="noreferrer"
            >
              <span>{item.media_type || item.photo_kind || item.filename || 'Datei'}</span>
              <strong>{item.filename || 'Öffnen'}</strong>
            </a>
          );
        })}
      </div>
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

        {loading && <div className="opc-loading-card">Einsatz wird geladen.</div>}

        {!loading && databaseError && <div className="opc-error-card">{databaseError}</div>}

        {!loading && !databaseError && job && (
          <>
            {actionMessage ? <div className="opc-action-message">{actionMessage}</div> : null}

            <section className="opc-hero-card" style={cardStyle}>
              <div className="opc-hero-main">
                <div>
                  <div className="opc-eyebrow">{job.service_category || 'Einsatz'}</div>
                  <h1>{job.title || `${job.service_category || 'Einsatz'} · ${getDisplayName(job)}`}</h1>
                  <div className="opc-hero-meta">
                    <span>{getDisplayName(job)}</span>
                    <span>{job.site_name || 'Standort nicht hinterlegt'}</span>
                    <span>{formatDate(job.planned_start)}</span>
                  </div>
                </div>

                <div className="opc-hero-actions">
                  <StatusBadge status={job.status} />
                  {access.canEdit ? (
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
              </div>
            </section>

            <div className="opc-metrics-grid">
              <MetricCard label="Status" value={formatStatus(job.status)} />
              <MetricCard label="Geplant" value={formatTime(job.planned_start)} helper={formatDate(job.planned_start)} />
              <MetricCard label="Dauer" value={job.estimated_hours ? `${job.estimated_hours} h` : '—'} />
              <MetricCard label="Bericht" value={job.report_required ? 'Erforderlich' : 'Optional'} />
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
                      <option value="completed">Abgeschlossen</option>
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
              <SectionTitle>Einsatzdaten</SectionTitle>
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
                <MiniField
                  label="Standort"
                  value={
                    job.client_site_id ? (
                      <a className="opc-inline-link" href={`${baseUrl}/kunden/${job.client_id || ''}`}>
                        {job.site_name || 'Standort öffnen'}
                      </a>
                    ) : (
                      job.site_name
                    )
                  }
                />
                <MiniField label="Adresse" value={joinAddress(job)} />
                <MiniField label="Typ" value={job.site_type} />
                <MiniField label="Betrag" value={job.billable_amount ? `${job.billable_amount} ${job.currency || 'CHF'}` : null} />
              </DetailCard>
            </div>

            <div className="opc-main-grid">
              <div className="opc-left-col">
                <section className="opc-section-card" style={cardStyle}>
                  <div className="opc-split-header">
                    <h2>Notizen & Bericht</h2>
                  </div>
                  <div className="opc-two-col">
                    <div>
                      <h3>Notizen</h3>
                      <div className="opc-note-box">{job.dispatcher_notes || job.internal_notes || 'Keine Notizen hinterlegt.'}</div>
                      {job.employee_notes ? <div className="opc-note-box opc-note-box-secondary">{job.employee_notes}</div> : null}
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

                <section className="opc-section-card" style={cardStyle}>
                  <div className="opc-split-header">
                    <h2>Nachrichten</h2>
                    {messages.length > 6 ? (
                      <button type="button" className="opc-link-button" onClick={() => setShowAllMessages((current) => !current)}>
                        {showAllMessages ? 'Weniger anzeigen' : `Alle ${messages.length} anzeigen`}
                      </button>
                    ) : null}
                  </div>

                  {visibleMessages.length === 0 ? (
                    <div className="opc-empty-box">Keine Nachrichten vorhanden.</div>
                  ) : (
                    <div className="opc-message-list">
                      {visibleMessages.map((message, index) => (
                        <div key={message.id || message.message_id || index} className="opc-message-card">
                          <div className="opc-message-top">
                            <strong>{message.sender_display || message.sender_type || 'Nachricht'}</strong>
                            <span>{formatDate(message.created_at)}</span>
                          </div>
                          <p>
                            {message.message_text_german ||
                              message.message_text_original ||
                              message.last_message ||
                              'Keine Nachricht'}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>

              <aside className="opc-right-col">
                <section className="opc-section-card" style={cardStyle}>
                  <div className="opc-split-header">
                    <h2>Admin & Zuweisungen</h2>
                  </div>

                  {assignments.length === 0 ? (
                    <div className="opc-empty-box">Keine Zuweisungen vorhanden.</div>
                  ) : (
                    <div className="opc-assignment-list">
                      {assignments.map((assignment, index) => (
                        <div key={assignment.id || assignment.assignment_id || index} className="opc-assignment-card">
                          <div>
                            <strong>{assignment.employee_name || assignment.display_name || 'Mitarbeiter'}</strong>
                            <span>{assignment.phone_e164 || assignment.email || 'Kontakt nicht hinterlegt'}</span>
                          </div>
                          <StatusBadge status={assignment.assignment_status || assignment.status || 'assigned'} />
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

                <section className="opc-section-card" style={cardStyle}>
                  <div className="opc-split-header">
                    <h2>Mitarbeiter-Aktion</h2>
                  </div>

                  <textarea
                    style={{ ...inputStyle(), minHeight: 84, resize: 'vertical' }}
                    placeholder="Notiz zum Einsatz hinzufügen"
                    value={employeeNote}
                    onChange={(event) => setEmployeeNote(event.target.value)}
                  />
                  <div className="opc-action-row">
                    <button type="button" className="opc-btn opc-btn-light" disabled={saving || !employeeNote.trim()} onClick={handleEmployeeNote}>
                      Notiz speichern
                    </button>
                    {activeTimeLog ? (
                      <button type="button" className="opc-btn opc-btn-dark" disabled={saving} onClick={handleClockOut}>
                        Ausstempeln
                      </button>
                    ) : (
                      <button type="button" className="opc-btn opc-btn-dark" disabled={saving} onClick={handleClockIn}>
                        Einstempeln
                      </button>
                    )}
                  </div>
                </section>

                <section className="opc-section-card" style={cardStyle}>
                  <div className="opc-split-header">
                    <h2>Zeiten & Medien</h2>
                  </div>

                  <div className="opc-two-mini">
                    <div>
                      <h3>Zeiterfassung</h3>
                      {timeLogs.length === 0 ? (
                        <div className="opc-empty-box">Keine Zeitlogs vorhanden.</div>
                      ) : (
                        <div className="opc-small-list">
                          {timeLogs.slice(0, 4).map((log, index) => (
                            <div key={log.id || index} className="opc-small-row">
                              <strong>{log.employee_name || log.display_name || 'Mitarbeiter'}</strong>
                              <span>
                                {formatTime(log.started_at || log.start_time || log.clock_in_at)} –{' '}
                                {formatTime(log.ended_at || log.end_time || log.clock_out_at)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <h3>Schäden</h3>
                      {damageReports.length === 0 ? (
                        <div className="opc-empty-box">Keine Schäden gemeldet.</div>
                      ) : (
                        <div className="opc-small-list">
                          {damageReports.slice(0, 3).map((damage, index) => (
                            <div key={damage.id || index} className="opc-small-row danger">
                              <strong>{damage.title || damage.damage_type || 'Schaden'}</strong>
                              <span>{damage.description || damage.notes || 'Keine Beschreibung'}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="opc-media-section">
                    <div className="opc-media-header">
                      <h3>Vorher</h3>
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
                    </div>
                    {renderMediaList(beforeMedia, 'Noch keine Vorher-Medien.')}
                  </div>

                  <div className="opc-media-section">
                    <div className="opc-media-header">
                      <h3>Nachher</h3>
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

                <section className="opc-section-card" style={cardStyle}>
                  <div className="opc-split-header">
                    <h2>Kurzinfo</h2>
                  </div>
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
                      <span>{employee.email || employee.phone_e164 || employee.role || 'Kontakt nicht hinterlegt'}</span>
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
          color: #111827;
          overflow-x: hidden;
        }

        .opc-back-link {
          display: inline-flex;
          align-items: center;
          height: 38px;
          padding: 0 14px;
          margin-bottom: 14px;
          border: 1px solid #E5E7EB;
          border-radius: 999px;
          color: #111827;
          text-decoration: none;
          font-size: 13px;
          font-weight: 760;
          background: #FFFFFF;
        }

        .opc-loading-card,
        .opc-error-card,
        .opc-action-message {
          border-radius: 18px;
          padding: 16px 18px;
          font-size: 14px;
          font-weight: 720;
          margin-bottom: 14px;
        }

        .opc-loading-card {
          border: 1px solid #E5E7EB;
          color: #6B7280;
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

        .opc-hero-card {
          padding: 24px;
          margin-bottom: 14px;
        }

        .opc-hero-main {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          align-items: flex-start;
        }

        .opc-eyebrow {
          font-size: 12px;
          color: #6B7280;
          font-weight: 760;
          margin-bottom: 6px;
        }

        .opc-hero-card h1 {
          margin: 0;
          font-size: 29px;
          line-height: 1.05;
          font-weight: 860;
          letter-spacing: -0.045em;
          color: #111827;
        }

        .opc-hero-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px 14px;
          margin-top: 9px;
          font-size: 13px;
          font-weight: 720;
          color: #6B7280;
        }

        .opc-hero-actions {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
          justify-content: flex-end;
          min-width: 190px;
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
          grid-template-columns: repeat(4, minmax(0, 1fr));
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
          border: 1px solid #E5E7EB;
          border-radius: 18px;
          box-shadow: 0 1px 2px rgba(15,23,42,0.04);
        }

        .opc-metric-value {
          font-size: 22px;
          line-height: 1.05;
          font-weight: 860;
          letter-spacing: -0.035em;
          color: #111827;
        }

        .opc-metric-label {
          margin-top: 5px;
          font-size: 12px;
          font-weight: 820;
          color: #6B7280;
        }

        .opc-metric-helper {
          margin-top: 4px;
          font-size: 11px;
          font-weight: 680;
          color: #9CA3AF;
        }

        .opc-metric-icon {
          width: 36px;
          height: 36px;
          border: 1px solid #E5E7EB;
          border-radius: 13px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #111827;
          background: #F9FAFB;
          flex: 0 0 auto;
        }

        .opc-section-title {
          margin: 20px 0 10px;
          font-size: 19px;
          line-height: 1.15;
          font-weight: 860;
          color: #111827;
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
          border: 1px solid #E5E7EB;
          border-radius: 999px;
          background: #FFFFFF;
          color: #111827;
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
        .opc-edit-panel {
          background: #FFFFFF;
          border: 1px solid #E5E7EB;
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
          color: #111827;
          letter-spacing: -0.02em;
        }

        .opc-detail-card-body,
        .opc-rows {
          display: grid;
          gap: 0;
        }

        .opc-mini-field {
          display: grid;
          grid-template-columns: minmax(86px, 0.8fr) minmax(0, 1.2fr);
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
          color: #6B7280;
        }

        .opc-mini-field strong {
          font-size: 12px;
          line-height: 1.35;
          font-weight: 820;
          color: #111827;
          text-align: right;
          word-break: break-word;
          overflow-wrap: anywhere;
        }

        .opc-inline-link {
          color: #111827;
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        .opc-main-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.15fr) minmax(360px, 0.85fr);
          gap: 14px;
          align-items: start;
        }

        .opc-left-col,
        .opc-right-col {
          display: grid;
          gap: 14px;
        }

        .opc-section-card,
        .opc-edit-panel {
          padding: 16px;
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
          color: #111827;
        }

        .opc-two-col {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 12px;
        }

        .opc-two-mini {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 10px;
          margin-bottom: 14px;
        }

        .opc-note-box,
        .opc-empty-box {
          min-height: 48px;
          border: 1px solid #F3F4F6;
          border-radius: 14px;
          padding: 12px;
          background: #FAFAFA;
          color: #6B7280;
          font-size: 13px;
          line-height: 1.45;
          font-weight: 650;
          white-space: pre-wrap;
        }

        .opc-note-box-secondary {
          margin-top: 8px;
          background: #FFFFFF;
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

        .opc-message-top strong,
        .opc-assignment-card strong,
        .opc-small-row strong {
          display: block;
          font-size: 12px;
          font-weight: 840;
          color: #111827;
        }

        .opc-message-top span,
        .opc-assignment-card span,
        .opc-small-row span {
          display: block;
          margin-top: 3px;
          font-size: 11px;
          font-weight: 650;
          color: #6B7280;
        }

        .opc-message-card p {
          margin: 8px 0 0;
          font-size: 12px;
          line-height: 1.5;
          font-weight: 620;
          color: #374151;
          word-break: break-word;
          overflow-wrap: anywhere;
        }

        .opc-link-button {
          border: 0;
          background: transparent;
          color: #111827;
          font-size: 12px;
          font-weight: 780;
          cursor: pointer;
        }

        .opc-btn {
          height: 42px;
          border-radius: 14px;
          padding: 0 16px;
          border: 1px solid #E5E7EB;
          font-size: 13px;
          font-weight: 820;
          font-family: inherit;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          white-space: nowrap;
        }

        .opc-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .opc-btn-dark {
          background: #070A10;
          color: #FFFFFF;
          border-color: #070A10;
        }

        .opc-btn-light {
          background: #FFFFFF;
          color: #111827;
          border-color: #E5E7EB;
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
          border: 1px solid #E5E7EB;
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
          color: #111827;
        }

        .opc-modal-header p {
          margin: 6px 0 0;
          font-size: 13px;
          line-height: 1.45;
          font-weight: 650;
          color: #6B7280;
        }

        .opc-modal-close {
          width: 38px;
          height: 38px;
          border: 1px solid #E5E7EB;
          border-radius: 999px;
          background: #FFFFFF;
          color: #111827;
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
          border: 1px solid #E5E7EB;
          border-radius: 16px;
          padding: 11px;
          background: #FFFFFF;
          color: #111827;
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
          background: #070A10;
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
          color: #111827;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .opc-employee-copy span {
          font-size: 12px;
          font-weight: 650;
          color: #6B7280;
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
          background: #070A10;
          color: #FFFFFF;
          font-size: 12px;
          font-weight: 820;
          white-space: nowrap;
        }

        .opc-employee-option.is-assigned .opc-employee-action {
          background: #F3F4F6;
          color: #6B7280;
        }

        .opc-modal-footer {
          display: flex;
          justify-content: flex-end;
          padding-top: 2px;
        }

        .opc-action-row,
        .opc-edit-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 9px;
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
          border: 1px solid #E5E7EB;
          border-radius: 999px;
          color: #111827;
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
          gap: 8px;
        }

        .opc-media-item {
          display: grid;
          gap: 3px;
          min-height: 48px;
          border: 1px solid #F3F4F6;
          border-radius: 12px;
          padding: 10px;
          background: #FAFAFA;
          text-decoration: none;
          color: #111827;
        }

        .opc-media-item span {
          font-size: 10px;
          font-weight: 760;
          color: #6B7280;
          text-transform: uppercase;
        }

        .opc-media-item strong {
          font-size: 12px;
          font-weight: 820;
          color: #111827;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .opc-rows.compact .opc-mini-field {
          grid-template-columns: 92px minmax(0, 1fr);
        }

        .danger {
          border-color: #FECACA;
          background: #FEF2F2;
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

          .opc-hero-actions {
            justify-content: stretch;
            min-width: 0;
          }

          .opc-hero-actions .opc-btn,
          .opc-hero-actions .opc-status-badge {
            flex: 1 1 auto;
          }

          .opc-metrics-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
            margin-bottom: 14px;
          }

          .opc-metric-card {
            min-height: 68px;
            padding: 13px;
            border-radius: 16px;
          }

          .opc-metric-value {
            font-size: 18px;
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
          .opc-right-col {
            display: grid;
            grid-template-columns: 1fr;
            gap: 11px;
          }

          .opc-section-card,
          .opc-edit-panel {
            padding: 14px;
            border-radius: 18px !important;
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
          .opc-two-mini,
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
            max-height: 78px;
            overflow: auto;
            font-size: 11.5px;
          }

          .opc-action-row,
          .opc-edit-actions {
            display: grid;
            grid-template-columns: 1fr;
          }

          .opc-btn {
            width: 100%;
            height: 40px;
            border-radius: 13px;
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

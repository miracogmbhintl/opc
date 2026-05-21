import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin, { DateClickArg } from '@fullcalendar/interaction';
import { EventClickArg, EventDropArg } from '@fullcalendar/core';
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  Users,
  X,
} from 'lucide-react';
import CalendarEventModal from './CalendarEventModal';
import CalendarInvitePanel from './CalendarInvitePanel';

type CalendarRow = {
  id: string;
  calendar_type: 'employee' | 'admin' | 'team' | 'system';
  owner_user_id: string | null;
  owner_staff_role_id: string | null;
  name: string;
  description?: string | null;
  is_private: boolean;
  is_active: boolean;
};

type StaffRow = {
  id: string;
  user_id: string | null;
  name: string;
  role: string;
  is_admin: boolean;
  is_active: boolean;
};

type CalendarAttendee = {
  id: string;
  event_id: string;
  user_id: string | null;
  staff_role_id: string | null;
  attendee_role: string;
  status: 'needs_action' | 'accepted' | 'declined' | 'tentative';
  response_note?: string | null;
};

type CalendarEvent = {
  id: string;
  calendar_id: string;
  event_type:
    | 'job_requested'
    | 'job_scheduled'
    | 'job_active'
    | 'job_completed'
    | 'internal'
    | 'absence'
    | 'blocked_time';
  status:
    | 'draft'
    | 'requested'
    | 'pending_acceptance'
    | 'confirmed'
    | 'in_progress'
    | 'completed'
    | 'cancelled'
    | 'declined';
  title: string;
  description?: string | null;
  starts_at: string;
  ends_at: string;
  timezone: string;
  location_name?: string | null;
  location_address?: string | null;
  attendees?: CalendarAttendee[];
};

type ApiPayload = {
  calendars: CalendarRow[];
  events: CalendarEvent[];
  staff: StaffRow[];
  notifications?: unknown[];
  currentUserId: string;
  currentRole: string;
};

type ModalState =
  | { mode: 'create'; startsAt?: string; endsAt?: string }
  | { mode: 'edit'; event: CalendarEvent }
  | null;

type CalendarViewFilter = 'all' | 'employee' | 'admin' | 'team';
type StatusFilter = 'all' | 'open' | 'in_progress' | 'done';

const BRAND = {
  text: '#111827',
  muted: '#6B7280',
  faint: '#9CA3AF',
  border: '#E5E7EB',
  softBorder: '#F3F4F6',
  black: '#0F1115',
  card: '#FFFFFF',
  soft: '#FAFAFA',
  red: '#B91C1C',
  amber: '#92400E',
  green: '#166534',
};

const pageFont = 'Inter, Helvetica, Arial, sans-serif';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Entwurf',
  requested: 'Offen',
  pending_acceptance: 'In Bearbeitung',
  confirmed: 'Bestätigt',
  in_progress: 'In Bearbeitung',
  completed: 'Erledigt',
  cancelled: 'Storniert',
  declined: 'Abgelehnt',
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  job_requested: 'Anfrage',
  job_scheduled: 'Einsatz',
  job_active: 'Laufend',
  job_completed: 'Erledigt',
  internal: 'Intern',
  absence: 'Abwesenheit',
  blocked_time: 'Blockiert',
};

const cardStyle: CSSProperties = {
  background: BRAND.card,
  border: `1px solid ${BRAND.border}`,
  borderRadius: '20px',
  boxShadow: '0 12px 32px rgba(15, 17, 21, 0.04)',
};

const selectStyle: CSSProperties = {
  width: '100%',
  height: '48px',
  borderRadius: '14px',
  border: `1px solid ${BRAND.border}`,
  background: '#FFFFFF',
  color: BRAND.text,
  outline: 'none',
  padding: '0 13px',
  fontSize: '14px',
  fontWeight: 650,
  fontFamily: pageFont,
  boxSizing: 'border-box',
};

const blackButtonStyle: CSSProperties = {
  width: '100%',
  height: '48px',
  borderRadius: '14px',
  border: `1px solid ${BRAND.black}`,
  background: BRAND.black,
  color: '#FFFFFF',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '9px',
  fontSize: '14px',
  fontWeight: 760,
  fontFamily: pageFont,
  textDecoration: 'none',
  whiteSpace: 'nowrap',
  boxSizing: 'border-box',
  cursor: 'pointer',
};

const secondaryButtonStyle: CSSProperties = {
  width: '100%',
  height: '48px',
  borderRadius: '14px',
  border: `1px solid ${BRAND.border}`,
  background: '#FFFFFF',
  color: BRAND.text,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '9px',
  fontSize: '14px',
  fontWeight: 760,
  fontFamily: pageFont,
  textDecoration: 'none',
  whiteSpace: 'nowrap',
  boxSizing: 'border-box',
  cursor: 'pointer',
};

const compactButtonStyle: CSSProperties = {
  height: '36px',
  borderRadius: '12px',
  border: `1px solid ${BRAND.border}`,
  background: '#FFFFFF',
  color: BRAND.text,
  padding: '0 12px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '7px',
  fontSize: '13px',
  fontWeight: 760,
  fontFamily: pageFont,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const compactBlackButtonStyle: CSSProperties = {
  ...compactButtonStyle,
  border: `1px solid ${BRAND.black}`,
  background: BRAND.black,
  color: '#FFFFFF',
};

const inputWithIconStyle: CSSProperties = {
  width: '100%',
  height: '48px',
  padding: '0 14px 0 42px',
  borderRadius: '14px',
  border: `1px solid ${BRAND.border}`,
  background: '#FFFFFF',
  color: BRAND.text,
  outline: 'none',
  fontSize: '14px',
  fontWeight: 560,
  fontFamily: pageFont,
  boxSizing: 'border-box',
};

const searchIconStyle: CSSProperties = {
  position: 'absolute',
  left: '14px',
  top: '50%',
  transform: 'translateY(-50%)',
  color: BRAND.faint,
  pointerEvents: 'none',
};

const errorStyle: CSSProperties = {
  marginBottom: '16px',
  padding: '13px 15px',
  borderRadius: '14px',
  border: '1px solid #FCA5A5',
  background: '#FEF2F2',
  color: BRAND.red,
  fontSize: '14px',
  fontWeight: 620,
};

function getAccessTokenFromStorage(): string | null {
  if (typeof window === 'undefined') return null;

  const keys = Object.keys(window.localStorage);
  const supabaseKey = keys.find(
    (key) =>
      key.startsWith('sb-') &&
      key.endsWith('-auth-token') &&
      window.localStorage.getItem(key)
  );

  if (!supabaseKey) return null;

  try {
    const raw = window.localStorage.getItem(supabaseKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    if (parsed?.access_token) return parsed.access_token;
    if (parsed?.currentSession?.access_token) return parsed.currentSession.access_token;
    if (parsed?.session?.access_token) return parsed.session.access_token;

    return null;
  } catch {
    return null;
  }
}

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getAccessTokenFromStorage();
  const headers = new Headers(options.headers || {});

  headers.set('Content-Type', 'application/json');

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  const json = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(json?.error || `Request failed: ${response.status}`);
  }

  return json as T;
}

function normalizeStatus(status: CalendarEvent['status']): StatusFilter {
  if (status === 'completed') return 'done';
  if (status === 'in_progress' || status === 'pending_acceptance') return 'in_progress';
  return 'open';
}

function formatDateTimeForInput(value?: string | null): string {
  if (!value) return '';

  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60_000);

  return localDate.toISOString().slice(0, 16);
}

function addOneHourIso(dateIso: string): string {
  const date = new Date(dateIso);
  date.setHours(date.getHours() + 1);
  return date.toISOString();
}

function formatTimeRange(start?: string | null, end?: string | null) {
  if (!start || !end) return '—';

  try {
    const startDate = new Date(start);
    const endDate = new Date(end);

    const day = new Intl.DateTimeFormat('de-CH', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    }).format(startDate);

    const startTime = new Intl.DateTimeFormat('de-CH', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(startDate);

    const endTime = new Intl.DateTimeFormat('de-CH', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(endDate);

    return `${day}, ${startTime} bis ${endTime}`;
  } catch {
    return '—';
  }
}

function getFocusLabel(event: CalendarEvent) {
  const now = Date.now();
  const start = new Date(event.starts_at).getTime();
  const end = new Date(event.ends_at).getTime();

  if (!Number.isNaN(start) && !Number.isNaN(end) && start <= now && end >= now) {
    return 'Jetzt';
  }

  if (!Number.isNaN(start) && start > now) {
    return 'Nächster Termin';
  }

  return 'Gerade beendet';
}

function MetricCard({
  label,
  value,
  icon,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  icon: ReactNode;
  tone?: 'neutral' | 'danger' | 'warning' | 'success';
}) {
  const valueColor =
    tone === 'danger'
      ? BRAND.red
      : tone === 'warning'
        ? BRAND.amber
        : tone === 'success'
          ? BRAND.green
          : BRAND.text;

  return (
    <div
      style={{
        ...cardStyle,
        minHeight: '96px',
        padding: '18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '14px',
      }}
    >
      <div>
        <div
          style={{
            fontSize: '24px',
            lineHeight: 1,
            fontWeight: 820,
            letterSpacing: '-0.04em',
            color: valueColor,
            marginBottom: '10px',
          }}
        >
          {value}
        </div>

        <div
          style={{
            fontSize: '13px',
            fontWeight: 720,
            color: BRAND.muted,
          }}
        >
          {label}
        </div>
      </div>

      <div
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '12px',
          border: `1px solid ${BRAND.border}`,
          background: '#FAFAFA',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: BRAND.black,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: CalendarEvent['status'] }) {
  const group = normalizeStatus(status);

  const style =
    group === 'done'
      ? { bg: '#F0FDF4', text: BRAND.green, border: '#BBF7D0' }
      : group === 'in_progress'
        ? { bg: '#FFFBEB', text: BRAND.amber, border: '#FDE68A' }
        : { bg: '#F9FAFB', text: BRAND.muted, border: BRAND.border };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '25px',
        padding: '0 9px',
        borderRadius: '999px',
        border: `1px solid ${style.border}`,
        background: style.bg,
        color: style.text,
        fontSize: '11px',
        fontWeight: 760,
        whiteSpace: 'nowrap',
      }}
    >
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function TypeBadge({ type }: { type: CalendarEvent['event_type'] }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: '25px',
        padding: '0 9px',
        borderRadius: '999px',
        border: `1px solid ${BRAND.border}`,
        background: '#FFFFFF',
        color: BRAND.muted,
        fontSize: '11px',
        fontWeight: 760,
        whiteSpace: 'nowrap',
      }}
    >
      {EVENT_TYPE_LABELS[type] || type}
    </span>
  );
}

function EventQuickView({
  event,
  isAdmin,
  onClose,
  onEdit,
}: {
  event: CalendarEvent;
  isAdmin: boolean;
  onClose: () => void;
  onEdit: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        background: 'rgba(15, 17, 21, 0.24)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '22px',
      }}
      onMouseDown={onClose}
    >
      <div
        onMouseDown={(mouseEvent) => mouseEvent.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '520px',
          background: '#FFFFFF',
          border: `1px solid ${BRAND.border}`,
          borderRadius: '24px',
          boxShadow: '0 24px 80px rgba(15, 17, 21, 0.22)',
          overflow: 'hidden',
          fontFamily: pageFont,
        }}
      >
        <div
          style={{
            padding: '18px 20px',
            borderBottom: `1px solid ${BRAND.softBorder}`,
            display: 'flex',
            justifyContent: 'space-between',
            gap: '16px',
            alignItems: 'flex-start',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: '20px',
                fontWeight: 820,
                color: BRAND.text,
                letterSpacing: '-0.035em',
                lineHeight: 1.2,
                marginBottom: '8px',
              }}
            >
              {event.title || 'Kalendereintrag'}
            </div>

            <div
              style={{
                fontSize: '13px',
                fontWeight: 650,
                color: BRAND.muted,
              }}
            >
              {formatTimeRange(event.starts_at, event.ends_at)}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '12px',
              border: `1px solid ${BRAND.border}`,
              background: '#FFFFFF',
              color: BRAND.text,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <X size={17} />
          </button>
        </div>

        <div style={{ padding: '20px', display: 'grid', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <StatusBadge status={event.status} />
            <TypeBadge type={event.event_type} />
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <MapPin size={17} color={BRAND.muted} style={{ marginTop: 1, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: BRAND.text }}>
                {event.location_name || 'Kein Standort'}
              </div>
              <div style={{ marginTop: 3, color: BRAND.muted, fontSize: '13px', fontWeight: 600 }}>
                {event.location_address || 'Keine Adresse hinterlegt'}
              </div>
            </div>
          </div>

          {event.description && (
            <div
              style={{
                border: `1px solid ${BRAND.border}`,
                background: BRAND.soft,
                borderRadius: '16px',
                padding: '13px',
                color: BRAND.muted,
                fontSize: '13px',
                lineHeight: 1.5,
                fontWeight: 600,
              }}
            >
              {event.description}
            </div>
          )}

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
              flexWrap: 'wrap',
              paddingTop: '4px',
            }}
          >
            <button type="button" onClick={onClose} style={{ ...compactButtonStyle, height: '40px' }}>
              Schliessen
            </button>

            {isAdmin && (
              <button type="button" onClick={onEdit} style={{ ...compactBlackButtonStyle, height: '40px' }}>
                <Pencil size={15} />
                Bearbeiten
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OPCCalendarPage() {
  const calendarRef = useRef<FullCalendar | null>(null);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [calendars, setCalendars] = useState<CalendarRow[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);

  const [currentUserId, setCurrentUserId] = useState('');
  const [currentRole, setCurrentRole] = useState('client');

  const [activeTab, setActiveTab] = useState<CalendarViewFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [staffFilter, setStaffFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('timeGridWeek');
  const [calendarTitle, setCalendarTitle] = useState('');

  const [modal, setModal] = useState<ModalState>(null);
  const [quickViewEvent, setQuickViewEvent] = useState<CalendarEvent | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const isAdmin = useMemo(() => {
    return ['owner', 'admin', 'dispatch'].includes(currentRole);
  }, [currentRole]);

  const filteredCalendars = useMemo(() => {
    return calendars.filter((calendar) => {
      if (activeTab === 'all') return true;
      return calendar.calendar_type === activeTab;
    });
  }, [calendars, activeTab]);

  const filteredEvents = useMemo(() => {
    const visibleCalendarIds = new Set(filteredCalendars.map((calendar) => calendar.id));
    const query = searchQuery.trim().toLowerCase();

    return events.filter((event) => {
      if (!visibleCalendarIds.has(event.calendar_id)) return false;

      if (statusFilter !== 'all' && normalizeStatus(event.status) !== statusFilter) return false;

      if (staffFilter !== 'all') {
        const attendeeStaffIds = new Set(
          (event.attendees || [])
            .map((attendee) => attendee.staff_role_id)
            .filter(Boolean) as string[]
        );

        if (!attendeeStaffIds.has(staffFilter)) return false;
      }

      if (!query) return true;

      return [
        event.title,
        event.description,
        event.location_name,
        event.location_address,
        STATUS_LABELS[event.status],
        EVENT_TYPE_LABELS[event.event_type],
      ]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [events, filteredCalendars, statusFilter, staffFilter, searchQuery]);

  const fullCalendarEvents = useMemo(() => {
    return filteredEvents.map((event) => {
      const attendeeCount = event.attendees?.length || 0;
      const acceptedCount =
        event.attendees?.filter((attendee) => attendee.status === 'accepted').length || 0;

      return {
        id: event.id,
        title:
          attendeeCount > 0
            ? `${event.title} · ${acceptedCount}/${attendeeCount}`
            : event.title,
        start: event.starts_at,
        end: event.ends_at,
        extendedProps: {
          raw: event,
        },
      };
    });
  }, [filteredEvents]);

  const pendingInvites = useMemo(() => {
    return events
      .flatMap((event) =>
        (event.attendees || [])
          .filter((attendee) => attendee.user_id === currentUserId && attendee.status === 'needs_action')
          .map((attendee) => ({ event, attendee }))
      )
      .sort((a, b) => new Date(a.event.starts_at).getTime() - new Date(b.event.starts_at).getTime());
  }, [events, currentUserId]);

  const metrics = useMemo(() => {
    return {
      active: events.filter((event) => normalizeStatus(event.status) === 'open').length,
      pending: events.filter((event) => event.status === 'pending_acceptance').length,
      confirmed: events.filter((event) => event.status === 'confirmed' || event.status === 'in_progress').length,
      employees: staff.filter((person) => person.is_active).length,
    };
  }, [events, staff]);

  const defaultCalendarId = useMemo(() => {
    const ownCalendar = calendars.find((calendar) => calendar.owner_user_id === currentUserId);
    const teamCalendar = calendars.find((calendar) => calendar.calendar_type === 'team');
    const employeeCalendar = calendars.find((calendar) => calendar.calendar_type === 'employee');

    return ownCalendar?.id || teamCalendar?.id || employeeCalendar?.id || calendars[0]?.id || '';
  }, [calendars, currentUserId]);

  const focusEvents = useMemo(() => {
    const now = Date.now();
    const graceMs = 5 * 60 * 1000;

    return filteredEvents
      .filter((event) => {
        const end = new Date(event.ends_at).getTime();
        if (Number.isNaN(end)) return false;
        return end + graceMs >= now;
      })
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
      .slice(0, 4);
  }, [filteredEvents]);

  const loadCalendarData = useCallback(async () => {
    setIsRefreshing(true);
    setErrorMessage('');

    try {
      const data = await apiFetch<ApiPayload>('/api/opc/calendar/events');

      setCalendars(data.calendars || []);
      setEvents(data.events || []);
      setStaff(data.staff || []);
      setCurrentUserId(data.currentUserId || '');
      setCurrentRole(data.currentRole || 'client');
    } catch (error: any) {
      setErrorMessage(error?.message || 'Kalender konnte nicht geladen werden.');
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadCalendarData();
  }, [loadCalendarData]);

  async function handleCreateOrUpdate(payload: {
    id?: string;
    calendar_id: string;
    event_type: CalendarEvent['event_type'];
    status: CalendarEvent['status'];
    title: string;
    description?: string;
    starts_at: string;
    ends_at: string;
    timezone?: string;
    location_name?: string;
    location_address?: string;
    assigned_staff_role_ids: string[];
    requires_acceptance: boolean;
  }) {
    setSaving(true);
    setErrorMessage('');

    try {
      await apiFetch<{ event: CalendarEvent }>('/api/opc/calendar/create-event', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setModal(null);
      setQuickViewEvent(null);
      await loadCalendarData();
    } catch (error: any) {
      const message = error?.message || 'Kalendereintrag konnte nicht gespeichert werden.';
      setErrorMessage(message);
      throw new Error(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRespondInvite(attendeeId: string, status: CalendarAttendee['status']) {
    setSaving(true);
    setErrorMessage('');

    try {
      await apiFetch('/api/opc/calendar/respond-invite', {
        method: 'POST',
        body: JSON.stringify({
          attendee_id: attendeeId,
          status,
        }),
      });

      await loadCalendarData();
    } catch (error: any) {
      setErrorMessage(error?.message || 'Antwort konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  }

  async function handleEventDrop(arg: EventDropArg) {
    if (!isAdmin) {
      arg.revert();
      return;
    }

    const event = events.find((item) => item.id === arg.event.id);
    if (!event) {
      arg.revert();
      return;
    }

    const startsAt = arg.event.start?.toISOString();
    const endsAt =
      arg.event.end?.toISOString() ||
      (startsAt ? addOneHourIso(startsAt) : event.ends_at);

    if (!startsAt || !endsAt) {
      arg.revert();
      return;
    }

    try {
      await handleCreateOrUpdate({
        id: event.id,
        calendar_id: event.calendar_id,
        event_type: event.event_type,
        status: event.status,
        title: event.title,
        description: event.description || '',
        starts_at: startsAt,
        ends_at: endsAt,
        timezone: event.timezone || 'Europe/Zurich',
        location_name: event.location_name || '',
        location_address: event.location_address || '',
        assigned_staff_role_ids:
          event.attendees
            ?.map((attendee) => attendee.staff_role_id)
            .filter(Boolean) as string[],
        requires_acceptance: event.status === 'pending_acceptance',
      });
    } catch {
      arg.revert();
    }
  }

  function handleDateClick(arg: DateClickArg) {
    if (!isAdmin || !defaultCalendarId) return;

    setModal({
      mode: 'create',
      startsAt: arg.date.toISOString(),
      endsAt: addOneHourIso(arg.date.toISOString()),
    });
  }

  function handleEventClick(arg: EventClickArg) {
    const event = arg.event.extendedProps.raw as CalendarEvent | undefined;
    if (!event) return;

    setQuickViewEvent(event);
  }

  function changeView(nextView: string) {
    setViewMode(nextView);
    calendarRef.current?.getApi().changeView(nextView);
  }

  function goPrev() {
    calendarRef.current?.getApi().prev();
  }

  function goNext() {
    calendarRef.current?.getApi().next();
  }

  function goToday() {
    calendarRef.current?.getApi().today();
  }

  return (
    <div
      className="opc-requests-page opc-calendar-page"
      style={{
        padding: 0,
        fontFamily: pageFont,
        color: BRAND.text,
      }}
    >
      <div
        className="opc-requests-tabs"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: '10px',
          marginBottom: '18px',
        }}
      >
        {[
          { key: 'all', label: 'Alle Kalender' },
          { key: 'employee', label: 'Mitarbeiter' },
          { key: 'admin', label: 'Admin' },
          { key: 'team', label: 'Team' },
        ].map((tab) => {
          const active = activeTab === tab.key;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as CalendarViewFilter)}
              style={{
                height: '48px',
                borderRadius: '15px',
                border: `1px solid ${active ? BRAND.black : BRAND.border}`,
                background: active ? BRAND.black : '#FFFFFF',
                color: active ? '#FFFFFF' : BRAND.text,
                fontSize: '14px',
                fontWeight: 760,
                cursor: 'pointer',
                fontFamily: pageFont,
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        className="opc-requests-metrics"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: '14px',
          marginBottom: '18px',
        }}
      >
        <MetricCard value={metrics.active} label="Offene Einträge" icon={<CalendarDays size={17} />} />
        <MetricCard value={metrics.pending} label="Offene Einladungen" icon={<Clock3 size={17} />} tone="warning" />
        <MetricCard value={metrics.confirmed} label="Bestätigt" icon={<CheckCircle2 size={17} />} tone="success" />
        <MetricCard value={metrics.employees} label="Mitarbeiter" icon={<Users size={17} />} />
      </div>

      <section
        style={{
          ...cardStyle,
          padding: '16px',
          marginBottom: '16px',
        }}
      >
        <div
          className="opc-requests-controls"
          style={{
            display: 'grid',
            gridTemplateColumns: isAdmin
              ? 'minmax(0, 1fr) 170px 180px 170px 180px'
              : 'minmax(0, 1fr) 170px 180px 170px',
            gap: '10px',
            alignItems: 'center',
          }}
        >
          <div style={{ position: 'relative', minWidth: 0 }}>
            <Search size={17} style={searchIconStyle} />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Suche nach Einsatz, Standort, Kunde oder Notiz"
              style={inputWithIconStyle}
              onFocus={(event) => {
                event.currentTarget.style.borderColor = BRAND.black;
              }}
              onBlur={(event) => {
                event.currentTarget.style.borderColor = BRAND.border;
              }}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            style={selectStyle}
          >
            <option value="all">Alle Status</option>
            <option value="open">Offen</option>
            <option value="in_progress">In Bearbeitung</option>
            <option value="done">Erledigt</option>
          </select>

          <select
            value={staffFilter}
            onChange={(event) => setStaffFilter(event.target.value)}
            style={selectStyle}
          >
            <option value="all">Alle Mitarbeiter</option>
            {staff.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            disabled={isRefreshing}
            onClick={() => void loadCalendarData()}
            style={{
              ...secondaryButtonStyle,
              opacity: isRefreshing ? 0.72 : 1,
              cursor: isRefreshing ? 'wait' : 'pointer',
            }}
          >
            {isRefreshing ? <Loader2 size={17} className="spin" /> : <RefreshCcw size={17} />}
            {isRefreshing ? 'Lädt' : 'Neu laden'}
          </button>

          {isAdmin && (
            <button
              type="button"
              disabled={!defaultCalendarId}
              onClick={() =>
                setModal({
                  mode: 'create',
                  startsAt: new Date().toISOString(),
                  endsAt: addOneHourIso(new Date().toISOString()),
                })
              }
              style={{
                ...blackButtonStyle,
                opacity: defaultCalendarId ? 1 : 0.5,
                cursor: defaultCalendarId ? 'pointer' : 'not-allowed',
              }}
            >
              <Plus size={17} />
              Neuer Eintrag
            </button>
          )}
        </div>
      </section>

      {errorMessage && <div style={errorStyle}>{errorMessage}</div>}

      {focusEvents.length > 0 && (
        <section className="opc-calendar-focus-strip">
          {focusEvents.map((event) => (
            <button
              key={event.id}
              type="button"
              onClick={() => setQuickViewEvent(event)}
              className="opc-calendar-focus-card"
            >
              <span className="opc-focus-label">{getFocusLabel(event)}</span>
              <span className="opc-focus-title">{event.title}</span>
              <span className="opc-focus-meta">{formatTimeRange(event.starts_at, event.ends_at)}</span>
              <StatusBadge status={event.status} />
            </button>
          ))}
        </section>
      )}

      <section style={{ ...cardStyle, overflow: 'hidden' }}>
        <div className="opc-calendar-custom-controls">
          <div className="opc-calendar-control-group">
            <button type="button" onClick={goToday} style={compactButtonStyle}>
              Heute
            </button>

            <button type="button" onClick={goPrev} style={compactBlackButtonStyle}>
              ‹
            </button>

            <button type="button" onClick={goNext} style={compactBlackButtonStyle}>
              ›
            </button>
          </div>

          <div className="opc-calendar-title">
            {calendarTitle || 'Kalender'}
          </div>

          <div className="opc-calendar-control-group right">
            <button
              type="button"
              onClick={() => changeView('dayGridMonth')}
              style={viewMode === 'dayGridMonth' ? compactBlackButtonStyle : compactButtonStyle}
            >
              Monat
            </button>

            <button
              type="button"
              onClick={() => changeView('timeGridWeek')}
              style={viewMode === 'timeGridWeek' ? compactBlackButtonStyle : compactButtonStyle}
            >
              Woche
            </button>

            <button
              type="button"
              onClick={() => changeView('timeGridDay')}
              style={viewMode === 'timeGridDay' ? compactBlackButtonStyle : compactButtonStyle}
            >
              Tag
            </button>
          </div>
        </div>

        <div className="opc-calendar-fullcalendar-wrap">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView={viewMode}
            headerToolbar={false}
            height={520}
            slotMinTime="07:00:00"
            slotMaxTime="20:00:00"
            slotDuration="01:00:00"
            slotLabelInterval="01:00:00"
            nowIndicator
            editable={isAdmin}
            selectable={isAdmin}
            events={fullCalendarEvents}
            dateClick={handleDateClick}
            eventClick={handleEventClick}
            eventDrop={handleEventDrop}
            datesSet={(arg) => {
              setViewMode(arg.view.type);
              setCalendarTitle(arg.view.title);
            }}
            eventContent={(arg) => {
              const raw = arg.event.extendedProps.raw as CalendarEvent;

              return (
                <div className="opc-calendar-event-inner">
                  <div className="opc-calendar-event-title">{arg.event.title}</div>
                  <div className="opc-calendar-event-meta">
                    {EVENT_TYPE_LABELS[raw.event_type] || raw.event_type} ·{' '}
                    {STATUS_LABELS[raw.status] || raw.status}
                  </div>
                </div>
              );
            }}
          />
        </div>
      </section>

      {pendingInvites.length > 0 && (
        <section style={{ marginTop: '18px' }}>
          <CalendarInvitePanel
            pendingInvites={pendingInvites}
            saving={saving}
            onRespond={handleRespondInvite}
          />
        </section>
      )}

      {quickViewEvent && (
        <EventQuickView
          event={quickViewEvent}
          isAdmin={isAdmin}
          onClose={() => setQuickViewEvent(null)}
          onEdit={() => {
            setModal({ mode: 'edit', event: quickViewEvent });
            setQuickViewEvent(null);
          }}
        />
      )}

      {modal && (
        <CalendarEventModal
          modal={modal}
          calendars={calendars}
          staff={staff}
          defaultCalendarId={defaultCalendarId}
          saving={saving}
          isAdmin={isAdmin}
          statusLabels={STATUS_LABELS}
          eventTypeLabels={EVENT_TYPE_LABELS}
          formatDateTimeForInput={formatDateTimeForInput}
          onClose={() => setModal(null)}
          onSubmit={handleCreateOrUpdate}
        />
      )}

      <style>{`
        .spin {
          animation: opc-calendar-spin 0.9s linear infinite;
        }

        @keyframes opc-calendar-spin {
          to { transform: rotate(360deg); }
        }

        .opc-calendar-focus-strip {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          margin-bottom: 12px;
          padding-bottom: 2px;
          scrollbar-width: thin;
        }

        .opc-calendar-focus-card {
          min-width: 280px;
          max-width: 420px;
          height: 48px;
          border: 1px solid ${BRAND.border};
          border-radius: 16px;
          background: #FFFFFF;
          padding: 0 12px;
          text-align: left;
          cursor: pointer;
          font-family: ${pageFont};
          box-shadow: 0 8px 18px rgba(15, 17, 21, 0.03);
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto auto;
          gap: 10px;
          align-items: center;
          flex: 1;
        }

        .opc-calendar-focus-card:hover {
          background: #FAFAFA;
        }

        .opc-focus-label {
          font-size: 11px;
          font-weight: 820;
          color: ${BRAND.muted};
          text-transform: uppercase;
          letter-spacing: 0.04em;
          white-space: nowrap;
        }

        .opc-focus-title {
          font-size: 13px;
          font-weight: 820;
          color: ${BRAND.text};
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .opc-focus-meta {
          font-size: 12px;
          font-weight: 650;
          color: ${BRAND.muted};
          white-space: nowrap;
        }

        .opc-calendar-custom-controls {
          padding: 12px 16px;
          border-bottom: 1px solid ${BRAND.border};
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          align-items: center;
          gap: 12px;
        }

        .opc-calendar-control-group {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          align-items: center;
        }

        .opc-calendar-control-group.right {
          justify-content: flex-end;
        }

        .opc-calendar-title {
          text-align: center;
          font-size: 17px;
          font-weight: 840;
          letter-spacing: -0.035em;
          color: ${BRAND.text};
          min-width: 0;
        }

        .opc-calendar-fullcalendar-wrap {
          padding: 12px 14px 14px;
        }

        .opc-calendar-fullcalendar-wrap .fc {
          --fc-border-color: #F3F4F6;
          --fc-today-bg-color: #FAFAFA;
          --fc-event-bg-color: #F9FAFB;
          --fc-event-border-color: #E5E7EB;
          --fc-page-bg-color: #FFFFFF;
          font-family: ${pageFont};
          font-size: 12px;
        }

        .opc-calendar-fullcalendar-wrap .fc .fc-scroller {
          overflow-y: auto !important;
        }

        .opc-calendar-fullcalendar-wrap .fc .fc-daygrid-day-number,
        .opc-calendar-fullcalendar-wrap .fc .fc-col-header-cell-cushion {
          color: ${BRAND.text};
          text-decoration: none;
          font-weight: 720;
        }

        .opc-calendar-fullcalendar-wrap .fc .fc-timegrid-slot {
          height: 31px !important;
        }

        .opc-calendar-fullcalendar-wrap .fc .fc-timegrid-axis-cushion,
        .opc-calendar-fullcalendar-wrap .fc .fc-timegrid-slot-label-cushion {
          color: ${BRAND.muted};
          font-size: 11px;
          font-weight: 650;
        }

        .opc-calendar-fullcalendar-wrap .fc .fc-event {
          background: #F9FAFB !important;
          border: 1px solid #E5E7EB !important;
          border-left: 4px solid #0F1115 !important;
          color: #111827 !important;
          border-radius: 9px;
          padding: 2px 5px;
          cursor: pointer;
          overflow: hidden;
          box-shadow: none;
        }

        .opc-calendar-fullcalendar-wrap .fc .fc-event:hover {
          background: #F3F4F6 !important;
        }

        .opc-calendar-event-title {
          color: #111827;
          font-weight: 800;
          line-height: 1.2;
          font-size: 11px;
        }

        .opc-calendar-event-meta {
          color: #6B7280;
          opacity: 1;
          font-size: 9px;
          line-height: 1.2;
          margin-top: 1px;
        }

        @media (max-width: 1280px) {
          .opc-requests-metrics {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .opc-requests-controls {
            grid-template-columns: minmax(0, 1fr) 170px 180px !important;
          }

          .opc-calendar-custom-controls {
            grid-template-columns: 1fr !important;
          }

          .opc-calendar-control-group,
          .opc-calendar-control-group.right {
            justify-content: center !important;
          }

          .opc-calendar-title {
            order: -1;
          }
        }

        @media (max-width: 980px) {
          .opc-requests-tabs {
            grid-template-columns: 1fr !important;
          }

          .opc-requests-controls {
            grid-template-columns: 1fr !important;
          }

          .opc-calendar-focus-card {
            min-width: 300px;
            grid-template-columns: auto minmax(0, 1fr);
            height: auto;
            min-height: 58px;
            padding: 10px 12px;
          }

          .opc-focus-meta {
            display: none;
          }
        }

        @media (max-width: 640px) {
          .opc-requests-metrics {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
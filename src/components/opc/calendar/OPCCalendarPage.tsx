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
  Clock3,
  Loader2,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  Video,
  X,
} from 'lucide-react';
import CalendarEventModal from './CalendarEventModal';
import CalendarInvitePanel from './CalendarInvitePanel';
import { readOpcPageCache, writeOpcPageCache } from '../../../lib/opc-page-cache';

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
  create_google_meet?: boolean;
  sync_google_calendar?: boolean;
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
  google_calendar_id?: string | null;
  google_event_id?: string | null;
  google_html_link?: string | null;
  google_meet_link?: string | null;
  google_conference_id?: string | null;
  google_conference_request_id?: string | null;
  google_meet_space_name?: string | null;
  google_sync_status?: string | null;
  google_sync_error?: string | null;
  metadata?: Record<string, any> | null;
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
type CalendarVisibleRange = { start: string; end: string };
// OPC_CALENDAR_RANGE_CACHE_V1
const CALENDAR_RANGE_CACHE_TTL_MS = 2 * 60 * 1000;
function calendarRangeCacheKey(range: CalendarVisibleRange) {
  return `opc:page-cache:calendar:${range.start.slice(0, 10)}:${range.end.slice(0, 10)}`;
}
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

const pageFont =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", "Helvetica Neue", Segoe UI, Roboto, sans-serif';

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
  boxShadow: '0 1px 2px rgba(15, 17, 21, 0.04)',
};

const selectStyle: CSSProperties = {
  width: '100%',
  height: '46px',
  borderRadius: '14px',
  border: `1px solid ${BRAND.border}`,
  background: '#FFFFFF',
  color: BRAND.text,
  outline: 'none',
  padding: '0 12px',
  fontSize: '13px',
  fontWeight: 760,
  fontFamily: pageFont,
  boxSizing: 'border-box',
};

const blackButtonStyle: CSSProperties = {
  width: '100%',
  minHeight: '46px',
  borderRadius: '14px',
  border: `1px solid ${BRAND.black}`,
  background: BRAND.black,
  color: '#FFFFFF',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  padding: '0 12px',
  fontSize: '13px',
  fontWeight: 820,
  fontFamily: pageFont,
  textDecoration: 'none',
  whiteSpace: 'nowrap',
  boxSizing: 'border-box',
  cursor: 'pointer',
};

const secondaryButtonStyle: CSSProperties = {
  width: '100%',
  minHeight: '46px',
  borderRadius: '14px',
  border: `1px solid ${BRAND.border}`,
  background: '#FFFFFF',
  color: BRAND.text,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  padding: '0 12px',
  fontSize: '13px',
  fontWeight: 820,
  fontFamily: pageFont,
  textDecoration: 'none',
  whiteSpace: 'nowrap',
  boxSizing: 'border-box',
  cursor: 'pointer',
};

const compactButtonStyle: CSSProperties = {
  width: '100%',
  minHeight: '46px',
  borderRadius: '14px',
  border: `1px solid ${BRAND.border}`,
  background: '#FFFFFF',
  color: BRAND.text,
  padding: '0 12px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '7px',
  fontSize: '13px',
  fontWeight: 820,
  fontFamily: pageFont,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  boxSizing: 'border-box',
};

const compactBlackButtonStyle: CSSProperties = {
  ...compactButtonStyle,
  border: `1px solid ${BRAND.black}`,
  background: BRAND.black,
  color: '#FFFFFF',
};

const inputWithIconStyle: CSSProperties = {
  width: '100%',
  height: '46px',
  padding: '0 14px 0 42px',
  borderRadius: '14px',
  border: `1px solid ${BRAND.border}`,
  background: '#FFFFFF',
  color: BRAND.text,
  outline: 'none',
  fontSize: '14px',
  fontWeight: 650,
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

function isSameLocalDay(value?: string | null, referenceDate = new Date()) {
  if (!value) return false;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return false;

  return (
    date.getFullYear() === referenceDate.getFullYear() &&
    date.getMonth() === referenceDate.getMonth() &&
    date.getDate() === referenceDate.getDate()
  );
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
}: {
  label: string;
  value: number;
  icon: ReactNode;
}) {
  return (
    <div
      className="opc-calendar-metric-card"
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
      <div style={{ minWidth: 0 }}>
        <div
          className="opc-calendar-metric-value"
          style={{
            fontSize: '25px',
            lineHeight: 1,
            fontWeight: 820,
            letterSpacing: '-0.04em',
            color: BRAND.text,
            marginBottom: '10px',
          }}
        >
          {value}
        </div>

        <div
          className="opc-calendar-metric-label"
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
        className="opc-calendar-metric-icon"
        style={{
          width: '38px',
          height: '38px',
          borderRadius: '13px',
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



function toDateTimeLocalValue(date: Date) {
  const copy = new Date(date);
  copy.setSeconds(0, 0);

  const year = copy.getFullYear();
  const month = String(copy.getMonth() + 1).padStart(2, '0');
  const day = String(copy.getDate()).padStart(2, '0');
  const hours = String(copy.getHours()).padStart(2, '0');
  const minutes = String(copy.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function dateTimeLocalToIso(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error('Ungültige Zeitangabe.');
  }

  return date.toISOString();
}

function QuickGoogleMeetModal({
  calendars,
  staff,
  defaultCalendarId,
  saving,
  onClose,
  onSubmit,
}: {
  calendars: Array<{ id: string; name: string; calendar_type?: string }>;
  staff: Array<{ id: string; name: string; role?: string; is_active?: boolean; email?: string | null }>;
  defaultCalendarId: string;
  saving: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    calendar_id?: string;
    title: string;
    attendee_emails: string;
    assigned_staff_role_ids?: string[];
    starts_at: string;
    ends_at: string;
    description?: string;
    location_address?: string;
    reminder_minutes?: number;
    guests_can_invite_others?: boolean;
    guests_can_modify?: boolean;
    guests_can_see_other_guests?: boolean;
    visibility?: 'default' | 'public' | 'private';
  }) => Promise<void>;
}) {
  const now = new Date();
  const roundedStart = new Date(now);
  roundedStart.setMinutes(Math.ceil(roundedStart.getMinutes() / 15) * 15, 0, 0);

  const roundedEnd = new Date(roundedStart.getTime() + 60 * 60 * 1000);

  const [calendarId, setCalendarId] = useState(defaultCalendarId);
  const [title, setTitle] = useState('Orange Pro Clean Meeting');
  const [guestEmails, setGuestEmails] = useState('');
  const [selectedStaffRoleIds, setSelectedStaffRoleIds] = useState<string[]>([]);
  const [reminderMinutes, setReminderMinutes] = useState(30);
  const [guestsCanInviteOthers, setGuestsCanInviteOthers] = useState(true);
  const [guestsCanModify, setGuestsCanModify] = useState(false);
  const [guestsCanSeeOtherGuests, setGuestsCanSeeOtherGuests] = useState(true);
  const [visibility, setVisibility] = useState<'default' | 'public' | 'private'>('default');
  const [startsAt, setStartsAt] = useState(toDateTimeLocalValue(roundedStart));
  const [endsAt, setEndsAt] = useState(toDateTimeLocalValue(roundedEnd));
  const [locationAddress, setLocationAddress] = useState('');
  const [description, setDescription] = useState('');
  const [localError, setLocalError] = useState('');

  async function submitForm(event: React.FormEvent) {
    event.preventDefault();
    setLocalError('');

    try {
      const startIso = dateTimeLocalToIso(startsAt);
      const endIso = dateTimeLocalToIso(endsAt);

      if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
        throw new Error('Das Ende muss nach dem Start liegen.');
      }

      await onSubmit({
        calendar_id: calendarId || defaultCalendarId,
        title: title.trim() || 'Orange Pro Clean Meeting',
        attendee_emails: guestEmails,
        assigned_staff_role_ids: selectedStaffRoleIds,
        starts_at: startIso,
        ends_at: endIso,
        location_address: locationAddress,
        description,
        reminder_minutes: reminderMinutes,
        guests_can_invite_others: guestsCanInviteOthers,
        guests_can_modify: guestsCanModify,
        guests_can_see_other_guests: guestsCanSeeOtherGuests,
        visibility,
      });
    } catch (error: any) {
      setLocalError(error?.message || 'Google Meet konnte nicht erstellt werden.');
    }
  }

  return (
    <div
      className="opc-modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15, 17, 21, 0.42)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <form
        onSubmit={submitForm}
        style={{
          width: 'min(760px, 100%)',
          maxHeight: 'calc(100vh - 48px)',
          overflowY: 'auto',
          background: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: 26,
          boxShadow: '0 24px 70px rgba(15, 17, 21, 0.18)',
          padding: 28,
          fontFamily: pageFont,
          color: BRAND.text,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 18,
            marginBottom: 22,
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: 24,
                fontWeight: 880,
                letterSpacing: '-0.04em',
              }}
            >
              Google Meet erstellen
            </h2>
            <p
              style={{
                margin: '6px 0 0',
                color: BRAND.muted,
                fontSize: 13,
                fontWeight: 650,
              }}
            >
              Termin wird im OPC Kalender gespeichert und mit Google Kalender synchronisiert.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              width: 42,
              height: 42,
              borderRadius: 14,
              border: `1px solid ${BRAND.border}`,
              background: '#FFFFFF',
              cursor: 'pointer',
              fontSize: 22,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <label style={{ display: 'grid', gap: 7 }}>
            <span style={{ fontSize: 12, fontWeight: 820, color: BRAND.muted }}>Titel</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="z.B. Team Meeting"
              required
              style={{
                height: 52,
                borderRadius: 14,
                border: `1px solid ${BRAND.border}`,
                padding: '0 16px',
                fontSize: 15,
                fontWeight: 720,
                fontFamily: pageFont,
              }}
            />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <label style={{ display: 'grid', gap: 7 }}>
              <span style={{ fontSize: 12, fontWeight: 820, color: BRAND.muted }}>Start</span>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
                required
                style={{
                  height: 52,
                  borderRadius: 14,
                  border: `1px solid ${BRAND.border}`,
                  padding: '0 16px',
                  fontSize: 15,
                  fontWeight: 720,
                  fontFamily: pageFont,
                }}
              />
            </label>

            <label style={{ display: 'grid', gap: 7 }}>
              <span style={{ fontSize: 12, fontWeight: 820, color: BRAND.muted }}>Ende</span>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(event) => setEndsAt(event.target.value)}
                required
                style={{
                  height: 52,
                  borderRadius: 14,
                  border: `1px solid ${BRAND.border}`,
                  padding: '0 16px',
                  fontSize: 15,
                  fontWeight: 720,
                  fontFamily: pageFont,
                }}
              />
            </label>
          </div>

          <label style={{ display: 'grid', gap: 7 }}>
            <span style={{ fontSize: 12, fontWeight: 820, color: BRAND.muted }}>Kalender</span>
            <select
              value={calendarId}
              onChange={(event) => setCalendarId(event.target.value)}
              style={{
                height: 52,
                borderRadius: 14,
                border: `1px solid ${BRAND.border}`,
                padding: '0 16px',
                fontSize: 15,
                fontWeight: 720,
                fontFamily: pageFont,
                background: '#FFFFFF',
              }}
            >
              {calendars.map((calendar) => (
                <option key={calendar.id} value={calendar.id}>
                  {calendar.name}
                </option>
              ))}
            </select>
          </label>

          <div style={{ display: 'grid', gap: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 820, color: BRAND.muted }}>
              Teammitglieder einladen
            </span>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 10,
              }}
            >
              {staff
                .filter((person) => person.is_active !== false)
                .map((person) => {
                  const checked = selectedStaffRoleIds.includes(person.id);

                  return (
                    <label
                      key={person.id}
                      style={{
                        minHeight: 56,
                        border: `1px solid ${checked ? BRAND.black : BRAND.border}`,
                        borderRadius: 16,
                        padding: '10px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        cursor: 'pointer',
                        background: checked ? '#F9FAFB' : '#FFFFFF',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => {
                          setSelectedStaffRoleIds((current) => {
                            if (event.target.checked) {
                              return Array.from(new Set([...current, person.id]));
                            }

                            return current.filter((id) => id !== person.id);
                          });
                        }}
                        style={{ width: 18, height: 18 }}
                      />

                      <span style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                        <span
                          style={{
                            fontSize: 14,
                            fontWeight: 850,
                            color: BRAND.text,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {person.name}
                        </span>

                        <span style={{ fontSize: 12, fontWeight: 650, color: BRAND.muted }}>
                          {person.role || 'Team'}
                        </span>
                      </span>
                    </label>
                  );
                })}
            </div>
          </div>

          <label style={{ display: 'grid', gap: 7 }}>
            <span style={{ fontSize: 12, fontWeight: 820, color: BRAND.muted }}>
              Gäste per E-Mail einladen
            </span>
            <input
              value={guestEmails}
              onChange={(event) => setGuestEmails(event.target.value)}
              placeholder="kunde@email.ch, team@email.ch"
              style={{
                height: 52,
                borderRadius: 14,
                border: `1px solid ${BRAND.border}`,
                padding: '0 16px',
                fontSize: 15,
                fontWeight: 720,
                fontFamily: pageFont,
              }}
            />
            <span style={{ fontSize: 12, fontWeight: 650, color: BRAND.muted }}>
              Mehrere E-Mails mit Komma trennen. Google sendet die Einladung automatisch.
            </span>
          </label>

          <label style={{ display: 'grid', gap: 7 }}>
            <span style={{ fontSize: 12, fontWeight: 820, color: BRAND.muted }}>Ort / Hinweis</span>
            <input
              value={locationAddress}
              onChange={(event) => setLocationAddress(event.target.value)}
              placeholder="Optional, z.B. Online oder Kunde / Objekt"
              style={{
                height: 52,
                borderRadius: 14,
                border: `1px solid ${BRAND.border}`,
                padding: '0 16px',
                fontSize: 15,
                fontWeight: 720,
                fontFamily: pageFont,
              }}
            />
          </label>

          <div
            style={{
              border: `1px solid ${BRAND.border}`,
              borderRadius: 18,
              padding: 14,
              display: 'grid',
              gap: 12,
              background: '#FFFFFF',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 850, color: BRAND.muted }}>
              Google Kalender Optionen
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={{ display: 'grid', gap: 7 }}>
                <span style={{ fontSize: 12, fontWeight: 760, color: BRAND.muted }}>Erinnerung</span>
                <select
                  value={reminderMinutes}
                  onChange={(event) => setReminderMinutes(Number(event.target.value))}
                  style={{
                    height: 44,
                    borderRadius: 12,
                    border: `1px solid ${BRAND.border}`,
                    padding: '0 12px',
                    fontSize: 14,
                    fontWeight: 720,
                    fontFamily: pageFont,
                    background: '#FFFFFF',
                  }}
                >
                  <option value={0}>Zur Startzeit</option>
                  <option value={10}>10 Minuten vorher</option>
                  <option value={30}>30 Minuten vorher</option>
                  <option value={60}>1 Stunde vorher</option>
                  <option value={1440}>1 Tag vorher</option>
                </select>
              </label>

              <label style={{ display: 'grid', gap: 7 }}>
                <span style={{ fontSize: 12, fontWeight: 760, color: BRAND.muted }}>Sichtbarkeit</span>
                <select
                  value={visibility}
                  onChange={(event) => setVisibility(event.target.value as 'default' | 'public' | 'private')}
                  style={{
                    height: 44,
                    borderRadius: 12,
                    border: `1px solid ${BRAND.border}`,
                    padding: '0 12px',
                    fontSize: 14,
                    fontWeight: 720,
                    fontFamily: pageFont,
                    background: '#FFFFFF',
                  }}
                >
                  <option value="default">Standardsichtbarkeit</option>
                  <option value="private">Privat</option>
                  <option value="public">Öffentlich</option>
                </select>
              </label>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 720 }}>
              <input
                type="checkbox"
                checked={guestsCanModify}
                onChange={(event) => setGuestsCanModify(event.target.checked)}
              />
              Gäste dürfen Termin bearbeiten
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 720 }}>
              <input
                type="checkbox"
                checked={guestsCanInviteOthers}
                onChange={(event) => setGuestsCanInviteOthers(event.target.checked)}
              />
              Gäste dürfen weitere Personen einladen
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 720 }}>
              <input
                type="checkbox"
                checked={guestsCanSeeOtherGuests}
                onChange={(event) => setGuestsCanSeeOtherGuests(event.target.checked)}
              />
              Gästeliste anzeigen
            </label>
          </div>

          <label style={{ display: 'grid', gap: 7 }}>
            <span style={{ fontSize: 12, fontWeight: 820, color: BRAND.muted }}>Nachricht / Beschreibung</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional: Agenda, Hinweise oder interne Notiz"
              rows={4}
              style={{
                borderRadius: 14,
                border: `1px solid ${BRAND.border}`,
                padding: 16,
                fontSize: 15,
                fontWeight: 650,
                fontFamily: pageFont,
                resize: 'vertical',
              }}
            />
          </label>
        </div>

        {localError && (
          <div
            style={{
              marginTop: 16,
              padding: '12px 14px',
              borderRadius: 14,
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              color: '#991B1B',
              fontSize: 13,
              fontWeight: 720,
            }}
          >
            {localError}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            marginTop: 24,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              height: 46,
              padding: '0 18px',
              borderRadius: 14,
              border: `1px solid ${BRAND.border}`,
              background: '#FFFFFF',
              color: BRAND.text,
              fontSize: 14,
              fontWeight: 820,
              cursor: saving ? 'wait' : 'pointer',
            }}
          >
            Schliessen
          </button>

          <button
            type="submit"
            disabled={saving}
            style={{
              height: 46,
              padding: '0 20px',
              borderRadius: 14,
              border: '1px solid #111111',
              background: '#111111',
              color: '#FFFFFF',
              fontSize: 14,
              fontWeight: 850,
              cursor: saving ? 'wait' : 'pointer',
              opacity: saving ? 0.72 : 1,
            }}
          >
            {saving ? 'Erstellt...' : 'Meet erstellen & Gäste einladen'}
          </button>
        </div>
      </form>
    </div>
  );
}



function getGuestEmails(event: CalendarEvent): string[] {
  const metadata = (event.metadata || {}) as any;
  const emails = metadata.guest_attendee_emails;

  if (!Array.isArray(emails)) return [];

  return emails
    .map((email) => String(email || '').trim())
    .filter(Boolean);
}

function getMeetOptions(event: CalendarEvent) {
  const metadata = (event.metadata || {}) as any;
  return metadata.google_meet_options || {};
}

async function copyTextToClipboard(value: string) {
  if (!value) return;

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
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
  const guestEmails = getGuestEmails(event);
  const meetOptions = getMeetOptions(event);
  const hasMeet = Boolean(event.google_meet_link);
  const internalAttendeeCount = event.attendees?.length || 0;

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
          maxWidth: '720px',
          maxHeight: 'calc(100vh - 44px)',
          overflowY: 'auto',
          background: '#FFFFFF',
          border: `1px solid ${BRAND.border}`,
          borderRadius: '26px',
          boxShadow: '0 24px 80px rgba(15, 17, 21, 0.22)',
          fontFamily: pageFont,
        }}
      >
        <div
          style={{
            padding: '22px 24px',
            borderBottom: `1px solid ${BRAND.softBorder}`,
            display: 'flex',
            justifyContent: 'space-between',
            gap: '18px',
            alignItems: 'flex-start',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap',
                marginBottom: 8,
              }}
            >
              {hasMeet && (
                <span
                  style={{
                    height: 27,
                    padding: '0 10px',
                    borderRadius: 999,
                    background: '#0F1115',
                    color: '#FFFFFF',
                    display: 'inline-flex',
                    alignItems: 'center',
                    fontSize: 11,
                    fontWeight: 850,
                    letterSpacing: '0.02em',
                    textTransform: 'uppercase',
                  }}
                >
                  Google Meet
                </span>
              )}

              <StatusBadge status={event.status} />
              <TypeBadge type={event.event_type} />
            </div>

            <div
              style={{
                fontSize: '23px',
                fontWeight: 880,
                color: BRAND.text,
                letterSpacing: '-0.045em',
                lineHeight: 1.15,
                marginBottom: '8px',
              }}
            >
              {event.title || 'Kalendereintrag'}
            </div>

            <div
              style={{
                fontSize: '14px',
                fontWeight: 720,
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
              width: '42px',
              height: '42px',
              borderRadius: '14px',
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
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '22px 24px 24px', display: 'grid', gap: '16px' }}>
          {hasMeet && (
            <div
              style={{
                border: `1px solid ${BRAND.border}`,
                background: '#FAFAFA',
                borderRadius: 20,
                padding: 16,
                display: 'grid',
                gap: 12,
              }}
            >
              <div style={{ display: 'grid', gap: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 850, color: BRAND.text }}>
                  Google Meet
                </div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 650,
                    color: BRAND.muted,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {event.google_meet_link}
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                  gap: 8,
                }}
              >
                <a
                  href={event.google_meet_link || '#'}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    minHeight: 42,
                    borderRadius: 999,
                    padding: '0 12px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textDecoration: 'none',
                    background: BRAND.black,
                    color: '#FFFFFF',
                    border: `1px solid ${BRAND.black}`,
                    fontSize: 12,
                    fontWeight: 850,
                    textAlign: 'center',
                  }}
                >
                  Mit Google Meet teilnehmen
                </a>

                <button
                  type="button"
                  onClick={() => void copyTextToClipboard(event.google_meet_link || '')}
                  style={{
                    minHeight: 42,
                    borderRadius: 999,
                    padding: '0 12px',
                    background: '#FFFFFF',
                    color: BRAND.text,
                    border: `1px solid ${BRAND.border}`,
                    fontSize: 12,
                    fontWeight: 850,
                    cursor: 'pointer',
                  }}
                >
                  Meet-Link kopieren
                </button>

                {event.google_html_link ? (
                  <a
                    href={event.google_html_link}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      minHeight: 42,
                      borderRadius: 999,
                      padding: '0 12px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textDecoration: 'none',
                      background: '#FFFFFF',
                      color: BRAND.text,
                      border: `1px solid ${BRAND.border}`,
                      fontSize: 12,
                      fontWeight: 850,
                      textAlign: 'center',
                    }}
                  >
                    Google Kalender öffnen
                  </a>
                ) : (
                  <span />
                )}
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div
              style={{
                border: `1px solid ${BRAND.border}`,
                background: '#FFFFFF',
                borderRadius: 18,
                padding: 14,
                display: 'grid',
                gap: 5,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 850, color: BRAND.muted, textTransform: 'uppercase' }}>
                Ort / Objekt
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: BRAND.text }}>
                {event.location_name || (hasMeet ? 'Google Meet' : 'Kein Standort')}
              </div>
              <div style={{ fontSize: 13, fontWeight: 650, color: BRAND.muted }}>
                {event.location_address || 'Keine Adresse hinterlegt'}
              </div>
            </div>

            <div
              style={{
                border: `1px solid ${BRAND.border}`,
                background: '#FFFFFF',
                borderRadius: 18,
                padding: 14,
                display: 'grid',
                gap: 5,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 850, color: BRAND.muted, textTransform: 'uppercase' }}>
                Teilnehmer
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: BRAND.text }}>
                {internalAttendeeCount} intern · {guestEmails.length} extern
              </div>
              <div style={{ fontSize: 13, fontWeight: 650, color: BRAND.muted }}>
                Erinnerung: {Number(meetOptions.reminder_minutes ?? 30)} Minuten vorher
              </div>
            </div>
          </div>

          {internalAttendeeCount > 0 && (
            <div
              style={{
                border: `1px solid ${BRAND.border}`,
                background: '#FFFFFF',
                borderRadius: 18,
                padding: 14,
                display: 'grid',
                gap: 8,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 850, color: BRAND.muted, textTransform: 'uppercase' }}>
                Interne Teammitglieder
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {event.attendees?.map((attendee) => (
                  <span
                    key={attendee.id || attendee.staff_role_id || attendee.user_id || Math.random()}
                    style={{
                      height: 28,
                      padding: '0 10px',
                      borderRadius: 999,
                      background: '#F9FAFB',
                      border: `1px solid ${BRAND.border}`,
                      color: BRAND.text,
                      display: 'inline-flex',
                      alignItems: 'center',
                      fontSize: 12,
                      fontWeight: 720,
                    }}
                  >
                    {attendee.status || 'accepted'}
                  </span>
                ))}
              </div>
            </div>
          )}

          {guestEmails.length > 0 && (
            <div
              style={{
                border: `1px solid ${BRAND.border}`,
                background: '#FFFFFF',
                borderRadius: 18,
                padding: 14,
                display: 'grid',
                gap: 8,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 850, color: BRAND.muted, textTransform: 'uppercase' }}>
                Eingeladene Gäste
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {guestEmails.map((email) => (
                  <span
                    key={email}
                    style={{
                      height: 28,
                      padding: '0 10px',
                      borderRadius: 999,
                      background: '#F9FAFB',
                      border: `1px solid ${BRAND.border}`,
                      color: BRAND.text,
                      display: 'inline-flex',
                      alignItems: 'center',
                      fontSize: 12,
                      fontWeight: 720,
                    }}
                  >
                    {email}
                  </span>
                ))}
              </div>
            </div>
          )}

          {event.description && (
            <div
              style={{
                border: `1px solid ${BRAND.border}`,
                background: BRAND.soft,
                borderRadius: '18px',
                padding: '14px',
                color: BRAND.muted,
                fontSize: '13px',
                lineHeight: 1.5,
                fontWeight: 650,
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
            <button type="button" onClick={onClose} style={{ ...compactButtonStyle, height: '42px' }}>
              Schliessen
            </button>

            {isAdmin && (
              <button type="button" onClick={onEdit} style={{ ...compactBlackButtonStyle, height: '42px' }}>
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


function getInitialCalendarScrollTime() {
  const now = new Date();
  now.setHours(now.getHours() - 2);

  const hours = Math.max(0, now.getHours()).toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');

  return `${hours}:${minutes}:00`;
}

export default function OPCCalendarPage() {
  const calendarRef = useRef<FullCalendar | null>(null);
  const visibleRangeRef = useRef<CalendarVisibleRange | null>(null);
  const loadedRangeKeyRef = useRef('');
  const calendarLoadInFlightRef = useRef<Promise<void> | null>(null);
  const initialCalendarScrollTime = getInitialCalendarScrollTime();

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
  const [quickMeetModalOpen, setQuickMeetModalOpen] = useState(false);
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
      today: events.filter((event) => isSameLocalDay(event.starts_at)).length,
      pending: pendingInvites.length,
    };
  }, [events, pendingInvites]);

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

  const loadCalendarData = useCallback(async (
    rangeOverride?: CalendarVisibleRange | null,
    force = false,
  ) => {
    const range = rangeOverride || visibleRangeRef.current;
    if (!range) return;
    const cacheKey = calendarRangeCacheKey(range);

    if (!force) {
      const cached = readOpcPageCache<ApiPayload>(cacheKey, CALENDAR_RANGE_CACHE_TTL_MS);
      if (cached) {
        setCalendars(cached.calendars || []);
        setEvents(cached.events || []);
        setStaff(cached.staff || []);
        setCurrentUserId(cached.currentUserId || '');
        setCurrentRole(cached.currentRole || 'client');
        loadedRangeKeyRef.current = cacheKey;
        return;
      }
    }

    if (calendarLoadInFlightRef.current && loadedRangeKeyRef.current === cacheKey) {
      return calendarLoadInFlightRef.current;
    }

    setIsRefreshing(true);
    setErrorMessage('');
    loadedRangeKeyRef.current = cacheKey;

    const task = (async () => {
      try {
        const params = new URLSearchParams({ start: range.start, end: range.end });
        const data = await apiFetch<ApiPayload>(`/api/opc/calendar/events?${params.toString()}`);
        setCalendars(data.calendars || []);
        setEvents(data.events || []);
        setStaff(data.staff || []);
        setCurrentUserId(data.currentUserId || '');
        setCurrentRole(data.currentRole || 'client');
        writeOpcPageCache(cacheKey, data);
      } catch (error: any) {
        setErrorMessage(error?.message || 'Kalender konnte nicht geladen werden.');
      } finally {
        setIsRefreshing(false);
        calendarLoadInFlightRef.current = null;
      }
    })();

    calendarLoadInFlightRef.current = task;
    return task;
  }, []);

  async function handleCreateOrUpdate(payload: {
    id?: string;
    calendar_id: string;
    create_google_meet?: boolean;
    sync_google_calendar?: boolean;
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
    attendee_emails?: string;
    guest_emails?: string;
    requires_acceptance: boolean;
  }) {
    setSaving(true);
    setErrorMessage('');

    try {
      const createResult = await apiFetch<{ event: CalendarEvent }>('/api/opc/calendar/create-event', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (createResult?.event?.id) {
        try {
          await apiFetch('/api/opc/calendar/create-google-meet', {
            method: 'POST',
            body: JSON.stringify({
              event_id: createResult.event.id,
              create_meet_link: Boolean((payload as any).create_google_meet),
            }),
          });
        } catch (googleSyncError: any) {
          console.warn('[OPC Calendar] Google sync failed:', googleSyncError?.message || googleSyncError);
          setErrorMessage(
            googleSyncError?.message ||
              'Der Termin wurde im Portal gespeichert, konnte aber nicht mit Google synchronisiert werden.'
          );
        }
      }

      setModal(null);
      setQuickViewEvent(null);
      await loadCalendarData(visibleRangeRef.current, true);
    } catch (error: any) {
      const message = error?.message || 'Kalendereintrag konnte nicht gespeichert werden.';
      setErrorMessage(message);
      throw new Error(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleQuickGoogleMeet(payload: {
    calendar_id?: string;
    title: string;
    attendee_emails: string;
    assigned_staff_role_ids?: string[];
    starts_at: string;
    ends_at: string;
    description?: string;
    location_address?: string;
    reminder_minutes?: number;
    guests_can_invite_others?: boolean;
    guests_can_modify?: boolean;
    guests_can_see_other_guests?: boolean;
    visibility?: 'default' | 'public' | 'private';
  }) {
    setSaving(true);
    setErrorMessage('');

    try {
      const calendarId = payload.calendar_id || defaultCalendarId;

      if (!calendarId) {
        throw new Error('Kein aktiver Kalender gefunden.');
      }

      const result = await apiFetch<{
        event: CalendarEvent;
        google_sync_status?: string;
        google_sync_error?: string | null;
      }>('/api/opc/calendar/create-event', {
        method: 'POST',
        body: JSON.stringify({
          calendar_id: calendarId,
          create_google_meet: true,
          sync_google_calendar: true,
          event_type: 'internal',
          status: 'confirmed',
          title: payload.title || 'Orange Pro Clean Meeting',
          description: payload.description || '',
          starts_at: payload.starts_at,
          ends_at: payload.ends_at,
          timezone: 'Europe/Zurich',
          location_name: 'Google Meet',
          location_address: payload.location_address || '',
          attendee_emails: payload.attendee_emails || '',
          assigned_staff_role_ids: payload.assigned_staff_role_ids || [],
          requires_acceptance: false,
          metadata: {
            google_meet_options: {
              reminder_minutes: payload.reminder_minutes ?? 30,
              guests_can_invite_others: payload.guests_can_invite_others ?? true,
              guests_can_modify: payload.guests_can_modify ?? false,
              guests_can_see_other_guests: payload.guests_can_see_other_guests ?? true,
              visibility: payload.visibility || 'default',
            },
          },
        }),
      });

      const event = result?.event;

      if (result?.google_sync_error) {
        throw new Error(result.google_sync_error);
      }

      if (!event?.google_meet_link) {
        throw new Error('Google Meet wurde erstellt, aber kein Meet-Link wurde zurückgegeben.');
      }

      setQuickMeetModalOpen(false);
      setQuickViewEvent(event);

      await loadCalendarData(visibleRangeRef.current, true);
    } catch (error: any) {
      setErrorMessage(error?.message || 'Google Meet konnte nicht erstellt werden.');
      throw error;
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

      await loadCalendarData(visibleRangeRef.current, true);
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
        attendee_emails: Array.isArray((event.metadata as any)?.guest_attendee_emails)
          ? ((event.metadata as any).guest_attendee_emails as string[]).join(', ')
          : '',
        create_google_meet: Boolean(event.google_meet_link),
        sync_google_calendar: Boolean(event.google_event_id || event.google_calendar_id || event.google_meet_link),
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
    <div className="opc-requests-page opc-calendar-page" style={{ padding: 0, fontFamily: pageFont, color: BRAND.text }}>
      <div
        className="opc-requests-metrics"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: '12px',
          marginBottom: '14px',
        }}
      >
        <MetricCard value={metrics.today} label="Heute" icon={<CalendarDays size={17} />} />
        <MetricCard value={metrics.pending} label="Offene Einladungen" icon={<Clock3 size={17} />} />
      </div>

      <section className="opc-calendar-filter-panel" style={{ ...cardStyle, padding: '16px', marginBottom: '18px' }}>
        <div className="opc-calendar-search-control" style={{ position: 'relative', minWidth: 0 }}>
          <Search size={17} style={searchIconStyle} />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Kalendereinträge suchen..."
            style={inputWithIconStyle}
            onFocus={(event) => {
              event.currentTarget.style.borderColor = BRAND.black;
            }}
            onBlur={(event) => {
              event.currentTarget.style.borderColor = BRAND.border;
            }}
          />
        </div>

        <div className={`opc-calendar-action-row ${isAdmin ? 'is-admin' : 'is-basic'}`}>
          {isAdmin && (
            <button
              type="button"
              className="opc-calendar-new-entry-button"
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
              <Plus size={16} />
              <span>Neuer Eintrag</span>
            </button>
          )}

          {isAdmin && (
            <button
              type="button"
              className="opc-calendar-quick-meet-button"
              onClick={() => setQuickMeetModalOpen(true)}
              disabled={saving}
              style={{
                ...blackButtonStyle,
                opacity: saving ? 0.72 : 1,
                cursor: saving ? 'wait' : 'pointer',
              }}
            >
              <Video size={16} />
              <span>Google Meet</span>
            </button>
          )}

          <button
            type="button"
            className="opc-calendar-refresh-button"
            disabled={isRefreshing}
            onClick={() => void loadCalendarData(visibleRangeRef.current, true)}
            style={{
              ...secondaryButtonStyle,
              opacity: isRefreshing ? 0.72 : 1,
              cursor: isRefreshing ? 'wait' : 'pointer',
            }}
          >
            {isRefreshing ? <Loader2 size={16} className="spin" /> : <RefreshCcw size={16} />}
            <span>{isRefreshing ? 'Lädt' : 'Neu laden'}</span>
          </button>
        </div>

        <div className="opc-calendar-select-row">
          <select value={staffFilter} onChange={(event) => setStaffFilter(event.target.value)} style={selectStyle}>
            <option value="all">Alle Mitarbeiter</option>
            {staff.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>

          <select
            value={activeTab}
            onChange={(event) => setActiveTab(event.target.value as CalendarViewFilter)}
            style={selectStyle}
          >
            <option value="all">Alle Kalender</option>
            <option value="employee">Mitarbeiter</option>
            <option value="admin">Admin</option>
            <option value="team">Team</option>
          </select>

          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} style={selectStyle}>
            <option value="all">Alle Status</option>
            <option value="open">Offen</option>
            <option value="in_progress">In Bearbeitung</option>
            <option value="done">Erledigt</option>
          </select>
        </div>
      </section>

      {errorMessage && <div style={errorStyle}>{errorMessage}</div>}

      {focusEvents.length > 0 && (
        <section className="opc-calendar-focus-strip">
          {focusEvents.map((event) => (
            <button key={event.id} type="button" onClick={() => setQuickViewEvent(event)} className="opc-calendar-focus-card">
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
          <div className="opc-calendar-title">{calendarTitle || 'Kalender'}</div>

          <div className="opc-calendar-control-row opc-calendar-nav-row">
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

          <div className="opc-calendar-control-row opc-calendar-view-row">
            <button type="button" onClick={() => changeView('dayGridMonth')} style={viewMode === 'dayGridMonth' ? compactBlackButtonStyle : compactButtonStyle}>
              Monat
            </button>

            <button type="button" onClick={() => changeView('timeGridWeek')} style={viewMode === 'timeGridWeek' ? compactBlackButtonStyle : compactButtonStyle}>
              Woche
            </button>

            <button type="button" onClick={() => changeView('timeGridDay')} style={viewMode === 'timeGridDay' ? compactBlackButtonStyle : compactButtonStyle}>
              Tag
            </button>
          </div>
        </div>

        <div className="opc-calendar-fullcalendar-wrap">
          <FullCalendar
            ref={calendarRef}
            height="100%"
            expandRows={false}
            slotMinTime="00:00:00"
            slotMaxTime="24:00:00"
            scrollTime={initialCalendarScrollTime}
            scrollTimeReset={false}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView={viewMode}
            headerToolbar={false}
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
              const range = {
                start: arg.start.toISOString(),
                end: arg.end.toISOString(),
              };
              visibleRangeRef.current = range;
              void loadCalendarData(range);
            }}
            eventContent={(arg) => {
              const raw = arg.event.extendedProps.raw as CalendarEvent;

              return (
                <div className="opc-calendar-event-inner">
                  <div className="opc-calendar-event-title">{arg.event.title}</div>
                  <div className="opc-calendar-event-meta">
                    {EVENT_TYPE_LABELS[raw.event_type] || raw.event_type} · {STATUS_LABELS[raw.status] || raw.status}
                    {raw.google_meet_link ? ' · Google Meet' : ''}
                  </div>
                </div>
              );
            }}
          />
        </div>
      </section>

      {pendingInvites.length > 0 && (
        <section style={{ marginTop: '18px' }}>
          <CalendarInvitePanel pendingInvites={pendingInvites} saving={saving} onRespond={handleRespondInvite} />
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

      {quickMeetModalOpen && (
        <QuickGoogleMeetModal
          calendars={calendars}
          staff={staff}
          defaultCalendarId={defaultCalendarId}
          saving={saving}
          onClose={() => setQuickMeetModalOpen(false)}
          onSubmit={handleQuickGoogleMeet}
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
        .opc-calendar-page * {
          box-sizing: border-box;
        }

        .spin {
          animation: opc-calendar-spin 0.9s linear infinite;
        }

        @keyframes opc-calendar-spin {
          to { transform: rotate(360deg); }
        }

        .opc-calendar-filter-panel {
          width: 100%;
          max-width: 100%;
          min-width: 0;
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
          overflow: visible;
        }

        .opc-calendar-search-control {
          width: 100%;
          min-width: 0;
        }

        .opc-calendar-search-control input::placeholder {
          color: #9CA3AF;
          font-weight: 700;
        }

        .opc-calendar-action-row {
          width: 100%;
          display: grid;
          gap: 8px;
          align-items: stretch;
        }

        .opc-calendar-action-row.is-admin {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .opc-calendar-action-row.is-basic {
          grid-template-columns: minmax(0, 1fr);
        }

        .opc-calendar-select-row {
          width: 100%;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
        }

        .opc-calendar-new-entry-button,
        .opc-calendar-quick-meet-button,
        .opc-calendar-refresh-button,
        .opc-calendar-control-row button {
          width: 100% !important;
          min-width: 0 !important;
          max-width: none !important;
          min-height: 46px !important;
          border-radius: 14px !important;
          padding: 0 12px !important;
          font-size: 13px !important;
          font-weight: 820 !important;
          letter-spacing: -0.01em;
        }

        .opc-calendar-new-entry-button span,
        .opc-calendar-quick-meet-button span,
        .opc-calendar-refresh-button span {
          display: inline-block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          min-width: 0;
        }

        .opc-calendar-new-entry-button:hover,
        .opc-calendar-quick-meet-button:hover,
        .opc-calendar-refresh-button:hover,
        .opc-calendar-control-row button:hover {
          background-image: none !important;
        }

        .opc-calendar-focus-strip {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 14px;
        }

        .opc-calendar-focus-card {
          min-width: 0;
          min-height: 96px;
          border: 1px solid ${BRAND.border};
          border-radius: 20px;
          background: #FFFFFF;
          padding: 14px 16px;
          text-align: left;
          cursor: pointer;
          font-family: ${pageFont};
          box-shadow: 0 1px 2px rgba(15, 17, 21, 0.04);
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 5px;
          align-content: start;
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
          line-height: 1.2;
          font-weight: 820;
          color: ${BRAND.text};
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .opc-focus-meta {
          font-size: 12px;
          line-height: 1.25;
          font-weight: 650;
          color: ${BRAND.muted};
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .opc-calendar-focus-card > span:last-child {
          margin-top: 4px;
          width: 100%;
        }

        .opc-calendar-custom-controls {
          padding: 18px 20px;
          border-bottom: 1px solid ${BRAND.border};
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
          background: #FFFFFF;
        }

        .opc-calendar-title {
          text-align: center;
          font-size: 19px;
          font-weight: 850;
          letter-spacing: -0.04em;
          color: ${BRAND.text};
          min-width: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .opc-calendar-control-row {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          align-items: stretch;
          width: 100%;
        }

        .opc-calendar-fullcalendar-wrap {
          height: min(720px, calc(100vh - 330px));
          min-height: 520px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
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
          height: 100% !important;
          min-height: 0;
          flex: 1 1 auto;
        }

        .opc-calendar-fullcalendar-wrap .fc-view-harness {
          height: 100% !important;
          min-height: 0;
          flex: 1 1 auto;
        }

        .opc-calendar-fullcalendar-wrap .fc-view-harness-active {
          height: 100% !important;
        }

        .opc-calendar-fullcalendar-wrap .fc-scroller,
        .opc-calendar-fullcalendar-wrap .fc-scroller-liquid,
        .opc-calendar-fullcalendar-wrap .fc-scroller-liquid-absolute {
          overflow-y: auto !important;
          overscroll-behavior: contain;
        }

        .opc-calendar-fullcalendar-wrap .fc-timegrid-body {
          width: 100% !important;
        }

        .opc-calendar-fullcalendar-wrap .fc-timegrid-slot {
          height: 60px !important;
        }

        .opc-calendar-fullcalendar-wrap .fc-timegrid-slots table {
          height: 1440px !important;
        }

        .opc-calendar-fullcalendar-wrap .fc .fc-daygrid-day-number,
        .opc-calendar-fullcalendar-wrap .fc .fc-col-header-cell-cushion {
          color: ${BRAND.text};
          text-decoration: none;
          font-weight: 720;
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

        .opc-quick-view-meet-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 14px;
        }

        .opc-quick-view-meet-primary,
        .opc-quick-view-meet-secondary {
          min-height: 38px;
          border-radius: 999px;
          padding: 0 14px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          font-family: ${pageFont};
          font-size: 12px;
          font-weight: 820;
          cursor: pointer;
        }

        .opc-quick-view-meet-primary {
          background: #111111;
          color: #FFFFFF;
          border: 1px solid #111111;
        }

        .opc-quick-view-meet-secondary {
          background: #FFFFFF;
          color: #111111;
          border: 1px solid ${BRAND.border};
        }

        .opc-quick-view-guests {
          margin-top: 12px;
        }

        .opc-quick-view-guests-label {
          font-size: 11px;
          font-weight: 820;
          color: ${BRAND.muted};
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 6px;
        }

        .opc-quick-view-guests-list {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .opc-quick-view-guest-pill {
          height: 28px;
          padding: 0 10px;
          border-radius: 999px;
          background: #F9FAFB;
          border: 1px solid ${BRAND.border};
          color: ${BRAND.text};
          display: inline-flex;
          align-items: center;
          font-size: 12px;
          font-weight: 720;
        }

        @media (max-width: 1280px) {
          .opc-calendar-focus-strip {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 980px) {
          .opc-calendar-action-row.is-admin {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .opc-calendar-refresh-button {
            grid-column: 1 / -1;
          }

          .opc-calendar-select-row {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .opc-calendar-select-row select:first-child {
            grid-column: 1 / -1;
          }

          .opc-calendar-fullcalendar-wrap {
            height: min(660px, calc(100vh - 300px));
            min-height: 500px;
          }
        }

        @media (max-width: 760px) {
          .opc-modal-backdrop form {
            padding: 20px !important;
            border-radius: 22px !important;
          }

          .opc-modal-backdrop form > div {
            grid-template-columns: 1fr !important;
          }

          .opc-calendar-page [role="dialog"] > div {
            max-width: calc(100vw - 24px) !important;
          }

          .opc-calendar-page [role="dialog"] a,
          .opc-calendar-page [role="dialog"] button {
            min-width: 0;
          }
        }

        @media (max-width: 640px) {
          .opc-requests-metrics {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 12px !important;
          }

          .opc-calendar-metric-card {
            min-height: 86px !important;
            padding: 15px !important;
          }

          .opc-calendar-metric-value {
            font-size: 23px !important;
          }

          .opc-calendar-metric-label {
            font-size: 12px !important;
            line-height: 1.2;
          }

          .opc-calendar-metric-icon {
            width: 34px !important;
            height: 34px !important;
          }

          .opc-calendar-action-row.is-admin {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .opc-calendar-refresh-button {
            grid-column: 1 / -1;
          }

          .opc-calendar-select-row {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .opc-calendar-select-row select:first-child {
            grid-column: 1 / -1;
          }

          .opc-calendar-new-entry-button,
          .opc-calendar-quick-meet-button,
          .opc-calendar-refresh-button,
          .opc-calendar-control-row button {
            min-height: 46px !important;
            font-size: 12px !important;
            padding: 0 8px !important;
          }

          .opc-calendar-focus-strip {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
          }

          .opc-calendar-focus-card {
            min-height: 92px;
            padding: 13px 14px;
          }

          .opc-focus-title {
            font-size: 12px;
          }

          .opc-focus-meta {
            font-size: 11px;
          }

          .opc-calendar-custom-controls {
            padding: 14px;
          }

          .opc-calendar-title {
            font-size: 17px;
          }

          .opc-calendar-control-row {
            gap: 8px;
          }
        }
      `}</style>
    </div>
  );
}
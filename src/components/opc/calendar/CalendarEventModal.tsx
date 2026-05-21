import React, { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Loader2, Save, X } from 'lucide-react';

type CalendarRow = {
  id: string;
  calendar_type: 'employee' | 'admin' | 'team' | 'system';
  owner_user_id: string | null;
  owner_staff_role_id: string | null;
  name: string;
};

type StaffRow = {
  id: string;
  user_id: string | null;
  name: string;
  role: string;
  is_admin: boolean;
  is_active: boolean;
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
  attendees?: {
    staff_role_id: string | null;
  }[];
};

type ModalState =
  | {
      mode: 'create';
      startsAt?: string;
      endsAt?: string;
    }
  | {
      mode: 'edit';
      event: CalendarEvent;
    };

type Props = {
  modal: ModalState;
  calendars: CalendarRow[];
  staff: StaffRow[];
  defaultCalendarId: string;
  saving: boolean;
  isAdmin: boolean;
  statusLabels: Record<string, string>;
  eventTypeLabels: Record<string, string>;
  formatDateTimeForInput: (value?: string | null) => string;
  onClose: () => void;
  onSubmit: (payload: {
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
  }) => Promise<void>;
};

const BRAND = {
  black: '#0F1115',
  text: '#111827',
  muted: '#6B7280',
  border: '#E5E7EB',
  red: '#B42318',
};

const pageFont = 'Inter, Helvetica, Arial, sans-serif';

const eventTypes: CalendarEvent['event_type'][] = [
  'job_requested',
  'job_scheduled',
  'job_active',
  'internal',
  'absence',
  'blocked_time',
];

const statuses: CalendarEvent['status'][] = [
  'requested',
  'pending_acceptance',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
];

const inputStyle: CSSProperties = {
  width: '100%',
  height: '48px',
  padding: '0 13px',
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

const selectStyle: CSSProperties = {
  ...inputStyle,
  fontWeight: 650,
};

const textareaStyle: CSSProperties = {
  width: '100%',
  minHeight: '84px',
  padding: '12px 13px',
  borderRadius: '14px',
  border: `1px solid ${BRAND.border}`,
  background: '#FFFFFF',
  color: BRAND.text,
  outline: 'none',
  fontSize: '14px',
  fontWeight: 560,
  fontFamily: pageFont,
  boxSizing: 'border-box',
  resize: 'vertical',
};

const labelStyle: CSSProperties = {
  display: 'grid',
  gap: '7px',
  fontSize: '12px',
  fontWeight: 800,
  color: BRAND.muted,
};

const blackButtonStyle: CSSProperties = {
  height: '44px',
  borderRadius: '14px',
  border: `1px solid ${BRAND.black}`,
  background: BRAND.black,
  color: '#FFFFFF',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '9px',
  padding: '0 16px',
  fontSize: '14px',
  fontWeight: 760,
  fontFamily: pageFont,
  cursor: 'pointer',
};

const secondaryButtonStyle: CSSProperties = {
  height: '44px',
  borderRadius: '14px',
  border: `1px solid ${BRAND.border}`,
  background: '#FFFFFF',
  color: BRAND.text,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '9px',
  padding: '0 16px',
  fontSize: '14px',
  fontWeight: 760,
  fontFamily: pageFont,
  cursor: 'pointer',
};

function addOneHourLocalInput() {
  const date = new Date();
  date.setHours(date.getHours() + 1);

  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60_000);

  return localDate.toISOString().slice(0, 16);
}

export default function CalendarEventModal({
  modal,
  calendars,
  staff,
  defaultCalendarId,
  saving,
  isAdmin,
  statusLabels,
  eventTypeLabels,
  formatDateTimeForInput,
  onClose,
  onSubmit,
}: Props) {
  const editingEvent = modal.mode === 'edit' ? modal.event : null;

  const [calendarId, setCalendarId] = useState(defaultCalendarId);
  const [title, setTitle] = useState('');
  const [eventType, setEventType] = useState<CalendarEvent['event_type']>('job_scheduled');
  const [status, setStatus] = useState<CalendarEvent['status']>('confirmed');
  const [description, setDescription] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [locationName, setLocationName] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [requiresAcceptance, setRequiresAcceptance] = useState(false);
  const [assignedStaffRoleIds, setAssignedStaffRoleIds] = useState<string[]>([]);
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    setLocalError('');

    if (editingEvent) {
      setCalendarId(editingEvent.calendar_id);
      setTitle(editingEvent.title);
      setEventType(editingEvent.event_type);
      setStatus(editingEvent.status);
      setDescription(editingEvent.description || '');
      setStartsAt(formatDateTimeForInput(editingEvent.starts_at));
      setEndsAt(formatDateTimeForInput(editingEvent.ends_at));
      setLocationName(editingEvent.location_name || '');
      setLocationAddress(editingEvent.location_address || '');
      setRequiresAcceptance(editingEvent.status === 'pending_acceptance');
      setAssignedStaffRoleIds(
        (editingEvent.attendees || [])
          .map((attendee) => attendee.staff_role_id)
          .filter(Boolean) as string[]
      );
      return;
    }

    setCalendarId(defaultCalendarId);
    setTitle('');
    setEventType('job_scheduled');
    setStatus('confirmed');
    setDescription('');
    setStartsAt(formatDateTimeForInput(modal.startsAt));
    setEndsAt(formatDateTimeForInput(modal.endsAt) || addOneHourLocalInput());
    setLocationName('');
    setLocationAddress('');
    setRequiresAcceptance(false);
    setAssignedStaffRoleIds([]);
  }, [defaultCalendarId, editingEvent, formatDateTimeForInput, modal]);

  const activeStaff = useMemo(() => {
    return staff.filter((person) => person.is_active);
  }, [staff]);

  function toggleStaff(staffId: string) {
    setAssignedStaffRoleIds((current) =>
      current.includes(staffId)
        ? current.filter((id) => id !== staffId)
        : [...current, staffId]
    );
  }

  async function submitForm(event: React.FormEvent) {
    event.preventDefault();
    setLocalError('');

    if (!isAdmin) {
      setLocalError('Du hast keine Berechtigung, diesen Kalendereintrag zu bearbeiten.');
      return;
    }

    if (!calendarId) {
      setLocalError('Bitte wähle einen Kalender aus.');
      return;
    }

    if (!title.trim()) {
      setLocalError('Bitte gib einen Titel ein.');
      return;
    }

    if (!startsAt || !endsAt) {
      setLocalError('Bitte gib Start und Ende ein.');
      return;
    }

    const startsDate = new Date(startsAt);
    const endsDate = new Date(endsAt);

    if (Number.isNaN(startsDate.getTime()) || Number.isNaN(endsDate.getTime())) {
      setLocalError('Start oder Ende ist ungültig.');
      return;
    }

    if (endsDate <= startsDate) {
      setLocalError('Das Ende muss nach dem Start liegen.');
      return;
    }

    try {
      await onSubmit({
        id: editingEvent?.id,
        calendar_id: calendarId,
        event_type: eventType,
        status: requiresAcceptance ? 'pending_acceptance' : status,
        title: title.trim(),
        description,
        starts_at: startsDate.toISOString(),
        ends_at: endsDate.toISOString(),
        timezone: 'Europe/Zurich',
        location_name: locationName,
        location_address: locationAddress,
        assigned_staff_role_ids: assignedStaffRoleIds,
        requires_acceptance: requiresAcceptance,
      });
    } catch (error) {
      setLocalError(
        error instanceof Error
          ? error.message
          : 'Kalendereintrag konnte nicht gespeichert werden.'
      );
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15, 17, 21, 0.42)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '22px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '760px',
          maxHeight: '90vh',
          overflow: 'auto',
          background: '#FFFFFF',
          borderRadius: '24px',
          border: `1px solid ${BRAND.border}`,
          boxShadow: '0 24px 80px rgba(15, 17, 21, 0.22)',
          fontFamily: pageFont,
        }}
      >
        <div
          style={{
            padding: '22px 24px',
            borderBottom: `1px solid ${BRAND.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            gap: '18px',
            alignItems: 'flex-start',
          }}
        >
          <div>
            <h2
              style={{
                margin: '0 0 7px',
                fontSize: '22px',
                fontWeight: 820,
                letterSpacing: '-0.035em',
                color: BRAND.text,
              }}
            >
              {editingEvent ? 'Kalendereintrag' : 'Neuer Kalendereintrag'}
            </h2>

            <p
              style={{
                margin: 0,
                fontSize: '13px',
                fontWeight: 600,
                color: BRAND.muted,
                lineHeight: 1.5,
              }}
            >
              {editingEvent
                ? `${eventTypeLabels[editingEvent.event_type] || editingEvent.event_type} · ${
                    statusLabels[editingEvent.status] || editingEvent.status
                  }`
                : 'Kompakter Eintrag für Einsatz, Anfrage oder interne Planung'}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '13px',
              border: `1px solid ${BRAND.border}`,
              background: '#FFFFFF',
              color: BRAND.text,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.55 : 1,
            }}
          >
            <X size={18} />
          </button>
        </div>

        <form style={{ padding: '24px' }} onSubmit={submitForm}>
          <div
            className="calendar-modal-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: '12px',
            }}
          >
            <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>
              Titel
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="z.B. Reinigung Elisabethenstrasse 41"
                style={inputStyle}
                disabled={!isAdmin || saving}
              />
            </label>

            <label style={labelStyle}>
              Kalender
              <select
                value={calendarId}
                onChange={(event) => setCalendarId(event.target.value)}
                style={selectStyle}
                disabled={!isAdmin || saving}
              >
                <option value="">Kalender wählen</option>
                {calendars.map((calendar) => (
                  <option key={calendar.id} value={calendar.id}>
                    {calendar.name}
                  </option>
                ))}
              </select>
            </label>

            <label style={labelStyle}>
              Typ
              <select
                value={eventType}
                onChange={(event) =>
                  setEventType(event.target.value as CalendarEvent['event_type'])
                }
                style={selectStyle}
                disabled={!isAdmin || saving}
              >
                {eventTypes.map((type) => (
                  <option key={type} value={type}>
                    {eventTypeLabels[type] || type}
                  </option>
                ))}
              </select>
            </label>

            <label style={labelStyle}>
              Status
              <select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as CalendarEvent['status'])
                }
                style={selectStyle}
                disabled={!isAdmin || saving || requiresAcceptance}
              >
                {statuses.map((item) => (
                  <option key={item} value={item}>
                    {statusLabels[item] || item}
                  </option>
                ))}
              </select>
            </label>

            <label style={labelStyle}>
              Mitarbeitereinladung
              <select
                value={requiresAcceptance ? 'yes' : 'no'}
                onChange={(event) => setRequiresAcceptance(event.target.value === 'yes')}
                style={selectStyle}
                disabled={!isAdmin || saving}
              >
                <option value="no">Direkt bestätigen</option>
                <option value="yes">Mitarbeiter müssen annehmen</option>
              </select>
            </label>

            <label style={labelStyle}>
              Start
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
                style={inputStyle}
                disabled={!isAdmin || saving}
              />
            </label>

            <label style={labelStyle}>
              Ende
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(event) => setEndsAt(event.target.value)}
                style={inputStyle}
                disabled={!isAdmin || saving}
              />
            </label>

            <label style={labelStyle}>
              Ort / Objekt
              <input
                value={locationName}
                onChange={(event) => setLocationName(event.target.value)}
                placeholder="z.B. Kunde, Gebäude, Objekt"
                style={inputStyle}
                disabled={!isAdmin || saving}
              />
            </label>

            <label style={labelStyle}>
              Adresse
              <input
                value={locationAddress}
                onChange={(event) => setLocationAddress(event.target.value)}
                placeholder="Strasse, PLZ, Ort"
                style={inputStyle}
                disabled={!isAdmin || saving}
              />
            </label>

            <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>
              Beschreibung / interne Notiz
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Interne Notizen, Kundenwunsch, Zugang, Besonderheiten..."
                style={textareaStyle}
                disabled={!isAdmin || saving}
              />
            </label>
          </div>

          <div style={{ marginTop: '22px' }}>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 800,
                color: BRAND.muted,
                marginBottom: '10px',
              }}
            >
              Mitarbeiter zuweisen
            </div>

            {activeStaff.length === 0 ? (
              <div
                style={{
                  border: `1px solid ${BRAND.border}`,
                  borderRadius: '16px',
                  padding: '14px',
                  color: BRAND.muted,
                  fontSize: '13px',
                  fontWeight: 650,
                  background: '#FAFAFA',
                }}
              >
                Keine aktiven Mitarbeiter gefunden.
              </div>
            ) : (
              <div
                className="calendar-staff-grid"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: '10px',
                }}
              >
                {activeStaff.map((person) => (
                  <label
                    key={person.id}
                    style={{
                      border: `1px solid ${BRAND.border}`,
                      borderRadius: '16px',
                      padding: '13px',
                      background: '#FFFFFF',
                      display: 'flex',
                      gap: '10px',
                      alignItems: 'flex-start',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={assignedStaffRoleIds.includes(person.id)}
                      onChange={() => toggleStaff(person.id)}
                      disabled={!isAdmin || saving}
                      style={{
                        width: '16px',
                        height: '16px',
                        marginTop: '2px',
                        accentColor: BRAND.black,
                      }}
                    />

                    <span style={{ minWidth: 0 }}>
                      <strong
                        style={{
                          display: 'block',
                          fontSize: '14px',
                          lineHeight: 1.25,
                          fontWeight: 820,
                          color: BRAND.text,
                          marginBottom: '4px',
                        }}
                      >
                        {person.name}
                      </strong>

                      <span
                        style={{
                          display: 'block',
                          fontSize: '12px',
                          fontWeight: 620,
                          color: BRAND.muted,
                        }}
                      >
                        {person.role}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {localError && (
            <div
              style={{
                marginTop: '18px',
                padding: '13px 14px',
                borderRadius: '14px',
                border: '1px solid #FCA5A5',
                background: '#FEF2F2',
                color: BRAND.red,
                fontSize: '13px',
                fontWeight: 650,
              }}
            >
              {localError}
            </div>
          )}

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              flexWrap: 'wrap',
              marginTop: '22px',
            }}
          >
            <button type="button" onClick={onClose} disabled={saving} style={secondaryButtonStyle}>
              Schliessen
            </button>

            {isAdmin && (
              <button type="submit" disabled={saving} style={blackButtonStyle}>
                {saving ? <Loader2 size={17} className="modal-spin" /> : <Save size={17} />}
                Speichern
              </button>
            )}
          </div>

          <style>{`
            .modal-spin {
              animation: modal-spin 0.9s linear infinite;
            }

            @keyframes modal-spin {
              to { transform: rotate(360deg); }
            }

            @media (max-width: 720px) {
              .calendar-modal-grid,
              .calendar-staff-grid {
                grid-template-columns: 1fr !important;
              }
            }
          `}</style>
        </form>
      </div>
    </div>
  );
}
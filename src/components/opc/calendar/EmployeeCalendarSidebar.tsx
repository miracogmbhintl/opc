import React from "react";

type CalendarRow = {
  id: string;
  calendar_type: "employee" | "admin" | "team" | "system";
  owner_user_id: string | null;
  owner_staff_role_id: string | null;
  name: string;
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

type Props = {
  calendars: CalendarRow[];
  employeeCalendars: CalendarRow[];
  adminCalendars: CalendarRow[];
  selectedCalendarIds: string[];
  selectedStaffIds: string[];
  staff: StaffRow[];
  isAdmin: boolean;
  unreadNotificationCount: number;
  pendingInviteCount: number;
  onToggleCalendar: (calendarId: string) => void;
  onToggleStaff: (staffId: string) => void;
  onSelectAllCalendars: () => void;
  onClearStaff: () => void;
};

export default function EmployeeCalendarSidebar({
  calendars,
  employeeCalendars,
  adminCalendars,
  selectedCalendarIds,
  selectedStaffIds,
  staff,
  isAdmin,
  unreadNotificationCount,
  pendingInviteCount,
  onToggleCalendar,
  onToggleStaff,
  onSelectAllCalendars,
  onClearStaff,
}: Props) {
  return (
    <aside className="opc-calendar-sidebar">
      <style>{`
        .opc-calendar-sidebar {
          background: #fff;
          border: 1px solid rgba(17,17,17,0.08);
          border-radius: 22px;
          padding: 16px;
          box-shadow: 0 20px 60px rgba(17,17,17,0.05);
          margin-bottom: 14px;
        }

        .opc-calendar-sidebar h2 {
          font-size: 16px;
          margin: 0 0 10px 0;
          letter-spacing: -0.02em;
        }

        .opc-sidebar-section {
          padding-top: 14px;
          margin-top: 14px;
          border-top: 1px solid rgba(17,17,17,0.08);
        }

        .opc-sidebar-row {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 7px 0;
          font-size: 14px;
        }

        .opc-sidebar-row input {
          width: 16px;
          height: 16px;
          accent-color: #f7931f;
        }

        .opc-sidebar-label {
          flex: 1;
          min-width: 0;
        }

        .opc-sidebar-label strong {
          display: block;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .opc-sidebar-label span {
          display: block;
          color: rgba(17,17,17,0.52);
          font-size: 12px;
          margin-top: 2px;
        }

        .opc-sidebar-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 10px;
        }

        .opc-sidebar-mini-button {
          appearance: none;
          border: 1px solid rgba(17,17,17,0.12);
          background: #fff;
          color: #111;
          border-radius: 999px;
          padding: 7px 10px;
          font-size: 12px;
          font-weight: 650;
          cursor: pointer;
        }

        .opc-sidebar-badge-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-bottom: 10px;
        }

        .opc-sidebar-badge {
          background: #f6f6f3;
          border-radius: 14px;
          padding: 10px;
        }

        .opc-sidebar-badge strong {
          display: block;
          font-size: 18px;
          line-height: 1;
          margin-bottom: 4px;
        }

        .opc-sidebar-badge span {
          font-size: 12px;
          color: rgba(17,17,17,0.58);
        }

        .opc-sidebar-empty {
          color: rgba(17,17,17,0.55);
          font-size: 13px;
          line-height: 1.45;
        }
      `}</style>

      <h2>Kalender</h2>

      <div className="opc-sidebar-badge-row">
        <div className="opc-sidebar-badge">
          <strong>{pendingInviteCount}</strong>
          <span>Offene Einladungen</span>
        </div>
        <div className="opc-sidebar-badge">
          <strong>{unreadNotificationCount}</strong>
          <span>Neue Hinweise</span>
        </div>
      </div>

      <div className="opc-sidebar-actions">
        <button className="opc-sidebar-mini-button" onClick={onSelectAllCalendars}>
          Alle Kalender
        </button>
        <button className="opc-sidebar-mini-button" onClick={onClearStaff}>
          Mitarbeiterfilter löschen
        </button>
      </div>

      <div className="opc-sidebar-section">
        <h2>Mitarbeiterkalender</h2>

        {employeeCalendars.length === 0 ? (
          <p className="opc-sidebar-empty">
            Noch keine Mitarbeiterkalender vorhanden. Für bestehende Mitarbeiter muss einmalig ein
            Kalender erstellt werden.
          </p>
        ) : (
          employeeCalendars.map((calendar) => (
            <label key={calendar.id} className="opc-sidebar-row">
              <input
                type="checkbox"
                checked={selectedCalendarIds.includes(calendar.id)}
                onChange={() => onToggleCalendar(calendar.id)}
              />
              <span className="opc-sidebar-label">
                <strong>{calendar.name}</strong>
                <span>{calendar.calendar_type}</span>
              </span>
            </label>
          ))
        )}
      </div>

      {isAdmin && (
        <div className="opc-sidebar-section">
          <h2>Admin-Kalender</h2>

          {adminCalendars.length === 0 ? (
            <p className="opc-sidebar-empty">Noch keine Admin-Kalender vorhanden.</p>
          ) : (
            adminCalendars.map((calendar) => (
              <label key={calendar.id} className="opc-sidebar-row">
                <input
                  type="checkbox"
                  checked={selectedCalendarIds.includes(calendar.id)}
                  onChange={() => onToggleCalendar(calendar.id)}
                />
                <span className="opc-sidebar-label">
                  <strong>{calendar.name}</strong>
                  <span>{calendar.is_private ? "privat" : "sichtbar"}</span>
                </span>
              </label>
            ))
          )}
        </div>
      )}

      <div className="opc-sidebar-section">
        <h2>Mitarbeiter filtern</h2>

        {staff.length === 0 ? (
          <p className="opc-sidebar-empty">Keine Mitarbeiter gefunden.</p>
        ) : (
          staff.map((person) => (
            <label key={person.id} className="opc-sidebar-row">
              <input
                type="checkbox"
                checked={selectedStaffIds.includes(person.id)}
                onChange={() => onToggleStaff(person.id)}
              />
              <span className="opc-sidebar-label">
                <strong>{person.name}</strong>
                <span>{person.role}</span>
              </span>
            </label>
          ))
        )}
      </div>

      <div className="opc-sidebar-section">
        <h2>Systemstatus</h2>
        <p className="opc-sidebar-empty">
          {calendars.length} Kalender geladen. Freigaben und Sichtbarkeit laufen über Supabase RLS.
        </p>
      </div>
    </aside>
  );
}
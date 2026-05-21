import React from "react";

type Props = {
  statusFilter: string;
  viewMode: string;
  eventCount: number;
  statusLabels: Record<string, string>;
  onStatusFilterChange: (value: string) => void;
  onViewModeChange: (value: string) => void;
};

export default function CalendarToolbar({
  statusFilter,
  viewMode,
  eventCount,
  onStatusFilterChange,
}: Props) {
  return (
    <div className="opc-calendar-toolbar">
      <style>{`
        .opc-calendar-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }

        .opc-calendar-toolbar-left {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .opc-calendar-toolbar-title {
          font-weight: 750;
          letter-spacing: -0.02em;
        }

        .opc-calendar-toolbar-meta {
          font-size: 13px;
          color: rgba(17,17,17,0.56);
        }

        .opc-calendar-toolbar-controls {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
        }

        .opc-calendar-select {
          border: 1px solid rgba(17,17,17,0.12);
          border-radius: 999px;
          background: #fff;
          padding: 9px 12px;
          font-size: 14px;
          outline: none;
        }
      `}</style>

      <div className="opc-calendar-toolbar-left">
        <div className="opc-calendar-toolbar-title">Kalenderübersicht</div>
        <div className="opc-calendar-toolbar-meta">
          {eventCount} sichtbare Einträge · Ansicht: {viewMode}
        </div>
      </div>

      <div className="opc-calendar-toolbar-controls">
        <select
          className="opc-calendar-select"
          value={statusFilter}
          onChange={(event) => onStatusFilterChange(event.target.value)}
        >
          <option value="active">Aktive Einträge</option>
          <option value="open">Offen / laufend</option>
          <option value="completed">Abgeschlossen</option>
          <option value="cancelled">Storniert / abgelehnt</option>
          <option value="all">Alle Einträge</option>
        </select>
      </div>
    </div>
  );
}
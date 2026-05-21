import React from 'react';
import { CheckCircle2, Clock3, XCircle } from 'lucide-react';

type CalendarEvent = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  location_address?: string | null;
};

type CalendarAttendee = {
  id: string;
  status: 'needs_action' | 'accepted' | 'declined' | 'tentative';
};

type Props = {
  pendingInvites: {
    event: CalendarEvent;
    attendee: CalendarAttendee;
  }[];
  saving: boolean;
  onRespond: (attendeeId: string, status: CalendarAttendee['status']) => void;
};

const BRAND = {
  black: '#0F1115',
  text: '#111827',
  muted: '#6B7280',
  border: '#E5E7EB',
};

const pageFont = 'Inter, Helvetica, Arial, sans-serif';

const blackButtonStyle: React.CSSProperties = {
  height: '38px',
  borderRadius: '12px',
  border: `1px solid ${BRAND.black}`,
  background: BRAND.black,
  color: '#FFFFFF',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '7px',
  padding: '0 12px',
  fontSize: '12px',
  fontWeight: 760,
  fontFamily: pageFont,
  cursor: 'pointer',
};

const secondaryButtonStyle: React.CSSProperties = {
  height: '38px',
  borderRadius: '12px',
  border: `1px solid ${BRAND.border}`,
  background: '#FFFFFF',
  color: BRAND.text,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '7px',
  padding: '0 12px',
  fontSize: '12px',
  fontWeight: 760,
  fontFamily: pageFont,
  cursor: 'pointer',
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('de-CH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function CalendarInvitePanel({ pendingInvites, saving, onRespond }: Props) {
  return (
    <section
      style={{
        background: '#FFFFFF',
        border: `1px solid ${BRAND.border}`,
        borderRadius: '22px',
        boxShadow: '0 12px 32px rgba(15, 17, 21, 0.04)',
        overflow: 'hidden',
        fontFamily: pageFont,
      }}
    >
      <div
        style={{
          padding: '20px 22px',
          borderBottom: `1px solid ${BRAND.border}`,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: '16px',
            fontWeight: 820,
            color: BRAND.text,
            letterSpacing: '-0.025em',
          }}
        >
          Meine Einladungen
        </h2>

        <div
          style={{
            marginTop: '5px',
            fontSize: '13px',
            fontWeight: 620,
            color: BRAND.muted,
          }}
        >
          Offene Kalendereinladungen zur Bestätigung.
        </div>
      </div>

      {pendingInvites.length === 0 ? (
        <div
          style={{
            minHeight: '140px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: BRAND.muted,
            fontSize: '14px',
            fontWeight: 650,
          }}
        >
          Keine offenen Kalendereinladungen.
        </div>
      ) : (
        <div>
          {pendingInvites.map(({ event, attendee }, index) => (
            <div
              key={attendee.id}
              className="calendar-invite-row"
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) auto',
                gap: '16px',
                alignItems: 'center',
                padding: '18px 22px',
                borderBottom:
                  index < pendingInvites.length - 1 ? `1px solid ${BRAND.border}` : 'none',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '15px',
                    fontWeight: 800,
                    color: BRAND.text,
                    marginBottom: '7px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {event.title}
                </div>

                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: BRAND.muted,
                    lineHeight: 1.45,
                  }}
                >
                  {formatDate(event.starts_at)} bis {formatDate(event.ends_at)}
                  {event.location_address ? ` · ${event.location_address}` : ''}
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  justifyContent: 'flex-end',
                  flexWrap: 'wrap',
                }}
              >
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => onRespond(attendee.id, 'accepted')}
                  style={blackButtonStyle}
                >
                  <CheckCircle2 size={16} />
                  Annehmen
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={() => onRespond(attendee.id, 'tentative')}
                  style={secondaryButtonStyle}
                >
                  <Clock3 size={16} />
                  Vorläufig
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={() => onRespond(attendee.id, 'declined')}
                  style={secondaryButtonStyle}
                >
                  <XCircle size={16} />
                  Ablehnen
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        @media (max-width: 760px) {
          .calendar-invite-row {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </section>
  );
}
import type { CSSProperties } from 'react';
import {
  CheckCircle2,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import {
  OPC_STAFF_PERMISSION_DEFINITIONS,
  type OpcEmployeePortalAccessDraft,
  type OpcStaffPermissionKey,
} from '../lib/opc-staff-permissions';

const BRAND = {
  text: '#111827',
  muted: '#6B7280',
  border: '#E5E7EB',
  black: '#0F1115',
  soft: '#FAFAFA',
  amber: '#92400E',
};

const font =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", "Helvetica Neue", Segoe UI, Roboto, sans-serif';

const cardStyle: CSSProperties = {
  marginTop: 14,
  border: `1px solid ${BRAND.border}`,
  borderRadius: 18,
  background: '#FFFFFF',
  overflow: 'hidden',
};

function Toggle({
  checked,
  onChange,
  label,
  helper,
  disabled = false,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  helper?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: '100%',
        border: 0,
        background: 'transparent',
        minHeight: 54,
        padding: '10px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        textAlign: 'left',
        color: BRAND.text,
        fontFamily: font,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? .55 : 1,
      }}
    >
      <span
        style={{
          width: 20,
          height: 20,
          borderRadius: 999,
          border: `2px solid ${checked ? BRAND.black : '#9CA3AF'}`,
          background: checked ? BRAND.black : '#FFFFFF',
          color: '#FFFFFF',
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        {checked ? <CheckCircle2 size={13} /> : null}
      </span>
      <span style={{ display: 'grid', gap: 2 }}>
        <strong style={{ fontSize: 13, fontWeight: 820 }}>{label}</strong>
        {helper ? (
          <small style={{ color: BRAND.muted, fontSize: 11, lineHeight: 1.35, fontWeight: 620 }}>
            {helper}
          </small>
        ) : null}
      </span>
    </button>
  );
}

export default function EmployeePortalAccessCreateFields({
  value,
  onChange,
  suggestedEmail,
  disabled = false,
}: {
  value: OpcEmployeePortalAccessDraft;
  onChange: (next: OpcEmployeePortalAccessDraft) => void;
  suggestedEmail?: string;
  disabled?: boolean;
}) {
  const updatePermission = (
    key: OpcStaffPermissionKey,
    checked: boolean,
  ) => {
    onChange({
      ...value,
      permissions: {
        ...value.permissions,
        [key]: checked,
      },
    });
  };

  const groups = [
    {
      key: 'standard',
      title: 'Standardzugriff',
      description: 'Empfohlene Rechte für reguläre Mitarbeitende.',
    },
    {
      key: 'extended',
      title: 'Erweiterter Zugriff',
      description: 'Zusätzliche Sichtbarkeit ohne vollständige Verwaltung.',
    },
    {
      key: 'management',
      title: 'Verwaltungsrechte',
      description: 'Nur gezielt vergeben. Diese Rechte betreffen andere Mitarbeitende oder operative Daten.',
    },
    {
      key: 'sensitive',
      title: 'Sensible Administration',
      description: 'Finanz- und Systemeinstellungen nur bei tatsächlichem Bedarf freigeben.',
    },
  ];

  return (
    <div data-opc-employee-portal-create-v10="true" style={cardStyle}>
      <div
        style={{
          padding: 16,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 11,
          borderBottom: `1px solid ${BRAND.border}`,
          background: BRAND.soft,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 13,
            border: `1px solid ${BRAND.border}`,
            background: '#FFFFFF',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          <ShieldCheck size={17} />
        </div>
        <div>
          <strong style={{ display: 'block', fontSize: 14, fontWeight: 850 }}>
            Neuen Portal-Zugang erstellen
          </strong>
          <span
            style={{
              display: 'block',
              marginTop: 4,
              color: BRAND.muted,
              fontSize: 12,
              lineHeight: 1.45,
              fontWeight: 640,
            }}
          >
            Owner können direkt mit der Personalakte einen Mitarbeiter-Login anlegen,
            Rechte definieren und die Einladung versenden.
          </span>
        </div>
      </div>

      <div style={{ padding: 14 }}>
        {disabled ? (
          <div
            style={{
              marginBottom: 12,
              padding: 11,
              borderRadius: 13,
              border: `1px solid ${BRAND.border}`,
              background: BRAND.soft,
              color: BRAND.muted,
              fontSize: 12,
              lineHeight: 1.45,
              fontWeight: 680,
            }}
          >
            Es wurde bereits ein bestehender Portalnutzer ausgewählt. Für diesen
            Mitarbeiter wird kein zweiter Login erzeugt.
          </div>
        ) : null}

        <Toggle
          checked={value.enabled}
          disabled={disabled}
          onChange={(enabled) =>
            onChange({
              ...value,
              enabled,
              loginEmail:
                value.loginEmail ||
                String(suggestedEmail || '').trim().toLowerCase(),
            })
          }
          label="Portal-Zugang erstellen"
          helper="Der Mitarbeiter erhält einen eigenen Supabase-Login. Owner-Rechte können hier nicht vergeben werden."
        />

        {value.enabled && !disabled ? (
          <>
            <label
              style={{
                display: 'grid',
                gap: 6,
                marginTop: 10,
                color: BRAND.muted,
                fontSize: 11,
                fontWeight: 780,
              }}
            >
              Login-E-Mail
              <span style={{ position: 'relative' }}>
                <Mail
                  size={15}
                  style={{
                    position: 'absolute',
                    left: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#9CA3AF',
                  }}
                />
                <input
                  type="email"
                  value={value.loginEmail}
                  onChange={(event) =>
                    onChange({
                      ...value,
                      loginEmail: event.target.value,
                    })
                  }
                  placeholder={suggestedEmail || 'name@orangeproclean.ch'}
                  style={{
                    width: '100%',
                    minHeight: 46,
                    border: `1px solid ${BRAND.border}`,
                    borderRadius: 14,
                    padding: '0 12px 0 38px',
                    background: '#FFFFFF',
                    color: BRAND.text,
                    outline: 0,
                    fontFamily: font,
                    fontSize: 13,
                    fontWeight: 680,
                  }}
                />
              </span>
            </label>

            {groups.map((group) => {
              const items = OPC_STAFF_PERMISSION_DEFINITIONS.filter(
                (item) => item.group === group.key,
              );

              return (
                <div
                  key={group.key}
                  style={{
                    marginTop: 13,
                    paddingTop: 13,
                    borderTop: `1px solid ${BRAND.border}`,
                  }}
                >
                  <div
                    style={{
                      marginBottom: 7,
                      display: 'grid',
                      gap: 2,
                    }}
                  >
                    <strong style={{ fontSize: 12, fontWeight: 850 }}>
                      {group.title}
                    </strong>
                    <span
                      style={{
                        color: group.key === 'sensitive' ? BRAND.amber : BRAND.muted,
                        fontSize: 11,
                        lineHeight: 1.4,
                        fontWeight: 620,
                      }}
                    >
                      {group.description}
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))',
                      gap: 5,
                    }}
                  >
                    {items.map((item) => (
                      <Toggle
                        key={item.key}
                        checked={value.permissions[item.key]}
                        onChange={(checked) =>
                          updatePermission(item.key, checked)
                        }
                        label={item.label}
                        helper={item.description}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </>
        ) : null}
      </div>
    </div>
  );
}

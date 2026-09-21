import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Check,
  KeyRound,
  Loader2,
  Mail,
  RefreshCw,
  Save,
  ShieldCheck,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';
import {
  OPC_STAFF_PERMISSION_DEFINITIONS,
  defaultOpcEmployeePermissions,
  type OpcStaffPermissions,
  type OpcStaffPermissionKey,
} from '../lib/opc-staff-permissions';

type PortalState = {
  linked: boolean;
  employeeId: string;
  userId: string | null;
  staffRoleId: string | null;
  loginEmail: string;
  role: string;
  status: string;
  isOwner?: boolean;
  isPrivileged?: boolean;
  canAccessPortal: boolean;
  permissions: OpcStaffPermissions;
  inviteSentAt: string | null;
  auth: {
    exists: boolean;
    confirmedAt: string | null;
    invitedAt: string | null;
    lastSignInAt: string | null;
  };
};

const BRAND = {
  text: '#111827',
  muted: '#6B7280',
  faint: '#9CA3AF',
  border: '#E5E7EB',
  borderStrong: '#D1D5DB',
  black: '#0F1115',
  soft: '#FAFAFA',
};

const font =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", "Helvetica Neue", Segoe UI, Roboto, sans-serif';

async function getToken() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Keine aktive Sitzung gefunden.');
  return token;
}

async function requestJson(path: string, init: RequestInit = {}) {
  const token = await getToken();
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Accept', 'application/json');

  if (init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      payload?.error ||
      'Portal-Zugang konnte nicht verarbeitet werden.',
    );
  }

  return payload;
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function groupTitle(group: string) {
  if (group === 'standard') return 'Standardzugriff';
  if (group === 'extended') return 'Erweiterter Zugriff';
  if (group === 'management') return 'Verwaltungsrechte';
  return 'Sensible Administration';
}

function statusLabel(portal: PortalState | null) {
  if (!portal) return 'Nicht geladen';
  if (portal.isOwner) return 'Owner · Vollzugriff';
  if (portal.isPrivileged) return `${portal.role || 'Admin'} · zentral verwaltet`;
  if (!portal.linked) return 'Kein Portalzugang';
  if (!portal.canAccessPortal) return 'Portal gesperrt';
  return 'Portal aktiv';
}

function accountLabel(portal: PortalState | null) {
  if (!portal) return '—';
  if (portal.auth?.confirmedAt) return 'Konto bestätigt';
  if (portal.auth?.exists) return 'Einladung ausstehend';
  if (portal.isOwner || portal.isPrivileged) return 'Rolle vorhanden';
  return 'Noch kein Login';
}

function PermissionRow({
  checked,
  label,
  helper,
  onClick,
  disabled,
}: {
  checked: boolean;
  label: string;
  helper: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        width: '100%',
        minHeight: 52,
        border: `1px solid ${BRAND.border}`,
        borderRadius: 14,
        padding: '9px 11px',
        background: checked ? BRAND.soft : '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        textAlign: 'left',
        fontFamily: font,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled && !checked ? .65 : 1,
      }}
    >
      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: 999,
          border: `2px solid ${checked ? BRAND.black : BRAND.borderStrong}`,
          background: checked ? BRAND.black : '#FFFFFF',
          color: '#FFFFFF',
          display: 'grid',
          placeItems: 'center',
          flex: '0 0 auto',
        }}
      >
        {checked ? <Check size={11} strokeWidth={3} /> : null}
      </span>

      <span style={{ minWidth: 0, display: 'grid', gap: 2 }}>
        <strong
          style={{
            color: BRAND.text,
            fontSize: 12,
            lineHeight: 1.2,
            fontWeight: 820,
          }}
        >
          {label}
        </strong>
        <small
          style={{
            color: BRAND.muted,
            fontSize: 10.5,
            lineHeight: 1.35,
            fontWeight: 630,
          }}
        >
          {helper}
        </small>
      </span>
    </button>
  );
}

export default function EmployeePortalAccessPanel({
  employeeId,
  suggestedEmail,
}: {
  employeeId: string;
  suggestedEmail?: string;
}) {
  const [portal, setPortal] = useState<PortalState | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [permissions, setPermissions] =
    useState<OpcStaffPermissions>(() =>
      defaultOpcEmployeePermissions()
    );
  const [canAccessPortal, setCanAccessPortal] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');

    try {
      const payload = await requestJson(
        `/api/opc/employees/${employeeId}/portal-access`,
      );

      const next = payload.portal as PortalState;
      setPortal(next);
      setLoginEmail(
        next.loginEmail ||
        String(suggestedEmail || '').trim().toLowerCase(),
      );
      setPermissions(
        next.permissions || defaultOpcEmployeePermissions(),
      );
      setCanAccessPortal(next.canAccessPortal !== false);
    } catch (nextError: any) {
      setError(
        nextError?.message ||
        'Portal-Zugang konnte nicht geladen werden.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [employeeId]);

  const groups = useMemo(
    () =>
      ['standard', 'extended', 'management', 'sensitive'].map(
        (group) => ({
          group,
          items: OPC_STAFF_PERMISSION_DEFINITIONS.filter(
            (item) => item.group === group,
          ),
        }),
      ),
    [],
  );

  const privileged = Boolean(portal?.isPrivileged);
  const owner = Boolean(portal?.isOwner);

  const updatePermission = (
    key: OpcStaffPermissionKey,
    checked: boolean,
  ) => {
    if (privileged) return;

    setPermissions((current) => ({
      ...current,
      [key]: checked,
    }));
  };

  const createOrInvite = async () => {
    if (busy || privileged) return;

    const email = loginEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      setError('Bitte eine gültige Login-E-Mail eintragen.');
      return;
    }

    setBusy('invite');
    setError('');
    setMessage('');

    try {
      const payload = await requestJson(
        `/api/opc/employees/${employeeId}/portal-access`,
        {
          method: 'POST',
          body: JSON.stringify({
            action: 'create_or_invite',
            loginEmail: email,
            canAccessPortal,
            permissions,
          }),
        },
      );

      setMessage(
        payload.inviteSent
          ? 'Portal-Zugang wurde erstellt und die Einladung wurde versendet.'
          : payload.accessEmailSent
            ? 'Zugangs-/Passwortlink wurde versendet.'
            : 'Bestehender Login wurde mit der Personalakte verknüpft.',
      );

      await load();
    } catch (nextError: any) {
      setError(nextError?.message || 'Einladung fehlgeschlagen.');
    } finally {
      setBusy('');
    }
  };

  const sendAccessEmail = async () => {
    if (busy || !portal?.linked || privileged) return;

    setBusy('email');
    setError('');
    setMessage('');

    try {
      const payload = await requestJson(
        `/api/opc/employees/${employeeId}/portal-access`,
        {
          method: 'POST',
          body: JSON.stringify({ action: 'send_access_email' }),
        },
      );

      setMessage(
        payload.inviteSent
          ? 'Einladung wurde erneut versendet.'
          : 'Passwort-/Zugangslink wurde versendet.',
      );

      await load();
    } catch (nextError: any) {
      setError(
        nextError?.message ||
        'Zugangslink konnte nicht versendet werden.',
      );
    } finally {
      setBusy('');
    }
  };

  const save = async () => {
    if (busy || !portal?.linked || privileged) return;

    setBusy('save');
    setError('');
    setMessage('');

    try {
      await requestJson(
        `/api/opc/employees/${employeeId}/portal-access`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            canAccessPortal,
            permissions,
          }),
        },
      );

      setMessage('Portal-Berechtigungen wurden gespeichert.');
      await load();
    } catch (nextError: any) {
      setError(
        nextError?.message ||
        'Berechtigungen konnten nicht gespeichert werden.',
      );
    } finally {
      setBusy('');
    }
  };

  return (
    <section
      data-opc-employee-portal-access-v101="true"
      style={{
        marginBottom: 18,
        padding: 18,
        border: `1px solid ${BRAND.border}`,
        borderRadius: 20,
        background: '#FFFFFF',
        boxShadow: '0 1px 2px rgba(15,23,42,.04)',
        fontFamily: font,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <span
            style={{
              width: 36,
              height: 36,
              border: `1px solid ${BRAND.border}`,
              borderRadius: 13,
              background: BRAND.soft,
              display: 'grid',
              placeItems: 'center',
              flex: '0 0 auto',
            }}
          >
            <ShieldCheck size={17} />
          </span>

          <div>
            <h2
              style={{
                margin: 0,
                color: BRAND.text,
                fontSize: 18,
                lineHeight: 1.2,
                fontWeight: 820,
                letterSpacing: '-.035em',
              }}
            >
              Portal & Berechtigungen
            </h2>
            <p
              style={{
                margin: '4px 0 0',
                color: BRAND.muted,
                fontSize: 13,
                lineHeight: 1.4,
                fontWeight: 650,
              }}
            >
              Login, Portalzugriff und rollenbasierte Rechte dieser Personalakte.
            </p>
          </div>
        </div>

        {!loading ? (
          <span
            style={{
              minHeight: 32,
              padding: '0 11px',
              border: `1px solid ${BRAND.border}`,
              borderRadius: 999,
              background: owner ? BRAND.black : BRAND.soft,
              color: owner ? '#FFFFFF' : BRAND.text,
              display: 'inline-flex',
              alignItems: 'center',
              whiteSpace: 'nowrap',
              fontSize: 11,
              fontWeight: 820,
            }}
          >
            {statusLabel(portal)}
          </span>
        ) : null}
      </div>

      {loading ? (
        <div
          style={{
            minHeight: 90,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 8,
            color: BRAND.muted,
            fontSize: 13,
            fontWeight: 680,
          }}
        >
          <Loader2 size={16} className="spin" />
          Portalzugang wird geladen...
        </div>
      ) : (
        <>
          {error ? (
            <div
              style={{
                marginBottom: 12,
                padding: '11px 13px',
                border: `1px solid ${BRAND.border}`,
                borderRadius: 14,
                background: BRAND.soft,
                color: BRAND.text,
                fontSize: 12,
                lineHeight: 1.4,
                fontWeight: 680,
              }}
            >
              {error}
            </div>
          ) : null}

          {message ? (
            <div
              style={{
                marginBottom: 12,
                padding: '11px 13px',
                border: `1px solid ${BRAND.border}`,
                borderRadius: 14,
                background: BRAND.soft,
                color: BRAND.text,
                fontSize: 12,
                lineHeight: 1.4,
                fontWeight: 680,
              }}
            >
              {message}
            </div>
          ) : null}

          {owner ? (
            <div
              style={{
                marginBottom: 14,
                padding: '12px 13px',
                border: `1px solid ${BRAND.border}`,
                borderRadius: 14,
                background: BRAND.soft,
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
              }}
            >
              <ShieldCheck size={16} style={{ marginTop: 1, flex: '0 0 auto' }} />
              <div>
                <strong
                  style={{
                    display: 'block',
                    color: BRAND.text,
                    fontSize: 12,
                    fontWeight: 840,
                  }}
                >
                  Owner-Rolle erkannt · vollständiger Portalzugriff
                </strong>
                <span
                  style={{
                    display: 'block',
                    marginTop: 3,
                    color: BRAND.muted,
                    fontSize: 11,
                    lineHeight: 1.4,
                    fontWeight: 640,
                  }}
                >
                  Owner erhalten ihre Rechte rollenbasiert. Alle unten aufgeführten
                  Berechtigungen gelten effektiv als aktiv und können in der
                  Mitarbeiter-Personalakte nicht herabgestuft werden.
                </span>
              </div>
            </div>
          ) : portal?.isPrivileged ? (
            <div
              style={{
                marginBottom: 14,
                padding: '12px 13px',
                border: `1px solid ${BRAND.border}`,
                borderRadius: 14,
                background: BRAND.soft,
                color: BRAND.muted,
                fontSize: 11,
                lineHeight: 1.4,
                fontWeight: 650,
              }}
            >
              Dieses privilegierte Konto wird über seine Systemrolle verwaltet.
              Die Mitarbeiter-Personalakte zeigt den effektiven Zugriff nur an.
            </div>
          ) : null}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3,minmax(0,1fr))',
              gap: 10,
              marginBottom: 15,
            }}
          >
            <div
              style={{
                minHeight: 68,
                padding: '11px 12px',
                border: `1px solid ${BRAND.border}`,
                borderRadius: 14,
                background: '#FFFFFF',
              }}
            >
              <span
                style={{
                  display: 'block',
                  color: BRAND.muted,
                  fontSize: 10,
                  fontWeight: 780,
                  marginBottom: 5,
                }}
              >
                Login-E-Mail
              </span>

              {portal?.linked || privileged ? (
                <strong
                  style={{
                    display: 'block',
                    color: BRAND.text,
                    fontSize: 12,
                    lineHeight: 1.35,
                    fontWeight: 780,
                    overflowWrap: 'anywhere',
                  }}
                >
                  {portal?.loginEmail || 'Nicht hinterlegt'}
                </strong>
              ) : (
                <div style={{ position: 'relative' }}>
                  <Mail
                    size={14}
                    style={{
                      position: 'absolute',
                      left: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: BRAND.faint,
                    }}
                  />
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(event) => setLoginEmail(event.target.value)}
                    placeholder={suggestedEmail || 'name@orangeproclean.ch'}
                    style={{
                      width: '100%',
                      minHeight: 36,
                      border: `1px solid ${BRAND.border}`,
                      borderRadius: 11,
                      padding: '0 9px 0 31px',
                      color: BRAND.text,
                      background: '#FFFFFF',
                      outline: 0,
                      fontFamily: font,
                      fontSize: 11,
                      fontWeight: 680,
                    }}
                  />
                </div>
              )}
            </div>

            <div
              style={{
                minHeight: 68,
                padding: '11px 12px',
                border: `1px solid ${BRAND.border}`,
                borderRadius: 14,
                background: '#FFFFFF',
              }}
            >
              <span
                style={{
                  display: 'block',
                  color: BRAND.muted,
                  fontSize: 10,
                  fontWeight: 780,
                  marginBottom: 5,
                }}
              >
                Loginstatus
              </span>
              <strong
                style={{
                  display: 'block',
                  color: BRAND.text,
                  fontSize: 12,
                  fontWeight: 780,
                }}
              >
                {accountLabel(portal)}
              </strong>
              {portal?.auth?.lastSignInAt ? (
                <small
                  style={{
                    display: 'block',
                    marginTop: 3,
                    color: BRAND.faint,
                    fontSize: 10,
                    fontWeight: 620,
                  }}
                >
                  Letzter Login {formatDateTime(portal.auth.lastSignInAt)}
                </small>
              ) : null}
            </div>

            <button
              type="button"
              disabled={privileged}
              onClick={() =>
                !privileged &&
                setCanAccessPortal((current) => !current)
              }
              style={{
                minHeight: 68,
                padding: '11px 12px',
                border: `1px solid ${BRAND.border}`,
                borderRadius: 14,
                background: '#FFFFFF',
                textAlign: 'left',
                fontFamily: font,
                cursor: privileged ? 'default' : 'pointer',
              }}
            >
              <span
                style={{
                  display: 'block',
                  color: BRAND.muted,
                  fontSize: 10,
                  fontWeight: 780,
                  marginBottom: 5,
                }}
              >
                Portalzugang
              </span>
              <strong
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  color: BRAND.text,
                  fontSize: 12,
                  fontWeight: 780,
                }}
              >
                <span
                  style={{
                    width: 17,
                    height: 17,
                    borderRadius: 999,
                    border: `2px solid ${canAccessPortal ? BRAND.black : BRAND.borderStrong}`,
                    background: canAccessPortal ? BRAND.black : '#FFFFFF',
                    color: '#FFFFFF',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  {canAccessPortal ? <Check size={10} strokeWidth={3} /> : null}
                </span>
                {owner
                  ? 'Über Owner-Rolle aktiv'
                  : canAccessPortal
                    ? 'Erlaubt'
                    : 'Gesperrt'}
              </strong>
            </button>
          </div>

          <div
            style={{
              paddingTop: 14,
              borderTop: `1px solid ${BRAND.border}`,
            }}
          >
            {groups.map(({ group, items }) => (
              <div
                key={group}
                style={{
                  marginBottom: group === 'sensitive' ? 0 : 15,
                }}
              >
                <div
                  style={{
                    marginBottom: 7,
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 8,
                  }}
                >
                  <strong
                    style={{
                      color: BRAND.text,
                      fontSize: 12,
                      fontWeight: 840,
                    }}
                  >
                    {groupTitle(group)}
                  </strong>
                  {group === 'sensitive' ? (
                    <span
                      style={{
                        color: BRAND.muted,
                        fontSize: 10,
                        fontWeight: 620,
                      }}
                    >
                      sensible Unternehmensbereiche
                    </span>
                  ) : null}
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2,minmax(0,1fr))',
                    gap: 7,
                  }}
                >
                  {items.map((item) => (
                    <PermissionRow
                      key={item.key}
                      checked={
                        owner
                          ? true
                          : Boolean(permissions[item.key])
                      }
                      disabled={privileged}
                      onClick={() =>
                        updatePermission(
                          item.key,
                          !permissions[item.key],
                        )
                      }
                      label={item.label}
                      helper={item.description}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: 15,
              paddingTop: 14,
              borderTop: `1px solid ${BRAND.border}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                color: BRAND.muted,
                fontSize: 10.5,
                lineHeight: 1.4,
                fontWeight: 640,
              }}
            >
              {owner
                ? `Owner · Vollzugriff · Staff-ID ${portal?.staffRoleId || '—'}`
                : portal?.linked
                  ? `Einladung ${formatDateTime(portal.inviteSentAt)} · Rolle ${portal.role || 'employee'}`
                  : 'Noch kein Portal-Login mit dieser Personalakte verknüpft.'}
            </span>

            {!privileged ? (
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                {!portal?.linked ? (
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => void createOrInvite()}
                    style={{
                      minHeight: 42,
                      border: `1px solid ${BRAND.black}`,
                      borderRadius: 13,
                      padding: '0 14px',
                      background: BRAND.black,
                      color: '#FFFFFF',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 7,
                      fontFamily: font,
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    {busy === 'invite'
                      ? <Loader2 size={14} className="spin" />
                      : <KeyRound size={14} />}
                    Zugang erstellen & einladen
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() => void sendAccessEmail()}
                      style={{
                        minHeight: 42,
                        border: `1px solid ${BRAND.border}`,
                        borderRadius: 13,
                        padding: '0 13px',
                        background: '#FFFFFF',
                        color: BRAND.text,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 7,
                        fontFamily: font,
                        fontSize: 12,
                        fontWeight: 780,
                        cursor: 'pointer',
                      }}
                    >
                      {busy === 'email'
                        ? <Loader2 size={14} className="spin" />
                        : <RefreshCw size={14} />}
                      Zugangslink senden
                    </button>

                    <button
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() => void save()}
                      style={{
                        minHeight: 42,
                        border: `1px solid ${BRAND.black}`,
                        borderRadius: 13,
                        padding: '0 14px',
                        background: BRAND.black,
                        color: '#FFFFFF',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 7,
                        fontFamily: font,
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      {busy === 'save'
                        ? <Loader2 size={14} className="spin" />
                        : <Save size={14} />}
                      Berechtigungen speichern
                    </button>
                  </>
                )}
              </div>
            ) : null}
          </div>
        </>
      )}

      <style>{`
        @media (max-width: 980px) {
          [data-opc-employee-portal-access-v101="true"] > div:nth-of-type(2) {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </section>
  );
}

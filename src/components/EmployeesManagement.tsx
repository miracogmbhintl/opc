import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  Clock3,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  UserRound,
  UsersRound,
} from 'lucide-react';
import MirakaDashboardShell from './MirakaDashboardShell';
import { supabase } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';
import { readOpcPageCache, writeOpcPageCache } from '../lib/opc-page-cache';

type JsonRow = Record<string, any>;

type EmployeeListRow = {
  id: string;
  employee_id: string | null;
  source: 'hr' | 'portal_only';
  employee_number: string | null;
  staff_role_id: string | null;
  display_name: string;
  email: string | null;
  phone_raw: string | null;
  phone_e164: string | null;
  whatsapp_wa_id: string | null;
  status: string;
  assignment_status: string;
  profile_completion_status: string;
  personnel_type: string;
  payroll_in_scope: boolean | null;
  portal_access_only: boolean;
  portal_role: string | null;
  entity_id: string | null;
  entity_code: string | null;
  entity_name: string | null;
  position: {
    id: string | null;
    code: string | null;
    title: string | null;
  };
  city: string | null;
  country_code: string | null;
  active_skill_count: number;
  preferred_skills: string[];
  availability_mode: string | null;
  is_available_today: boolean | null;
  availability_label: string;
  entry_date: string | null;
};

type ListPayload = {
  success: boolean;
  role?: 'owner' | 'admin';
  canManagePayroll?: boolean;
  employees?: EmployeeListRow[];
  options?: {
    entities?: JsonRow[];
    positions?: JsonRow[];
    skills?: JsonRow[];
    unlinkedStaff?: JsonRow[];
  };
  error?: string;
};

type MainFilter = 'active' | 'incomplete' | 'all';
type AvailabilityFilter = 'all' | 'available' | 'unavailable' | 'not_maintained';
// OPC_EMPLOYEE_SUMMARY_CACHE_V1
const EMPLOYEE_SUMMARY_CACHE_KEY = 'opc:page-cache:employees:summary:v1';
const EMPLOYEE_SUMMARY_CACHE_TTL_MS = 5 * 60 * 1000;

const BRAND = {
  text: '#111827',
  muted: '#6B7280',
  faint: '#9CA3AF',
  border: '#E5E7EB',
  black: '#0F1115',
  card: '#FFFFFF',
  soft: '#FAFAFA',
  green: '#166534',
  red: '#B91C1C',
  amber: '#92400E',
  blue: '#155E75',
};

const pageFont =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", "Helvetica Neue", Segoe UI, Roboto, sans-serif';

const cardStyle: CSSProperties = {
  background: BRAND.card,
  border: `1px solid ${BRAND.border}`,
  borderRadius: '20px',
  boxShadow: '0 1px 2px rgba(15, 17, 21, 0.04)',
};

function normalize(value?: string | null) {
  return String(value || '').trim().toLowerCase();
}

function formatEmployeeStatus(status?: string | null) {
  const labels: Record<string, string> = {
    onboarding: 'Onboarding',
    active: 'Aktiv',
    inactive: 'Inaktiv',
    suspended: 'Gesperrt',
    terminated: 'Ausgetreten',
    archived: 'Archiviert',
    available: 'Verfügbar',
    limited: 'Eingeschränkt',
    unavailable: 'Nicht verfügbar',
    on_leave: 'Abwesend',
    missing: 'Personalakte fehlt',
    incomplete: 'Unvollständig',
    in_review: 'In Prüfung',
    complete: 'Vollständig',
    update_required: 'Aktualisierung nötig',
  };

  const key = normalize(status);
  return labels[key] || key.replaceAll('_', ' ') || 'Unbekannt';
}

function formatPersonnelType(value?: string | null) {
  const labels: Record<string, string> = {
    employee: 'Mitarbeiter/in',
    owner_employee: 'Inhaber/in mit Anstellung',
    external_contractor: 'Externe Fachkraft',
    external_infrastructure: 'Externe Infrastruktur',
    agency_worker: 'Temporär über Agentur',
    temporary_external: 'Temporäre externe Kraft',
    intern: 'Praktikum',
    apprentice: 'Lernende/r',
    other: 'Andere',
    unclassified: 'Noch nicht klassifiziert',
  };
  return labels[normalize(value)] || value || 'Nicht klassifiziert';
}

function getStatusStyle(row: EmployeeListRow) {
  if (row.source === 'portal_only' || row.profile_completion_status === 'missing') {
    return { bg: '#FFFBEB', color: BRAND.amber, border: '#FDE68A', label: 'Personalakte fehlt' };
  }

  const status = normalize(row.status);
  if (status === 'active') {
    return { bg: '#ECFDF5', color: '#047857', border: '#A7F3D0', label: 'Aktiv' };
  }
  if (status === 'onboarding') {
    return { bg: '#F5F3FF', color: '#5B21B6', border: '#DDD6FE', label: 'Onboarding' };
  }
  if (['inactive', 'terminated', 'archived'].includes(status)) {
    return { bg: '#F3F4F6', color: BRAND.text, border: '#D1D5DB', label: formatEmployeeStatus(status) };
  }
  if (status === 'suspended') {
    return { bg: '#FEF2F2', color: BRAND.red, border: '#FECACA', label: 'Gesperrt' };
  }

  return { bg: '#F9FAFB', color: BRAND.muted, border: BRAND.border, label: formatEmployeeStatus(status) };
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join('') || '?';
}

async function apiGet<T>(path: string): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Keine aktive Sitzung gefunden.');

  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  const payload = (await response.json().catch(() => ({}))) as any;
  if (!response.ok) throw new Error(payload?.error || 'Anfrage fehlgeschlagen.');
  return payload as T;
}

function MetricCard({
  value,
  label,
  icon,
  tone = 'neutral',
}: {
  value: number;
  label: string;
  icon: ReactNode;
  tone?: 'neutral' | 'danger' | 'dark';
}) {
  const valueColor = tone === 'danger' ? BRAND.red : tone === 'dark' ? BRAND.black : BRAND.text;

  return (
    <div className="opc-staff-metric-card" style={cardStyle}>
      <div>
        <div className="opc-staff-metric-value" style={{ color: valueColor }}>{value}</div>
        <div className="opc-staff-metric-label">{label}</div>
      </div>
      <div className="opc-staff-metric-icon">{icon}</div>
    </div>
  );
}

function StatusBadge({ row }: { row: EmployeeListRow }) {
  const style = getStatusStyle(row);
  return (
    <span
      className="opc-staff-status-badge"
      style={{ background: style.bg, color: style.color, borderColor: style.border }}
    >
      {style.label}
    </span>
  );
}

function AvailabilityBadge({ row }: { row: EmployeeListRow }) {
  const available = row.is_available_today;
  const style =
    available === true
      ? { background: '#ECFDF5', color: '#047857', borderColor: '#A7F3D0' }
      : available === false
        ? { background: '#F9FAFB', color: BRAND.muted, borderColor: BRAND.border }
        : { background: '#FFFBEB', color: BRAND.amber, borderColor: '#FDE68A' };

  return (
    <span className="opc-availability-badge" style={style}>
      {row.availability_label || 'Nicht gepflegt'}
    </span>
  );
}

function EmployeeCard({ row }: { row: EmployeeListRow }) {
  const detailHref = row.employee_id
    ? `${baseUrl}/mitarbeiter/${row.employee_id}`
    : `${baseUrl}/mitarbeiter-anlegen?staffRoleId=${encodeURIComponent(row.staff_role_id || '')}`;
  const primaryAction = row.employee_id ? 'Details öffnen' : 'Personalakte anlegen';
  const phone = row.phone_e164 || row.phone_raw || '';
  const whatsapp = row.whatsapp_wa_id || phone;

  return (
    <article className="opc-staff-card" style={cardStyle}>
      <div className="opc-staff-card-main">
        <div className="opc-staff-person-block">
          <div className="opc-staff-avatar">{initials(row.display_name)}</div>
          <div className="opc-staff-title-wrap">
            <h3>{row.display_name}</h3>
            <div className="opc-staff-number-row">
              <span>{row.employee_number || 'Noch keine Personalnummer'}</span>
              {row.portal_role ? <span>Portal: {row.portal_role}</span> : null}
            </div>
          </div>
        </div>

        <div className="opc-staff-card-side">
          <StatusBadge row={row} />
          <AvailabilityBadge row={row} />
        </div>
      </div>

      <div className="opc-staff-meta-grid">
        <div>
          <BriefcaseBusiness size={14} />
          <span>{row.position?.title || formatPersonnelType(row.personnel_type)}</span>
        </div>
        <div>
          <Building2 size={14} />
          <span>{row.entity_name || 'Rechtsträger nicht hinterlegt'}</span>
        </div>
        <div>
          <Phone size={14} />
          <span>{phone || 'Telefon nicht hinterlegt'}</span>
        </div>
        <div>
          <BadgeCheck size={14} />
          <span>
            {row.availability_label === 'Details öffnen'
              ? 'Skills in den Details'
              : `${row.active_skill_count} Skill${row.active_skill_count === 1 ? '' : 's'}${row.preferred_skills?.length ? ` · ${row.preferred_skills.join(', ')}` : ''}`}
          </span>
        </div>
      </div>

      <div className="opc-staff-card-actions">
        <a className="opc-staff-action dark" href={detailHref} data-astro-prefetch="false">
          {primaryAction}
        </a>

        {phone ? (
          <a className="opc-staff-action" href={`tel:${phone}`}>
            <Phone size={15} />
            Anrufen
          </a>
        ) : null}

        {row.email ? (
          <a className="opc-staff-icon-action" href={`mailto:${row.email}`} title="E-Mail">
            <Mail size={16} />
          </a>
        ) : null}

        {whatsapp ? (
          <a
            className="opc-staff-icon-action"
            href={`https://wa.me/${String(whatsapp).replace(/\D/g, '')}`}
            target="_blank"
            rel="noreferrer"
            title="WhatsApp"
          >
            <MessageCircle size={16} />
          </a>
        ) : null}
      </div>
    </article>
  );
}

export default function EmployeesManagement() {
  const [rows, setRows] = useState<EmployeeListRow[]>([]);
  const [entities, setEntities] = useState<JsonRow[]>([]);
  const [positions, setPositions] = useState<JsonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [mainFilter, setMainFilter] = useState<MainFilter>('active');
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilter>('all');
  const [entityFilter, setEntityFilter] = useState('all');
  const [positionFilter, setPositionFilter] = useState('all');
  const [role, setRole] = useState<'owner' | 'admin' | ''>('');

  useEffect(() => {
    const cached = readOpcPageCache<ListPayload>(
      EMPLOYEE_SUMMARY_CACHE_KEY,
      EMPLOYEE_SUMMARY_CACHE_TTL_MS,
    );
    if (cached) {
      applyEmployeePayload(cached);
      setLoading(false);
      return;
    }
    void loadEmployees();
  }, []);

  function applyEmployeePayload(payload: ListPayload) {
    setRows(payload.employees || []);
    setEntities(payload.options?.entities || []);
    setPositions(payload.options?.positions || []);
    setRole(payload.role || '');
  }

  async function loadEmployees() {
    setLoading(true);
    setErrorMessage('');

    try {
      const payload = await apiGet<ListPayload>('/api/opc/employees?mode=summary');
      applyEmployeePayload(payload);
      writeOpcPageCache(EMPLOYEE_SUMMARY_CACHE_KEY, payload);
    } catch (error: any) {
      setErrorMessage(error?.message || 'Mitarbeiter konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }

  const activeCount = useMemo(
    () => rows.filter((row) => row.source === 'hr' && ['active', 'onboarding'].includes(normalize(row.status))).length,
    [rows],
  );
  const availableCount = useMemo(
    () => rows.filter((row) => row.source === 'hr' && row.is_available_today === true).length,
    [rows],
  );
  const incompleteCount = useMemo(
    () =>
      rows.filter(
        (row) =>
          row.source === 'portal_only' ||
          ['missing', 'incomplete', 'update_required'].includes(normalize(row.profile_completion_status)),
      ).length,
    [rows],
  );
  const externalCount = useMemo(
    () => rows.filter((row) => normalize(row.personnel_type).startsWith('external')).length,
    [rows],
  );

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return rows.filter((row) => {
      const isIncomplete =
        row.source === 'portal_only' ||
        ['missing', 'incomplete', 'update_required'].includes(normalize(row.profile_completion_status));
      const isActive = ['active', 'onboarding'].includes(normalize(row.status));

      const matchesMain =
        mainFilter === 'all' ||
        (mainFilter === 'active' && isActive) ||
        (mainFilter === 'incomplete' && isIncomplete);

      const matchesAvailability =
        availabilityFilter === 'all' ||
        (availabilityFilter === 'available' && row.is_available_today === true) ||
        (availabilityFilter === 'unavailable' && row.is_available_today === false) ||
        (availabilityFilter === 'not_maintained' && row.is_available_today === null);

      const matchesEntity = entityFilter === 'all' || String(row.entity_id || '') === entityFilter;
      const matchesPosition =
        positionFilter === 'all' || String(row.position?.id || '') === positionFilter;

      if (!matchesMain || !matchesAvailability || !matchesEntity || !matchesPosition) return false;
      if (!query) return true;

      return [
        row.display_name,
        row.employee_number,
        row.email,
        row.phone_raw,
        row.phone_e164,
        row.entity_name,
        row.entity_code,
        row.position?.title,
        row.portal_role,
        formatPersonnelType(row.personnel_type),
        row.city,
        ...(row.preferred_skills || []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [
    availabilityFilter,
    entityFilter,
    mainFilter,
    positionFilter,
    rows,
    searchQuery,
  ]);

  if (loading) {
    return (
      <MirakaDashboardShell hideTopBar={true} requiredRole={['owner', 'admin']} currentPath="/mitarbeiter">
        <div className="opc-staff-loading" style={{ fontFamily: pageFont }}>
          <Loader2 size={19} className="spin" />
          Mitarbeiter werden geladen...
        </div>
      </MirakaDashboardShell>
    );
  }

  return (
    <MirakaDashboardShell
      hideTopBar={true}
      requiredRole={['owner', 'admin']}
      currentPath="/mitarbeiter"
    >
      <div className="opc-staff-page" style={{ fontFamily: pageFont, color: BRAND.text }}>
        {errorMessage ? <div className="opc-staff-error">{errorMessage}</div> : null}

        <div className="opc-staff-metrics">
          <MetricCard value={activeCount} label="Aktive Mitarbeitende" icon={<UsersRound size={17} />} />
          <MetricCard
            value={availableCount}
            label="Heute verfügbar"
            icon={<Clock3 size={17} />}
            tone={availableCount > 0 ? 'dark' : 'neutral'}
          />
          <MetricCard
            value={incompleteCount}
            label="Personalakten unvollständig"
            icon={<AlertTriangle size={17} />}
            tone={incompleteCount > 0 ? 'danger' : 'neutral'}
          />
          <MetricCard value={externalCount} label="Externe Personen" icon={<ShieldCheck size={17} />} />
        </div>

        <section className="opc-staff-filter-panel" style={cardStyle}>
          <div className="opc-staff-search">
            <Search size={17} />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Mitarbeiter, Personalnummer, Telefon oder Skill suchen..."
            />
          </div>

          <div className="opc-staff-main-buttons" aria-label="Personalstatus filtern">
            <button
              type="button"
              className={mainFilter === 'active' ? 'active' : ''}
              onClick={() => setMainFilter('active')}
            >
              Aktiv
            </button>
            <button
              type="button"
              className={mainFilter === 'incomplete' ? 'active' : ''}
              onClick={() => setMainFilter('incomplete')}
            >
              Unvollständig
            </button>
            <button
              type="button"
              className={mainFilter === 'all' ? 'active' : ''}
              onClick={() => setMainFilter('all')}
            >
              Alle
            </button>
          </div>

          <div className="opc-staff-action-row">
            <select
              value={availabilityFilter}
              onChange={(event) => setAvailabilityFilter(event.target.value as AvailabilityFilter)}
            >
              <option value="all">Alle Verfügbarkeiten</option>
              <option value="available">Heute verfügbar</option>
              <option value="unavailable">Heute nicht verfügbar</option>
              <option value="not_maintained">Nicht gepflegt</option>
            </select>

            <a className="opc-staff-create-button" href={`${baseUrl}/mitarbeiter-anlegen`}>
              <Plus size={16} />
              Mitarbeiter anlegen
            </a>
          </div>

          <div className="opc-staff-select-row">
            <select value={entityFilter} onChange={(event) => setEntityFilter(event.target.value)}>
              <option value="all">Alle Rechtsträger</option>
              {entities.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.legal_name}
                </option>
              ))}
            </select>

            <select value={positionFilter} onChange={(event) => setPositionFilter(event.target.value)}>
              <option value="all">Alle Positionen</option>
              {positions.map((position) => (
                <option key={position.id} value={position.id}>
                  {position.title_de}
                </option>
              ))}
            </select>
          </div>
        </section>

        <div className="opc-staff-result-head">
          <span>{filteredRows.length} Einträge</span>
          <span>Zugriff: {role === 'owner' ? 'Owner' : 'Admin'}</span>
        </div>

        {filteredRows.length === 0 ? (
          <div className="opc-staff-empty" style={cardStyle}>
            <UserRound size={23} />
            Keine Mitarbeitenden für diese Auswahl gefunden.
          </div>
        ) : (
          <div className="opc-staff-list">
            {filteredRows.map((row) => (
              <EmployeeCard key={row.id} row={row} />
            ))}
          </div>
        )}
      </div>

      <style>{`
        .opc-staff-page {
          padding: 0 0 140px;
        }

        .opc-staff-page * {
          box-sizing: border-box;
        }

        .opc-staff-loading {
          min-height: 60vh;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          color: ${BRAND.muted};
          font-size: 14px;
          font-weight: 680;
        }

        .opc-staff-error {
          border: 1px solid #FECACA;
          background: #FEF2F2;
          color: ${BRAND.red};
          padding: 14px 16px;
          border-radius: 16px;
          font-size: 13px;
          font-weight: 720;
          margin-bottom: 14px;
        }

        .opc-staff-metrics {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 14px;
        }

        .opc-staff-metric-card {
          min-height: 96px;
          padding: 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
        }

        .opc-staff-metric-value {
          font-size: 25px;
          line-height: 1;
          font-weight: 820;
          letter-spacing: -0.04em;
          margin-bottom: 10px;
        }

        .opc-staff-metric-label {
          font-size: 13px;
          font-weight: 720;
          color: ${BRAND.muted};
        }

        .opc-staff-metric-icon {
          width: 38px;
          height: 38px;
          border-radius: 13px;
          border: 1px solid ${BRAND.border};
          background: ${BRAND.soft};
          display: flex;
          align-items: center;
          justify-content: center;
          color: ${BRAND.black};
          flex-shrink: 0;
        }

        .opc-staff-filter-panel {
          width: 100%;
          padding: 16px;
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
          margin-bottom: 18px;
          overflow: visible;
        }

        .opc-staff-search {
          width: 100%;
          height: 46px;
          border: 1px solid ${BRAND.border};
          border-radius: 14px;
          background: #FFFFFF;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 12px;
          color: ${BRAND.muted};
        }

        .opc-staff-search input {
          width: 100%;
          min-width: 0;
          border: 0;
          outline: 0;
          color: ${BRAND.text};
          font-size: 14px;
          font-weight: 650;
          font-family: ${pageFont};
        }

        .opc-staff-main-buttons {
          width: 100%;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
        }

        .opc-staff-main-buttons button {
          width: 100%;
          height: 46px;
          min-width: 0;
          border: 1px solid ${BRAND.border};
          border-radius: 14px;
          background: #FFFFFF;
          color: ${BRAND.muted};
          padding: 0 12px;
          font-size: 13px;
          font-weight: 820;
          font-family: ${pageFont};
          cursor: pointer;
        }

        .opc-staff-main-buttons button.active {
          background: ${BRAND.black};
          border-color: ${BRAND.black};
          color: #FFFFFF;
        }

        .opc-staff-action-row,
        .opc-staff-select-row {
          width: 100%;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }

        .opc-staff-filter-panel select,
        .opc-staff-create-button {
          width: 100%;
          min-width: 0;
          height: 46px;
          min-height: 46px;
          max-height: 46px;
          border-radius: 14px;
          border: 1px solid ${BRAND.border};
          background-color: #FFFFFF;
          color: ${BRAND.text};
          padding: 0 42px 0 12px;
          font-size: 13px;
          line-height: 46px;
          font-weight: 800;
          font-family: ${pageFont};
          outline: 0;
          box-sizing: border-box;
        }

        .opc-staff-filter-panel select {
          appearance: none;
          -webkit-appearance: none;
          background-image:
            linear-gradient(45deg, transparent 50%, ${BRAND.text} 50%),
            linear-gradient(135deg, ${BRAND.text} 50%, transparent 50%);
          background-position:
            calc(100% - 18px) 19px,
            calc(100% - 12px) 19px;
          background-size: 6px 6px, 6px 6px;
          background-repeat: no-repeat;
          cursor: pointer;
        }

        .opc-staff-create-button {
          background: ${BRAND.black};
          border-color: ${BRAND.black};
          color: #FFFFFF;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 0 14px;
          line-height: 1;
          white-space: nowrap;
        }

        .opc-staff-result-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          color: ${BRAND.muted};
          font-size: 12px;
          font-weight: 760;
          margin: 0 2px 10px;
        }

        .opc-staff-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .opc-staff-card {
          padding: 18px;
        }

        .opc-staff-card-main {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 18px;
          align-items: start;
        }

        .opc-staff-person-block {
          display: flex;
          align-items: center;
          gap: 13px;
          min-width: 0;
        }

        .opc-staff-avatar {
          width: 48px;
          height: 48px;
          border-radius: 16px;
          border: 1px solid ${BRAND.border};
          background: ${BRAND.soft};
          display: flex;
          align-items: center;
          justify-content: center;
          color: ${BRAND.black};
          font-size: 15px;
          font-weight: 860;
          flex-shrink: 0;
        }

        .opc-staff-title-wrap {
          min-width: 0;
        }

        .opc-staff-title-wrap h3 {
          margin: 0;
          color: ${BRAND.text};
          font-size: 20px;
          line-height: 1.18;
          letter-spacing: -0.04em;
          font-weight: 860;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .opc-staff-number-row {
          display: flex;
          flex-wrap: wrap;
          gap: 6px 12px;
          margin-top: 7px;
          color: ${BRAND.muted};
          font-size: 12px;
          font-weight: 700;
        }

        .opc-staff-card-side {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 7px;
        }

        .opc-staff-status-badge,
        .opc-availability-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 28px;
          padding: 0 11px;
          border-radius: 999px;
          border: 1px solid;
          font-size: 12px;
          font-weight: 780;
          white-space: nowrap;
        }

        .opc-staff-meta-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 9px 18px;
          margin-top: 16px;
          padding-top: 15px;
          border-top: 1px solid #F3F4F6;
        }

        .opc-staff-meta-grid > div {
          display: flex;
          align-items: flex-start;
          gap: 7px;
          min-width: 0;
          color: ${BRAND.muted};
          font-size: 13px;
          line-height: 1.4;
          font-weight: 650;
        }

        .opc-staff-meta-grid svg {
          flex-shrink: 0;
          margin-top: 2px;
        }

        .opc-staff-card-actions {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 10px;
          margin-top: 16px;
        }

        .opc-staff-action,
        .opc-staff-icon-action {
          min-height: 42px;
          border-radius: 13px;
          border: 1px solid ${BRAND.border};
          background: #FFFFFF;
          color: ${BRAND.text};
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 0 14px;
          font-size: 13px;
          font-weight: 760;
          font-family: ${pageFont};
          text-decoration: none;
          cursor: pointer;
          white-space: nowrap;
        }

        .opc-staff-action.dark {
          background: ${BRAND.black};
          border-color: ${BRAND.black};
          color: #FFFFFF;
        }

        .opc-staff-icon-action {
          width: 42px;
          padding: 0;
        }

        .opc-staff-empty {
          min-height: 150px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          color: ${BRAND.muted};
          font-size: 14px;
          font-weight: 650;
          text-align: center;
          padding: 22px;
        }

        .spin {
          animation: opcStaffSpin 0.8s linear infinite;
        }

        @keyframes opcStaffSpin {
          to { transform: rotate(360deg); }
        }

        @media (min-width: 1180px) {
          .opc-staff-metrics {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }

        @media (max-width: 720px) {
          .opc-staff-page {
            padding-bottom: 110px;
          }

          .opc-staff-card {
            padding: 15px;
          }

          .opc-staff-card-main {
            grid-template-columns: 1fr;
            gap: 13px;
          }

          .opc-staff-card-side {
            align-items: flex-start;
            flex-direction: row;
            flex-wrap: wrap;
          }

          .opc-staff-meta-grid {
            grid-template-columns: 1fr;
          }

          .opc-staff-card-actions {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .opc-staff-action {
            width: 100%;
          }

          .opc-staff-title-wrap h3 {
            font-size: 18px;
          }

          .opc-staff-action-row {
            grid-template-columns: 1fr;
          }

          .opc-staff-create-button {
            width: 100%;
          }

          .opc-staff-select-row {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 420px) {
          .opc-staff-select-row {
            grid-template-columns: 1fr;
          }

          .opc-staff-filter-panel {
            padding: 12px;
            gap: 9px;
          }
        }
      `}</style>
    </MirakaDashboardShell>
  );
}

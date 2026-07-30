import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import {
  AlertTriangle,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  FileText,
  MapPin,
  Settings,
} from 'lucide-react';
import { supabase, type UserProfile } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';

type JsonRecord = Record<string, any>;

type PortalData = {
  jobs: JsonRecord[];
  reports: JsonRecord[];
};

const BRAND = {
  text: '#111827',
  muted: '#6B7280',
  border: '#E5E7EB',
  black: '#0F1115',
  card: '#FFFFFF',
  soft: '#FAFAFA',
  amber: '#92400E',
};

const pageFont =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", "Helvetica Neue", Segoe UI, Roboto, sans-serif';

const cardStyle: CSSProperties = {
  background: BRAND.card,
  border: `1px solid ${BRAND.border}`,
  borderRadius: '20px',
  boxShadow: '0 1px 2px rgba(15, 17, 21, 0.04)',
};

function normalize(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function firstValue(row: JsonRecord, keys: string[], fallback = '') {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      return String(value);
    }
  }
  return fallback;
}

function jobDate(row: JsonRecord) {
  return firstValue(row, ['planned_start', 'start_time', 'scheduled_at', 'date_time']);
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Termin folgt';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Termin folgt';

  return date.toLocaleString('de-CH', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function withTimeout<T>(request: PromiseLike<T>, timeoutMs = 5000): Promise<T> {
  return Promise.race([
    Promise.resolve(request),
    new Promise<T>((_, reject) => {
      window.setTimeout(
        () => reject(new Error('Portal-Daten konnten nicht rechtzeitig geladen werden.')),
        timeoutMs,
      );
    }),
  ]);
}

function MetricCard({ value, label, icon }: { value: string | number; label: string; icon: ReactNode }) {
  return (
    <div style={{ ...cardStyle, padding: 18, minHeight: 112 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
        <div style={{ fontSize: 28, fontWeight: 880, letterSpacing: '-0.045em' }}>{value}</div>
        <div style={{ width: 38, height: 38, borderRadius: 12, background: BRAND.soft, display: 'grid', placeItems: 'center' }}>
          {icon}
        </div>
      </div>
      <div style={{ color: BRAND.muted, fontSize: 13, fontWeight: 720 }}>{label}</div>
    </div>
  );
}

function PortalLink({ href, title, description, icon }: { href: string; title: string; description: string; icon: ReactNode }) {
  return (
    <a
      href={`${baseUrl}${href}`}
      style={{
        ...cardStyle,
        minHeight: 148,
        padding: 20,
        color: BRAND.text,
        textDecoration: 'none',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: 18,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}>
        <div style={{ width: 42, height: 42, borderRadius: 13, background: BRAND.soft, display: 'grid', placeItems: 'center' }}>
          {icon}
        </div>
        <ChevronRight size={18} color={BRAND.muted} />
      </div>
      <div>
        <div style={{ fontSize: 16, fontWeight: 840, marginBottom: 7 }}>{title}</div>
        <div style={{ color: BRAND.muted, fontSize: 13, lineHeight: 1.5, fontWeight: 620 }}>{description}</div>
      </div>
    </a>
  );
}

export default function OpcClientDashboardHome({ profile }: { profile: UserProfile }) {
  const [portalData, setPortalData] = useState<PortalData>({ jobs: [], reports: [] });
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let mounted = true;

    async function loadPortalData() {
      try {
        const [jobsResult, reportsResult] = await Promise.all([
          withTimeout(supabase.from('opc_my_portal_job_feed').select('*').limit(150)),
          withTimeout(supabase.from('opc_portal_report_feed').select('*').limit(150)),
        ]);

        if (!mounted) return;

        setPortalData({
          jobs: jobsResult.error ? [] : jobsResult.data || [],
          reports: reportsResult.error ? [] : reportsResult.data || [],
        });

        if (jobsResult.error || reportsResult.error) {
          setNotice('Ein Teil der Portal-Kennzahlen ist vorübergehend nicht verfügbar. Die Kundenbereiche können weiterhin geöffnet werden.');
        }
      } catch {
        if (!mounted) return;
        setNotice('Die Portal-Kennzahlen konnten nicht geladen werden. Die Navigation und Ihre Kundenbereiche bleiben verfügbar.');
      } finally {
        if (mounted) setLoadingMetrics(false);
      }
    }

    void loadPortalData();

    return () => {
      mounted = false;
    };
  }, []);

  const completedStatuses = useMemo(
    () => new Set(['completed', 'approved', 'report_approved', 'sent_to_client']),
    [],
  );
  const activeStatuses = useMemo(
    () => new Set(['scheduled', 'assigned', 'confirmed', 'on_site', 'onsite', 'in_progress', 'started', 'running', 'active']),
    [],
  );

  const upcomingJobs = useMemo(() => {
    const now = Date.now();
    return portalData.jobs.filter((job) => {
      const plannedAt = new Date(jobDate(job)).getTime();
      return Number.isFinite(plannedAt) && plannedAt >= now && !completedStatuses.has(normalize(job.status || job.job_status));
    });
  }, [portalData.jobs, completedStatuses]);

  const completedJobs = useMemo(
    () => portalData.jobs.filter((job) => completedStatuses.has(normalize(job.status || job.job_status))),
    [portalData.jobs, completedStatuses],
  );

  const activeJobs = useMemo(
    () => portalData.jobs.filter((job) => activeStatuses.has(normalize(job.status || job.job_status))),
    [portalData.jobs, activeStatuses],
  );

  const nextJob = useMemo(
    () => [...upcomingJobs].sort((a, b) => new Date(jobDate(a)).getTime() - new Date(jobDate(b)).getTime())[0] || null,
    [upcomingJobs],
  );

  const displayName = profile.full_name || profile.email || 'Kunde';

  return (
    <div className="opc-client-dashboard" style={{ fontFamily: pageFont, color: BRAND.text, paddingBottom: 120 }}>
      <section style={{ ...cardStyle, padding: 26, marginBottom: 16 }}>
        <div style={{ color: BRAND.muted, fontSize: 12, fontWeight: 800, marginBottom: 9 }}>Kundenportal</div>
        <h1 style={{ margin: 0, fontSize: 32, lineHeight: 1.06, letterSpacing: '-0.045em', fontWeight: 880 }}>
          Guten Tag, {displayName}
        </h1>
        <p style={{ margin: '10px 0 0', maxWidth: 760, color: BRAND.muted, fontSize: 14, lineHeight: 1.6, fontWeight: 620 }}>
          Hier finden Sie Ihre Einsätze, freigegebenen Berichte und Dateien sowie Ihre Anfragen und Schadenmeldungen.
        </p>
      </section>

      {notice ? (
        <div style={{ border: '1px solid #FDE68A', background: '#FFFBEB', color: BRAND.amber, padding: '13px 15px', borderRadius: 15, fontSize: 13, lineHeight: 1.5, fontWeight: 700, marginBottom: 16 }}>
          {notice}
        </div>
      ) : null}

      <div className="opc-client-dashboard-metrics">
        <MetricCard value={loadingMetrics ? '–' : upcomingJobs.length} label="Bevorstehende Einsätze" icon={<CalendarDays size={18} />} />
        <MetricCard value={loadingMetrics ? '–' : activeJobs.length} label="Aktive Aufträge" icon={<Briefcase size={18} />} />
        <MetricCard value={loadingMetrics ? '–' : completedJobs.length} label="Abgeschlossene Einsätze" icon={<CheckCircle2 size={18} />} />
        <MetricCard value={loadingMetrics ? '–' : portalData.reports.length} label="Berichte & Dateien" icon={<FileText size={18} />} />
      </div>

      {nextJob ? (
        <section style={{ ...cardStyle, padding: 22, marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
            <div>
              <div style={{ color: BRAND.muted, fontSize: 12, fontWeight: 800, marginBottom: 8 }}>Nächster Einsatz</div>
              <div style={{ fontSize: 19, fontWeight: 850, marginBottom: 8 }}>
                {firstValue(nextJob, ['title', 'job_title', 'service_category'], 'Geplanter Einsatz')}
              </div>
              <div style={{ color: BRAND.muted, fontSize: 13, fontWeight: 650, marginBottom: 7 }}>
                {formatDateTime(jobDate(nextJob))}
              </div>
              <div style={{ color: BRAND.muted, fontSize: 13, fontWeight: 650, display: 'flex', alignItems: 'center', gap: 7 }}>
                <MapPin size={15} />
                {firstValue(nextJob, ['site_name', 'site_address', 'address_text', 'city'], 'Standort wird nach Bestätigung angezeigt')}
              </div>
            </div>
            <a href={`${baseUrl}/einsaetze`} style={{ minHeight: 44, padding: '0 17px', borderRadius: 13, background: BRAND.black, color: '#FFFFFF', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 820 }}>
              Einsatz öffnen
            </a>
          </div>
        </section>
      ) : null}

      <div className="opc-client-dashboard-links">
        <PortalLink href="/einsaetze" title="Einsätze" description="Geplante, laufende und abgeschlossene Aufträge ansehen." icon={<Briefcase size={19} />} />
        <PortalLink href="/anfragen-schaeden" title="Tickets" description="Anfragen erfassen und Schäden mit Informationen dokumentieren." icon={<AlertTriangle size={19} />} />
        <PortalLink href="/berichte-dateien" title="Berichte & Dateien" description="Freigegebene Einsatzberichte und Dokumente öffnen." icon={<FileText size={19} />} />
        <PortalLink href="/einstellungen" title="Einstellungen" description="Persönliche Angaben und Benachrichtigungen verwalten." icon={<Settings size={19} />} />
      </div>

      <style>{`
        .opc-client-dashboard-metrics,
        .opc-client-dashboard-links {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        .opc-client-dashboard-links {
          margin-top: 16px;
        }

        .opc-client-dashboard-links a:hover {
          border-color: #D1D5DB !important;
          background: #FCFCFC !important;
        }

        @media (max-width: 1100px) {
          .opc-client-dashboard-metrics,
          .opc-client-dashboard-links {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 640px) {
          .opc-client-dashboard h1 {
            font-size: 26px !important;
          }

          .opc-client-dashboard-metrics,
          .opc-client-dashboard-links {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

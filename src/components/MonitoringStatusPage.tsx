import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Database,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';
import MirakaDashboardShell from './MirakaDashboardShell';
import { readOpcAccessToken } from '../lib/opc-browser-session';

type Severity = 'critical' | 'error' | 'warning' | 'info';
type Range = '24h' | '7d' | '30d';
type StatusFilter = 'all' | 'open' | 'resolved';

type MonitoringEvent = {
  id: string;
  created_at: string;
  first_seen_at: string;
  last_seen_at: string;
  occurrence_count: number;
  severity: Severity;
  source: string;
  event_type: string;
  message: string;
  route: string;
  stack?: string | null;
  context?: Record<string, unknown> | null;
  user_id?: string | null;
  user_label?: string | null;
  user_email?: string | null;
  language?: string | null;
  browser?: string | null;
  device?: string | null;
  user_agent?: string | null;
  session_id?: string | null;
  resolved_at?: string | null;
  email_sent_at?: string | null;
  email_error?: string | null;
};

const BRAND = {
  text: '#111827',
  muted: '#6B7280',
  faint: '#9CA3AF',
  border: '#E5E7EB',
  black: '#0F1115',
  card: '#FFFFFF',
  red: '#B91C1C',
  amber: '#92400E',
  green: '#166534',
};

const pageFont =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", "Helvetica Neue", Segoe UI, Roboto, sans-serif';

const cardStyle: React.CSSProperties = {
  background: BRAND.card,
  border: `1px solid ${BRAND.border}`,
  borderRadius: '20px',
  boxShadow: '0 1px 2px rgba(15, 17, 21, 0.04)',
};

function clean(value: unknown) {
  return String(value ?? '').trim();
}

function severityLabel(value: Severity) {
  if (value === 'critical') return 'Kritisch';
  if (value === 'error') return 'Fehler';
  if (value === 'warning') return 'Warnung';
  return 'Info';
}

function severityTone(value: Severity) {
  if (value === 'critical') return { bg: '#FEF2F2', text: '#991B1B', border: '#FECACA' };
  if (value === 'error') return { bg: '#FFF7ED', text: '#9A3412', border: '#FED7AA' };
  if (value === 'warning') return { bg: '#FFFBEB', text: '#92400E', border: '#FDE68A' };
  return { bg: '#F9FAFB', text: '#4B5563', border: '#E5E7EB' };
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat('de-CH', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function MetricCard({
  value,
  label,
  icon,
}: {
  value: number;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="opc-monitor-metric" style={cardStyle}>
      <div>
        <div className="opc-monitor-metric-value">{value}</div>
        <div className="opc-monitor-metric-label">{label}</div>
      </div>
      <div className="opc-monitor-metric-icon">{icon}</div>
    </div>
  );
}

function getChartBuckets(events: MonitoringEvent[], range: Range) {
  const now = Date.now();
  const totalMs =
    range === '30d'
      ? 30 * 24 * 60 * 60_000
      : range === '7d'
        ? 7 * 24 * 60 * 60_000
        : 24 * 60 * 60_000;

  const bucketCount = range === '7d' ? 7 : range === '30d' ? 10 : 12;
  const bucketMs = totalMs / bucketCount;
  const start = now - totalMs;

  const buckets = Array.from({ length: bucketCount }, (_, index) => ({
    start: start + index * bucketMs,
    end: start + (index + 1) * bucketMs,
    value: 0,
  }));

  for (const event of events) {
    const timestamp = new Date(event.last_seen_at || event.created_at).getTime();
    if (!Number.isFinite(timestamp) || timestamp < start || timestamp > now) continue;

    const index = Math.min(
      bucketCount - 1,
      Math.max(0, Math.floor((timestamp - start) / bucketMs)),
    );

    buckets[index].value += Math.max(1, Number(event.occurrence_count || 1));
  }

  return buckets.map((bucket, index) => {
    const date = new Date(bucket.start);
    const label =
      range === '24h'
        ? new Intl.DateTimeFormat('de-CH', {
            hour: '2-digit',
            minute: '2-digit',
          }).format(date)
        : new Intl.DateTimeFormat('de-CH', {
            day: '2-digit',
            month: '2-digit',
          }).format(date);

    return { ...bucket, index, label };
  });
}

function chartScale(maxValue: number) {
  if (maxValue <= 4) return 4;
  if (maxValue <= 10) return 10;
  const magnitude = 10 ** Math.floor(Math.log10(maxValue));
  return Math.ceil(maxValue / magnitude) * magnitude;
}

export default function MonitoringStatusPage() {
  const [range, setRange] = useState<Range>('24h');
  const [events, setEvents] = useState<MonitoringEvent[]>([]);
  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState<'all' | Severity>('all');
  const [source, setSource] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selected, setSelected] = useState<MonitoringEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [health, setHealth] = useState<Record<string, string>>({});

  async function apiRequest(method: 'GET' | 'PATCH', body?: unknown) {
    const token = readOpcAccessToken(true);

    const response = await fetch(
      method === 'GET'
        ? `/api/opc/monitoring/events?range=${encodeURIComponent(range)}`
        : '/api/opc/monitoring/events',
      {
        method,
        credentials: 'include',
        headers: {
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      },
    );

    const payload = await response.json().catch(() => ({}));

    if (!response.ok || payload?.ok === false) {
      throw new Error(payload?.error || `Monitoring API returned ${response.status}`);
    }

    return payload;
  }

  async function loadEvents(background = false) {
    if (background) setRefreshing(true);
    else setLoading(true);

    setLoadError('');

    try {
      const payload = await apiRequest('GET');
      const nextEvents = Array.isArray(payload?.events) ? payload.events : [];

      setEvents(nextEvents);
      setHealth(payload?.health || {});

      const eventId = new URLSearchParams(window.location.search).get('event');
      if (eventId) {
        const match = nextEvents.find((event: MonitoringEvent) => event.id === eventId);
        if (match) setSelected(match);
      }
    } catch (error: any) {
      setLoadError(clean(error?.message || error || 'Monitoring konnte nicht geladen werden.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadEvents();
  }, [range]);

  const users = useMemo(() => {
    const map = new Map<string, string>();

    for (const event of events) {
      const key = clean(event.user_id || event.user_email || event.user_label);
      const label = clean(event.user_label || event.user_email || event.user_id);
      if (key && label) map.set(key, label);
    }

    return Array.from(map.entries()).sort((left, right) =>
      left[1].localeCompare(right[1], 'de-CH'),
    );
  }, [events]);

  const sources = useMemo(
    () =>
      Array.from(new Set(events.map((event) => clean(event.source)).filter(Boolean))).sort(
        (left, right) => left.localeCompare(right, 'de-CH'),
      ),
    [events],
  );

  const filteredEvents = useMemo(() => {
    const query = search.trim().toLowerCase();

    return events.filter((event) => {
      if (severity !== 'all' && event.severity !== severity) return false;
      if (source !== 'all' && event.source !== source) return false;

      if (userFilter !== 'all') {
        const key = clean(event.user_id || event.user_email || event.user_label);
        if (key !== userFilter) return false;
      }

      if (statusFilter === 'open' && event.resolved_at) return false;
      if (statusFilter === 'resolved' && !event.resolved_at) return false;
      if (!query) return true;

      const haystack = [
        event.message,
        event.event_type,
        event.source,
        event.route,
        event.user_label,
        event.user_email,
        event.language,
        event.browser,
        event.device,
        event.stack,
      ]
        .map(clean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [events, search, severity, source, userFilter, statusFilter]);

  const metrics = useMemo(() => {
    const errorCount = events.reduce(
      (sum, event) => sum + Math.max(1, Number(event.occurrence_count || 1)),
      0,
    );

    const critical = events
      .filter((event) => event.severity === 'critical')
      .reduce(
        (sum, event) => sum + Math.max(1, Number(event.occurrence_count || 1)),
        0,
      );

    const affectedUsers = new Set(
      events
        .map((event) => clean(event.user_id || event.user_email || event.user_label))
        .filter(Boolean),
    ).size;

    const open = events.filter((event) => !event.resolved_at).length;

    return { errorCount, critical, affectedUsers, open };
  }, [events]);

  const chartBuckets = useMemo(() => getChartBuckets(events, range), [events, range]);
  const chartMaximum = chartScale(
    Math.max(0, ...chartBuckets.map((bucket) => bucket.value)),
  );

  const yTicks = [
    chartMaximum,
    Math.round(chartMaximum * 0.75),
    Math.round(chartMaximum * 0.5),
    Math.round(chartMaximum * 0.25),
    0,
  ];

  async function toggleResolved(event: MonitoringEvent) {
    try {
      const payload = await apiRequest('PATCH', {
        id: event.id,
        resolved: Boolean(!event.resolved_at),
      });

      const updated = payload.event as MonitoringEvent;
      setEvents((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setSelected(updated);
    } catch (error: any) {
      window.alert(clean(error?.message || error || 'Status konnte nicht geändert werden.'));
    }
  }

  const healthRows = [
    ['Portal / Frontend', health.portal || 'operational', Activity],
    ['Authentication', health.authentication || 'operational', ShieldCheck],
    ['Supabase Database', health.database || 'operational', Database],
    ['API / Worker', health.api || 'operational', Server],
  ] as const;

  return (
    <MirakaDashboardShell
      requiredRole={['owner']}
      currentPath="/monitoring-status"
      hideTopBar={true}
      fullWidth
    >
      <div className="opc-monitor-page" style={{ fontFamily: pageFont, color: BRAND.text }}>
        <div className="opc-monitor-metrics">
          <MetricCard value={metrics.errorCount} label="Fehler gesamt" icon={<CircleAlert size={18} />} />
          <MetricCard value={metrics.critical} label="Kritische Fehler" icon={<AlertTriangle size={18} />} />
          <MetricCard value={metrics.affectedUsers} label="Betroffene User" icon={<UserRound size={18} />} />
          <MetricCard value={metrics.open} label="Offene Fehler" icon={<Clock3 size={18} />} />
        </div>

        <section className="opc-monitor-filter-card" style={cardStyle}>
          <div className="opc-monitor-controls">
            <div className="opc-monitor-search">
              <Search size={17} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Suche nach Fehler, Route, Benutzer, Sprache oder Gerät"
              />
            </div>

            <select value={range} onChange={(event) => setRange(event.target.value as Range)}>
              <option value="24h">Letzte 24 Stunden</option>
              <option value="7d">Letzte 7 Tage</option>
              <option value="30d">Letzte 30 Tage</option>
            </select>

            <select value={severity} onChange={(event) => setSeverity(event.target.value as 'all' | Severity)}>
              <option value="all">Alle Prioritäten</option>
              <option value="critical">Kritisch</option>
              <option value="error">Fehler</option>
              <option value="warning">Warnung</option>
              <option value="info">Info</option>
            </select>

            <select value={source} onChange={(event) => setSource(event.target.value)}>
              <option value="all">Alle Quellen</option>
              {sources.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>

            <select value={userFilter} onChange={(event) => setUserFilter(event.target.value)}>
              <option value="all">Alle Benutzer</option>
              {users.map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>

            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
              <option value="all">Alle Status</option>
              <option value="open">Offen</option>
              <option value="resolved">Gelöst</option>
            </select>

            <button
              type="button"
              className="opc-monitor-refresh"
              onClick={() => void loadEvents(true)}
              disabled={refreshing}
              title="Aktualisieren"
            >
              <RefreshCw size={17} className={refreshing ? 'spin' : ''} />
              <span>Aktualisieren</span>
            </button>
          </div>
        </section>

        {loadError ? (
          <div className="opc-monitor-inline-error">
            <AlertTriangle size={17} />
            {loadError}
          </div>
        ) : null}

        <div className="opc-monitor-overview-grid">
          <section className="opc-monitor-health" style={cardStyle}>
            <div className="opc-monitor-card-head">
              <div>
                <strong>System Health</strong>
                <span>Aktueller Zustand der Kernbereiche</span>
              </div>
              <span className="opc-monitor-health-pill">
                <CheckCircle2 size={13} />
                Operational
              </span>
            </div>

            <div className="opc-monitor-health-list">
              {healthRows.map(([label, value, Icon]) => (
                <div className="opc-monitor-health-row" key={label}>
                  <div>
                    <span className="opc-monitor-health-icon"><Icon size={16} /></span>
                    <strong>{label}</strong>
                  </div>
                  <span className="opc-monitor-health-value"><i />{value === 'operational' ? 'Operational' : value}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="opc-monitor-chart-card" style={cardStyle}>
            <div className="opc-monitor-card-head">
              <div>
                <strong>Error Activity</strong>
                <span>Erfasste Fehler im gewählten Zeitraum</span>
              </div>
              <span className="opc-monitor-chart-total">{metrics.errorCount} Ereignisse</span>
            </div>

            <div className="opc-monitor-chart">
              <div className="opc-monitor-y-axis">
                {yTicks.map((value, index) => <span key={`${value}-${index}`}>{value}</span>)}
              </div>

              <div className="opc-monitor-plot">
                {yTicks.slice(0, -1).map((_value, index) => (
                  <i className="opc-monitor-grid-line" key={index} style={{ top: `${index * 25}%` }} />
                ))}

                <div className="opc-monitor-bars">
                  {chartBuckets.map((bucket) => (
                    <div className="opc-monitor-bar-column" key={bucket.index}>
                      <span className="opc-monitor-bar-value">{bucket.value > 0 ? bucket.value : ''}</span>
                      <div
                        className="opc-monitor-bar"
                        style={{
                          height: `${Math.max(
                            bucket.value > 0 ? 6 : 0,
                            (bucket.value / Math.max(1, chartMaximum)) * 100,
                          )}%`,
                        }}
                      />
                    </div>
                  ))}
                </div>

                <div className="opc-monitor-x-axis">
                  {chartBuckets.map((bucket, index) => {
                    const show =
                      index === 0 ||
                      index === chartBuckets.length - 1 ||
                      index === Math.floor(chartBuckets.length / 3) ||
                      index === Math.floor((chartBuckets.length * 2) / 3);

                    return (
                      <span key={bucket.index} style={{ visibility: show ? 'visible' : 'hidden' }}>
                        {bucket.label}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="opc-monitor-list">
          {loading ? (
            <section className="opc-monitor-empty" style={cardStyle}>
              <RefreshCw size={24} className="spin" />
              <strong>Fehlerprotokoll wird geladen…</strong>
            </section>
          ) : filteredEvents.length === 0 ? (
            <section className="opc-monitor-empty" style={cardStyle}>
              <CheckCircle2 size={28} />
              <strong>Keine Fehler gefunden</strong>
              <span>Für die gewählten Filter liegen keine Ereignisse vor.</span>
            </section>
          ) : (
            filteredEvents.map((event) => {
              const tone = severityTone(event.severity);

              return (
                <button
                  key={event.id}
                  type="button"
                  className="opc-monitor-event-card"
                  style={cardStyle}
                  onClick={() => setSelected(event)}
                >
                  <div className="opc-monitor-event-main">
                    <div className="opc-monitor-event-copy">
                      <h3>{event.message}</h3>
                      <div className="opc-monitor-event-meta">
                        <span>{severityLabel(event.severity)}</span>
                        <span>{event.source}</span>
                        <span>{event.event_type}</span>
                        <span>{event.route || 'Route nicht hinterlegt'}</span>
                        <span>{formatDate(event.last_seen_at || event.created_at)}</span>
                        <span>{event.user_label || event.user_email || 'Benutzer nicht zugeordnet'}</span>
                        <span>{[event.language, event.browser, event.device].filter(Boolean).join(' · ') || 'Client nicht hinterlegt'}</span>
                      </div>
                    </div>

                    <div className="opc-monitor-event-side">
                      <span
                        className="opc-monitor-severity"
                        style={{ background: tone.bg, color: tone.text, borderColor: tone.border }}
                      >
                        {severityLabel(event.severity)}
                      </span>
                    </div>
                  </div>

                  <div className="opc-monitor-event-footer">
                    <span>{event.occurrence_count > 1 ? `${event.occurrence_count} Vorkommnisse` : '1 Vorkommnis'}</span>
                    <span>{event.resolved_at ? 'Gelöst' : event.email_sent_at ? 'E-Mail gesendet' : 'Offen'}</span>
                  </div>

                  <div className="opc-monitor-event-actions">
                    <span className="opc-monitor-event-action dark">Details öffnen</span>
                    <span className="opc-monitor-event-action">{event.resolved_at ? 'Gelöst' : 'Fehler ansehen'}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {!loading ? <div className="opc-monitor-count-line">{filteredEvents.length} geladene Fehler</div> : null}

        {selected ? (
          <div className="opc-monitor-drawer-backdrop" onClick={() => setSelected(null)}>
            <aside className="opc-monitor-drawer" onClick={(event) => event.stopPropagation()}>
              <div className="opc-monitor-drawer-head">
                <div>
                  <span className="opc-monitor-drawer-kicker">{selected.source} · {severityLabel(selected.severity)}</span>
                  <h2>{selected.event_type}</h2>
                </div>
                <button type="button" onClick={() => setSelected(null)}><X size={19} /></button>
              </div>

              <div className="opc-monitor-detail-message">{selected.message}</div>

              <div className="opc-monitor-detail-grid">
                <div><span>User</span><strong>{selected.user_label || selected.user_email || selected.user_id || '—'}</strong></div>
                <div><span>Zeit</span><strong>{formatDate(selected.last_seen_at || selected.created_at)}</strong></div>
                <div><span>Route</span><strong>{selected.route || '—'}</strong></div>
                <div><span>Sprache</span><strong>{selected.language || '—'}</strong></div>
                <div><span>Browser</span><strong>{selected.browser || '—'}</strong></div>
                <div><span>Gerät</span><strong>{selected.device || '—'}</strong></div>
                <div><span>Vorkommnisse</span><strong>{selected.occurrence_count || 1}</strong></div>
                <div><span>E-Mail Alert</span><strong>{selected.email_sent_at ? `Gesendet · ${formatDate(selected.email_sent_at)}` : selected.email_error ? 'Versandfehler' : 'Nicht gesendet'}</strong></div>
              </div>

              <div className="opc-monitor-code-block">
                <span>Stacktrace</span>
                <pre>{selected.stack || 'Kein Stacktrace vorhanden.'}</pre>
              </div>

              <div className="opc-monitor-code-block">
                <span>Technical Context</span>
                <pre>{JSON.stringify(selected.context || {}, null, 2)}</pre>
              </div>

              {selected.email_error ? (
                <div className="opc-monitor-email-error">
                  <strong>E-Mail Versandfehler</strong>
                  <span>{selected.email_error}</span>
                </div>
              ) : null}

              <div className="opc-monitor-drawer-actions">
                <button type="button" className="light" onClick={() => setSelected(null)}>Schliessen</button>
                <button type="button" className="dark" onClick={() => void toggleResolved(selected)}>
                  {selected.resolved_at ? 'Wieder öffnen' : 'Als gelöst markieren'}
                </button>
              </div>
            </aside>
          </div>
        ) : null}

        <style>{`
          .opc-monitor-page, .opc-monitor-page * { box-sizing: border-box; }
          .opc-monitor-page { width: 100%; padding: 0 0 140px; font-family: ${pageFont}; }

          .opc-monitor-metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 14px; }
          .opc-monitor-metric { min-height: 96px; padding: 18px; display: flex; align-items: center; justify-content: space-between; gap: 14px; }
          .opc-monitor-metric-value { font-size: 25px; line-height: 1; font-weight: 820; letter-spacing: -0.04em; color: ${BRAND.text}; margin-bottom: 10px; }
          .opc-monitor-metric-label { font-size: 13px; font-weight: 720; color: ${BRAND.muted}; }
          .opc-monitor-metric-icon { width: 38px; height: 38px; border-radius: 13px; border: 1px solid ${BRAND.border}; background: #FAFAFA; color: ${BRAND.black}; display: flex; align-items: center; justify-content: center; flex: 0 0 auto; }

          .opc-monitor-filter-card { width: 100%; padding: 16px; margin-bottom: 14px; }
          .opc-monitor-controls { display: grid; grid-template-columns: minmax(300px, 1.7fr) repeat(5, minmax(118px, .72fr)) minmax(126px, .7fr); gap: 8px; width: 100%; align-items: stretch; }
          .opc-monitor-search { height: 46px; min-width: 0; border: 1px solid ${BRAND.border}; border-radius: 14px; background: #FFFFFF; display: flex; align-items: center; gap: 10px; padding: 0 12px; color: ${BRAND.muted}; }
          .opc-monitor-search input { width: 100%; min-width: 0; border: 0; outline: 0; color: ${BRAND.text}; font-size: 14px; font-weight: 650; font-family: ${pageFont}; }
          .opc-monitor-search input::placeholder { color: #9CA3AF; font-weight: 700; }
          .opc-monitor-controls select, .opc-monitor-refresh { width: 100%; min-width: 0; height: 46px; border: 1px solid ${BRAND.border}; border-radius: 14px; background: #FFFFFF; color: ${BRAND.text}; padding: 0 13px; font-family: ${pageFont}; font-size: 12px; font-weight: 800; outline: 0; }
          .opc-monitor-refresh { background: ${BRAND.black}; border-color: ${BRAND.black}; color: #FFFFFF; display: flex; align-items: center; justify-content: center; gap: 7px; cursor: pointer; }
          .opc-monitor-refresh:disabled { opacity: .65; cursor: wait; }

          .opc-monitor-inline-error { margin-bottom: 14px; min-height: 48px; border: 1px solid #FECACA; background: #FEF2F2; color: #991B1B; border-radius: 14px; padding: 12px 14px; display: flex; align-items: center; gap: 9px; font-size: 12px; font-weight: 750; }

          .opc-monitor-overview-grid { display: grid; grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr); gap: 12px; margin-bottom: 14px; }
          .opc-monitor-health, .opc-monitor-chart-card { min-height: 310px; padding: 18px; }
          .opc-monitor-chart-card { display: flex; flex-direction: column; }
          .opc-monitor-card-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; margin-bottom: 14px; }
          .opc-monitor-card-head > div { display: flex; flex-direction: column; gap: 4px; }
          .opc-monitor-card-head strong { font-size: 14px; font-weight: 820; color: ${BRAND.text}; }
          .opc-monitor-card-head span { font-size: 11px; color: ${BRAND.muted}; }
          .opc-monitor-health-pill { display: inline-flex; align-items: center; gap: 5px; padding: 5px 8px; border-radius: 999px; background: #F0FDF4; color: ${BRAND.green} !important; font-weight: 820 !important; }
          .opc-monitor-health-list { border-top: 1px solid ${BRAND.border}; }
          .opc-monitor-health-row { min-height: 55px; display: flex; justify-content: space-between; align-items: center; gap: 14px; border-bottom: 1px solid #F3F4F6; }
          .opc-monitor-health-row > div { display: flex; align-items: center; gap: 10px; }
          .opc-monitor-health-row strong { font-size: 12px; font-weight: 760; }
          .opc-monitor-health-icon { width: 31px; height: 31px; display: flex; align-items: center; justify-content: center; border-radius: 10px; border: 1px solid ${BRAND.border}; background: #FAFAFA; }
          .opc-monitor-health-value { display: flex; align-items: center; gap: 7px; font-size: 10px; font-weight: 720; color: ${BRAND.muted}; }
          .opc-monitor-health-value i { width: 7px; height: 7px; border-radius: 50%; background: #22C55E; }
          .opc-monitor-chart-total { font-weight: 800 !important; }

          .opc-monitor-chart { min-height: 224px; flex: 1; display: grid; grid-template-columns: 34px minmax(0, 1fr); gap: 8px; align-items: stretch; margin-top: auto; }
          .opc-monitor-y-axis { height: 190px; padding: 2px 0 20px; display: flex; flex-direction: column; justify-content: space-between; align-items: flex-end; color: ${BRAND.faint}; font-size: 9px; font-weight: 650; }
          .opc-monitor-plot { position: relative; height: 190px; border-left: 1px solid ${BRAND.border}; border-bottom: 1px solid ${BRAND.border}; }
          .opc-monitor-grid-line { position: absolute; left: 0; right: 0; border-top: 1px dashed #ECEFF3; pointer-events: none; }
          .opc-monitor-bars { position: absolute; inset: 8px 8px 22px 8px; display: grid; grid-template-columns: repeat(${chartBuckets.length}, minmax(0, 1fr)); gap: 6px; align-items: end; }
          .opc-monitor-bar-column { height: 100%; min-width: 0; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; gap: 4px; }
          .opc-monitor-bar-value { height: 12px; color: ${BRAND.muted}; font-size: 8px; font-weight: 750; }
          .opc-monitor-bar { width: min(26px, 82%); max-height: calc(100% - 16px); min-height: 0; border-radius: 5px 5px 2px 2px; background: ${BRAND.black}; }
          .opc-monitor-x-axis { position: absolute; left: 8px; right: 8px; bottom: -20px; display: grid; grid-template-columns: repeat(${chartBuckets.length}, minmax(0, 1fr)); gap: 6px; }
          .opc-monitor-x-axis span { min-width: 0; text-align: center; color: ${BRAND.faint}; font-size: 8px; white-space: nowrap; }

          .opc-monitor-list { display: grid; grid-template-columns: 1fr; gap: 10px; }
          .opc-monitor-event-card { width: 100%; padding: 16px; text-align: left; color: inherit; font-family: ${pageFont}; cursor: pointer; overflow: hidden; }
          .opc-monitor-event-card:hover { border-color: #D1D5DB !important; }
          .opc-monitor-event-main { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; }
          .opc-monitor-event-copy { min-width: 0; }
          .opc-monitor-event-copy h3 { margin: 0 0 7px; font-size: 14px; font-weight: 820; letter-spacing: -0.015em; color: ${BRAND.text}; }
          .opc-monitor-event-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 0; color: ${BRAND.muted}; font-size: 10px; line-height: 1.5; }
          .opc-monitor-event-meta span:not(:last-child)::after { content: ' · '; padding: 0 5px; color: #D1D5DB; }
          .opc-monitor-severity { display: inline-flex; align-items: center; min-height: 27px; border: 1px solid; border-radius: 999px; padding: 0 9px; white-space: nowrap; font-size: 10px; font-weight: 820; }
          .opc-monitor-event-footer { min-height: 39px; margin-top: 12px; padding-top: 10px; border-top: 1px solid #F3F4F6; display: flex; justify-content: space-between; align-items: center; gap: 12px; color: ${BRAND.muted}; font-size: 10px; font-weight: 720; }
          .opc-monitor-event-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 8px; }
          .opc-monitor-event-action { min-height: 35px; border: 1px solid ${BRAND.border}; border-radius: 10px; display: flex; align-items: center; justify-content: center; background: #FFFFFF; color: ${BRAND.text}; font-size: 10px; font-weight: 820; }
          .opc-monitor-event-action.dark { background: ${BRAND.black}; border-color: ${BRAND.black}; color: #FFFFFF; }

          .opc-monitor-empty { min-height: 180px; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 8px; color: ${BRAND.muted}; font-size: 12px; }
          .opc-monitor-empty strong { color: ${BRAND.text}; }
          .opc-monitor-count-line { margin-top: 12px; color: ${BRAND.faint}; font-size: 10px; }

          .opc-monitor-drawer-backdrop { position: fixed; inset: 0; z-index: 9999; background: rgba(15, 17, 21, .22); display: flex; justify-content: flex-end; }
          .opc-monitor-drawer { width: min(620px, 96vw); height: 100%; overflow-y: auto; background: #FFFFFF; padding: 28px; box-shadow: -20px 0 50px rgba(15, 17, 21, .14); }
          .opc-monitor-drawer-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 18px; margin-bottom: 18px; }
          .opc-monitor-drawer-kicker { color: ${BRAND.muted}; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; }
          .opc-monitor-drawer h2 { margin: 5px 0 0; font-size: 22px; letter-spacing: -.03em; }
          .opc-monitor-drawer-head button { width: 38px; height: 38px; border: 1px solid ${BRAND.border}; background: #FFFFFF; border-radius: 12px; display: flex; align-items: center; justify-content: center; cursor: pointer; }
          .opc-monitor-detail-message { border: 1px solid ${BRAND.border}; background: #FAFAFA; border-radius: 14px; padding: 14px; font-size: 13px; font-weight: 760; line-height: 1.5; }
          .opc-monitor-detail-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin: 12px 0; }
          .opc-monitor-detail-grid > div { border: 1px solid ${BRAND.border}; border-radius: 14px; padding: 12px; display: flex; flex-direction: column; gap: 5px; }
          .opc-monitor-detail-grid span, .opc-monitor-code-block > span { color: ${BRAND.muted}; font-size: 9px; font-weight: 780; text-transform: uppercase; letter-spacing: .04em; }
          .opc-monitor-detail-grid strong { font-size: 11px; word-break: break-word; }
          .opc-monitor-code-block { margin-top: 10px; border: 1px solid ${BRAND.border}; border-radius: 14px; padding: 12px; }
          .opc-monitor-code-block pre { margin: 8px 0 0; max-height: 300px; overflow: auto; white-space: pre-wrap; word-break: break-word; background: #F7F7F7; border-radius: 10px; padding: 12px; color: #374151; font-size: 10px; line-height: 1.55; }
          .opc-monitor-email-error { margin-top: 10px; border: 1px solid #FECACA; background: #FEF2F2; color: #991B1B; border-radius: 14px; padding: 12px; display: flex; flex-direction: column; gap: 5px; font-size: 10px; }
          .opc-monitor-drawer-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 18px; padding-top: 18px; border-top: 1px solid ${BRAND.border}; }
          .opc-monitor-drawer-actions button { min-height: 42px; border-radius: 12px; font-family: ${pageFont}; font-size: 11px; font-weight: 820; cursor: pointer; }
          .opc-monitor-drawer-actions .light { border: 1px solid ${BRAND.border}; background: #FFFFFF; color: ${BRAND.text}; }
          .opc-monitor-drawer-actions .dark { border: 1px solid ${BRAND.black}; background: ${BRAND.black}; color: #FFFFFF; }

          .spin { animation: opc-monitor-spin .8s linear infinite; }
          @keyframes opc-monitor-spin { to { transform: rotate(360deg); } }

          @media (max-width: 1280px) {
            .opc-monitor-controls { grid-template-columns: repeat(3, minmax(0, 1fr)); }
            .opc-monitor-search { grid-column: 1 / -1; }
          }

          @media (max-width: 980px) {
            .opc-monitor-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            .opc-monitor-overview-grid { grid-template-columns: 1fr; }
          }

          @media (max-width: 720px) {
            .opc-monitor-metrics, .opc-monitor-controls, .opc-monitor-detail-grid { grid-template-columns: 1fr; }
            .opc-monitor-search { grid-column: auto; }
            .opc-monitor-event-main { gap: 10px; }
            .opc-monitor-event-actions { grid-template-columns: 1fr; }
          }
        `}</style>
      </div>
    </MirakaDashboardShell>
  );
}

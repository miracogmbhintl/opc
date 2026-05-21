import { useEffect, useMemo, useState, type ReactNode } from 'react';
import MirakaDashboardShell from './MirakaDashboardShell';
import { supabase } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';

interface EinsatzDetailPageProps {
  jobId: string;
}

type JsonRecord = Record<string, any>;
type JsonArray = JsonRecord[];

interface JobDetail {
  job_id: string;
  title?: string | null;
  job_type?: string | null;
  status?: string | null;
  priority?: string | null;
  planned_start?: string | null;
  planned_end?: string | null;
  actual_start?: string | null;
  actual_end?: string | null;
  service_category?: string | null;
  service_description?: string | null;
  estimated_hours?: string | number | null;
  final_hours?: string | number | null;
  billable_amount?: string | number | null;
  currency?: string | null;
  dispatcher_notes?: string | null;
  employee_notes?: string | null;
  client_notes?: string | null;
  internal_notes?: string | null;
  report_required?: boolean | null;
  report_approved?: boolean | null;
  report_approved_at?: string | null;
  report_approved_by?: string | null;
  client_id?: string | null;
  billing_name?: string | null;
  company_name?: string | null;
  full_name?: string | null;
  email?: string | null;
  phone_raw?: string | null;
  phone_e164?: string | null;
  client_site_id?: string | null;
  site_name?: string | null;
  site_type?: string | null;
  address_text?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
  access_notes?: string | null;
  cleaning_notes?: string | null;
  billing_notes?: string | null;
  service_requirements?: any;
  assignments?: JsonArray | null;
  time_logs?: JsonArray | null;
  media?: JsonArray | null;
  damage_reports?: JsonArray | null;
  report?: JsonRecord | null;
  activity_timeline?: JsonArray | null;
  conversation_messages?: JsonArray | null;
}

const statusLabels: Record<string, string> = {
  scheduled: 'Geplant',
  assigned: 'Zugewiesen',
  pending: 'Offen',
  confirmed: 'Bestätigt',
  on_site: 'Vor Ort',
  'on-site': 'Vor Ort',
  in_progress: 'In Arbeit',
  'in-progress': 'In Arbeit',
  completed: 'Abgeschlossen',
  report_pending: 'Bericht offen',
  report_approved: 'Bericht freigegeben',
  cancelled: 'Storniert',
  draft: 'Entwurf',
  approved: 'Freigegeben',
  sent_to_client: 'An Kunde gesendet',
};

const statusStyles: Record<string, { background: string; color: string; border: string }> = {
  scheduled: { background: '#EEF4FF', color: '#1E40AF', border: '#BFDBFE' },
  assigned: { background: '#ECFEFF', color: '#155E75', border: '#A5F3FC' },
  pending: { background: '#FFFBEB', color: '#92400E', border: '#FDE68A' },
  confirmed: { background: '#F5F3FF', color: '#5B21B6', border: '#DDD6FE' },
  on_site: { background: '#FEFCE8', color: '#854D0E', border: '#FEF08A' },
  'on-site': { background: '#FEFCE8', color: '#854D0E', border: '#FEF08A' },
  in_progress: { background: '#FFF7ED', color: '#9A3412', border: '#FED7AA' },
  'in-progress': { background: '#FFF7ED', color: '#9A3412', border: '#FED7AA' },
  completed: { background: '#ECFDF5', color: '#065F46', border: '#A7F3D0' },
  report_pending: { background: '#FFFBEB', color: '#92400E', border: '#FDE68A' },
  report_approved: { background: '#ECFDF5', color: '#047857', border: '#A7F3D0' },
  cancelled: { background: '#FEF2F2', color: '#991B1B', border: '#FECACA' },
  draft: { background: '#F3F4F6', color: '#374151', border: '#E5E7EB' },
  approved: { background: '#ECFDF5', color: '#047857', border: '#A7F3D0' },
  sent_to_client: { background: '#EEF2FF', color: '#3730A3', border: '#C7D2FE' },
};

function formatStatus(status?: string | null) {
  if (!status) return 'Unbekannt';
  return statusLabels[status] || status.replaceAll('_', ' ');
}

function getStatusStyle(status?: string | null) {
  return (
    statusStyles[status || ''] || {
      background: '#F3F4F6',
      color: '#374151',
      border: '#E5E7EB',
    }
  );
}

function formatDate(value?: string | null) {
  if (!value) return 'Nicht hinterlegt';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Nicht hinterlegt';
  }

  return new Intl.DateTimeFormat('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function asArray(value: unknown): JsonArray {
  return Array.isArray(value) ? (value as JsonArray) : [];
}

function getDisplayName(job: JobDetail) {
  return job.billing_name || job.company_name || job.site_name || 'Unbekannter Kunde';
}

function joinAddress(job: JobDetail) {
  return [job.address_text, job.postal_code, job.city, job.country].filter(Boolean).join(', ');
}

function InfoCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section
      style={{
        background: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: '18px',
        padding: '22px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
      }}
    >
      <h2
        style={{
          margin: '0 0 16px',
          fontSize: '16px',
          fontWeight: 750,
          color: '#111111',
          letterSpacing: '-0.02em',
        }}
      >
        {title}
      </h2>

      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  const hasValue =
    value !== null &&
    value !== undefined &&
    value !== '' &&
    !(Array.isArray(value) && value.length === 0);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '150px 1fr',
        gap: '14px',
        padding: '10px 0',
        borderTop: '1px solid #F3F4F6',
      }}
    >
      <div style={{ fontSize: '13px', color: '#6B7280', fontWeight: 600 }}>
        {label}
      </div>

      <div style={{ fontSize: '13px', color: '#111111', lineHeight: 1.5 }}>
        {hasValue ? value : 'Nicht hinterlegt'}
      </div>
    </div>
  );
}

export default function EinsatzDetailPage({ jobId }: EinsatzDetailPageProps) {
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [databaseError, setDatabaseError] = useState<string | null>(null);

  useEffect(() => {
    void loadJob();
  }, [jobId]);

  const loadJob = async () => {
    if (!jobId) {
      setDatabaseError('Keine Einsatz-ID vorhanden.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setDatabaseError(null);

    try {
      const { data, error } = await supabase
        .from('opc_job_detail_view')
        .select('*')
        .eq('job_id', jobId)
        .single();

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      setJob(data as JobDetail);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Einsatz konnte nicht geladen werden.';

      setDatabaseError(message);
      setJob(null);
    } finally {
      setLoading(false);
    }
  };

  const assignments = useMemo(() => asArray(job?.assignments), [job]);
  const timeLogs = useMemo(() => asArray(job?.time_logs), [job]);
  const media = useMemo(() => asArray(job?.media), [job]);
  const damageReports = useMemo(() => asArray(job?.damage_reports), [job]);
  const messages = useMemo(() => asArray(job?.conversation_messages), [job]);
  const report = job?.report || null;
  const statusStyle = getStatusStyle(job?.status);

  return (
    <MirakaDashboardShell
      title="Einsatzdetails"
      requiredRole={['owner', 'admin', 'dispatch', 'employee', 'client']}
      currentPath="/einsaetze"
      hideTopBar={false}
      fullWidth={false}
    >
      <div style={{ maxWidth: '1440px', margin: '0 auto' }}>
        <div style={{ marginBottom: '24px' }}>
          <a
            href={`${baseUrl}/einsaetze`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              color: '#6B7280',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: 600,
              marginBottom: '18px',
            }}
          >
            Zurück zu Einsätze
          </a>

          {loading && (
            <div style={{ padding: '48px 0', color: '#6B7280', fontSize: '15px' }}>
              Einsatz wird geladen.
            </div>
          )}

          {!loading && databaseError && (
            <div
              style={{
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                color: '#991B1B',
                borderRadius: '14px',
                padding: '16px',
                fontSize: '14px',
                fontWeight: 600,
              }}
            >
              {databaseError}
            </div>
          )}

          {!loading && !databaseError && job && (
            <>
              <div
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E5E7EB',
                  borderRadius: '22px',
                  padding: '28px',
                  marginBottom: '22px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '20px',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: '13px',
                        color: '#6B7280',
                        fontWeight: 700,
                        marginBottom: '8px',
                      }}
                    >
                      {job.service_category || 'Einsatz'}
                    </div>

                    <h1
                      style={{
                        margin: 0,
                        fontSize: '34px',
                        lineHeight: 1.1,
                        fontWeight: 780,
                        letterSpacing: '-0.04em',
                        color: '#111111',
                      }}
                    >
                      {job.title || `${job.service_category || 'Einsatz'} · ${getDisplayName(job)}`}
                    </h1>

                    <p
                      style={{
                        margin: '12px 0 0',
                        fontSize: '15px',
                        color: '#6B7280',
                        lineHeight: 1.6,
                      }}
                    >
                      {getDisplayName(job)} · {job.site_name || 'Standort nicht hinterlegt'}
                    </p>
                  </div>

                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '7px 12px',
                      borderRadius: '999px',
                      fontSize: '12px',
                      fontWeight: 750,
                      background: statusStyle.background,
                      color: statusStyle.color,
                      border: `1px solid ${statusStyle.border}`,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {formatStatus(job.status)}
                  </span>
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1.25fr) minmax(360px, 0.75fr)',
                  gap: '22px',
                  alignItems: 'start',
                }}
              >
                <div style={{ display: 'grid', gap: '22px' }}>
                  <InfoCard title="Einsatzdaten">
                    <Row label="Kunde" value={getDisplayName(job)} />
                    <Row label="Standort" value={job.site_name} />
                    <Row label="Adresse" value={joinAddress(job)} />
                    <Row label="Start" value={formatDate(job.planned_start)} />
                    <Row label="Ende" value={formatDate(job.planned_end)} />
                    <Row label="Service" value={job.service_category || job.service_description} />
                    <Row
                      label="Geschätzte Stunden"
                      value={job.estimated_hours ? `${job.estimated_hours} h` : null}
                    />
                    <Row
                      label="Finale Stunden"
                      value={job.final_hours ? `${job.final_hours} h` : null}
                    />
                  </InfoCard>

                  <InfoCard title="Notizen">
                    <Row label="Disposition" value={job.dispatcher_notes} />
                    <Row label="Mitarbeiter" value={job.employee_notes} />
                    <Row label="Kunde" value={job.client_notes} />
                    <Row label="Zugang" value={job.access_notes} />
                    <Row label="Reinigung" value={job.cleaning_notes} />
                  </InfoCard>

                  <InfoCard title="Bericht">
                    {report ? (
                      <>
                        <Row label="Status" value={formatStatus(report.status)} />
                        <Row label="Titel" value={report.report_title} />
                        <Row label="Zusammenfassung" value={report.report_summary} />
                        <Row
                          label="Total Stunden"
                          value={report.total_hours ? `${report.total_hours} h` : null}
                        />
                        <Row label="Freigegeben am" value={formatDate(report.approved_at)} />
                      </>
                    ) : (
                      <div style={{ fontSize: '14px', color: '#6B7280' }}>
                        Noch kein Bericht vorhanden.
                      </div>
                    )}
                  </InfoCard>

                  <InfoCard title="Nachrichten">
                    {messages.length === 0 ? (
                      <div style={{ fontSize: '14px', color: '#6B7280' }}>
                        Keine Nachrichten vorhanden.
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gap: '10px' }}>
                        {messages.slice(0, 20).map((message, index) => (
                          <div
                            key={message.id || message.message_id || index}
                            style={{
                              border: '1px solid #F3F4F6',
                              borderRadius: '14px',
                              padding: '12px',
                              background: '#FAFAFA',
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                gap: '12px',
                                marginBottom: '6px',
                              }}
                            >
                              <div style={{ fontSize: '13px', fontWeight: 700, color: '#111111' }}>
                                {message.sender_display || message.sender_type || 'Nachricht'}
                              </div>

                              <div style={{ fontSize: '12px', color: '#9CA3AF' }}>
                                {formatDate(message.created_at)}
                              </div>
                            </div>

                            <div style={{ fontSize: '13px', color: '#374151', lineHeight: 1.5 }}>
                              {message.message_text_german ||
                                message.message_text_original ||
                                message.last_message ||
                                'Keine Nachricht'}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </InfoCard>
                </div>

                <div style={{ display: 'grid', gap: '22px' }}>
                  <InfoCard title="Zuweisungen">
                    {assignments.length === 0 ? (
                      <div style={{ fontSize: '14px', color: '#6B7280' }}>
                        Keine Zuweisungen vorhanden.
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gap: '10px' }}>
                        {assignments.map((assignment, index) => (
                          <div
                            key={assignment.id || assignment.assignment_id || index}
                            style={{
                              border: '1px solid #F3F4F6',
                              borderRadius: '14px',
                              padding: '12px',
                            }}
                          >
                            <div style={{ fontSize: '14px', fontWeight: 750, color: '#111111' }}>
                              {assignment.employee_name || assignment.display_name || 'Mitarbeiter'}
                            </div>

                            <div style={{ marginTop: '4px', fontSize: '12px', color: '#6B7280' }}>
                              {formatStatus(assignment.assignment_status || assignment.status)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </InfoCard>

                  <InfoCard title="Zeiterfassung">
                    {timeLogs.length === 0 ? (
                      <div style={{ fontSize: '14px', color: '#6B7280' }}>
                        Keine Zeitlogs vorhanden.
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gap: '10px' }}>
                        {timeLogs.map((log, index) => (
                          <div
                            key={log.id || index}
                            style={{
                              border: '1px solid #F3F4F6',
                              borderRadius: '14px',
                              padding: '12px',
                            }}
                          >
                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#111111' }}>
                              {log.employee_name || 'Mitarbeiter'}
                            </div>

                            <div style={{ marginTop: '4px', fontSize: '12px', color: '#6B7280' }}>
                              {formatDate(log.started_at || log.start_time)} bis{' '}
                              {formatDate(log.ended_at || log.end_time)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </InfoCard>

                  <InfoCard title="Medien">
                    {media.length === 0 ? (
                      <div style={{ fontSize: '14px', color: '#6B7280' }}>
                        Keine Medien vorhanden.
                      </div>
                    ) : (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                          gap: '10px',
                        }}
                      >
                        {media.map((item, index) => {
                          const url = item.file_url || item.public_url || item.url;

                          return (
                            <a
                              key={item.id || index}
                              href={url || '#'}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                border: '1px solid #F3F4F6',
                                borderRadius: '14px',
                                padding: '12px',
                                color: '#111111',
                                textDecoration: 'none',
                                fontSize: '13px',
                                fontWeight: 650,
                                background: '#FAFAFA',
                              }}
                            >
                              {item.media_type || item.photo_kind || item.filename || 'Datei öffnen'}
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </InfoCard>

                  <InfoCard title="Schäden">
                    {damageReports.length === 0 ? (
                      <div style={{ fontSize: '14px', color: '#6B7280' }}>
                        Keine Schäden gemeldet.
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gap: '10px' }}>
                        {damageReports.map((damage, index) => (
                          <div
                            key={damage.id || index}
                            style={{
                              border: '1px solid #FECACA',
                              borderRadius: '14px',
                              padding: '12px',
                              background: '#FEF2F2',
                            }}
                          >
                            <div style={{ fontSize: '13px', fontWeight: 750, color: '#991B1B' }}>
                              {damage.title || damage.damage_type || 'Schaden'}
                            </div>

                            <div
                              style={{
                                marginTop: '5px',
                                fontSize: '12px',
                                color: '#7F1D1D',
                                lineHeight: 1.5,
                              }}
                            >
                              {damage.description || damage.notes || 'Keine Beschreibung'}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </InfoCard>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 980px) {
          div[style*="grid-template-columns: minmax(0, 1.25fr)"] {
            grid-template-columns: 1fr !important;
          }

          div[style*="grid-template-columns: 150px 1fr"] {
            grid-template-columns: 1fr !important;
            gap: 4px !important;
          }
        }
      `}</style>
    </MirakaDashboardShell>
  );
}
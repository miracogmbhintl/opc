import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Trash2, Users, X } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { baseUrl } from '../../../lib/base-url';

type AnyRow = Record<string, any>;

type Props = {
  jobId: string;
};

function normalizeRole(value: unknown) {
  const role = String(value || '').trim().toLowerCase();
  if (role === 'dispatcher' || role === 'disposition') return 'dispatch';
  if (role === 'administrator') return 'admin';
  if (role === 'inhaber') return 'owner';
  return role;
}

function assignmentName(row: AnyRow) {
  return (
    row.employee_name ||
    row.display_name ||
    row.name ||
    row.employee_email ||
    row.email ||
    'Mitarbeiter'
  );
}

export default function JobAssignmentCalendarManager({ jobId }: Props) {
  const [allowed, setAllowed] = useState(false);
  const [assignments, setAssignments] = useState<AnyRow[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!jobId) return;

    setLoading(true);
    setError('');

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setAllowed(false);
        return;
      }

      const { data: staffRows, error: staffError } = await supabase
        .from('opc_staff_roles')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('status', 'active');

      if (staffError) throw staffError;

      const canManage = (staffRows || []).some((row: AnyRow) => {
        const role = normalizeRole(row.role);
        return ['owner', 'admin', 'dispatch'].includes(role) || row.can_manage_jobs === true;
      });

      setAllowed(canManage);
      if (!canManage) return;

      let rows: AnyRow[] = [];
      const rpcResult = await supabase.rpc('opc_get_job_assignments', { p_job_id: jobId });

      if (!rpcResult.error && Array.isArray(rpcResult.data)) {
        rows = rpcResult.data;
      } else {
        const directResult = await supabase
          .from('opc_job_assignments')
          .select('*')
          .eq('job_id', jobId)
          .order('created_at', { ascending: true });

        if (directResult.error) throw directResult.error;
        rows = directResult.data || [];
      }

      const { data: employees } = await supabase
        .from('opc_staff_roles')
        .select('id,user_id,employee_id,display_name,email,phone_e164,phone_raw')
        .limit(2000);

      const staff = employees || [];
      const hydrated = rows.map((assignment: AnyRow) => {
        const identifiers = new Set(
          [
            assignment.staff_role_id,
            assignment.staff_id,
            assignment.employee_id,
            assignment.user_id,
            assignment.employee_user_id,
            assignment.assigned_to,
          ]
            .filter(Boolean)
            .map(String),
        );
        const employee = staff.find((candidate: AnyRow) =>
          [candidate.id, candidate.user_id, candidate.employee_id]
            .filter(Boolean)
            .map(String)
            .some((id) => identifiers.has(id)),
        );

        return {
          ...assignment,
          employee_name: assignmentName({ ...employee, ...assignment }),
          email: assignment.email || assignment.employee_email || employee?.email || null,
        };
      });

      setAssignments(hydrated);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Zuweisungen konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeAssignments = useMemo(
    () =>
      assignments.filter((row) => {
        const status = String(row.status || row.assignment_status || 'assigned').toLowerCase();
        return !['removed', 'unassigned', 'cancelled', 'canceled', 'deleted', 'inactive'].includes(status);
      }),
    [assignments],
  );

  async function removeAssignment(assignment: AnyRow) {
    const assignmentId = String(assignment.id || assignment.assignment_id || '').trim();
    if (!assignmentId) {
      setError('Diese Zuweisung besitzt keine gültige ID.');
      return;
    }

    const name = assignmentName(assignment);
    if (!window.confirm(`${name} wirklich von diesem Einsatz entfernen?`)) return;

    setRemovingId(assignmentId);
    setError('');

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) throw new Error('Keine aktive Sitzung für Kalender-Synchronisation.');

      const response = await fetch(`${baseUrl}/api/opc/calendar/sync-job-assignment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          job_id: jobId,
          remove_assignment_id: assignmentId,
        }),
      });
      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.error || 'Zuweisung und Kalender konnten nicht aktualisiert werden.');
      }

      await load();
      window.location.reload();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Zuweisung konnte nicht entfernt werden.');
    } finally {
      setRemovingId(null);
    }
  }

  if (!allowed) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed',
          right: 18,
          bottom: 18,
          zIndex: 9000,
          minHeight: 46,
          border: '1px solid #0F1115',
          borderRadius: 15,
          background: '#0F1115',
          color: '#FFFFFF',
          padding: '0 16px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 9,
          font: '750 13px Inter, Helvetica, Arial, sans-serif',
          cursor: 'pointer',
          boxShadow: '0 12px 32px rgba(15,17,21,.18)',
        }}
      >
        <Users size={17} />
        Zuweisungen verwalten
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9500,
            background: 'rgba(15,17,21,.42)',
            display: 'grid',
            placeItems: 'center',
            padding: 20,
          }}
        >
          <div
            style={{
              width: 'min(620px, 100%)',
              maxHeight: '85vh',
              overflow: 'auto',
              background: '#FFFFFF',
              border: '1px solid #E5E7EB',
              borderRadius: 22,
              boxShadow: '0 24px 80px rgba(15,17,21,.22)',
              fontFamily: 'Inter, Helvetica, Arial, sans-serif',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                padding: '20px 22px',
                borderBottom: '1px solid #E5E7EB',
              }}
            >
              <div>
                <strong style={{ display: 'block', fontSize: 19, color: '#111827' }}>
                  Zugewiesene Mitarbeiter
                </strong>
                <span style={{ fontSize: 13, color: '#6B7280' }}>
                  Entfernen aktualisiert Einsatzliste und Kalender sofort.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  border: '1px solid #E5E7EB',
                  background: '#FFFFFF',
                  display: 'grid',
                  placeItems: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: 22, display: 'grid', gap: 10 }}>
              {error ? (
                <div
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    border: '1px solid #FCA5A5',
                    background: '#FEF2F2',
                    color: '#B91C1C',
                    fontSize: 13,
                    fontWeight: 650,
                  }}
                >
                  {error}
                </div>
              ) : null}

              {loading ? (
                <div style={{ padding: 18, textAlign: 'center', color: '#6B7280' }}>
                  <Loader2 size={18} className="spin" />
                </div>
              ) : activeAssignments.length === 0 ? (
                <div style={{ padding: 18, textAlign: 'center', color: '#6B7280' }}>
                  Keine Mitarbeiter zugewiesen.
                </div>
              ) : (
                activeAssignments.map((assignment) => {
                  const id = String(assignment.id || assignment.assignment_id || '');
                  const removing = removingId === id;

                  return (
                    <div
                      key={id || assignmentName(assignment)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 14,
                        padding: 14,
                        border: '1px solid #E5E7EB',
                        borderRadius: 15,
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <strong style={{ display: 'block', color: '#111827', fontSize: 14 }}>
                          {assignmentName(assignment)}
                        </strong>
                        <span style={{ display: 'block', color: '#6B7280', fontSize: 12 }}>
                          {assignment.email || 'Kein E-Mail-Kontakt hinterlegt'}
                        </span>
                      </div>
                      <button
                        type="button"
                        disabled={Boolean(removingId)}
                        onClick={() => void removeAssignment(assignment)}
                        style={{
                          minWidth: 42,
                          height: 42,
                          borderRadius: 12,
                          border: '1px solid #FECACA',
                          background: '#FEF2F2',
                          color: '#B91C1C',
                          display: 'grid',
                          placeItems: 'center',
                          cursor: removingId ? 'wait' : 'pointer',
                        }}
                        title="Zuweisung entfernen"
                      >
                        {removing ? <Loader2 size={16} className="spin" /> : <Trash2 size={16} />}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

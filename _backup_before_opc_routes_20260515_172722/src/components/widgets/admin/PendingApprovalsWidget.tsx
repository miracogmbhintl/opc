import React, { useEffect, useState } from 'react';
import WidgetCard from '../shared/WidgetCard';
import WidgetSkeleton from '../shared/WidgetSkeleton';
import { AlertCircle } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

interface PendingApproval {
  id: string;
  projectName: string;
  client: string;
  step: string;
  daysWaiting: number;
}

interface PendingApprovalsWidgetProps {
  baseUrl: string;
  limit?: number;
}

export default function PendingApprovalsWidget({ baseUrl, limit = 5 }: PendingApprovalsWidgetProps) {
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPendingApprovals();
  }, [limit]);

  const loadPendingApprovals = async () => {
    try {
      // Get projects with status 'pending' or 'at_risk'
      const { data: projects, error } = await supabase
        .from('projects')
        .select('*')
        .in('status', ['pending', 'at_risk'])
        .order('updated_at', { ascending: true })
        .limit(limit);

      if (error) throw error;

      // Transform into approvals
      const approvals: PendingApproval[] = (projects || []).map((project: any) => {
        const updatedAt = new Date(project.updated_at);
        const now = new Date();
        const daysWaiting = Math.floor((now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24));

        return {
          id: project.id,
          projectName: project.project_title,
          client: project.client?.company_name || 'Unknown Client',
          step: project.status === 'pending' ? 'Client Approval' : 'On Hold',
          daysWaiting
        };
      });

      setApprovals(approvals);
    } catch (error) {
      console.error('Error loading pending approvals:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <WidgetSkeleton />;

  const getUrgencyColor = (days: number) => {
    if (days >= 5) return '#EF4444';
    if (days >= 3) return '#F59E0B';
    return '#6B7280';
  };

  return (
    <WidgetCard title="Pending Approvals" icon={<AlertCircle size={18} />}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {approvals.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>
              No pending approvals
            </p>
          </div>
        ) : (
          <>
            {approvals.map((approval, index) => (
              <div
                key={approval.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  paddingBottom: '12px',
                  borderBottom: index < approvals.length - 1 ? '1px solid #F3F4F6' : 'none'
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start'
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: '14px',
                      fontWeight: 500,
                      color: '#1A1A1A',
                      margin: 0,
                      marginBottom: '2px'
                    }}>
                      {approval.projectName}
                    </p>
                    <p style={{
                      fontSize: '14px',
                      color: '#6B7280',
                      margin: 0,
                      marginBottom: '4px'
                    }}>
                      {approval.client}
                    </p>
                  </div>
                  <span style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: getUrgencyColor(approval.daysWaiting),
                    whiteSpace: 'nowrap',
                    marginLeft: '8px'
                  }}>
                    {approval.daysWaiting}d
                  </span>
                </div>
                <div style={{
                  display: 'inline-block',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#6B7280',
                  padding: '4px 12px',
                  background: '#F3F4F6',
                  borderRadius: '12px',
                  alignSelf: 'flex-start'
                }}>
                  {approval.step}
                </div>
              </div>
            ))}
            
            {/* Summary */}
            <div style={{
              marginTop: '4px',
              paddingTop: '12px',
              borderTop: '1px solid #E5E7EB',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ fontSize: '13px', color: '#6B7280', fontWeight: 500 }}>
                Total Pending
              </span>
              <span style={{
                fontSize: '36px',
                fontWeight: 600,
                color: '#1A1A1A',
                lineHeight: 1
              }}>
                {approvals.length}
              </span>
            </div>
          </>
        )}
      </div>
    </WidgetCard>
  );
}


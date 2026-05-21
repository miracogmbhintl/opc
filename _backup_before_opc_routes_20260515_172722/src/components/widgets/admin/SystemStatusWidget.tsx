import React, { useEffect, useState } from 'react';
import WidgetCard from '../shared/WidgetCard';
import WidgetSkeleton from '../shared/WidgetSkeleton';
import { Server } from 'lucide-react';

interface SystemStatus {
  database: 'online' | 'offline';
  auth: 'active' | 'inactive';
  api: 'healthy' | 'degraded' | 'down';
  uptime: string;
}

interface SystemStatusWidgetProps {
  baseUrl: string;
}

export default function SystemStatusWidget({ baseUrl }: SystemStatusWidgetProps) {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${baseUrl}/api/diagnostic`, {
      credentials: 'include'
    })
      .then(res => res.json())
      .then(data => {
        setStatus({
          database: data.supabase ? 'online' : 'offline',
          auth: data.supabase ? 'active' : 'inactive',
          api: 'healthy',
          uptime: '99.9%'
        });
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching system status:', err);
        setStatus({
          database: 'offline',
          auth: 'inactive',
          api: 'down',
          uptime: 'N/A'
        });
        setLoading(false);
      });
  }, [baseUrl]);

  if (loading) return <WidgetSkeleton />;

  const getStatusColor = (status: string) => {
    if (status === 'online' || status === 'active' || status === 'healthy') {
      return '#22C55E';
    }
    if (status === 'degraded') return '#F59E0B';
    return '#EF4444';
  };

  const getStatusDot = (isOnline: boolean) => (
    <div style={{
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      background: isOnline ? '#22C55E' : '#EF4444'
    }} />
  );

  return (
    <WidgetCard title="System Status" icon={<Server size={18} />}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* Database Status */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 0'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            {getStatusDot(status?.database === 'online')}
            <span style={{ fontSize: '14px', fontWeight: 500, color: '#1A1A1A' }}>Database</span>
          </div>
          <span style={{
            fontSize: '13px',
            fontWeight: 500,
            color: getStatusColor(status?.database || ''),
            textTransform: 'capitalize'
          }}>
            {status?.database}
          </span>
        </div>

        {/* Auth Status */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 0',
          borderTop: '1px solid #F9FAFB'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            {getStatusDot(status?.auth === 'active')}
            <span style={{ fontSize: '14px', fontWeight: 500, color: '#1A1A1A' }}>Auth</span>
          </div>
          <span style={{
            fontSize: '13px',
            fontWeight: 500,
            color: getStatusColor(status?.auth || ''),
            textTransform: 'capitalize'
          }}>
            {status?.auth}
          </span>
        </div>

        {/* API Status */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 0',
          borderTop: '1px solid #F9FAFB'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            {getStatusDot(status?.api === 'healthy')}
            <span style={{ fontSize: '14px', fontWeight: 500, color: '#1A1A1A' }}>API</span>
          </div>
          <span style={{
            fontSize: '13px',
            fontWeight: 500,
            color: getStatusColor(status?.api || ''),
            textTransform: 'capitalize'
          }}>
            {status?.api}
          </span>
        </div>

        {/* Uptime */}
        <div style={{
          marginTop: '4px',
          paddingTop: '12px',
          borderTop: '1px solid #E5E7EB',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span style={{ fontSize: '13px', fontWeight: 500, color: '#6B7280', letterSpacing: '0.3px' }}>Uptime</span>
          <span style={{
            fontSize: '36px',
            fontWeight: 600,
            color: '#1A1A1A',
            lineHeight: 1
          }}>
            {status?.uptime}
          </span>
        </div>
      </div>
    </WidgetCard>
  );
}

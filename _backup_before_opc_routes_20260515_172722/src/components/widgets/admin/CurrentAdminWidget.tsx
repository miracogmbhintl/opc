import React, { useEffect, useState } from 'react';
import WidgetCard from '../shared/WidgetCard';
import WidgetSkeleton from '../shared/WidgetSkeleton';
import { User, Settings, Mail, Shield, Calendar, ExternalLink } from 'lucide-react';

interface AdminInfo {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at?: string;
  last_sign_in?: string;
}

interface CurrentAdminWidgetProps {
  baseUrl: string;
}

export default function CurrentAdminWidget({ baseUrl }: CurrentAdminWidgetProps) {
  const [admin, setAdmin] = useState<AdminInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${baseUrl}/api/auth/profile`, {
      credentials: 'include'
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch profile');
        return res.json();
      })
      .then(data => {
        setAdmin({
          id: data.id,
          name: data.full_name || data.email?.split('@')[0] || 'Admin',
          email: data.email || 'N/A',
          role: data.role || 'admin',
          created_at: data.created_at,
          last_sign_in: data.last_sign_in_at
        });
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching admin info:', err);
        setError('Unable to load admin info');
        setLoading(false);
      });
  }, [baseUrl]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) return <WidgetSkeleton />;

  if (error) {
    return (
      <WidgetCard title="Your Information" icon={<User size={18} />}>
        <p style={{ fontSize: '14px', color: '#6B7280' }}>{error}</p>
      </WidgetCard>
    );
  }

  return (
    <WidgetCard 
      title="Your Information" 
      icon={<User size={18} />}
      action={
        <a
          href={`${baseUrl}/miraka-co-portal/settings`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            fontWeight: 500,
            color: '#1A1A1A',
            textDecoration: 'none',
            padding: '6px 12px',
            borderRadius: '8px',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#F3F4F6';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
          title="Edit profile"
        >
          <Settings size={14} />
          <span>Edit</span>
        </a>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* User Avatar & Name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            fontWeight: 600,
            fontSize: '20px',
            flexShrink: 0
          }}>
            {admin?.name?.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              fontWeight: 600,
              color: '#1A1A1A',
              fontSize: '16px',
              lineHeight: 1.2,
              margin: 0,
              marginBottom: '4px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {admin?.name}
            </p>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <Mail size={12} style={{ color: '#9CA3AF' }} />
              <p style={{ 
                fontSize: '13px', 
                color: '#6B7280', 
                margin: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {admin?.email}
              </p>
            </div>
          </div>
        </div>
        
        {/* Account Details */}
        <div style={{
          paddingTop: '12px',
          borderTop: '1px solid #E5E7EB',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          {/* Role */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Shield size={14} style={{ color: '#6B7280' }} />
              <span style={{ fontSize: '13px', color: '#6B7280', fontWeight: 500 }}>Role</span>
            </div>
            <span style={{
              fontSize: '13px',
              fontWeight: 600,
              color: '#1A1A1A',
              padding: '4px 10px',
              background: '#F3F4F6',
              borderRadius: '8px',
              textTransform: 'capitalize'
            }}>
              {admin?.role}
            </span>
          </div>

          {/* Account Created */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={14} style={{ color: '#6B7280' }} />
              <span style={{ fontSize: '13px', color: '#6B7280', fontWeight: 500 }}>Joined</span>
            </div>
            <span style={{ fontSize: '13px', fontWeight: 500, color: '#1A1A1A' }}>
              {formatDate(admin?.created_at)}
            </span>
          </div>

          {/* Status */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#22C55E',
                flexShrink: 0
              }} />
              <span style={{ fontSize: '13px', color: '#6B7280', fontWeight: 500 }}>Status</span>
            </div>
            <span style={{ fontSize: '13px', color: '#22C55E', fontWeight: 600 }}>
              Active
            </span>
          </div>
        </div>

        {/* Settings Link */}
        <a
          href={`${baseUrl}/miraka-co-portal/settings`}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '10px 16px',
            marginTop: '6px',
            background: '#1A1A1A',
            color: '#FFFFFF',
            fontSize: '14px',
            fontWeight: 500,
            borderRadius: '10px',
            textDecoration: 'none',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#2A2A2A';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#1A1A1A';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <Settings size={16} />
          <span>Manage Account</span>
          <ExternalLink size={14} style={{ marginLeft: '4px' }} />
        </a>
      </div>
    </WidgetCard>
  );
}

import React, { useEffect, useState } from 'react';
import WidgetCard from '../shared/WidgetCard';
import WidgetSkeleton from '../shared/WidgetSkeleton';
import { Building2, Mail, Phone, MapPin } from 'lucide-react';

interface CompanyInfo {
  company_name: string;
  email?: string;
  phone?: string;
  address?: string;
  website?: string;
  industry?: string;
}

interface MyCompanyOverviewProps {
  baseUrl: string;
}

export default function MyCompanyOverview({ baseUrl }: MyCompanyOverviewProps) {
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${baseUrl}/api/client/company-info`, {
      credentials: 'include'
    })
      .then(res => {
        if (!res.ok) {
          return fetch(`${baseUrl}/api/auth/profile`, { credentials: 'include' });
        }
        return res.json();
      })
      .then(data => {
        setCompany({
          company_name: data.company_name || 'My Company',
          email: data.email || data.contact_email,
          phone: data.phone || data.contact_phone,
          address: data.address,
          website: data.website,
          industry: data.industry
        });
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching company info:', err);
        setCompany({
          company_name: 'My Company'
        });
        setLoading(false);
      });
  }, [baseUrl]);

  if (loading) return <WidgetSkeleton />;

  return (
    <WidgetCard title="My Company" icon={<Building2 size={18} />}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div>
          <h4 style={{
            fontSize: '18px',
            fontWeight: 600,
            color: '#1A1A1A',
            margin: 0,
            marginBottom: '6px'
          }}>
            {company?.company_name}
          </h4>
          {company?.industry && (
            <span style={{
              fontSize: '11px',
              fontWeight: 500,
              color: '#1A1A1A',
              padding: '4px 10px',
              background: '#F3F4F6',
              borderRadius: '6px',
              display: 'inline-block'
            }}>
              {company.industry}
            </span>
          )}
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          paddingTop: '4px'
        }}>
          {company?.email && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Mail size={14} style={{ color: '#6B7280', flexShrink: 0 }} />
              <a
                href={`mailto:${company.email}`}
                style={{
                  fontSize: '13px',
                  color: '#1A1A1A',
                  textDecoration: 'none',
                  transition: 'color 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#6B7280'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#1A1A1A'}
              >
                {company.email}
              </a>
            </div>
          )}

          {company?.phone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Phone size={14} style={{ color: '#6B7280', flexShrink: 0 }} />
              <a
                href={`tel:${company.phone}`}
                style={{
                  fontSize: '13px',
                  color: '#1A1A1A',
                  textDecoration: 'none',
                  transition: 'color 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#6B7280'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#1A1A1A'}
              >
                {company.phone}
              </a>
            </div>
          )}

          {company?.address && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <MapPin size={14} style={{ color: '#6B7280', marginTop: '2px', flexShrink: 0 }} />
              <span style={{ fontSize: '13px', color: '#6B7280', lineHeight: 1.4 }}>
                {company.address}
              </span>
            </div>
          )}
        </div>

        {company?.website && (
          <div style={{
            paddingTop: '12px',
            borderTop: '1px solid #E5E7EB'
          }}>
            <a
              href={company.website}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: '13px',
                color: '#1A1A1A',
                textDecoration: 'none',
                fontWeight: 500,
                transition: 'color 0.2s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#6B7280'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#1A1A1A'}
            >
              Visit Website →
            </a>
          </div>
        )}
      </div>
    </WidgetCard>
  );
}

/**
 * System Tab Component for Settings Page (Owner Only)
 * Complete system settings with translations
 */

import { Database, HardDrive, Users, FileText, Trash2, Download, Upload, RefreshCw } from 'lucide-react';

interface SystemTabProps {
  language: string;
  tr: (de: string, en: string) => string;
}

export default function SystemTab({ language, tr }: SystemTabProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Database Management */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '14px',
        padding: '32px',
        border: '1px solid #E5E7EB',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <Database size={24} style={{ color: '#1A1A1A' }} />
          <h3 style={{
            fontSize: '20px',
            fontWeight: 600,
            color: '#1A1A1A',
            margin: 0,
            fontFamily: 'Inter, sans-serif'
          }}>
            {tr('Datenbankverwaltung', 'Database Management')}
          </h3>
        </div>
        <p style={{
          fontSize: '14px',
          color: '#6B7280',
          marginBottom: '24px',
          fontFamily: 'Inter, sans-serif'
        }}>
          {tr('Verwalten Sie Datenbankbackups und Wiederherstellungen', 'Manage database backups and restoration')}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Database Stats */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            padding: '20px',
            background: '#F9FAFB',
            borderRadius: '12px'
          }}>
            <div>
              <div style={{ fontSize: '13px', color: '#6B7280', marginBottom: '4px', fontFamily: 'Inter, sans-serif' }}>
                {tr('Gesamt-Clients', 'Total Clients')}
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#1A1A1A', fontFamily: 'Inter, sans-serif' }}>
                24
              </div>
            </div>
            <div>
              <div style={{ fontSize: '13px', color: '#6B7280', marginBottom: '4px', fontFamily: 'Inter, sans-serif' }}>
                {tr('Gesamt-Projekte', 'Total Projects')}
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#1A1A1A', fontFamily: 'Inter, sans-serif' }}>
                67
              </div>
            </div>
            <div>
              <div style={{ fontSize: '13px', color: '#6B7280', marginBottom: '4px', fontFamily: 'Inter, sans-serif' }}>
                {tr('Gesamt-Tickets', 'Total Tickets')}
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#1A1A1A', fontFamily: 'Inter, sans-serif' }}>
                142
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '12px', paddingTop: '12px' }}>
            <button
              type="button"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 24px',
                background: '#1A1A1A',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#2A2A2A';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#1A1A1A';
              }}
            >
              <Download size={16} />
              {tr('Backup erstellen', 'Create Backup')}
            </button>
            <button
              type="button"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 24px',
                background: '#FFFFFF',
                color: '#1A1A1A',
                border: '1px solid #E5E7EB',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#F9FAFB';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#FFFFFF';
              }}
            >
              <Upload size={16} />
              {tr('Wiederherstellen', 'Restore')}
            </button>
          </div>
        </div>
      </div>

      {/* User Management */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '14px',
        padding: '32px',
        border: '1px solid #E5E7EB',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <Users size={24} style={{ color: '#1A1A1A' }} />
          <h3 style={{
            fontSize: '20px',
            fontWeight: 600,
            color: '#1A1A1A',
            margin: 0,
            fontFamily: 'Inter, sans-serif'
          }}>
            {tr('Benutzerverwaltung', 'User Management')}
          </h3>
        </div>
        <p style={{
          fontSize: '14px',
          color: '#6B7280',
          marginBottom: '24px',
          fontFamily: 'Inter, sans-serif'
        }}>
          {tr('Benutzerkonten und Berechtigungen verwalten', 'Manage user accounts and permissions')}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 18px',
            background: '#F9FAFB',
            borderRadius: '12px'
          }}>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: '#1A1A1A', marginBottom: '4px', fontFamily: 'Inter, sans-serif' }}>
                {tr('Aktive Benutzer', 'Active Users')}
              </div>
              <div style={{ fontSize: '14px', color: '#6B7280', fontFamily: 'Inter, sans-serif' }}>
                {tr('28 Benutzer sind derzeit aktiv', '28 users currently active')}
              </div>
            </div>
            <button
              type="button"
              style={{
                padding: '10px 20px',
                background: '#1A1A1A',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif'
              }}
            >
              {tr('Verwalten', 'Manage')}
            </button>
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 18px',
            background: '#F9FAFB',
            borderRadius: '12px'
          }}>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: '#1A1A1A', marginBottom: '4px', fontFamily: 'Inter, sans-serif' }}>
                {tr('Rollen & Berechtigungen', 'Roles & Permissions')}
              </div>
              <div style={{ fontSize: '14px', color: '#6B7280', fontFamily: 'Inter, sans-serif' }}>
                {tr('Benutzerzugriffsrollen konfigurieren', 'Configure user access roles')}
              </div>
            </div>
            <button
              type="button"
              style={{
                padding: '10px 20px',
                background: '#1A1A1A',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif'
              }}
            >
              {tr('Konfigurieren', 'Configure')}
            </button>
          </div>
        </div>
      </div>

      {/* Storage & Files */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '14px',
        padding: '32px',
        border: '1px solid #E5E7EB',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <HardDrive size={24} style={{ color: '#1A1A1A' }} />
          <h3 style={{
            fontSize: '20px',
            fontWeight: 600,
            color: '#1A1A1A',
            margin: 0,
            fontFamily: 'Inter, sans-serif'
          }}>
            {tr('Speicher & Dateien', 'Storage & Files')}
          </h3>
        </div>
        <p style={{
          fontSize: '14px',
          color: '#6B7280',
          marginBottom: '24px',
          fontFamily: 'Inter, sans-serif'
        }}>
          {tr('Speichernutzung und Dateiverwaltung überwachen', 'Monitor storage usage and file management')}
        </p>

        {/* Storage Bar */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '10px',
            fontSize: '14px',
            fontFamily: 'Inter, sans-serif'
          }}>
            <span style={{ color: '#1A1A1A', fontWeight: 600 }}>
              {tr('Speicherverbrauch', 'Storage Usage')}
            </span>
            <span style={{ color: '#6B7280' }}>
              42.8 GB / 100 GB
            </span>
          </div>
          <div style={{
            height: '12px',
            background: '#F3F4F6',
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
            <div style={{
              height: '100%',
              width: '42.8%',
              background: 'linear-gradient(90deg, #1A1A1A, #3A3A3A)',
              borderRadius: '8px',
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', paddingTop: '12px' }}>
          <button
            type="button"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 24px',
              background: '#1A1A1A',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif'
            }}
          >
            <FileText size={16} />
            {tr('Dateien verwalten', 'Manage Files')}
          </button>
          <button
            type="button"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 24px',
              background: '#FFFFFF',
              color: '#DC2626',
              border: '1px solid #DC2626',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#DC2626';
              e.currentTarget.style.color = '#FFFFFF';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#FFFFFF';
              e.currentTarget.style.color = '#DC2626';
            }}
          >
            <Trash2 size={16} />
            {tr('Cache leeren', 'Clear Cache')}
          </button>
        </div>
      </div>

      {/* System Maintenance */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '14px',
        padding: '32px',
        border: '1px solid #E5E7EB',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <RefreshCw size={24} style={{ color: '#1A1A1A' }} />
          <h3 style={{
            fontSize: '20px',
            fontWeight: 600,
            color: '#1A1A1A',
            margin: 0,
            fontFamily: 'Inter, sans-serif'
          }}>
            {tr('Systemwartung', 'System Maintenance')}
          </h3>
        </div>
        <p style={{
          fontSize: '14px',
          color: '#6B7280',
          marginBottom: '24px',
          fontFamily: 'Inter, sans-serif'
        }}>
          {tr('Systemwartung und Diagnosewerkzeuge', 'System maintenance and diagnostic tools')}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            type="button"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 18px',
              background: '#F9FAFB',
              color: '#1A1A1A',
              border: 'none',
              borderRadius: '12px',
              fontSize: '15px',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#F3F4F6';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#F9FAFB';
            }}
          >
            <span>{tr('System-Logs anzeigen', 'View System Logs')}</span>
            <span style={{ fontSize: '12px', color: '#6B7280' }}>→</span>
          </button>

          <button
            type="button"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 18px',
              background: '#F9FAFB',
              color: '#1A1A1A',
              border: 'none',
              borderRadius: '12px',
              fontSize: '15px',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#F3F4F6';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#F9FAFB';
            }}
          >
            <span>{tr('Systemdiagnose ausführen', 'Run System Diagnostics')}</span>
            <span style={{ fontSize: '12px', color: '#6B7280' }}>→</span>
          </button>

          <button
            type="button"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 18px',
              background: '#FEF2F2',
              color: '#DC2626',
              border: '1px solid #FCA5A5',
              borderRadius: '12px',
              fontSize: '15px',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#FEE2E2';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#FEF2F2';
            }}
          >
            <span>{tr('System neu starten', 'Restart System')}</span>
            <span style={{ fontSize: '12px' }}>⚠️</span>
          </button>
        </div>
      </div>
    </div>
  );
}

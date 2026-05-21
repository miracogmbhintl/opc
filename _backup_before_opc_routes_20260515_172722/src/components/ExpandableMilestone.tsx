import { useState } from 'react';
import { ChevronDown, ChevronUp, CheckCircle, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ExpandableMilestoneProps {
  milestone: {
    id: string;
    title: string;
    description?: string;
    status: 'planned' | 'in_progress' | 'done';
    due_date: string;
    staff_notes?: string;
    client_notes?: string;
  };
  onStatusChange: (milestoneId: string, currentStatus: string) => void;
  onNotesUpdate: () => void;
  isUpdating: boolean;
  userRole: 'admin' | 'owner' | 'client' | 'freelancer';
}

export default function ExpandableMilestone({
  milestone,
  onStatusChange,
  onNotesUpdate,
  isUpdating,
  userRole
}: ExpandableMilestoneProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [staffNotes, setStaffNotes] = useState(milestone.staff_notes || '');
  const [clientNotes, setClientNotes] = useState(milestone.client_notes || '');
  const [isSaving, setIsSaving] = useState(false);

  const isStaff = userRole === 'admin' || userRole === 'owner';

  const handleSaveNotes = async () => {
    setIsSaving(true);
    try {
      const updates: any = {
        updated_at: new Date().toISOString()
      };

      // Only update staff notes if user is staff
      if (isStaff) {
        updates.staff_notes = staffNotes;
      }
      
      // Update client notes (both staff and clients can edit)
      updates.client_notes = clientNotes;

      const { error } = await supabase
        .from('project_milestones')
        .update(updates)
        .eq('id', milestone.id);

      if (error) throw error;

      alert('Notes saved successfully!');
      onNotesUpdate();
    } catch (err) {
      console.error('Error saving notes:', err);
      alert('Failed to save notes');
    } finally {
      setIsSaving(false);
    }
  };

  const getMilestoneStatusBadge = (status: string) => {
    const statusColors: Record<string, { bg: string; text: string }> = {
      'planned': { bg: '#FEF3C7', text: '#92400E' },
      'in_progress': { bg: '#DBEAFE', text: '#1E40AF' },
      'done': { bg: '#DCFCE7', text: '#166534' }
    };

    const colors = statusColors[status] || { bg: '#F3F4F6', text: '#6B7280' };
    const displayStatus = status.replace(/_/g, ' ');

    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '4px 10px',
          borderRadius: '8px',
          fontSize: '12px',
          fontWeight: 500,
          background: colors.bg,
          color: colors.text,
          textTransform: 'capitalize',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          userSelect: 'none'
        }}
        title="Click to change status"
      >
        {status === 'done' && <CheckCircle size={14} />}
        {displayStatus}
      </span>
    );
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const hasChanges = () => {
    if (isStaff && staffNotes !== (milestone.staff_notes || '')) return true;
    if (clientNotes !== (milestone.client_notes || '')) return true;
    return false;
  };

  return (
    <div
      style={{
        border: '1px solid #E5E7EB',
        borderRadius: '12px',
        overflow: 'hidden',
        transition: 'all 0.2s ease',
        opacity: isUpdating ? 0.5 : 1
      }}
    >
      {/* Header - Always Visible */}
      <div
        style={{
          padding: '16px 20px',
          background: '#FFFFFF',
          cursor: 'pointer',
          transition: 'background 0.2s ease'
        }}
        onClick={() => setIsExpanded(!isExpanded)}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#F9FAFB';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = '#FFFFFF';
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '12px'
          }}
        >
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Expand/Collapse Icon */}
            <div style={{ color: '#6B7280', flexShrink: 0 }}>
              {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </div>

            {/* Milestone Title */}
            <div style={{ flex: 1 }}>
              <h3
                style={{
                  fontSize: '15px',
                  fontWeight: 600,
                  color: '#1A1A1A',
                  margin: '0 0 4px 0'
                }}
              >
                {milestone.title}
              </h3>
              {milestone.description && (
                <p
                  style={{
                    fontSize: '13px',
                    color: '#6B7280',
                    margin: 0,
                    lineHeight: '1.5'
                  }}
                >
                  {milestone.description}
                </p>
              )}
            </div>
          </div>

          {/* Status Badge */}
          <div
            onClick={(e) => {
              e.stopPropagation();
              onStatusChange(milestone.id, milestone.status);
            }}
          >
            {getMilestoneStatusBadge(milestone.status)}
          </div>
        </div>

        {/* Due Date */}
        {milestone.due_date && (
          <div
            style={{
              fontSize: '13px',
              color: '#6B7280',
              marginTop: '8px',
              marginLeft: '32px'
            }}
          >
            Due: {formatDate(milestone.due_date)}
          </div>
        )}
      </div>

      {/* Expanded Content - Notes Section */}
      {isExpanded && (
        <div
          style={{
            padding: '20px',
            background: '#F9FAFB',
            borderTop: '1px solid #E5E7EB'
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Staff Notes - Only visible to staff */}
            {isStaff && (
              <div>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#1A1A1A'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>Staff Notes</span>
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: '#FEF3C7',
                        color: '#92400E',
                        fontWeight: 500
                      }}
                    >
                      Internal Only
                    </span>
                  </div>
                </label>
                <textarea
                  value={staffNotes}
                  onChange={(e) => setStaffNotes(e.target.value)}
                  placeholder="Add internal notes for staff only..."
                  disabled={isSaving}
                  style={{
                    width: '100%',
                    minHeight: '100px',
                    padding: '12px 14px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '10px',
                    fontSize: '14px',
                    fontFamily: 'Inter, sans-serif',
                    resize: 'vertical',
                    outline: 'none',
                    transition: 'border-color 0.2s ease',
                    background: '#FFFFFF'
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = '#1A1A1A')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = '#E5E7EB')}
                />
              </div>
            )}

            {/* Client Notes - Visible to both staff and clients */}
            <div>
              <label
                style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#1A1A1A'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Client Notes</span>
                  <span
                    style={{
                      fontSize: '11px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: '#DCFCE7',
                      color: '#166534',
                      fontWeight: 500
                    }}
                  >
                    Visible to Client
                  </span>
                </div>
              </label>
              <textarea
                value={clientNotes}
                onChange={(e) => setClientNotes(e.target.value)}
                placeholder="Add notes visible to clients..."
                disabled={isSaving}
                style={{
                  width: '100%',
                  minHeight: '100px',
                  padding: '12px 14px',
                  border: '1px solid #E5E7EB',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontFamily: 'Inter, sans-serif',
                  resize: 'vertical',
                  outline: 'none',
                  transition: 'border-color 0.2s ease',
                  background: '#FFFFFF'
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = '#1A1A1A')}
                onBlur={(e) => (e.currentTarget.style.borderColor = '#E5E7EB')}
              />
            </div>

            {/* Save Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={handleSaveNotes}
                disabled={isSaving || !hasChanges()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '10px 18px',
                  background:
                    isSaving || !hasChanges() ? '#E5E7EB' : '#1A1A1A',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor:
                    isSaving || !hasChanges() ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => {
                  if (!isSaving && hasChanges()) {
                    e.currentTarget.style.background = '#2A2A2A';
                  }
                }}
                onMouseOut={(e) => {
                  if (!isSaving && hasChanges()) {
                    e.currentTarget.style.background = '#1A1A1A';
                  }
                }}
              >
                <Save size={16} />
                {isSaving ? 'Saving...' : 'Save Notes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

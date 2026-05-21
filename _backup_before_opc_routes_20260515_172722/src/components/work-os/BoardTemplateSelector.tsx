import { useState } from 'react';
import { Briefcase, Calendar, Users, Settings, ChevronRight } from 'lucide-react';

interface BoardTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  groups: Array<{ name: string; color?: string }>;
  columns: Array<{ name: string; type: string }>;
}

interface BoardTemplateSelectorProps {
  onSelectTemplate: (template: BoardTemplate) => void;
  onCancel: () => void;
}

export default function BoardTemplateSelector({ onSelectTemplate, onCancel }: BoardTemplateSelectorProps) {
  const templates: BoardTemplate[] = [
    {
      id: 'project-management',
      name: 'Project Management',
      description: 'Track tasks, timelines, and deliverables',
      icon: <Briefcase size={24} color="#1A1A1A" />,
      groups: [
        { name: 'Planning', color: '#DBEAFE' },
        { name: 'In Progress', color: '#FEF3C7' },
        { name: 'Review', color: '#E0E7FF' },
        { name: 'Done', color: '#D1FAE5' }
      ],
      columns: [
        { name: 'Status', type: 'status' },
        { name: 'Priority', type: 'priority' },
        { name: 'Owner', type: 'assignee' },
        { name: 'Due Date', type: 'date' },
        { name: 'Progress', type: 'progress' }
      ]
    },
    {
      id: 'content-calendar',
      name: 'Content Calendar',
      description: 'Plan and schedule content creation',
      icon: <Calendar size={24} color="#1A1A1A" />,
      groups: [
        { name: 'Ideas', color: '#F3F4F6' },
        { name: 'Drafting', color: '#FEF3C7' },
        { name: 'Review', color: '#E0E7FF' },
        { name: 'Published', color: '#D1FAE5' }
      ],
      columns: [
        { name: 'Type', type: 'status' },
        { name: 'Author', type: 'assignee' },
        { name: 'Publish Date', type: 'date' },
        { name: 'Platform', type: 'text' },
        { name: 'Status', type: 'status' }
      ]
    },
    {
      id: 'crm-pipeline',
      name: 'CRM Pipeline',
      description: 'Manage leads and client relationships',
      icon: <Users size={24} color="#1A1A1A" />,
      groups: [
        { name: 'New Leads', color: '#DBEAFE' },
        { name: 'Qualified', color: '#FEF3C7' },
        { name: 'Proposal', color: '#E0E7FF' },
        { name: 'Closed Won', color: '#D1FAE5' }
      ],
      columns: [
        { name: 'Contact', type: 'assignee' },
        { name: 'Company', type: 'text' },
        { name: 'Value', type: 'number' },
        { name: 'Last Contact', type: 'date' },
        { name: 'Stage', type: 'status' }
      ]
    },
    {
      id: 'operations',
      name: 'Operations',
      description: 'Daily operations and task management',
      icon: <Settings size={24} color="#1A1A1A" />,
      groups: [
        { name: 'Backlog', color: '#F3F4F6' },
        { name: 'This Week', color: '#FEF3C7' },
        { name: 'In Progress', color: '#DBEAFE' },
        { name: 'Completed', color: '#D1FAE5' }
      ],
      columns: [
        { name: 'Task Type', type: 'status' },
        { name: 'Assigned To', type: 'assignee' },
        { name: 'Priority', type: 'priority' },
        { name: 'Due Date', type: 'date' },
        { name: 'Completed', type: 'checkbox' }
      ]
    }
  ];

  const [selectedTemplate, setSelectedTemplate] = useState<BoardTemplate | null>(null);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000
    }}>
      <div style={{
        background: '#FFFFFF',
        borderRadius: '12px',
        width: '90%',
        maxWidth: '760px',
        maxHeight: '80vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{
          padding: '24px 32px',
          borderBottom: '1px solid #E6E6E6'
        }}>
          <h2 style={{
            fontSize: '22px',
            fontWeight: 700,
            color: '#1A1A1A',
            fontFamily: 'Poppins, sans-serif',
            margin: 0,
            marginBottom: '6px'
          }}>
            Choose a template
          </h2>
          <p style={{
            fontSize: '14px',
            color: '#6B6B6B',
            fontFamily: 'Inter, sans-serif',
            margin: 0
          }}>
            Start with a pre-configured board or create a blank one
          </p>
        </div>

        <div style={{
          padding: '24px 32px',
          overflowY: 'auto',
          flex: 1
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '16px'
          }}>
            {templates.map(template => (
              <button
                key={template.id}
                onClick={() => setSelectedTemplate(template)}
                style={{
                  background: selectedTemplate?.id === template.id ? '#FAFAFA' : '#FFFFFF',
                  border: selectedTemplate?.id === template.id ? '2px solid #1A1A1A' : '1px solid #E6E6E6',
                  borderRadius: '10px',
                  padding: '20px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={(e) => {
                  if (selectedTemplate?.id !== template.id) {
                    e.currentTarget.style.borderColor = '#1A1A1A';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedTemplate?.id !== template.id) {
                    e.currentTarget.style.borderColor = '#E6E6E6';
                  }
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  marginBottom: '12px'
                }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    background: '#F2F2F2',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    {template.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{
                      fontSize: '15px',
                      fontWeight: 600,
                      color: '#1A1A1A',
                      fontFamily: 'Poppins, sans-serif',
                      margin: 0,
                      marginBottom: '4px'
                    }}>
                      {template.name}
                    </h3>
                    <p style={{
                      fontSize: '13px',
                      color: '#6B6B6B',
                      fontFamily: 'Inter, sans-serif',
                      margin: 0
                    }}>
                      {template.description}
                    </p>
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  gap: '6px',
                  flexWrap: 'wrap'
                }}>
                  {template.groups.slice(0, 3).map((group, idx) => (
                    <span
                      key={idx}
                      style={{
                        fontSize: '11px',
                        color: '#6B6B6B',
                        fontFamily: 'Inter, sans-serif',
                        padding: '3px 8px',
                        background: group.color || '#F2F2F2',
                        borderRadius: '4px'
                      }}
                    >
                      {group.name}
                    </span>
                  ))}
                  {template.groups.length > 3 && (
                    <span style={{
                      fontSize: '11px',
                      color: '#9A9A9A',
                      fontFamily: 'Inter, sans-serif'
                    }}>
                      +{template.groups.length - 3}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>

          <button
            onClick={() => setSelectedTemplate(null)}
            style={{
              width: '100%',
              marginTop: '16px',
              padding: '16px',
              background: 'transparent',
              border: '1px dashed #E6E6E6',
              borderRadius: '10px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
              color: '#6B6B6B',
              fontFamily: 'Inter, sans-serif',
              transition: 'all 0.15s',
              textAlign: 'center'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#1A1A1A';
              e.currentTarget.style.background = '#FAFAFA';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#E6E6E6';
              e.currentTarget.style.background = 'transparent';
            }}
          >
            Start with blank board
          </button>
        </div>

        <div style={{
          padding: '20px 32px',
          borderTop: '1px solid #E6E6E6',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px'
        }}>
          <button
            onClick={onCancel}
            style={{
              padding: '10px 20px',
              background: 'transparent',
              border: '1px solid #E6E6E6',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
              color: '#1A1A1A',
              fontFamily: 'Inter, sans-serif'
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (selectedTemplate) {
                onSelectTemplate(selectedTemplate);
              } else {
                onSelectTemplate({
                  id: 'blank',
                  name: 'Blank Board',
                  description: '',
                  icon: null,
                  groups: [],
                  columns: []
                });
              }
            }}
            style={{
              padding: '10px 20px',
              background: '#1A1A1A',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600,
              color: '#FFFFFF',
              fontFamily: 'Inter, sans-serif',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            Continue
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}


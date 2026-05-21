import { useState } from 'react';
import { Plus } from 'lucide-react';

interface BoardColumn {
  id: string;
  name: string;
  type: string;
  options?: string[];
}

interface BoardItem {
  id: string;
  name: string;
  values: Record<string, any>;
  position: number;
}

interface BoardData {
  columns: BoardColumn[];
  items: BoardItem[];
}

interface KanbanViewProps {
  board: BoardData;
  onItemClick: (itemId: string) => void;
  onItemUpdate: (itemId: string, updates: Record<string, any>) => void;
}

export default function KanbanView({ board, onItemClick, onItemUpdate }: KanbanViewProps) {
  const statusColumn = board.columns.find(c => c.type === 'status');
  const [draggedItem, setDraggedItem] = useState<string | null>(null);

  if (!statusColumn || !statusColumn.options) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: '#6B7280',
        fontSize: '14px',
        fontWeight: 500,
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif'
      }}>
        Kanban view requires a Status column
      </div>
    );
  }

  const statuses = statusColumn.options;

  const getItemsByStatus = (status: string) => {
    return board.items.filter(item => item.values[statusColumn.id] === status);
  };

  const handleDragStart = (itemId: string) => {
    setDraggedItem(itemId);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  const handleDrop = (status: string) => {
    if (!draggedItem) return;
    
    onItemUpdate(draggedItem, { [statusColumn.id]: status });
    setDraggedItem(null);
  };

  return (
    <div style={{
      display: 'flex',
      gap: '20px',
      padding: '24px',
      height: '100%',
      overflowX: 'auto',
      background: '#F9FAFB'
    }}>
      {statuses.map(status => {
        const items = getItemsByStatus(status);
        
        return (
          <div
            key={status}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(status)}
            style={{
              flex: '0 0 320px',
              display: 'flex',
              flexDirection: 'column',
              background: '#FFFFFF',
              borderRadius: '12px',
              border: '1px solid #E5E7EB',
              maxHeight: 'calc(100vh - 200px)'
            }}
          >
            {/* Column Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #E5E7EB',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#F9FAFB',
              borderRadius: '12px 12px 0 0'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <h3 style={{
                  fontSize: '15px',
                  fontWeight: 600,
                  color: '#1A1A1A',
                  margin: 0,
                  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif'
                }}>
                  {status}
                </h3>
                <span style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#6B7280',
                  background: '#E5E7EB',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif'
                }}>
                  {items.length}
                </span>
              </div>
              <button
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E5E7EB',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  padding: '6px',
                  color: '#6B7280',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#F9FAFB';
                  e.currentTarget.style.color = '#1A1A1A';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#FFFFFF';
                  e.currentTarget.style.color = '#6B7280';
                }}
              >
                <Plus size={16} strokeWidth={2} />
              </button>
            </div>

            {/* Items Container */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              {items.length === 0 ? (
                <div style={{
                  padding: '40px 16px',
                  textAlign: 'center',
                  color: '#9CA3AF',
                  fontSize: '14px',
                  fontWeight: 500,
                  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif'
                }}>
                  No items yet
                </div>
              ) : (
                items.map(item => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={() => handleDragStart(item.id)}
                    onDragEnd={handleDragEnd}
                    onClick={() => onItemClick(item.id)}
                    style={{
                      background: draggedItem === item.id ? '#F9FAFB' : '#FFFFFF',
                      border: '1px solid #E5E7EB',
                      borderRadius: '8px',
                      padding: '14px',
                      cursor: 'grab',
                      transition: 'all 0.2s ease',
                      opacity: draggedItem === item.id ? 0.6 : 1,
                      boxShadow: draggedItem === item.id ? 'none' : '0 1px 3px rgba(0, 0, 0, 0.05)'
                    }}
                    onMouseEnter={(e) => {
                      if (draggedItem !== item.id) {
                        e.currentTarget.style.borderColor = '#1A1A1A';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#E5E7EB';
                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    {/* Item Title */}
                    <div style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#1A1A1A',
                      marginBottom: '12px',
                      lineHeight: '1.4',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif'
                    }}>
                      {item.name}
                    </div>

                    {/* Item Tags/Metadata */}
                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '8px'
                    }}>
                      {board.columns.map(column => {
                        const value = item.values[column.id];
                        if (!value || column.type === 'status') return null;

                        if (column.type === 'priority') {
                          return (
                            <span
                              key={column.id}
                              style={{
                                fontSize: '12px',
                                fontWeight: 500,
                                padding: '4px 10px',
                                background: getPriorityColor(value),
                                color: '#1A1A1A',
                                borderRadius: '6px',
                                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif'
                              }}
                            >
                              {value}
                            </span>
                          );
                        }

                        if (column.type === 'assignee') {
                          return (
                            <span
                              key={column.id}
                              style={{
                                fontSize: '12px',
                                fontWeight: 500,
                                padding: '4px 10px',
                                background: '#F3F4F6',
                                color: '#1A1A1A',
                                borderRadius: '6px',
                                border: '1px solid #E5E7EB',
                                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif'
                              }}
                            >
                              👤 {value}
                            </span>
                          );
                        }

                        if (column.type === 'date') {
                          return (
                            <span
                              key={column.id}
                              style={{
                                fontSize: '12px',
                                fontWeight: 500,
                                padding: '4px 10px',
                                background: '#F3F4F6',
                                color: '#6B7280',
                                borderRadius: '6px',
                                border: '1px solid #E5E7EB',
                                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif'
                              }}
                            >
                              📅 {new Date(value).toLocaleDateString()}
                            </span>
                          );
                        }

                        return null;
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function getPriorityColor(priority: string): string {
  const colors: Record<string, string> = {
    'High': '#FEE2E2',
    'Medium': '#FEF3C7',
    'Low': '#E0E7FF'
  };
  return colors[priority] || '#F3F4F6';
}

import { useState } from 'react';
import { Plus, X, Star } from 'lucide-react';

interface ViewDefinition {
  id: string;
  name: string;
  visibleColumns: string[];
  filters: Record<string, any>;
  sortBy?: { columnId: string; direction: 'asc' | 'desc' };
  isDefault?: boolean;
}

interface SavedViewsBarProps {
  activeViewId: string;
  onViewChange: (viewId: string) => void;
  onCreateGroup?: () => void;
}

export default function SavedViewsBar({ activeViewId, onViewChange, onCreateGroup }: SavedViewsBarProps) {
  const [views] = useState<ViewDefinition[]>([
    { id: 'main', name: 'Main', visibleColumns: [], filters: {}, isDefault: true },
    { id: 'my-items', name: 'My Items', visibleColumns: [], filters: { assignee: 'me' } },
    { id: 'high-priority', name: 'High Priority', visibleColumns: [], filters: { priority: 'High' } },
    { id: 'client-view', name: 'Client View', visibleColumns: [], filters: {} }
  ]);

  const [showCreateView, setShowCreateView] = useState(false);
  const [newViewName, setNewViewName] = useState('');

  const handleCreateView = () => {
    if (newViewName.trim()) {
      console.log('Create view:', newViewName);
      setNewViewName('');
      setShowCreateView(false);
    }
  };

  // Consistent button style - 36px height
  const buttonBaseStyle: React.CSSProperties = {
    height: '36px',
    padding: '0 14px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontFamily: "'Inter Tight', 'Helvetica Neue', sans-serif",
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none'
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '12px 32px',
      background: '#FFFFFF',
      borderBottom: '1px solid #F2F2F2'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        flex: 1,
        overflowX: 'auto',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none'
      }}>
        {views.map(view => (
          <button
            key={view.id}
            onClick={() => onViewChange(view.id)}
            style={{
              ...buttonBaseStyle,
              background: activeViewId === view.id ? '#F2F2F2' : 'transparent',
              color: activeViewId === view.id ? '#1A1A1A' : '#6B6B6B',
              borderRadius: '6px',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap'
            }}
            onMouseEnter={(e) => {
              if (activeViewId !== view.id) {
                e.currentTarget.style.background = '#FAFAFA';
              }
            }}
            onMouseLeave={(e) => {
              if (activeViewId !== view.id) {
                e.currentTarget.style.background = 'transparent';
              }
            }}
          >
            {view.isDefault && <Star size={12} fill="#1A1A1A" color="#1A1A1A" />}
            {view.name}
          </button>
        ))}
      </div>

      {showCreateView ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <input
            type="text"
            value={newViewName}
            onChange={(e) => setNewViewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateView();
              if (e.key === 'Escape') {
                setNewViewName('');
                setShowCreateView(false);
              }
            }}
            placeholder="View name"
            autoFocus
            style={{
              fontSize: '13px',
              fontFamily: "'Inter Tight', 'Helvetica Neue', sans-serif",
              padding: '6px 10px',
              border: '1px solid #E6E6E6',
              borderRadius: '6px',
              outline: 'none',
              background: '#FFFFFF',
              minWidth: '140px'
            }}
          />
          <button
            onClick={handleCreateView}
            style={{
              background: '#1A1A1A',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: "'Inter Tight', 'Helvetica Neue', sans-serif"
            }}
          >
            Save
          </button>
          <button
            onClick={() => {
              setNewViewName('');
              setShowCreateView(false);
            }}
            style={{
              background: 'none',
              border: 'none',
              padding: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              color: '#6B6B6B',
              borderRadius: '4px'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#F2F2F2'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <button
          onClick={onCreateGroup}
          style={{
            ...buttonBaseStyle,
            background: '#1A1A1A',
            color: '#FFFFFF'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#2A2A2A';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#1A1A1A';
          }}
        >
          + New Group
        </button>
      )}
    </div>
  );
}








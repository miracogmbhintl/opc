import { useState } from 'react';
import { MoreVertical, Edit2, EyeOff, Lock, Type, Hash, Calendar, User as UserIcon, CheckSquare } from 'lucide-react';

interface ColumnHeaderActionsProps {
  columnId: string;
  columnName: string;
  columnType: string;
  onRename: (columnId: string, newName: string) => void;
  onHide: (columnId: string) => void;
  onChangeType: (columnId: string, newType: string) => void;
  onLock: (columnId: string) => void;
}

export default function ColumnHeaderActions({
  columnId,
  columnName,
  columnType,
  onRename,
  onHide,
  onChangeType,
  onLock
}: ColumnHeaderActionsProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(columnName);

  const handleRename = () => {
    if (newName.trim() && newName !== columnName) {
      onRename(columnId, newName.trim());
    } else {
      setNewName(columnName);
    }
    setIsRenaming(false);
    setShowMenu(false);
  };

  const columnTypes = [
    { value: 'text', label: 'Text', icon: Type },
    { value: 'number', label: 'Number', icon: Hash },
    { value: 'date', label: 'Date', icon: Calendar },
    { value: 'assignee', label: 'Person', icon: UserIcon },
    { value: 'checkbox', label: 'Checkbox', icon: CheckSquare },
    { value: 'status', label: 'Status', icon: Type },
    { value: 'priority', label: 'Priority', icon: Type }
  ];

  if (isRenaming) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onBlur={handleRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleRename();
            if (e.key === 'Escape') {
              setNewName(columnName);
              setIsRenaming(false);
            }
          }}
          autoFocus
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: '#6B6B6B',
            fontFamily: 'Inter, sans-serif',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            border: '1px solid #1A1A1A',
            borderRadius: '4px',
            padding: '2px 6px',
            outline: 'none',
            background: '#FFFFFF'
          }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        position: 'relative'
      }}
      onMouseLeave={() => {
        setShowMenu(false);
        setShowTypeMenu(false);
      }}
    >
      <span>{columnName}</span>

      <button
        onClick={() => setShowMenu(!showMenu)}
        style={{
          background: 'none',
          border: 'none',
          padding: '2px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          color: '#9A9A9A',
          opacity: showMenu ? 1 : 0,
          transition: 'opacity 0.15s',
          borderRadius: '3px'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '1';
          e.currentTarget.style.background = '#E6E6E6';
        }}
        onMouseLeave={(e) => {
          if (!showMenu) e.currentTarget.style.opacity = '0';
          e.currentTarget.style.background = 'none';
        }}
      >
        <MoreVertical size={14} />
      </button>

      {showMenu && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: '6px',
            background: '#FFFFFF',
            border: '1px solid #E6E6E6',
            borderRadius: '6px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
            minWidth: '160px',
            zIndex: 1000
          }}
        >
          <button
            onClick={() => {
              setIsRenaming(true);
              setShowMenu(false);
            }}
            style={{
              width: '100%',
              padding: '8px 12px',
              background: 'none',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              fontFamily: 'Inter, sans-serif',
              color: '#1A1A1A',
              borderRadius: '4px'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#F2F2F2'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
          >
            <Edit2 size={14} />
            Rename column
          </button>

          <div
            style={{ position: 'relative' }}
            onMouseEnter={() => setShowTypeMenu(true)}
            onMouseLeave={() => setShowTypeMenu(false)}
          >
            <button
              style={{
                width: '100%',
                padding: '8px 12px',
                background: showTypeMenu ? '#F2F2F2' : 'none',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13px',
                fontFamily: 'Inter, sans-serif',
                color: '#1A1A1A',
                borderRadius: '4px'
              }}
            >
              <Type size={14} />
              Change type
            </button>

            {showTypeMenu && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: '100%',
                  marginLeft: '4px',
                  background: '#FFFFFF',
                  border: '1px solid #E6E6E6',
                  borderRadius: '6px',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                  minWidth: '140px',
                  zIndex: 1001
                }}
              >
                {columnTypes.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => {
                      onChangeType(columnId, value);
                      setShowMenu(false);
                      setShowTypeMenu(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: columnType === value ? '#F2F2F2' : 'none',
                      border: 'none',
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '13px',
                      fontFamily: 'Inter, sans-serif',
                      color: '#1A1A1A',
                      borderRadius: '4px'
                    }}
                    onMouseEnter={(e) => {
                      if (columnType !== value) {
                        e.currentTarget.style.background = '#F2F2F2';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (columnType !== value) {
                        e.currentTarget.style.background = 'none';
                      }
                    }}
                  >
                    <Icon size={14} />
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => {
              onHide(columnId);
              setShowMenu(false);
            }}
            style={{
              width: '100%',
              padding: '8px 12px',
              background: 'none',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              fontFamily: 'Inter, sans-serif',
              color: '#1A1A1A',
              borderRadius: '4px'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#F2F2F2'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
          >
            <EyeOff size={14} />
            Hide column
          </button>

          <button
            onClick={() => {
              onLock(columnId);
              setShowMenu(false);
            }}
            style={{
              width: '100%',
              padding: '8px 12px',
              background: 'none',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              fontFamily: 'Inter, sans-serif',
              color: '#1A1A1A',
              borderRadius: '4px'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#F2F2F2'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
          >
            <Lock size={14} />
            Lock column
          </button>
        </div>
      )}
    </div>
  );
}

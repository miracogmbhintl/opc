import { useState, useRef, useEffect } from 'react';
import { Plus } from 'lucide-react';

interface QuickActionRowProps {
  groupId: string;
  columnCount: number;
  onAddItem: (groupId: string, itemName: string) => void;
  isChildRow?: boolean;
}

export default function QuickActionRow({ groupId, columnCount, onAddItem, isChildRow = false }: QuickActionRowProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [itemName, setItemName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdding && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAdding]);

  const handleSave = () => {
    if (itemName.trim()) {
      onAddItem(groupId, itemName.trim());
      setItemName('');
    }
    setIsAdding(false);
  };

  const handleCancel = () => {
    setItemName('');
    setIsAdding(false);
  };

  if (isAdding) {
    return (
      <tr style={{ borderBottom: '1px solid #F2F2F2', height: '48px' }}>
        <td
          style={{
            padding: '0 16px',
            minWidth: '280px',
            position: 'sticky',
            left: 0,
            background: 'inherit',
            verticalAlign: 'middle',
            height: '48px'
          }}
        >
          <div style={{
            position: 'relative',
            paddingLeft: isChildRow ? '32px' : '0'
          }}>
            {/* Tree line connector for child rows */}
            {isChildRow && (
              <>
                <div
                  style={{
                    position: 'absolute',
                    left: '20px',
                    top: '-24px',
                    bottom: '24px',
                    width: '1px',
                    background: '#E6E6E6'
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: '20px',
                    top: '50%',
                    width: '12px',
                    height: '1px',
                    background: '#E6E6E6'
                  }}
                />
              </>
            )}
            
            <input
              ref={inputRef}
              type="text"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              onBlur={handleSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') handleCancel();
              }}
              placeholder="Item name"
              style={{
                width: '100%',
                padding: '6px 10px',
                fontSize: '13px',
                fontWeight: 600,
                fontFamily: 'Inter, sans-serif',
                color: '#1A1A1A',
                border: '1px solid #1A1A1A',
                borderRadius: '4px',
                outline: 'none',
                background: '#FFFFFF'
              }}
            />
          </div>
        </td>
        {/* Empty cells to maintain grid alignment */}
        {Array.from({ length: columnCount }).map((_, idx) => (
          <td
            key={idx}
            style={{
              padding: '0 16px',
              verticalAlign: 'middle',
              height: '48px'
            }}
          />
        ))}
      </tr>
    );
  }

  return (
    <tr style={{ borderBottom: '1px solid #F2F2F2', height: '48px' }}>
      <td
        style={{
          padding: '0 16px',
          minWidth: '280px',
          position: 'sticky',
          left: 0,
          background: 'inherit',
          verticalAlign: 'middle',
          height: '48px'
        }}
      >
        <div style={{
          position: 'relative',
          paddingLeft: isChildRow ? '32px' : '0'
        }}>
          {/* Tree line connector for child rows */}
          {isChildRow && (
            <>
              <div
                style={{
                  position: 'absolute',
                  left: '20px',
                  top: '-24px',
                  bottom: '24px',
                  width: '1px',
                  background: '#E6E6E6'
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: '20px',
                  top: '50%',
                  width: '12px',
                  height: '1px',
                  background: '#E6E6E6'
                }}
              />
            </>
          )}
          
          <button
            onClick={() => setIsAdding(true)}
            style={{
              background: 'none',
              border: 'none',
              padding: '4px 8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '12px',
              fontWeight: 500,
              color: '#9A9A9A',
              fontFamily: 'Inter, sans-serif',
              borderRadius: '4px',
              transition: 'all 0.15s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#F2F2F2';
              e.currentTarget.style.color = '#1A1A1A';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none';
              e.currentTarget.style.color = '#9A9A9A';
            }}
          >
            <Plus size={14} />
            Add item
          </button>
        </div>
      </td>
      {/* Empty cells to maintain grid alignment */}
      {Array.from({ length: columnCount }).map((_, idx) => (
        <td
          key={idx}
          style={{
            padding: '0 16px',
            verticalAlign: 'middle',
            height: '48px'
          }}
        />
      ))}
    </tr>
  );
}


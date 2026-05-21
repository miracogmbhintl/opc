import { useState, useRef, useEffect } from 'react';
import { CheckSquare, Square, Calendar, User, MoreHorizontal, Trash2, ChevronDown, Plus, X, Upload, Download, Eye, MessageSquare, Paperclip } from 'lucide-react';
import { useActivityLogger } from './ActivityBar';
import BoardGroup from './BoardGroup';
import ColumnHeaderActions from './ColumnHeaderActions';

interface BoardColumn {
  id: string;
  name: string;
  type: 'text' | 'status' | 'priority' | 'assignee' | 'date' | 'checkbox' | 'number' | 'progress' | 'file' | 'internal_note';
  options?: string[];
  width?: number;
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

interface TableViewProps {
  board: BoardData & { id?: string };
  onItemClick: (itemId: string) => void;
  onItemUpdate: (itemId: string, updates: Record<string, any>) => void;
  showCreateGroupModal?: boolean;
  onCloseCreateGroupModal?: () => void;
}

export default function TableView({ board, onItemClick, onItemUpdate, showCreateGroupModal, onCloseCreateGroupModal }: TableViewProps) {
  const [editingCell, setEditingCell] = useState<{ itemId: string; columnId: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [previousValue, setPreviousValue] = useState<any>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  
  const { logActivity } = useActivityLogger(board.id || 'default');

  const [groups, setGroups] = useState([
    { id: 'planning', name: 'Planning', color: '#DBEAFE', items: [] as BoardItem[] },
    { id: 'in-progress', name: 'In Progress', color: '#FEF3C7', items: [] as BoardItem[] },
    { id: 'review', name: 'Review', color: '#E0E7FF', items: [] as BoardItem[] },
    { id: 'done', name: 'Done', color: '#D1FAE5', items: [] as BoardItem[] }
  ]);

  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);

  useEffect(() => {
    const itemsPerGroup = Math.ceil(board.items.length / groups.length);
    const updatedGroups = groups.map((group, idx) => ({
      ...group,
      items: board.items.slice(idx * itemsPerGroup, (idx + 1) * itemsPerGroup)
    }));
    setGroups(updatedGroups);
  }, [board.items]);

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingCell]);

  const handleCellClick = (itemId: string, columnId: string, currentValue: any) => {
    const column = board.columns.find(c => c.id === columnId);
    if (!column) return;

    if (column.type === 'checkbox') {
      const item = board.items.find(i => i.id === itemId);
      onItemUpdate(itemId, { [columnId]: !currentValue });
      
      if (item) {
        logActivity({
          user: '',
          action: 'updated',
          itemName: item.name,
          columnName: column.name,
          oldValue: currentValue ? 'checked' : 'unchecked',
          newValue: !currentValue ? 'checked' : 'unchecked'
        });
      }
      return;
    }

    setPreviousValue(currentValue);
    setEditingCell({ itemId, columnId });
    setEditValue(currentValue || '');
  };

  const handleSaveCell = () => {
    if (!editingCell) return;
    
    const item = board.items.find(i => i.id === editingCell.itemId);
    const column = board.columns.find(c => c.id === editingCell.columnId);
    
    if (editValue !== previousValue) {
      onItemUpdate(editingCell.itemId, { [editingCell.columnId]: editValue });
      
      if (item && column) {
        logActivity({
          user: '',
          action: 'updated',
          itemName: item.name,
          columnName: column.name,
          oldValue: previousValue?.toString() || '',
          newValue: editValue?.toString() || ''
        });
      }
    }
    
    setEditingCell(null);
    setEditValue('');
    setPreviousValue(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveCell();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
      setEditValue('');
    }
  };

  const renderCell = (item: BoardItem, column: BoardColumn) => {
    const value = item.values[column.id];
    const isEditing = editingCell?.itemId === item.id && editingCell?.columnId === column.id;

    if (isEditing) {
      return (
        <CellEditor
          column={column}
          value={editValue}
          onChange={setEditValue}
          onSave={handleSaveCell}
          onCancel={() => setEditingCell(null)}
          onKeyDown={handleKeyDown}
          inputRef={inputRef}
        />
      );
    }

    return (
      <div
        onClick={() => handleCellClick(item.id, column.id, value)}
        style={{
          minHeight: '40px',
          display: 'flex',
          alignItems: 'center',
          cursor: 'pointer',
          padding: '8px 12px',
          borderRadius: '6px',
          transition: 'background 0.15s ease'
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = '#F9FAFB'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <CellContent column={column} value={value} />
      </div>
    );
  };

  const handleRenameColumn = (columnId: string, newName: string) => {
    console.log('Rename column:', columnId, newName);
  };

  const handleHideColumn = (columnId: string) => {
    setHiddenColumns([...hiddenColumns, columnId]);
  };

  const handleChangeColumnType = (columnId: string, newType: string) => {
    console.log('Change column type:', columnId, newType);
  };

  const handleLockColumn = (columnId: string) => {
    console.log('Lock column:', columnId);
  };

  const handleAddItemToGroup = (groupId: string) => {
    console.log('Add item to group:', groupId);
  };

  const handleRenameGroup = (groupId: string, newName: string) => {
    setGroups(groups.map(g => g.id === groupId ? { ...g, name: newName } : g));
  };

  const handleDeleteGroup = (groupId: string) => {
    setGroups(groups.filter(g => g.id !== groupId));
  };

  const handleDeleteItem = (itemId: string) => {
    console.log('Delete item:', itemId);
  };

  const visibleColumns = board.columns.filter(col => !hiddenColumns.includes(col.id));

  return (
    <div style={{
      width: '100%',
      height: '100%',
      overflow: 'auto',
      background: '#FFFFFF',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif'
    }}>
      {/* Render BoardGroup directly without table wrapper */}
      {groups.map(group => (
        <BoardGroup
          key={group.id}
          boardId={board.id || 'default'}
          workspaceColor="#1A1A1A"
          showCreateGroupModal={showCreateGroupModal}
          onCloseCreateGroupModal={onCloseCreateGroupModal}
        />
      ))}
    </div>
  );
}

interface CellEditorProps {
  column: BoardColumn;
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  inputRef: React.MutableRefObject<HTMLInputElement | HTMLTextAreaElement | null>;
}

function CellEditor({ column, value, onChange, onSave, onCancel, onKeyDown, inputRef }: CellEditorProps) {
  const baseInputStyle: React.CSSProperties = {
    width: '100%',
    height: '36px',
    padding: '0 12px',
    border: '1px solid #1A1A1A',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 500,
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif',
    background: '#FFFFFF',
    outline: 'none',
    color: '#1A1A1A'
  };

  if (column.type === 'status' || column.type === 'priority') {
    return (
      <select
        ref={(el) => { inputRef.current = el; }}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setTimeout(onSave, 0);
        }}
        onBlur={onSave}
        style={baseInputStyle}
      >
        <option value="">Select</option>
        {column.options?.map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    );
  }

  if (column.type === 'date') {
    return (
      <input
        ref={(el) => { inputRef.current = el; }}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onSave}
        onKeyDown={onKeyDown}
        style={baseInputStyle}
      />
    );
  }

  if (column.type === 'number' || column.type === 'progress') {
    return (
      <input
        ref={(el) => { inputRef.current = el; }}
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onSave}
        onKeyDown={onKeyDown}
        style={baseInputStyle}
      />
    );
  }

  return (
    <input
      ref={(el) => { inputRef.current = el; }}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onSave}
      onKeyDown={onKeyDown}
      style={baseInputStyle}
    />
  );
}

interface CellContentProps {
  column: BoardColumn;
  value: any;
}

function CellContent({ column, value }: CellContentProps) {
  if (!value && column.type !== 'checkbox') {
    return <span style={{ color: '#9CA3AF', fontSize: '14px', fontWeight: 500 }}>—</span>;
  }

  switch (column.type) {
    case 'checkbox':
      return value ? (
        <CheckSquare size={18} color="#1A1A1A" strokeWidth={2} />
      ) : (
        <Square size={18} color="#9CA3AF" strokeWidth={2} />
      );

    case 'status':
      return (
        <span style={{
          display: 'inline-block',
          padding: '5px 12px',
          background: getStatusColor(value),
          color: '#1A1A1A',
          fontSize: '13px',
          fontWeight: 500,
          borderRadius: '6px',
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif'
        }}>
          {value}
        </span>
      );

    case 'priority':
      return (
        <span style={{
          display: 'inline-block',
          padding: '5px 12px',
          background: getPriorityColor(value),
          color: '#1A1A1A',
          fontSize: '13px',
          fontWeight: 500,
          borderRadius: '6px',
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif'
        }}>
          {value}
        </span>
      );

    case 'assignee':
      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <User size={16} color="#6B7280" strokeWidth={2} />
          <span style={{ fontSize: '14px', fontWeight: 500, color: '#1A1A1A' }}>{value}</span>
        </div>
      );

    case 'date':
      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Calendar size={16} color="#6B7280" strokeWidth={2} />
          <span style={{ fontSize: '14px', fontWeight: 500, color: '#1A1A1A' }}>
            {new Date(value).toLocaleDateString()}
          </span>
        </div>
      );

    case 'progress':
      const percent = Math.min(100, Math.max(0, Number(value) || 0));
      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          width: '100%'
        }}>
          <div style={{
            flex: 1,
            height: '8px',
            background: '#F3F4F6',
            borderRadius: '4px',
            overflow: 'hidden',
            border: '1px solid #E5E7EB'
          }}>
            <div style={{
              width: `${percent}%`,
              height: '100%',
              background: '#1A1A1A',
              transition: 'width 0.3s ease'
            }} />
          </div>
          <span style={{
            fontSize: '13px',
            fontWeight: 600,
            color: '#6B7280',
            minWidth: '40px',
            textAlign: 'right'
          }}>
            {percent}%
          </span>
        </div>
      );

    default:
      return (
        <span style={{
          fontSize: '14px',
          fontWeight: 500,
          color: '#1A1A1A',
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif'
        }}>
          {value}
        </span>
      );
  }
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    'Done': '#D1FAE5',
    'In Progress': '#DBEAFE',
    'Blocked': '#FEE2E2',
    'To Do': '#F3F4F6',
    'Review': '#FEF3C7'
  };
  return colors[status] || '#F3F4F6';
}

function getPriorityColor(priority: string): string {
  const colors: Record<string, string> = {
    'High': '#FEE2E2',
    'Medium': '#FEF3C7',
    'Low': '#E0E7FF'
  };
  return colors[priority] || '#F3F4F6';
}

const headerCellStyle: React.CSSProperties = {
  padding: '14px 16px',
  textAlign: 'left',
  fontSize: '12px',
  fontWeight: 600,
  color: '#6B7280',
  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, sans-serif',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  borderBottom: '1px solid #E5E7EB'
};




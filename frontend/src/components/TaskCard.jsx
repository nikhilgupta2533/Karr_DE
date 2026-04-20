import { useEffect, useState } from 'react';
import { Trash2, CheckCircle2, Circle, Pin, Clock3 } from 'lucide-react';
import './TaskCard.css';

export function TaskCard({ task, onToggle, onDelete, onTogglePin, onUpdateTitle, onUpdateDueTime, renderMeta }) {
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(task.title || '');
  const [showTimeEditor, setShowTimeEditor] = useState(false);
  const [lastTapAt, setLastTapAt] = useState(0);
  
  const d = new Date(task.addedAt);
  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (task.loading) {
    return (
      <div className="task-card loading glass-panel">
        <div className="skeleton-block">
          <div className="skeleton-line" style={{ height: '24px', width: '70%', borderRadius: '8px' }}></div>
          <div className="skeleton-line" style={{ height: '14px', width: '40%', borderRadius: '6px' }}></div>
        </div>
      </div>
    );
  }

  const isCompleted = task.status === 'completed';
  const displayTitle = task.title || 'Processing Flow...';

  const cleanTitleOnly = (value) => value.replace(/^[^\w\s]+\s*/, '').trim();
  const getEmojiPrefix = (value) => {
    const parts = (value || '').trim().split(' ');
    if (!parts.length) return '';
    return /\p{Emoji}/u.test(parts[0]) ? parts[0] : '';
  };

  const saveTitle = () => {
    const trimmed = cleanTitleOnly(draftTitle);
    if (!trimmed) {
      setDraftTitle(displayTitle);
      setEditing(false);
      return;
    }
    const emoji = getEmojiPrefix(displayTitle);
    onUpdateTitle(task.id, `${emoji ? `${emoji} ` : ''}${trimmed}`);
    setEditing(false);
  };

  const startEdit = () => {
    setDraftTitle(cleanTitleOnly(displayTitle));
    setEditing(true);
  };

  useEffect(() => {
    if (!editing) setDraftTitle(task.title || '');
  }, [task.title, editing]);

  return (
    <div className={`task-card ${isCompleted ? 'completed' : ''} ${task.is_pinned ? 'pinned' : ''}`}>
      <button 
        type="button" 
        className="check-btn magnetic-btn" 
        onClick={() => onToggle(task.id)}
        aria-label={isCompleted ? "Mark pending" : "Mark completed"}
      >
        {isCompleted ? (
          <CheckCircle2 className="check-icon checked" size={20} strokeWidth={2.5} />
        ) : (
          <Circle className="check-icon" size={20} strokeWidth={2} />
        )}
      </button>

      <div className="task-texts">
        {editing ? (
          <input
            className="task-title-input"
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => { if (e.key === 'Enter') saveTitle(); }}
            autoFocus
          />
        ) : (
          <div
            className="task-title"
            onDoubleClick={startEdit}
            onTouchEnd={() => {
              const now = Date.now();
              if (now - lastTapAt < 300) startEdit();
              setLastTapAt(now);
            }}
          >
            {displayTitle}
          </div>
        )}
        <div className="task-raw">{task.raw}</div>
        <div className="task-meta">
          <span className="task-meta-item">{timeStr}</span>
          {renderMeta && renderMeta()}
          {showTimeEditor && (
            <input
              className="task-inline-time"
              type="time"
              value={task.due_time || ''}
              onChange={(e) => onUpdateDueTime(task.id, e.target.value)}
              onBlur={() => setShowTimeEditor(false)}
              autoFocus
            />
          )}
        </div>
      </div>

      <div className="task-controls">
        <button
          type="button"
          className={`control-btn magnetic-btn ${task.is_pinned ? 'pin-active' : ''}`}
          onClick={() => onTogglePin(task.id)}
          aria-label={task.is_pinned ? 'Unpin' : 'Pin'}
        >
          <Pin size={16} strokeWidth={2} />
        </button>

        <button 
          type="button" 
          className="control-btn magnetic-btn" 
          onClick={() => setShowTimeEditor((s) => !s)}
          aria-label="Set due time"
        >
          <Clock3 size={16} strokeWidth={2} />
        </button>

        <button 
          type="button" 
          className="control-btn delete-btn magnetic-btn" 
          onClick={() => onDelete(task.id)}
          aria-label="Delete task"
        >
          <Trash2 size={16} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}


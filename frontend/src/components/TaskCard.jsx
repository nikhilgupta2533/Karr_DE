import { useEffect, useState, useRef } from 'react';
import {
  Trash2, CheckCircle2, Circle, Pin, Clock3,
  Pencil, X, ChevronDown, ChevronUp, Sparkles
} from 'lucide-react';
import './TaskCard.css';

const CATEGORIES = ['Personal','Work','Health','Home'];
const PRIORITIES  = ['low','medium','high'];

function parseSubtasks(raw) {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

export function TaskCard({
  task, onToggle, onDelete, onTogglePin,
  onUpdateTitle, onUpdateDueTime, onUpdateTask,
  onAIRewrite, soundFns, renderMeta,
}) {
  const [editing,       setEditing]       = useState(false);
  const [draftTitle,    setDraftTitle]    = useState(task.title || '');
  const [showTimeEditor,setShowTimeEditor]= useState(false);
  const [lastTapAt,     setLastTapAt]     = useState(0);
  const [showSubtasks,  setShowSubtasks]  = useState(false);
  const [aiLoading,     setAiLoading]     = useState(false);

  // Inline edit draft state
  const [editDraft, setEditDraft] = useState({
    title: '', category: 'Personal', priority: 'medium',
    recurrence: 'none', due_time: '',
  });

  useEffect(() => {
    if (!editing) setDraftTitle(task.title || '');
  }, [task.title, editing]);

  const subtasks = parseSubtasks(task.subtasks);
  const subtaskDone = subtasks.filter(s => s.done).length;

  const d = task.addedAt ? new Date(task.addedAt) : new Date();
  const isValidDate = !isNaN(d.getTime());
  const timeStr = isValidDate
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Unknown time';

  if (task.loading) {
    return (
      <div className="task-card loading glass-panel">
        <div className="skeleton-block">
          <div className="skeleton-line" style={{ height:'24px', width:'70%', borderRadius:'8px' }}></div>
          <div className="skeleton-line" style={{ height:'14px', width:'40%', borderRadius:'6px' }}></div>
        </div>
      </div>
    );
  }

  const isCompleted = task.status === 'completed';
  const isMissed    = task.status === 'missed';
  const canEdit     = !isCompleted && !isMissed;
  const displayTitle = task.title || 'Processing Flow...';

  const cleanTitleOnly = (v) => (v || '').replace(/^[^\w\s]+\s*/, '').trim();
  const getEmojiPrefix = (v) => {
    const parts = (v || '').trim().split(' ');
    if (!parts.length) return '';
    try { return /\p{Emoji}/u.test(parts[0]) ? parts[0] : ''; }
    catch { const m = parts[0]; return m && m.length <= 4 ? m : ''; }
  };

  // ── Quick title save (double-click) ───────────────────────────────────────
  const saveTitle = () => {
    const trimmed = cleanTitleOnly(draftTitle || '');
    if (!trimmed) { setDraftTitle(displayTitle); setEditing(false); return; }
    const emoji = getEmojiPrefix(displayTitle);
    onUpdateTitle(task.id, `${emoji ? `${emoji} ` : ''}${trimmed}`);
    setEditing(false);
  };
  const startQuickEdit = () => {
    setDraftTitle(cleanTitleOnly(displayTitle));
    setEditing(true);
  };

  // ── Full inline editor ────────────────────────────────────────────────────
  const openFullEdit = () => {
    setEditDraft({
      title:      cleanTitleOnly(displayTitle),
      category:   task.category   || 'Personal',
      priority:   task.priority   || 'medium',
      recurrence: task.recurrence || 'none',
      due_time:   task.due_time   || '',
    });
    setEditing('full');
  };

  const saveFullEdit = async () => {
    const fields = {
      title:     editDraft.title.trim() || displayTitle,
      category:  editDraft.category,
      priority:  editDraft.priority,
      recurrence: editDraft.recurrence === 'none' ? null : editDraft.recurrence,
      due_time:  editDraft.due_time || null,
    };
    // Add emoji back
    const emoji = getEmojiPrefix(displayTitle);
    if (emoji && !fields.title.startsWith(emoji)) {
      fields.title = `${emoji} ${fields.title}`;
    }
    setEditing(false);
    await onUpdateTask?.(task.id, fields);
  };

  const handleAIRewrite = async () => {
    if (!editDraft.title.trim()) return;
    setAiLoading(true);
    try {
      const res = await onAIRewrite?.(editDraft.title);
      if (res) setEditDraft(d => ({ ...d, title: res }));
    } finally {
      setAiLoading(false);
    }
  };

  // ── Subtask toggle ────────────────────────────────────────────────────────
  const toggleSubtask = (idx) => {
    const updated = subtasks.map((s, i) => i === idx ? { ...s, done: !s.done } : s);
    if (!updated[idx].done === false) {
      soundFns?.playSubtaskTick?.();
    } else {
      soundFns?.playSubtaskTick?.();
    }
    onUpdateTask?.(task.id, { subtasks: JSON.stringify(updated) });
  };

  // ─── Full edit form ───────────────────────────────────────────────────────
  if (editing === 'full' && canEdit) {
    return (
      <div className="task-card task-card--editing glass-panel">
        <div className="edit-form">
          <div className="edit-form-row">
            <input
              className="edit-title-input"
              value={editDraft.title}
              onChange={e => setEditDraft(d => ({ ...d, title: e.target.value }))}
              placeholder="Task title..."
              autoFocus
            />
            <button
              type="button"
              className="edit-ai-btn magnetic-btn"
              onClick={handleAIRewrite}
              disabled={aiLoading || !editDraft.title.trim()}
              title="AI Rewrite"
            >
              <Sparkles size={14} />
              {aiLoading ? '...' : 'AI'}
            </button>
          </div>
          <div className="edit-form-row edit-form-selects">
            <select
              className="edit-select"
              value={editDraft.category}
              onChange={e => setEditDraft(d => ({ ...d, category: e.target.value }))}
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select
              className="edit-select"
              value={editDraft.priority}
              onChange={e => setEditDraft(d => ({ ...d, priority: e.target.value }))}
            >
              {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>)}
            </select>
            <select
              className="edit-select"
              value={editDraft.recurrence}
              onChange={e => setEditDraft(d => ({ ...d, recurrence: e.target.value }))}
            >
              <option value="none">Once</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div className="edit-form-row">
            <label className="edit-time-label">
              <Clock3 size={12} /> Due time
            </label>
            <input
              type="time"
              className="edit-time-input"
              value={editDraft.due_time}
              onChange={e => setEditDraft(d => ({ ...d, due_time: e.target.value }))}
            />
          </div>
          <div className="edit-form-actions">
            <button type="button" className="edit-save-btn magnetic-btn" onClick={saveFullEdit}>
              Save
            </button>
            <button type="button" className="edit-cancel-btn magnetic-btn" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`task-card ${isCompleted ? 'completed' : ''} ${isMissed ? 'missed' : ''} ${task.is_pinned ? 'pinned' : ''}`}>
      <button
        type="button"
        className="check-btn magnetic-btn"
        onClick={() => onToggle(task.id)}
        aria-label={isCompleted ? 'Mark pending' : 'Mark completed'}
      >
        {isCompleted
          ? <CheckCircle2 className="check-icon checked" size={20} strokeWidth={2.5} />
          : <Circle className="check-icon" size={20} strokeWidth={2} />}
      </button>

      <div className="task-texts">
        {editing === true ? (
          <input
            className="task-title-input"
            value={draftTitle}
            onChange={e => setDraftTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditing(false); }}
            autoFocus
          />
        ) : (
          <div
            className="task-title"
            onDoubleClick={canEdit ? startQuickEdit : undefined}
            onTouchEnd={() => {
              const now = Date.now();
              if (now - lastTapAt < 300 && canEdit) startQuickEdit();
              setLastTapAt(now);
            }}
          >
            {displayTitle}
            {task.ai_planned && <span className="ai-planned-badge">AI ✦</span>}
          </div>
        )}

        {task.raw && task.title && task.raw !== task.title && (
          <div className="task-raw">{task.raw}</div>
        )}

        {/* Subtask progress bar */}
        {subtasks.length > 0 && (
          <div className="subtask-progress-row">
            <div className="subtask-progress-bar">
              <div
                className="subtask-progress-fill"
                style={{ width: `${(subtaskDone / subtasks.length) * 100}%` }}
              />
            </div>
            <button
              type="button"
              className="subtask-toggle-btn"
              onClick={() => setShowSubtasks(s => !s)}
            >
              {subtaskDone}/{subtasks.length}
              {showSubtasks ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            </button>
          </div>
        )}

        {showSubtasks && subtasks.length > 0 && (
          <div className="subtask-list">
            {subtasks.map((s, i) => (
              <label key={i} className={`subtask-item ${s.done ? 'subtask-done' : ''}`}>
                <input
                  type="checkbox"
                  checked={!!s.done}
                  onChange={() => toggleSubtask(i)}
                  className="subtask-checkbox"
                />
                <span>{s.text || s}</span>
              </label>
            ))}
          </div>
        )}

        <div className="task-meta">
          <span className="task-meta-item">{timeStr}</span>
          {renderMeta && renderMeta()}
          {showTimeEditor && (
            <input
              className="task-inline-time"
              type="time"
              value={task.due_time || ''}
              onChange={e => onUpdateDueTime(task.id, e.target.value)}
              onBlur={() => setShowTimeEditor(false)}
              autoFocus
            />
          )}
        </div>
      </div>

      <div className="task-controls">
        {/* Edit icon — hidden for completed/missed */}
        {canEdit && (
          <button
            type="button"
            className="control-btn magnetic-btn"
            onClick={openFullEdit}
            aria-label="Edit task"
          >
            <Pencil size={16} strokeWidth={2} />
          </button>
        )}

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
          onClick={() => setShowTimeEditor(s => !s)}
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

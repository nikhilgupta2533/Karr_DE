import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Plus, Trash2, Check, X, FolderPlus, ChevronLeft,
  Sparkles, CalendarDays, Loader2, Pencil
} from 'lucide-react';
import { useNotes } from '../hooks/useNotes';
import { useAuth } from '../hooks/useAuth';
import './PlanTab.css';

// ── Constants ──────────────────────────────────────────────────────────────────
const API_BASE     = (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '');
const FOLDER_COLORS= ['#00D4FF','#7B61FF','#FF6B6B','#00FF9D','#FFB347','#FF69B4','#00CED1','#E040FB'];
const EMOJI_LIST   = ['💡','🚀','🎯','🔥','📝','🌙','🌈','⚡','🎨','🧠','💪','🌟','🏆','📚','🎭','💼','🌿','💎'];
const getColor     = (i) => FOLDER_COLORS[(i ?? 0) % FOLDER_COLORS.length];

const YYYY_MM_DD   = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const fmtDate      = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { weekday:'short', month:'short', day:'numeric' });
const timeAgo      = (iso) => {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

// ── FolderCard ─────────────────────────────────────────────────────────────────
function FolderCard({ folder, noteCount, colorIdx, onClick, onDelete, onRename }) {
  const color = getColor(colorIdx);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(folder.name);
  const inputRef = useRef(null);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const commit = (e) => {
    e.stopPropagation();
    if (draft.trim()) onRename(folder.id, draft.trim());
    setEditing(false);
  };

  return (
    <div className="folder-card glass-panel" onClick={() => !editing && onClick()} style={{ '--fc': color }}>
      <div className="fc-icon" style={{ background: color }}>{folder.emoji}</div>
      <div className="fc-body">
        {editing ? (
          <input
            ref={inputRef}
            className="fc-rename-input"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={e => { if (e.key === 'Enter') commit(e); if (e.key === 'Escape') { setEditing(false); setDraft(folder.name); } }}
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <h4 className="fc-name">{folder.name}</h4>
        )}
        <span className="fc-meta">{noteCount} {noteCount === 1 ? 'note' : 'notes'}</span>
      </div>
      <div className="fc-actions">
        <button className="fc-btn" title="Rename" onClick={e => { e.stopPropagation(); setEditing(true); setDraft(folder.name); }}>
          <Pencil size={13} />
        </button>
        <button className="fc-btn fc-del" title="Delete folder" onClick={e => { e.stopPropagation(); onDelete(folder.id); }}>
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

// ── NoteCard ──────────────────────────────────────────────────────────────────
function NoteCard({ note, folderColor, onClick, onDelete }) {
  const scheduled = (note.scheduled || []).length > 0;
  const last      = scheduled ? note.scheduled[note.scheduled.length - 1] : null;

  return (
    <div
      className={`note-card glass-panel ${scheduled ? 'note-card--scheduled' : ''}`}
      style={{ '--fc': folderColor }}
      onClick={onClick}
    >
      {scheduled && (
        <div className="note-scheduled-pill">
          <CalendarDays size={10} />
          <span>Scheduled · {fmtDate(last.date)}</span>
        </div>
      )}
      <h4 className="note-card-title">{note.title || 'Untitled Note'}</h4>
      <p className="note-card-preview">{(note.body || '').trim().slice(0, 100) || 'Empty note...'}</p>
      <div className="note-card-meta">
        <span>{timeAgo(note.updatedAt || note.createdAt)}</span>
        <button className="note-del-btn" onClick={e => { e.stopPropagation(); onDelete(note.id); }}>
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

// ── NoteEditor (full-screen overlay) ─────────────────────────────────────────
function NoteEditor({ note, folderColor, onClose, onSave, onAiTitle, onCreateTask }) {
  const [title, setTitle]       = useState(note.title || '');
  const [body,  setBody]        = useState(note.body  || '');
  const [schedState, setSchedState] = useState(null);
  // null | 'loading' | { suggestedTitle, editedTitle, date, saving }

  const textareaRef = useRef(null);
  const autoSaveRef = useRef(null);

  // Focus body on open
  useEffect(() => { textareaRef.current?.focus(); }, []);

  // ESC to save & close
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') handleSaveAndClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  });

  // Auto-save debounce
  const triggerAutoSave = (newTitle, newBody) => {
    clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => {
      onSave({ ...note, title: newTitle.trim() || 'Untitled Note', body: newBody });
    }, 1200);
  };

  const handleTitleChange = (e) => {
    setTitle(e.target.value);
    triggerAutoSave(e.target.value, body);
  };

  const handleBodyChange  = (e) => {
    setBody(e.target.value);
    triggerAutoSave(title, e.target.value);
    // auto-resize
    const el = textareaRef.current;
    if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
  };

  const buildUpdated = () => ({
    ...note,
    title: title.trim() || 'Untitled Note',
    body,
  });

  const handleSaveAndClose = () => {
    clearTimeout(autoSaveRef.current);
    onSave(buildUpdated());
    onClose();
  };

  // AI Schedule step 1: get title
  const handleAiSchedule = async () => {
    if (!body.trim() && !title.trim()) return;
    setSchedState('loading');
    try {
      const aiTitle = await onAiTitle(title || 'My Note', body);
      setSchedState({
        suggestedTitle: aiTitle,
        editedTitle: aiTitle,
        date: YYYY_MM_DD(new Date(Date.now() + 86400000)), // default: tomorrow
        saving: false,
      });
    } catch {
      setSchedState(null);
      alert('AI is busy right now. Try again!');
    }
  };

  // AI Schedule step 2: confirm → create task → badge note
  const handleConfirmSchedule = async () => {
    if (!schedState || schedState === 'loading') return;
    const { editedTitle, date } = schedState;
    if (!editedTitle.trim() || !date) return;
    setSchedState(s => ({ ...s, saving: true }));

    await onCreateTask({ title: editedTitle, date });

    const entry = { date, taskTitle: editedTitle, scheduledAt: new Date().toISOString() };
    const updated = {
      ...buildUpdated(),
      scheduled: [...(note.scheduled || []), entry],
    };
    onSave(updated);
    setSchedState(null);
  };

  const isLoading   = schedState === 'loading';
  const hasForm     = schedState && schedState !== 'loading';
  const canSchedule = !isLoading && !hasForm && (!!body.trim() || !!title.trim());

  return (
    <div className="note-editor-overlay" onClick={e => e.target === e.currentTarget && handleSaveAndClose()}>
      <div className="note-editor glass-panel" style={{ '--fc': folderColor }}>

        {/* Top bar */}
        <div className="ne-topbar">
          <button className="ne-back magnetic-btn" onClick={handleSaveAndClose}>
            <ChevronLeft size={18} /> Save &amp; Close
          </button>
          {(note.scheduled || []).length > 0 && (
            <span className="ne-sched-count-badge">
              <CalendarDays size={11} /> {note.scheduled.length} scheduled
            </span>
          )}
        </div>

        {/* Colour accent */}
        <div className="ne-accent" style={{ background: folderColor }} />

        {/* Title */}
        <input
          className="ne-title-input"
          value={title}
          onChange={handleTitleChange}
          placeholder="Note title..."
        />

        {/* Body — Caveat handwriting font */}
        <textarea
          ref={textareaRef}
          className="ne-body-textarea"
          value={body}
          onChange={handleBodyChange}
          placeholder="Write your ideas, plans, thoughts freely… ✍️"
        />

        {/* Past scheduled badges */}
        {(note.scheduled || []).length > 0 && (
          <div className="ne-scheduled-list">
            {note.scheduled.map((s, i) => (
              <span key={i} className="ne-scheduled-badge">
                <CalendarDays size={10} /> {s.taskTitle} · {fmtDate(s.date)}
              </span>
            ))}
          </div>
        )}

        {/* AI Schedule form */}
        {hasForm && (
          <div className="ne-schedule-form">
            <p className="ne-sched-label">✨ AI suggested task title — edit if needed</p>
            <input
              className="ne-sched-title-input"
              value={schedState.editedTitle}
              onChange={e => setSchedState(s => ({ ...s, editedTitle: e.target.value }))}
              placeholder="Task title..."
            />
            <div className="ne-sched-date-row">
              <label>📅 Schedule for:</label>
              <input
                type="date"
                className="ne-sched-date"
                value={schedState.date}
                min={YYYY_MM_DD(new Date())}
                onChange={e => setSchedState(s => ({ ...s, date: e.target.value }))}
              />
            </div>
            <div className="ne-sched-actions">
              <button
                className="ne-sched-confirm magnetic-btn"
                onClick={handleConfirmSchedule}
                disabled={schedState.saving}
              >
                {schedState.saving
                  ? <><Loader2 size={14} className="spin" /> Scheduling...</>
                  : <><Check size={14} /> Confirm Schedule</>
                }
              </button>
              <button className="ne-sched-cancel" onClick={() => setSchedState(null)}>
                <X size={14} /> Cancel
              </button>
            </div>
          </div>
        )}

        {/* Bottom bar */}
        <div className="ne-bottombar">
          <button
            className={`ne-ai-btn magnetic-btn ${isLoading ? 'loading' : ''}`}
            onClick={handleAiSchedule}
            disabled={!canSchedule}
            title="AI will read your note and suggest a task title to schedule"
          >
            {isLoading
              ? <><Loader2 size={15} className="spin" /> Thinking...</>
              : <><Sparkles size={15} /> AI Schedule</>
            }
          </button>
          <button className="ne-save-btn magnetic-btn" onClick={handleSaveAndClose}>
            <Check size={15} /> Done
          </button>
        </div>

      </div>
    </div>
  );
}

// ── Main PlanTab ──────────────────────────────────────────────────────────────
export function PlanTab({ onAddTask }) {
  const { getFreshToken } = useAuth();
  const { folders, notes, synced, createFolder, deleteFolder, renameFolder, createNote, updateNote, deleteNote } = useNotes();

  const [activeFolderId, setActiveFolderId] = useState(null);
  const [editingNote,    setEditingNote]     = useState(null);

  // New folder form
  const [showNewFolder, setShowNewFolder]   = useState(false);
  const [newName,  setNewName]   = useState('');
  const [newEmoji, setNewEmoji]  = useState('💡');
  const nameInputRef = useRef(null);

  useEffect(() => { if (showNewFolder) nameInputRef.current?.focus(); }, [showNewFolder]);

  // ── Folder actions ──────────────────────────────────────────────────────────
  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const folder = await createFolder({ name: newName.trim(), emoji: newEmoji });
    setNewName(''); setNewEmoji('💡'); setShowNewFolder(false);
    setActiveFolderId(folder.id);
  };

  const handleDeleteFolder = (id) => {
    if (!window.confirm('Delete this folder and all its notes?')) return;
    if (activeFolderId === id) setActiveFolderId(null);
    deleteFolder(id);
  };

  const handleRenameFolder = (id, newFolderName) => {
    renameFolder(id, newFolderName);
  };

  // ── Note actions ────────────────────────────────────────────────────────────
  const handleCreateNote = async () => {
    const note = await createNote(activeFolderId);
    setEditingNote(note);
  };

  const handleSaveNote = (updated) => {
    updateNote(updated);
    // Keep editingNote in sync with updated version
    setEditingNote(prev => prev?.id === updated.id ? { ...prev, ...updated } : prev);
  };

  const handleDeleteNote = (id) => {
    if (!window.confirm('Delete this note?')) return;
    deleteNote(id);
    if (editingNote?.id === id) setEditingNote(null);
  };

  // ── AI helpers ───────────────────────────────────────────────────────────────
  const handleAiTitle = useCallback(async (noteTitle, noteBody) => {
    const token = await getFreshToken();
    const apiUrl = API_BASE ? `${API_BASE}/api/tasks/note-to-task` : '/api/tasks/note-to-task';
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ note_title: noteTitle, note_body: noteBody }),
    });
    if (!res.ok) throw new Error('AI failed');
    const data = await res.json();
    return data.title;
  }, [getFreshToken]);

  const handleCreateTask = useCallback(async ({ title, date }) => {
    const iso = new Date(`${date}T09:00:00`).toISOString();
    await onAddTask(title, {
      category: 'Personal',
      skip_ai: true,
      skip_duplicate_check: true,
      addedAt: iso,
    });
  }, [onAddTask]);

  // ── Derived ──────────────────────────────────────────────────────────────────
  const activeFolder    = folders.find(f => f.id === activeFolderId);
  const activeFolderIdx = folders.findIndex(f => f.id === activeFolderId);
  const folderNotes     = notes.filter(n => n.folderId === activeFolderId)
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
  const noteCount       = (id) => notes.filter(n => n.folderId === id).length;
  const folderColor     = getColor(activeFolderIdx);

  return (
    <div className="plan-tab-content">

      {/* ── Note editor overlay ── */}
      {editingNote && (
        <NoteEditor
          note={editingNote}
          folderColor={folderColor}
          onClose={() => setEditingNote(null)}
          onSave={handleSaveNote}
          onAiTitle={handleAiTitle}
          onCreateTask={handleCreateTask}
        />
      )}

      {/* ── Folder-view (inside a folder) ── */}
      {activeFolderId ? (
        <>
          {/* Header */}
          <div className="plan-folder-view-header">
            <button className="plan-back-btn magnetic-btn" onClick={() => setActiveFolderId(null)}>
              <ChevronLeft size={20} />
            </button>
            <div className="plan-folder-view-title">
              <span className="pfvt-emoji">{activeFolder?.emoji}</span>
              <h2 className="pfvt-name">{activeFolder?.name}</h2>
            </div>
            <button className="plan-new-note-btn magnetic-btn" onClick={handleCreateNote}>
              <Plus size={17} strokeWidth={2.5} /> New Note
            </button>
          </div>

          {/* Notes */}
          {folderNotes.length === 0 ? (
            <div className="plan-empty-state">
              <div className="plan-empty-icon">📄</div>
              <p className="plan-empty-title">No notes yet</p>
              <p className="plan-empty-hint">Tap <strong>New Note</strong> to start writing your ideas &amp; plans.</p>
              <button className="plan-empty-cta magnetic-btn" onClick={handleCreateNote}>
                <Plus size={15} /> Create First Note
              </button>
            </div>
          ) : (
            <div className="notes-grid">
              {folderNotes.map(note => (
                <NoteCard
                  key={note.id}
                  note={note}
                  folderColor={folderColor}
                  onClick={() => setEditingNote({ ...note })}
                  onDelete={handleDeleteNote}
                />
              ))}
              {/* Quick-add card */}
              <button className="note-add-card" onClick={handleCreateNote}>
                <Plus size={22} /><span>New Note</span>
              </button>
            </div>
          )}
        </>

      ) : (
        /* ── Folders view ── */
        <>
          {/* Hero */}
          <div className="plan-hero glass-panel">
            <div className="plan-hero-left">
              <h2>Ideas &amp; Notes</h2>
              <p>Your private space. Write freely, schedule when ready.</p>
              {synced && <span className="plan-synced-badge">☁️ Synced</span>}
            </div>
            <div className="plan-hero-stat">
              <span className="plan-stat-num">{folders.length}</span>
              <span className="plan-stat-label">folders</span>
            </div>
          </div>

          {/* Grid */}
          <div className="folders-grid">
            {folders.map((folder, idx) => (
              <FolderCard
                key={folder.id}
                folder={folder}
                noteCount={noteCount(folder.id)}
                colorIdx={idx}
                onClick={() => setActiveFolderId(folder.id)}
                onDelete={handleDeleteFolder}
                onRename={handleRenameFolder}
              />
            ))}

            {/* New folder form */}
            {showNewFolder ? (
              <form className="new-folder-form glass-panel" onSubmit={handleCreateFolder}>
                <div className="nff-emoji-row">
                  {EMOJI_LIST.map(em => (
                    <button
                      key={em} type="button"
                      className={`nff-emoji-btn ${newEmoji === em ? 'picked' : ''}`}
                      onClick={() => setNewEmoji(em)}
                    >{em}</button>
                  ))}
                </div>
                <div className="nff-input-row">
                  <span className="nff-emoji-preview">{newEmoji}</span>
                  <input
                    ref={nameInputRef}
                    type="text"
                    className="nff-input"
                    placeholder="Folder name..."
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    maxLength={30}
                  />
                  <button type="submit" className="nff-ok magnetic-btn" disabled={!newName.trim()}>
                    <Check size={16} />
                  </button>
                  <button type="button" className="nff-cancel" onClick={() => { setShowNewFolder(false); setNewName(''); }}>
                    <X size={16} />
                  </button>
                </div>
              </form>
            ) : (
              <button className="folder-add-card" onClick={() => setShowNewFolder(true)}>
                <FolderPlus size={26} />
                <span>New Folder</span>
              </button>
            )}
          </div>

          {/* Completely empty state */}
          {folders.length === 0 && !showNewFolder && (
            <div className="plan-empty-state">
              <div className="plan-empty-icon">🗂️</div>
              <p className="plan-empty-title">No folders yet</p>
              <p className="plan-empty-hint">Create a folder to start organizing your ideas and day-wise plans.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

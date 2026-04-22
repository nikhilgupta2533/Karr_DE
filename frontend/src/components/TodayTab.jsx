import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, Clock3, Crosshair, LayoutTemplate, Repeat, X } from 'lucide-react';
import { TaskCard } from './TaskCard';
import { getYYYYMMDD } from '../hooks/useTasks';
import './TodayTab.css';

const TEMPLATE_OPTIONS = [
  { label: '🌅 Morning Routine', tasks: ['💪 Morning Workout', '🥣 Eat Breakfast', '📋 Plan My Day'] },
  { label: '💼 Work Day', tasks: ['📧 Check Emails', '📝 Top Priority Task', '🔄 EOD Review'] },
  { label: '🏠 Home Reset', tasks: ['🧹 Clean Up', '🛒 Grocery List', '🍳 Cook Dinner'] },
  { label: '😴 Wind Down', tasks: ['📖 Read a Book', '🚿 Shower', '😴 Sleep on Time'] }
];

export function TodayTab({ tasks, onAddTask, onToggleTask, onDeleteTask, onTogglePinTask, onBulkComplete, onUpdateTitle, onAddTemplate, onUpdateDueTime }) {
  const [inputVal, setInputVal] = useState('');
  const [recurrence, setRecurrence] = useState('none');
  const [showDuePicker, setShowDuePicker] = useState(false);
  const [dueTime, setDueTime] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);
  const [zenTime, setZenTime] = useState(1500); // 25 mins in seconds
  const [zenActive, setZenActive] = useState(false);
  const templateRef = useRef(null);
  const timerRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputVal.trim()) return;
    onAddTask(inputVal.trim(), {
      is_recurring: recurrence !== 'none',
      recurrence: recurrence === 'none' ? null : recurrence,
      due_time: dueTime || null
    });
    setInputVal('');
    setRecurrence('none');
    setDueTime('');
  };

  const todayStr = getYYYYMMDD(new Date());
  const displayTasks = tasks.filter(t => 
    t.status !== 'missed' && ((getYYYYMMDD(new Date(t.addedAt)) === todayStr) || t.status === 'pending')
  );

  const pending = displayTasks.filter(t => t.status === 'pending');
  const completed = displayTasks.filter(t => t.status === 'completed');
  
  const orderedTasks = [...pending, ...completed].sort((a, b) => {
    const pinDiff = Number(Boolean(b.is_pinned)) - Number(Boolean(a.is_pinned));
    if (pinDiff !== 0) return pinDiff;
    if (a.status !== b.status) return a.status === 'pending' ? -1 : 1;
    const aTime = a.status === 'completed' ? a.completedAt : a.addedAt;
    const bTime = b.status === 'completed' ? b.completedAt : b.addedAt;
    return new Date(bTime) - new Date(aTime);
  });

  const focusTasks = useMemo(() => orderedTasks.filter((t) => t.status === 'pending'), [orderedTasks]);
  const activeFocusTask = focusTasks[focusIndex] || null;

  useEffect(() => {
    if (zenActive && zenTime > 0) {
      timerRef.current = setInterval(() => setZenTime(t => t - 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [zenActive, zenTime]);

  useEffect(() => {
    if (!focusMode) {
      setZenActive(false);
      setZenTime(1500);
    }
  }, [focusMode]);

  const formatZenTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  useEffect(() => {
    const onEsc = (e) => { if (e.key === 'Escape') setFocusMode(false); };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, []);

  useEffect(() => {
    const closeIfOutside = (event) => {
      if (templateRef.current && !templateRef.current.contains(event.target)) setShowTemplates(false);
    };
    document.addEventListener('mousedown', closeIfOutside);
    return () => document.removeEventListener('mousedown', closeIfOutside);
  }, []);

  const formatTime = (value) => {
    if (!value) return '';
    try {
      const parts = value.split(':');
      if (parts.length < 2) return value;
      const [h, m] = parts;
      const d = new Date();
      d.setHours(Number(h), Number(m));
      if (isNaN(d.getTime())) return value;
      return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } catch {
      return value;
    }
  };

  return (
    <div className="view-content">
      <div className="today-top-actions">
        <button type="button" className="focus-btn magnetic-btn" onClick={() => { setFocusMode(true); setFocusIndex(0); }}>
          <Crosshair size={14} strokeWidth={2.5} /> Focus Mode
        </button>
      </div>

      <form className="input-bar glass-panel" onSubmit={handleSubmit}>
        <input 
          type="text" 
          placeholder="What's next in your flow?" 
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
        />
        
        <div className="input-actions">
          {showDuePicker && (
            <input
              type="time"
              className="due-time-input"
              value={dueTime}
              onChange={(e) => setDueTime(e.target.value)}
            />
          )}
          
          <button 
            type="button" 
            className={`mini-icon-btn magnetic-btn ${showDuePicker ? 'active' : ''}`} 
            onClick={() => setShowDuePicker((s) => !s)}
            title="Set Due Time"
          >
            <Clock3 size={18} />
          </button>

          <select 
            className="recurrence-select magnetic-btn" 
            value={recurrence} 
            onChange={(e) => setRecurrence(e.target.value)}
            title="Set Recurrence"
          >
            <option value="none">Once</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>

          <div className="template-wrap" ref={templateRef} style={{ position: 'relative' }}>
            <button 
              type="button" 
              className={`mini-icon-btn magnetic-btn ${showTemplates ? 'active' : ''}`} 
              onClick={() => setShowTemplates((s) => !s)}
              title="Templates"
            >
              <LayoutTemplate size={18} />
            </button>
            {showTemplates && (
              <div className="templates-pop glass-panel">
                {TEMPLATE_OPTIONS.map((tpl) => (
                  <button key={tpl.label} type="button" onClick={() => { onAddTemplate(tpl.tasks.map(t => ({ title: t }))); setShowTemplates(false); }}>
                    {tpl.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button type="submit" disabled={!inputVal.trim()} className="add-btn magnetic-btn">
            <ArrowUp size={24} strokeWidth={3} />
          </button>
        </div>
      </form>
      
      <div className="task-list">
        {displayTasks.length === 0 ? (
          <div className="empty-state">
            <span className="empty-emoji">🌊</span>
            <p>Your flow is clear. Start something fresh.</p>
          </div>
        ) : (
          orderedTasks.map(t => (
            <TaskCard 
              key={t.id} 
              task={t} 
              onToggle={onToggleTask} 
              onDelete={onDeleteTask} 
              onTogglePin={onTogglePinTask}
              onUpdateTitle={onUpdateTitle}
              onUpdateDueTime={onUpdateDueTime}
              renderMeta={() => (
                <>
                  {t.is_recurring && <span className="task-meta-item"><Repeat size={10} /> {t.recurrence}</span>}
                  {t.due_time && <span className="task-meta-item due-badge">{formatTime(t.due_time)}</span>}
                </>
              )}
            />
          ))
        )}
      </div>

      {pending.filter(t => getYYYYMMDD(new Date(t.addedAt)) === todayStr).length >= 2 && (
        <button type="button" className="bulk-done-btn magnetic-btn" onClick={() => onBulkComplete(pending.map(t => t.id))}>
          Mark Infinite Progress (All Done)
        </button>
      )}

      {focusMode && (
        <div className="focus-overlay">
          <button type="button" className="focus-close magnetic-btn" onClick={() => setFocusMode(false)}><X size={24} /></button>
          
          <div className="zen-timer-wrap">
            <div className={`zen-timer ${zenActive ? 'pulse' : ''}`}>{formatZenTime(zenTime)}</div>
            <button type="button" className="zen-toggle magnetic-btn" onClick={() => setZenActive(!zenActive)}>
              {zenActive ? 'Pause Session' : 'Start Zen'}
            </button>
          </div>

          {!activeFocusTask ? (
            <div className="focus-empty">All objectives achieved. 🎉</div>
          ) : (
            <div className="focus-card">
              <div className="focus-emoji">{(activeFocusTask.title || '').split(' ')[0]}</div>
              <div className="focus-title">{activeFocusTask.title || activeFocusTask.raw}</div>
              <p className="focus-raw">{activeFocusTask.raw}</p>
              <div className="focus-actions">
                <button type="button" className="magnetic-btn" onClick={() => { onToggleTask(activeFocusTask.id); setFocusIndex((i) => i + 1); }}>✓ Complete</button>
                <button type="button" className="magnetic-btn" onClick={() => setFocusIndex((i) => i + 1)}>✗ Defer</button>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}


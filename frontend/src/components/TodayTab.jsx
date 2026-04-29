import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp, Clock3, Crosshair, LayoutTemplate, Repeat, X,
  Sparkles, Map, Loader2, GripVertical, Plus, Trash2, Save
} from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TaskCard } from './TaskCard';
import { getYYYYMMDD } from '../hooks/useTasks';
import './TodayTab.css';

const DEFAULT_TEMPLATES = [
  { id: 't1', label: '📚 Study Session', tasks: ['📖 Read Chapter 1', '📝 Take Notes', '🧠 Review Concepts'] },
  { id: 't2', label: '💪 Workout',        tasks: ['🏃‍♂️ Warm Up', '🏋️‍♂️ Main Exercise', '🧘‍♂️ Stretching'] },
  { id: 't3', label: '🎯 Deep Work',      tasks: ['📵 Phone on DND', '💻 90 Min Focus Block', '🚶‍♂️ 15 Min Walk'] },
];

function SortableTaskItem({ task, isPrimary, index, ...props }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 99 : 'auto',
    position: 'relative'
  };

  return (
    <div ref={setNodeRef} style={style} className={isPrimary ? "primary-task-wrapper" : ""}>
      {isPrimary && <div className="primary-task-label">⭐️ 1 TASK RULE: DO THIS FIRST</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div {...attributes} {...listeners} className="drag-handle" style={{ cursor: 'grab', color: 'var(--text-muted)' }}>
          <GripVertical size={16} />
        </div>
        <div style={{ flex: 1, animationDelay: `${index * 0.05}s`, animation: 'slideUpFade 0.5s var(--ease-soft) both' }}>
          <TaskCard task={task} {...props} />
        </div>
      </div>
    </div>
  );
}

const SUGGESTIONS = [
  "Write report", "Reply to emails", "Read 10 pages", "Meditate 5m", "Workout", "Plan tomorrow"
];

const PRODUCTIVITY_TIPS = [
  "Eat the frog: Do your hardest task first thing in the morning.",
  "Pomodoro technique: Focus for 25 mins, break for 5 mins.",
  "The 2-minute rule: If it takes less than 2 mins, do it now.",
  "Batching: Group similar tasks together to save mental energy."
];

export function TodayTab({
  tasks, onAddTask, onToggleTask, onDeleteTask, onTogglePinTask,
  onBulkComplete, onUpdateTitle, onAddTemplate, onUpdateDueTime,
  onUpdateTask, onDecomposeTask, onPlanDay, onToggleSubtask, soundFns, missedPattern,
}) {
  const [inputVal,       setInputVal]       = useState('');
  const [recurrence,     setRecurrence]     = useState('none');
  const [showDuePicker,  setShowDuePicker]  = useState(false);
  const [dueTime,        setDueTime]        = useState('');
  const [showTemplates,  setShowTemplates]  = useState(false);
  const [focusMode,      setFocusMode]      = useState(false);
  const [focusIndex,     setFocusIndex]     = useState(0);
  const [zenTime,        setZenTime]        = useState(1500);
  const [zenActive,      setZenActive]      = useState(false);

  // Focus Stats
  const [focusStats, setFocusStats] = useState(() => {
    try {
      const saved = localStorage.getItem('karde_focus_stats');
      return saved ? JSON.parse(saved) : { completed: 0, interrupted: 0, score: 100 };
    } catch { return { completed: 0, interrupted: 0, score: 100 }; }
  });
  const [sessionSummary, setSessionSummary] = useState(null); // { timeSpent, tasksCompleted }
  const totalTimeSpentThisSession = useRef(0);
  const tasksCompletedThisSession = useRef(0);

  // Decompose state
  const [decomposing,    setDecomposing]    = useState(false);
  const [decomposeSteps, setDecomposeSteps] = useState([]);     // [{text, checked}]

  // Plan Day state
  const [planning,       setPlanning]       = useState(false);
  const [planData,       setPlanData]       = useState(null);   // { message, plan[] }
  const [plannedIds,     setPlannedIds]     = useState(new Set());

  // Mood Check-in
  const [mood, setMood] = useState(() => localStorage.getItem(`mood_${getYYYYMMDD(new Date())}`) || null);

  const handleMoodSelect = (selectedMood) => {
    setMood(selectedMood);
    localStorage.setItem(`mood_${getYYYYMMDD(new Date())}`, selectedMood);
  };

  const [randomTip] = useState(() => PRODUCTIVITY_TIPS[Math.floor(Math.random() * PRODUCTIVITY_TIPS.length)]);

  const templateRef = useRef(null);
  const timerRef    = useRef(null);

  const [templates, setTemplates] = useState(() => {
    try {
      const saved = localStorage.getItem('karde_templates');
      return saved ? JSON.parse(saved) : DEFAULT_TEMPLATES;
    } catch { return DEFAULT_TEMPLATES; }
  });
  const [editingTemplates, setEditingTemplates] = useState(false);
  const [draftTemplates, setDraftTemplates] = useState([]);

  // DND Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Local task order state for drag & drop
  const [taskOrder, setTaskOrder] = useState([]); // array of task IDs in user-defined order

  const todayStr = getYYYYMMDD(new Date());
  const displayTasks = tasks.filter(t =>
    t.status !== 'missed' &&
    ((getYYYYMMDD(new Date(t.addedAt)) === todayStr) || t.status === 'pending')
  );
  const pending   = displayTasks.filter(t => t.status === 'pending');
  const completed = displayTasks.filter(t => t.status === 'completed');
  
  const orderedTasks = useMemo(() => {
    const base = [...pending, ...completed].sort((a, b) => {
      const pinDiff = Number(Boolean(b.is_pinned)) - Number(Boolean(a.is_pinned));
      if (pinDiff !== 0) return pinDiff;
      if (a.status !== b.status) return a.status === 'pending' ? -1 : 1;
      const aTime = a.status === 'completed' ? a.completedAt : a.addedAt;
      const bTime = b.status === 'completed' ? b.completedAt : b.addedAt;
      return new Date(bTime) - new Date(aTime);
    });

    // If we have a user-defined order, apply it (only for IDs that still exist)
    if (taskOrder.length > 0) {
      const byId = Object.fromEntries(base.map(t => [t.id, t]));
      const ordered = taskOrder.map(id => byId[id]).filter(Boolean);
      const orderedIds = new Set(taskOrder);
      const rest = base.filter(t => !orderedIds.has(t.id));
      return [...ordered, ...rest];
    }
    return base;
  }, [pending, completed, taskOrder]);

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      const currentIds = orderedTasks.map(t => t.id);
      const oldIndex = currentIds.indexOf(active.id);
      const newIndex = currentIds.indexOf(over.id);
      const newOrder = arrayMove(currentIds, oldIndex, newIndex);
      setTaskOrder(newOrder);
    }
  };

  const focusTasks     = useMemo(() => orderedTasks.filter(t => t.status === 'pending'), [orderedTasks]);
  const activeFocusTask = focusTasks[focusIndex] || null;

  // ── Zen timer ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (zenActive && zenTime > 0) {
      timerRef.current = setInterval(() => {
        setZenTime(t => t - 1);
        totalTimeSpentThisSession.current += 1;
      }, 1000);
    } else {
      clearInterval(timerRef.current);
      if (zenActive && zenTime === 0) {
        soundFns?.playZenEnd?.();
        setFocusStats(prev => {
          const newStats = { ...prev, completed: prev.completed + 1, score: Math.min(100, prev.score + 5) };
          localStorage.setItem('karde_focus_stats', JSON.stringify(newStats));
          return newStats;
        });
        setZenActive(false);
      }
    }
    return () => clearInterval(timerRef.current);
  }, [zenActive, zenTime]);

  useEffect(() => {
    if (!focusMode) { setZenActive(false); setZenTime(1500); }
  }, [focusMode]);

  const formatZenTime = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  useEffect(() => {
    const onEsc = (e) => { if (e.key === 'Escape' && focusMode) handleExitFocusMode(); };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [focusMode, zenActive, zenTime, activeFocusTask]);

  const handleExitFocusMode = () => {
    if (zenActive && zenTime < 1500 && zenTime > 0 && activeFocusTask) {
      if (!window.confirm("Task incomplete — are you sure you want to exit? This will affect your focus score.")) return;
      setFocusStats(prev => {
        const newStats = { ...prev, interrupted: prev.interrupted + 1, score: Math.max(0, prev.score - 10) };
        localStorage.setItem('karde_focus_stats', JSON.stringify(newStats));
        return newStats;
      });
    }
    
    if (totalTimeSpentThisSession.current > 60 || tasksCompletedThisSession.current > 0) {
      setSessionSummary({
        timeSpent: totalTimeSpentThisSession.current,
        tasksCompleted: tasksCompletedThisSession.current
      });
    } else {
      setFocusMode(false);
    }
    
    setZenActive(false);
    totalTimeSpentThisSession.current = 0;
    tasksCompletedThisSession.current = 0;
  };

  useEffect(() => {
    const close = (e) => {
      if (templateRef.current && !templateRef.current.contains(e.target)) setShowTemplates(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const formatTime = (value) => {
    if (!value) return '';
    try {
      const [h, m] = value.split(':');
      const d = new Date(); d.setHours(Number(h), Number(m));
      if (isNaN(d.getTime())) return value;
      return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } catch { return value; }
  };



  // ── Show plan button 7AM–10AM auto ────────────────────────────────────────
  const hour = new Date().getHours();
  const showPlanBtn = pending.length >= 3;
  const showPlanAuto = showPlanBtn && hour >= 7 && hour < 10 && !planData;

  // ── AI Decompose ──────────────────────────────────────────────────────────
  const handleDecompose = async () => {
    if (!inputVal.trim() || decomposing) return;
    setDecomposing(true);
    const steps = await onDecomposeTask(inputVal.trim());
    setDecomposing(false);
    if (steps.length > 0) {
      setDecomposeSteps(steps.map(text => ({ text, checked: true })));
    }
  };

  const toggleDecomposeStep = (i) => {
    setDecomposeSteps(prev => prev.map((s, idx) => idx === i ? { ...s, checked: !s.checked } : s));
  };
  const removeDecomposeStep = (i) => {
    setDecomposeSteps(prev => prev.filter((_, idx) => idx !== i));
  };

  // ── Submit form ───────────────────────────────────────────────────────────
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputVal.trim() || decomposing) return;
    const approvedSteps = decomposeSteps.filter(s => s.checked).map(s => ({ text: s.text, done: false }));
    const subtasks = approvedSteps.length > 0 ? JSON.stringify(approvedSteps) : null;
    onAddTask(inputVal.trim(), {
      is_recurring: recurrence !== 'none',
      recurrence:   recurrence === 'none' ? null : recurrence,
      due_time:     dueTime || null,
      subtasks,
      skip_ai: true,
    });
    setInputVal('');
    setRecurrence('none');
    setDueTime('');
    setDecomposeSteps([]);
  };

  // ── AI Plan Day ───────────────────────────────────────────────────────────
  const handlePlanDay = async () => {
    if (planning) return;
    setPlanning(true);
    const result = await onPlanDay(pending);
    setPlanning(false);
    if (result) {
      setPlanData(result);
      setPlannedIds(new Set(result.plan.map(p => p.task_id)));
    }
  };

  // ── AI Rewrite helper (passed into TaskCard) ──────────────────────────────
  const handleAIRewrite = async (title) => {
    try {
      const res = await fetch('/api/tasks/decompose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: `Rewrite this task title cleanly: ${title}` }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.steps?.[0] || null;
    } catch { return null; }
  };

  // ── Toggle with sound ─────────────────────────────────────────────────────
  const handleToggle = (id) => {
    const t = tasks.find(x => x.id === id);
    if (t?.status === 'pending') soundFns?.playComplete?.();
    onToggleTask(id);
  };

  // ── Focus mode jump-to task ───────────────────────────────────────────────
  const jumpToFocusTask = (taskId) => {
    const idx = focusTasks.findIndex(t => t.id === taskId);
    if (idx >= 0) { setFocusIndex(idx); setFocusMode(true); }
  };

  return (
    <div className="view-content">
      {/* Daily Check-In */}
      {!mood ? (
        <div className="daily-checkin glass-panel">
          <h3>How are you feeling today?</h3>
          <div className="mood-buttons">
            <button type="button" className="magnetic-btn mood-btn" onClick={() => handleMoodSelect('Focused')}>🔥 Focused</button>
            <button type="button" className="magnetic-btn mood-btn" onClick={() => handleMoodSelect('Tired')}>🔋 Tired</button>
            <button type="button" className="magnetic-btn mood-btn" onClick={() => handleMoodSelect('Lazy')}>🥱 Lazy</button>
          </div>
        </div>
      ) : (
        <div className="mood-suggestion">
          {mood === 'Focused' && "Great energy today. Tackle the hard tasks first. 🔥"}
          {mood === 'Tired' && "Take it easy today. Focus only on the essential tasks. 🔋"}
          {mood === 'Lazy' && "Break things down into micro-steps. Just start. 🥱"}
        </div>
      )}

      {/* Top actions row */}
      <div className="today-top-actions">
        {showPlanBtn && (
          <button
            type="button"
            className={`plan-btn magnetic-btn ${planData ? 'plan-active' : ''}`}
            onClick={handlePlanDay}
            disabled={planning}
          >
            {planning ? <Loader2 size={14} className="spin-icon" /> : <Map size={14} strokeWidth={2.5} />}
            Plan My Day
          </button>
        )}
        <button
          type="button"
          className="focus-btn magnetic-btn"
          onClick={() => { setFocusMode(true); setFocusIndex(0); }}
        >
          <Crosshair size={14} strokeWidth={2.5} /> Focus Mode
        </button>
      </div>

      {/* AI Plan Card */}
      {planData && (
        <div className="plan-card glass-panel">
          <div className="plan-card-header">
            <span className="plan-card-title">✦ AI Day Plan</span>
            <button
              type="button"
              className="plan-dismiss"
              onClick={() => { setPlanData(null); setPlannedIds(new Set()); }}
            >
              <X size={16} />
            </button>
          </div>
          <p className="plan-message">{planData.message}</p>
          <div className="plan-list">
            {planData.plan.map((item, i) => {
              const t = tasks.find(x => x.id === item.task_id);
              return (
                <div key={item.task_id} className="plan-item">
                  <span className="plan-order">{item.order}</span>
                  <div className="plan-item-body">
                    <div className="plan-item-title">{t?.title || t?.raw || item.task_id}</div>
                    <div className="plan-item-reason">{item.reason}</div>
                  </div>
                  {i === 0 && (
                    <button
                      type="button"
                      className="plan-start-btn magnetic-btn"
                      onClick={() => jumpToFocusTask(item.task_id)}
                    >
                      Start →
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Daily Mood Check-in */}
      {!mood && (
        <div className="mood-checkin glass-panel">
          <p>How is your energy today?</p>
          <div className="mood-options">
            <button type="button" onClick={() => handleMoodSelect('high')} className="magnetic-btn mood-btn--high">🔥 High</button>
            <button type="button" onClick={() => handleMoodSelect('medium')} className="magnetic-btn mood-btn--medium">⚡ Medium</button>
            <button type="button" onClick={() => handleMoodSelect('low')} className="magnetic-btn mood-btn--low">☁️ Low</button>
          </div>
        </div>
      )}

      {/* Input bar */}
      <form className={`input-bar glass-panel${showDuePicker ? ' input-bar--expanded' : ''}`} onSubmit={handleSubmit}>
        <div className="input-row">
          <input
            type="text"
            placeholder="What's next in your flow?"
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
          />
          <div className="input-actions">
            <button
              type="button"
              className={`mini-icon-btn magnetic-btn ${showDuePicker ? 'active' : ''}`}
              onClick={() => setShowDuePicker(s => !s)}
              title="Set Due Time"
            >
              <Clock3 size={18} />
            </button>

            <select
              className="recurrence-select magnetic-btn"
              value={recurrence}
              onChange={e => setRecurrence(e.target.value)}
              title="Set Recurrence"
            >
              <option value="none">Once</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>

            {/* Break it down button */}
            <button
              type="button"
              className={`mini-icon-btn magnetic-btn decompose-btn ${decomposing ? 'active' : ''}`}
              onClick={handleDecompose}
              disabled={!inputVal.trim() || decomposing}
              title="Break it down (AI)"
            >
              {decomposing ? <Loader2 size={16} className="spin-icon" /> : <Sparkles size={16} />}
            </button>

            <div className="template-wrap" ref={templateRef} style={{ position: 'relative' }}>
              <button
                type="button"
                className={`mini-icon-btn magnetic-btn ${showTemplates ? 'active' : ''}`}
                onClick={() => setShowTemplates(s => !s)}
                title="Templates"
              >
                <LayoutTemplate size={18} />
              </button>
              {showTemplates && (
                <div className="templates-pop glass-panel">
                  {templates.map(tpl => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => { onAddTemplate(tpl.tasks.map(t => ({ title: t }))); setShowTemplates(false); }}
                    >
                      {tpl.label}
                    </button>
                  ))}
                  <button type="button" onClick={() => {
                    setDraftTemplates(JSON.parse(JSON.stringify(templates)));
                    setEditingTemplates(true);
                    setShowTemplates(false);
                  }} style={{ color: 'var(--accent-1)', borderTop: '1px solid var(--glass-border)', marginTop: '4px', paddingTop: '8px' }}>
                    + Edit Templates...
                  </button>
                </div>
              )}
            </div>

            <button type="submit" disabled={!inputVal.trim() || decomposing} className="add-btn magnetic-btn">
              <ArrowUp size={24} strokeWidth={3} />
            </button>
          </div>
        </div>

        {/* Time picker — own row so it never pushes the send button off */}
        {showDuePicker && (
          <div className="due-time-row">
            <Clock3 size={13} className="due-time-row-icon" />
            <span className="due-time-row-label">Due time</span>
            <input
              type="time"
              className="due-time-input"
              value={dueTime}
              onChange={e => setDueTime(e.target.value)}
            />
          </div>
        )}
      </form>

      {/* Suggestion Chips */}
      <div className="suggestion-chips">
        {SUGGESTIONS.map(s => (
          <button
            key={s}
            type="button"
            className="suggestion-chip magnetic-btn"
            onClick={() => setInputVal(s)}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Decompose steps preview */}
      {decomposeSteps.length > 0 && (
        <div className="decompose-preview glass-panel">
          <div className="decompose-header">
            <Sparkles size={14} />
            <span>Sub-steps preview — uncheck to remove</span>
          </div>
          {decomposeSteps.map((s, i) => (
            <label key={i} className={`decompose-step ${!s.checked ? 'step-unchecked' : ''}`}>
              <input
                type="checkbox"
                checked={s.checked}
                onChange={() => toggleDecomposeStep(i)}
              />
              <span>{s.text}</span>
              <button type="button" className="step-remove-btn" onClick={() => removeDecomposeStep(i)}>
                <X size={12} />
              </button>
            </label>
          ))}
          <p className="decompose-hint">Submit the form above to create the task with these steps.</p>
        </div>
      )}

      {/* Task list */}
      <div className="task-list">
        {displayTasks.length === 0 ? (
          <div className="empty-state glass-panel">
            <span className="empty-emoji">🌊</span>
            <h3>Start your day in 3 steps</h3>
            <p className="empty-tip">💡 {randomTip}</p>
            <div className="empty-quick-actions">
              <button type="button" className="magnetic-btn" onClick={() => setInputVal('🔥 Important Task: ')}>+ Add important task</button>
              <button type="button" className="magnetic-btn" onClick={() => setInputVal('✅ Small Task: ')}>+ Add small task</button>
              <button type="button" className="magnetic-btn" onClick={() => { setFocusMode(true); setFocusIndex(0); }}>🎯 Start focus session</button>
            </div>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={orderedTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
              {orderedTasks.map((t, index) => {
                const isPrimary = index === 0 && t.status === 'pending';
                return (
                  <SortableTaskItem
                    key={t.id}
                    task={{ ...t, ai_planned: plannedIds.has(t.id) }}
                    isPrimary={isPrimary}
                    index={index}
                    onToggle={handleToggle}
                    onDelete={onDeleteTask}
                    onTogglePin={onTogglePinTask}
                    onUpdateTitle={onUpdateTitle}
                    onUpdateDueTime={onUpdateDueTime}
                    onUpdateTask={onUpdateTask}
                    onAIRewrite={handleAIRewrite}
                    onFocus={jumpToFocusTask}
                    soundFns={soundFns}
                    renderMeta={() => (
                      <>
                        {t.is_recurring && <span className="task-meta-item"><Repeat size={10} /> {t.recurrence}</span>}
                        {t.due_time     && <span className="task-meta-item due-badge">{formatTime(t.due_time)}</span>}
                      </>
                    )}
                  />
                );
              })}
            </SortableContext>
          </DndContext>
        )}
      </div>

      {pending.filter(t => getYYYYMMDD(new Date(t.addedAt)) === todayStr).length >= 2 && (
        <button
          type="button"
          className="bulk-done-btn magnetic-btn"
          onClick={() => onBulkComplete(pending.map(t => t.id))}
        >
          Mark Infinite Progress (All Done)
        </button>
      )}

      {/* Focus Overlay */}
      {focusMode && (
        <div className="focus-overlay">
          {sessionSummary ? (
            <div className="focus-card session-summary-card">
              <h2 className="focus-title">Session Complete</h2>
              <div className="summary-stats">
                <div className="summary-stat">
                  <span>Time Focused</span>
                  <strong>{Math.floor(sessionSummary.timeSpent / 60)}m {sessionSummary.timeSpent % 60}s</strong>
                </div>
                <div className="summary-stat">
                  <span>Tasks Achieved</span>
                  <strong>{sessionSummary.tasksCompleted}</strong>
                </div>
                <div className="summary-stat">
                  <span>Focus Score</span>
                  <strong style={{ color: 'var(--accent-1)' }}>{focusStats.score}</strong>
                </div>
              </div>
              <button
                type="button"
                className="magnetic-btn summary-close-btn"
                onClick={() => { setSessionSummary(null); setFocusMode(false); }}
              >
                Continue
              </button>
            </div>
          ) : (
            <>
              <button type="button" className="focus-close magnetic-btn" onClick={handleExitFocusMode}>
                <X size={24} />
              </button>

              <div className="zen-timer-wrap">
                <div className="zen-progress-ring">
                  <svg viewBox="0 0 100 100">
                    <circle className="zen-ring-bg" cx="50" cy="50" r="46" />
                    <circle 
                      className="zen-ring-fill" 
                      cx="50" cy="50" r="46" 
                      strokeDasharray={`${((1500 - zenTime) / 1500) * 289} 289`} 
                      style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
                    />
                  </svg>
                  <div className={`zen-timer ${zenActive ? 'pulse' : ''}`}>{formatZenTime(zenTime)}</div>
                </div>
                <div className="focus-counter">
                  Task {focusIndex + 1} of {focusTasks.length}
                </div>
                <button
                  type="button"
                  className="zen-toggle magnetic-btn"
                  onClick={() => setZenActive(!zenActive)}
                >
                  {zenActive ? 'Pause Session' : 'Start Zen'}
                </button>
                <div className="focus-score-badge">
                  Score: {focusStats.score} 
                </div>
              </div>

              {!activeFocusTask ? (
                <div className="focus-empty">All objectives achieved. 🎉</div>
              ) : (
                <div className="focus-card">
                  <div className="focus-emoji">{(activeFocusTask.title || '').split(' ')[0]}</div>
                  <div className="focus-title">{activeFocusTask.title || activeFocusTask.raw}</div>
                  <p className="focus-raw">{activeFocusTask.raw}</p>

                  {/* Focus subtasks */}
              {activeFocusTask.subtasks && (() => {
                try {
                  const st = JSON.parse(activeFocusTask.subtasks);
                  if (st.length) return (
                    <div className="focus-subtasks">
                      {st.map((s, i) => (
                        <div 
                          key={i} 
                          className={`focus-subtask-item ${s.done ? 'done' : ''}`}
                          onClick={() => onToggleSubtask(activeFocusTask.id, i)}
                        >
                          <span className="focus-subtask-check">{s.done ? '✓' : '○'}</span>
                          <span className="focus-subtask-text">{s.text || s}</span>
                        </div>
                      ))}
                    </div>
                  );
                } catch {}
                return null;
              })()}

              <div className="focus-actions">
                <button
                  type="button"
                  className="magnetic-btn"
                  onClick={() => {
                    soundFns?.playComplete?.();
                    handleToggle(activeFocusTask.id);
                    tasksCompletedThisSession.current += 1;
                    setFocusIndex(i => i + 1);
                  }}
                >
                  ✓ Complete
                </button>
                <button
                  type="button"
                  className="magnetic-btn"
                  onClick={() => setFocusIndex(i => i + 1)}
                >
                  ✗ Defer
                </button>
              </div>
            </div>
          )}
          </>
          )}
        </div>
      )}

      {/* Edit Templates Modal */}
      {editingTemplates && (
        <div className="modal-overlay">
          <div className="tpl-edit-modal glass-panel">
            <div className="tpl-edit-header">
              <h2>Edit Templates</h2>
              <button type="button" className="modal-close" onClick={() => setEditingTemplates(false)}><X size={20} /></button>
            </div>
            <div className="tpl-list">
              {draftTemplates.map((tpl, ti) => (
                <div key={tpl.id} className="tpl-edit-card glass-panel">
                  <div className="tpl-label-row">
                    <input className="tpl-label-input" value={tpl.label}
                      onChange={e => { const d=[...draftTemplates]; d[ti]={...d[ti],label:e.target.value}; setDraftTemplates(d); }} />
                    <button type="button" className="tpl-del-btn" onClick={() => setDraftTemplates(draftTemplates.filter((_,i)=>i!==ti))}><Trash2 size={14}/></button>
                  </div>
                  <div className="tpl-tasks">
                    {tpl.tasks.map((task, ki) => (
                      <div key={ki} className="tpl-task-row">
                        <input className="tpl-task-input" value={task}
                          onChange={e => { const d=[...draftTemplates]; const tasks=[...d[ti].tasks]; tasks[ki]=e.target.value; d[ti]={...d[ti],tasks}; setDraftTemplates(d); }} />
                        <button type="button" className="tpl-del-btn" onClick={() => { const d=[...draftTemplates]; d[ti]={...d[ti],tasks:d[ti].tasks.filter((_,i)=>i!==ki)}; setDraftTemplates(d); }}><X size={12}/></button>
                      </div>
                    ))}
                    <button type="button" className="tpl-add-task-btn" onClick={() => { const d=[...draftTemplates]; d[ti]={...d[ti],tasks:[...d[ti].tasks,'']}; setDraftTemplates(d); }}><Plus size={12}/> Add step</button>
                  </div>
                </div>
              ))}
              <button type="button" className="tpl-add-btn magnetic-btn" onClick={() => setDraftTemplates([...draftTemplates,{id:`t${Date.now()}`,label:'✨ New Template',tasks:['']}])}>
                <Plus size={14}/> New Template
              </button>
            </div>
            <div className="tpl-edit-footer">
              <button type="button" className="tpl-cancel-btn" onClick={() => setEditingTemplates(false)}>Cancel</button>
              <button type="button" className="tpl-save-btn magnetic-btn" onClick={() => {
                const cleaned = draftTemplates.filter(t=>t.label.trim()).map(t=>({...t,tasks:t.tasks.filter(s=>s.trim())}));
                setTemplates(cleaned);
                localStorage.setItem('karde_templates', JSON.stringify(cleaned));
                setEditingTemplates(false);
              }}><Save size={14}/> Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

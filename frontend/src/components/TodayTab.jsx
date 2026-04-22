import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp, Clock3, Crosshair, LayoutTemplate, Repeat, X,
  Sparkles, Map, Loader2
} from 'lucide-react';
import { TaskCard } from './TaskCard';
import { getYYYYMMDD } from '../hooks/useTasks';
import './TodayTab.css';

const TEMPLATE_OPTIONS = [
  { label: '🌅 Morning Routine', tasks: ['💪 Morning Workout', '🥣 Eat Breakfast', '📋 Plan My Day'] },
  { label: '💼 Work Day',        tasks: ['📧 Check Emails', '📝 Top Priority Task', '🔄 EOD Review'] },
  { label: '🏠 Home Reset',      tasks: ['🧹 Clean Up', '🛒 Grocery List', '🍳 Cook Dinner'] },
  { label: '😴 Wind Down',       tasks: ['📖 Read a Book', '🚿 Shower', '😴 Sleep on Time'] },
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

  // Decompose state
  const [decomposing,    setDecomposing]    = useState(false);
  const [decomposeSteps, setDecomposeSteps] = useState([]);     // [{text, checked}]

  // Plan Day state
  const [planning,       setPlanning]       = useState(false);
  const [planData,       setPlanData]       = useState(null);   // { message, plan[] }
  const [plannedIds,     setPlannedIds]     = useState(new Set());

  const templateRef = useRef(null);
  const timerRef    = useRef(null);

  // ── Zen timer ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (zenActive && zenTime > 0) {
      timerRef.current = setInterval(() => setZenTime(t => t - 1), 1000);
    } else {
      clearInterval(timerRef.current);
      if (zenActive && zenTime === 0) {
        soundFns?.playZenEnd?.();
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
    const onEsc = (e) => { if (e.key === 'Escape') setFocusMode(false); };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, []);

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

  const todayStr = getYYYYMMDD(new Date());
  const displayTasks = tasks.filter(t =>
    t.status !== 'missed' &&
    ((getYYYYMMDD(new Date(t.addedAt)) === todayStr) || t.status === 'pending')
  );
  const pending   = displayTasks.filter(t => t.status === 'pending');
  const completed = displayTasks.filter(t => t.status === 'completed');
  const orderedTasks = [...pending, ...completed].sort((a, b) => {
    const pinDiff = Number(Boolean(b.is_pinned)) - Number(Boolean(a.is_pinned));
    if (pinDiff !== 0) return pinDiff;
    if (a.status !== b.status) return a.status === 'pending' ? -1 : 1;
    const aTime = a.status === 'completed' ? a.completedAt : a.addedAt;
    const bTime = b.status === 'completed' ? b.completedAt : b.addedAt;
    return new Date(bTime) - new Date(aTime);
  });
  const focusTasks     = useMemo(() => orderedTasks.filter(t => t.status === 'pending'), [orderedTasks]);
  const activeFocusTask = focusTasks[focusIndex] || null;

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
    if (!inputVal.trim()) return;
    const approvedSteps = decomposeSteps.filter(s => s.checked).map(s => ({ text: s.text, done: false }));
    const subtasks = approvedSteps.length > 0 ? JSON.stringify(approvedSteps) : null;
    onAddTask(inputVal.trim(), {
      is_recurring: recurrence !== 'none',
      recurrence:   recurrence === 'none' ? null : recurrence,
      due_time:     dueTime || null,
      subtasks,
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
                  {TEMPLATE_OPTIONS.map(tpl => (
                    <button
                      key={tpl.label}
                      type="button"
                      onClick={() => { onAddTemplate(tpl.tasks.map(t => ({ title: t }))); setShowTemplates(false); }}
                    >
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
          <div className="empty-state">
            <span className="empty-emoji">🌊</span>
            <p>Your flow is clear. Start something fresh.</p>
          </div>
        ) : (
          orderedTasks.map(t => (
            <TaskCard
              key={t.id}
              task={{ ...t, ai_planned: plannedIds.has(t.id) }}
              onToggle={handleToggle}
              onDelete={onDeleteTask}
              onTogglePin={onTogglePinTask}
              onUpdateTitle={onUpdateTitle}
              onUpdateDueTime={onUpdateDueTime}
              onUpdateTask={onUpdateTask}
              onAIRewrite={handleAIRewrite}
              soundFns={soundFns}
              renderMeta={() => (
                <>
                  {t.is_recurring && <span className="task-meta-item"><Repeat size={10} /> {t.recurrence}</span>}
                  {t.due_time     && <span className="task-meta-item due-badge">{formatTime(t.due_time)}</span>}
                </>
              )}
            />
          ))
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
          <button type="button" className="focus-close magnetic-btn" onClick={() => setFocusMode(false)}>
            <X size={24} />
          </button>

          <div className="zen-timer-wrap">
            <div className={`zen-timer ${zenActive ? 'pulse' : ''}`}>{formatZenTime(zenTime)}</div>
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
        </div>
      )}
    </div>
  );
}

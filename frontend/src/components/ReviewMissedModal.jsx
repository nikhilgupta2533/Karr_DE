import { useMemo, useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import './ReviewMissedModal.css';

const ACTIONS = [
  { id: 'today', label: 'Do it Today 🔥', sub: 'Move to today\'s list' },
  { id: 'tomorrow', label: 'Do it Tomorrow 🌅', sub: 'Snooze until tomorrow' },
  { id: 'drop', label: 'Drop it 🗑️', sub: 'Accept the loss' },
];

export function ReviewMissedModal({ tasks, updateTask }) {
  const [dismissedIds, setDismissedIds] = useState(() => new Set());
  const [reviewedCount, setReviewedCount] = useState(0);
  const [isBusy, setIsBusy] = useState(false);

  const missedTasks = useMemo(
    () => tasks.filter((t) => t.status === 'missed' && !t.missed_reason && !dismissedIds.has(t.id)),
    [tasks, dismissedIds]
  );
  if (missedTasks.length === 0) return null;

  const currentTask = missedTasks[0];
  const totalCount = reviewedCount + missedTasks.length;

  const handleAction = async (actionId) => {
    if (!currentTask || isBusy) return;
    setIsBusy(true);
    const taskToUpdate = currentTask;
    setDismissedIds(prev => {
      const next = new Set(prev);
      next.add(taskToUpdate.id);
      return next;
    });
    setReviewedCount(c => c + 1);

    if (actionId === 'today') {
      await updateTask(taskToUpdate.id, { 
        status: 'pending', 
        addedAt: new Date().toISOString(),
        missed_reason: 'rescheduled_today' // Mark as reviewed
      });
    } else if (actionId === 'tomorrow') {
      const tmrw = new Date();
      tmrw.setDate(tmrw.getDate() + 1);
      await updateTask(taskToUpdate.id, { 
        status: 'pending', 
        addedAt: tmrw.toISOString(),
        missed_reason: 'rescheduled_tomorrow'
      });
    } else if (actionId === 'drop') {
      await updateTask(taskToUpdate.id, { missed_reason: 'dropped' });
    }
    setIsBusy(false);
  };

  const handleDismissAll = async () => {
    if (isBusy) return;
    setIsBusy(true);
    const remaining = [...missedTasks];
    setDismissedIds(prev => {
      const next = new Set(prev);
      remaining.forEach((t) => next.add(t.id));
      return next;
    });
    setReviewedCount(c => c + remaining.length);
    for (const t of remaining) {
      await updateTask(t.id, { missed_reason: 'skipped_review' });
    }
    setIsBusy(false);
  };

  if (!currentTask) return null;

  return (
    <div className="modal-overlay review-overlay" role="dialog" aria-modal="true" aria-label="Review missed tasks">
      <div className="review-modal-content glass-panel">
        <button
          type="button"
          className="review-modal-close"
          onClick={handleDismissAll}
          disabled={isBusy}
          aria-label="Dismiss all missed tasks"
        >
          <X size={20} />
        </button>

        <div className="review-header">
          <AlertCircle size={28} className="review-icon" />
          <h2 className="review-title">Action Required</h2>
        </div>

        <p className="review-subtitle">
          Task {reviewedCount + 1} of {totalCount} missed yesterday. What's the plan?
        </p>

        <div className="review-task-card glass-panel">
          {currentTask.title || currentTask.raw}
        </div>

        <div className="review-actions-list">
          {ACTIONS.map(a => (
            <button
              key={a.id}
              type="button"
              className="action-btn magnetic-btn"
              onClick={() => handleAction(a.id)}
              disabled={isBusy}
            >
              <span className="action-label">{a.label}</span>
              <span className="action-sub">{a.sub}</span>
            </button>
          ))}
        </div>
        
        <button type="button" className="skip-btn" onClick={handleDismissAll} disabled={isBusy}>
          {isBusy ? 'Saving...' : 'Skip & Dismiss All'}
        </button>
      </div>
    </div>
  );
}

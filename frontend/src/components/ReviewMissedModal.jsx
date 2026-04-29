import { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import './ReviewMissedModal.css';

const ACTIONS = [
  { id: 'today', label: 'Do it Today 🔥', sub: 'Move to today\'s list' },
  { id: 'tomorrow', label: 'Do it Tomorrow 🌅', sub: 'Snooze until tomorrow' },
  { id: 'drop', label: 'Drop it 🗑️', sub: 'Accept the loss' },
];

export function ReviewMissedModal({ tasks, updateTask }) {
  const [missedTasks, setMissedTasks] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    // Find all missed tasks that don't have a reason yet
    const pendingMissed = tasks.filter(t => t.status === 'missed' && !t.missed_reason);
    if (pendingMissed.length > 0) {
      setMissedTasks(pendingMissed);
    } else {
      setMissedTasks([]);
    }
  }, [tasks]);

  if (missedTasks.length === 0) return null;

  const currentTask = missedTasks[currentIndex];

  const handleAction = async (actionId) => {
    const taskToUpdate = currentTask;
    
    // Optimistically move to next
    if (currentIndex < missedTasks.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setMissedTasks([]); // close modal
      setCurrentIndex(0);
    }

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
  };

  const handleDismissAll = async () => {
    // If they skip, we just mark the remaining ones as skipped so they don't get bothered again
    const remaining = missedTasks.slice(currentIndex);
    setMissedTasks([]);
    for (const t of remaining) {
      await updateTask(t.id, { missed_reason: 'skipped_review' });
    }
  };

  if (!currentTask) return null;

  return (
    <div className="modal-overlay">
      <div className="review-modal-content glass-panel">
        <button type="button" className="modal-close" onClick={handleDismissAll}>
          <X size={20} />
        </button>

        <div className="review-header">
          <AlertCircle size={28} className="review-icon" />
          <h2 className="review-title">Action Required</h2>
        </div>

        <p className="review-subtitle">
          Task {currentIndex + 1} of {missedTasks.length} missed yesterday. What's the plan?
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
            >
              <span className="action-label">{a.label}</span>
              <span className="action-sub">{a.sub}</span>
            </button>
          ))}
        </div>
        
        <button type="button" className="skip-btn" onClick={handleDismissAll}>
          Skip & Dismiss All
        </button>
      </div>
    </div>
  );
}

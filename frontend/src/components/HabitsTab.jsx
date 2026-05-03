import { useEffect, useState } from 'react';
import { Flame, Plus, Trash2, Download } from 'lucide-react';
import { getYYYYMMDD } from '../hooks/useTasks';
import './HabitsTab.css';

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function getYYYYMMDD_local(dateObj) {
  return `${dateObj.getFullYear()}-${String(dateObj.getMonth()+1).padStart(2,'0')}-${String(dateObj.getDate()).padStart(2,'0')}`;
}

// Build 52-week heatmap grid (364 days + today = 365 days, padded to full weeks)
function buildHeatmapGrid(logDates) {
  const logSet = new Set(logDates);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Go back 364 days
  const start = new Date(today);
  start.setDate(start.getDate() - 363);

  // Pad to Monday of that week
  const dow = start.getDay(); // 0=Sun
  start.setDate(start.getDate() - dow);

  const cells = [];
  const d = new Date(start);
  while (d <= today) {
    const ds = getYYYYMMDD_local(d);
    const isFuture = d > today;
    cells.push({ date: ds, done: logSet.has(ds), future: isFuture, month: d.getMonth() });
    d.setDate(d.getDate() + 1);
  }

  // Split into weeks (7 rows per column)
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return weeks;
}

function Heatmap({ logDates }) {
  const weeks = buildHeatmapGrid(logDates);
  const [tooltip, setTooltip] = useState(null);

  // Month labels: find first week for each month
  const monthPositions = {};
  weeks.forEach((week, wi) => {
    const firstCell = week[0];
    if (firstCell && !monthPositions[firstCell.month]) {
      monthPositions[firstCell.month] = wi;
    }
  });

  const showTooltip = (e, cell) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({ x: rect.left + rect.width / 2, y: rect.top, date: cell.date, done: cell.done });
  };

  return (
    <div className="heatmap-wrap">
      <div className="heatmap-month-row">
        {weeks.map((_, wi) => {
          const month = Object.keys(monthPositions).find(m => monthPositions[m] === wi);
          return (
            <div key={wi} className="heatmap-month-cell">
              {month !== undefined ? MONTH_LABELS[Number(month)] : ''}
            </div>
          );
        })}
      </div>
      <div className="heatmap-grid" style={{ gridTemplateColumns: `repeat(${weeks.length}, 1fr)` }}>
        {weeks.map((week, wi) =>
          week.map((cell, di) => (
            <div
              key={`${wi}-${di}`}
              className={`heatmap-cell ${cell.done ? 'heatmap-done' : ''} ${cell.future ? 'heatmap-future' : ''}`}
              onMouseEnter={e => showTooltip(e, cell)}
              onMouseLeave={() => setTooltip(null)}
              onTouchStart={e => { e.preventDefault(); showTooltip(e.touches[0] ? { currentTarget: e.currentTarget } : e, cell); }}
              onTouchEnd={() => setTimeout(() => setTooltip(null), 1200)}
            />
          ))
        )}
      </div>
      {tooltip && (
        <div className="heatmap-tooltip" style={{ left: tooltip.x, top: tooltip.y - 40 }}>
          {tooltip.date} — {tooltip.done ? '✓ Done' : '✗ Not done'}
        </div>
      )}
    </div>
  );
}

// CSV export for habits
function downloadHabitsCSV(habits) {
  const dateStr = getYYYYMMDD(new Date());
  const rows = [['Habit Name','Date','Completed']];
  // We only have today's log info here — full export requires heatmap data per habit
  habits.forEach(h => {
    rows.push([h.name, dateStr, h.logged_today ? 'Yes' : 'No']);
  });
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `KarDe_Habits_${dateStr}.csv`; a.click();
  URL.revokeObjectURL(url);
}

export function HabitsTab({ habitsHook }) {
  const { habits, loading, error, fetchHabits, addHabit, removeHabit, logHabit, unlogHabit, fetchHeatmap, updateHabit } = habitsHook;
  const [newIcon, setNewIcon] = useState('⭐');
  const [newName, setNewName] = useState('');
  const [newIdentity, setNewIdentity] = useState('');
  const [newDifficulty, setNewDifficulty] = useState('medium');
  const [heatmapData, setHeatmapData] = useState({}); // habitId → date[]
  const [selectedHabit, setSelectedHabit] = useState(null);

  // FIX: habit edit toggle — track which habit is being edited and its draft values
  const [editingHabit, setEditingHabit] = useState(null); // habit id being edited
  const [editDraft, setEditDraft] = useState({ name: '', identity: '', difficulty: 'medium' });

  const openEdit = (h) => {
    setEditingHabit(h.id);
    setEditDraft({ name: h.name || '', identity: h.identity || '', difficulty: h.difficulty || 'medium' });
  };

  const cancelEdit = () => {
    setEditingHabit(null);
    setEditDraft({ name: '', identity: '', difficulty: 'medium' });
  };

  const saveEdit = async (habitId) => {
    await updateHabit(habitId, {
      name: editDraft.name.trim() || undefined,
      identity: editDraft.identity.trim(),
      difficulty: editDraft.difficulty,
    });
    setEditingHabit(null); // FIX: collapse edit section after saving
  };

  // Load heatmap for selected habit
  useEffect(() => {
    if (!selectedHabit) return;
    if (heatmapData[selectedHabit]) return;
    fetchHeatmap(selectedHabit).then(entries => {
      const dates = entries.filter(e => e.done).map(e => e.date);
      setHeatmapData(prev => ({ ...prev, [selectedHabit]: dates }));
    });
  }, [selectedHabit, heatmapData, fetchHeatmap]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    await addHabit(newName.trim(), newIcon, newIdentity.trim(), newDifficulty);
    setNewName('');
    setNewIcon('⭐');
    setNewIdentity('');
    setNewDifficulty('medium');
  };

  const handleToggle = async (h) => {
    const todayStr = getYYYYMMDD(new Date());
    if (h.logged_today) {
      await unlogHabit(h.id);
      setHeatmapData(prev => {
        if (!prev[h.id]) return prev;
        return { ...prev, [h.id]: prev[h.id].filter(d => d !== todayStr) };
      });
    } else {
      await logHabit(h.id);
      setHeatmapData(prev => {
        const existing = prev[h.id] || [];
        if (existing.includes(todayStr)) return prev;
        return { ...prev, [h.id]: [...existing, todayStr] };
      });
    }
  };

  return (
    <div className="view-content habits-tab">
      <div className="habits-header">
        <div className="habits-title-row">
          <Flame size={20} className="habits-flame" />
          <h2>Habit Tracker</h2>
        </div>
        <button
          type="button"
          className="export-btn-habits magnetic-btn"
          onClick={() => downloadHabitsCSV(habits)}
          title="Export Habits CSV"
        >
          <Download size={14} /> CSV
        </button>
      </div>

      {/* Add habit form */}
      <form className="add-habit-form glass-panel" onSubmit={handleAdd}>
        <div className="add-habit-row">
          <input
            type="text"
            className="habit-icon-input"
            value={newIcon}
            onChange={e => setNewIcon(e.target.value)}
            maxLength={4}
            placeholder="⭐"
          />
          <input
            type="text"
            className="habit-name-input"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="New habit (e.g. Read 10 pages)"
          />
          <button type="submit" className="habit-add-btn magnetic-btn" disabled={!newName.trim()}>
            <Plus size={18} strokeWidth={3} />
          </button>
        </div>
        <div className="add-habit-row add-habit-meta-row">
          <input
            type="text"
            className="habit-identity-input"
            value={newIdentity}
            onChange={e => setNewIdentity(e.target.value)}
            placeholder="Identity (e.g. A Reader)"
          />
          <select 
            className="habit-difficulty-select"
            value={newDifficulty}
            onChange={e => setNewDifficulty(e.target.value)}
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
      </form>

      {/* Error/loading state */}
      {loading && <div className="habits-loading">Loading habits...</div>}
      {error   && <div className="habits-error">{error}</div>}

      {/* Habit cards */}
      {!loading && habits.length === 0 && (
        <div className="habits-empty">
          <span style={{ fontSize: '48px' }}>🔥</span>
          <p>Start your first habit above</p>
        </div>
      )}

      <div className="habits-list">
        {habits.map(h => {
          // Streak risk: missed 2+ days or 1 day and not yet logged today
          const isAtRisk = h.missed_days >= 1 && !h.logged_today;

          return (
          <div key={h.id} className={`habit-card glass-panel ${h.logged_today ? 'habit-done' : ''}`}>
            <div className="habit-card-left">
              <span className="habit-icon">{h.icon || '⭐'}</span>
              <div className="habit-info">
                <div className="habit-name">{h.name}</div>
                {h.identity && <div className="habit-identity">Building: {h.identity}</div>}
                <div className="habit-meta-row">
                  <div className={`habit-streak ${isAtRisk ? 'habit-streak-risk' : ''}`}>
                    <Flame size={12} />
                    {h.streak} day streak
                  </div>
                  <div className={`habit-difficulty diff-${h.difficulty}`}>{h.difficulty}</div>
                </div>
                {isAtRisk && <div className="habit-risk-warning">⚠️ {h.missed_days} day missed! Don't lose the streak!</div>}
              </div>
            </div>
            <div className="habit-card-right">
              <label className="habit-checkbox-label" title={h.logged_today ? 'Undo' : 'Mark done today'}>
                <input
                  type="checkbox"
                  checked={!!h.logged_today}
                  onChange={() => handleToggle(h)}
                  className="habit-checkbox"
                />
                <span className="habit-checkmark">{h.logged_today ? '✓' : '○'}</span>
              </label>
              {/* FIX: habit edit toggle — ▼ now opens inline edit form */}
              <button
                type="button"
                className="habit-heatmap-btn magnetic-btn"
                onClick={() => editingHabit === h.id ? cancelEdit() : openEdit(h)}
                title="Edit habit"
              >
                {editingHabit === h.id ? '▲' : '▼'}
              </button>
              <button
                type="button"
                className="habit-heatmap-btn magnetic-btn"
                onClick={() => setSelectedHabit(selectedHabit === h.id ? null : h.id)}
                title="View Heatmap"
                style={{ fontSize: '12px' }}
              >
                {selectedHabit === h.id ? '📊' : '📈'}
              </button>
              <button
                type="button"
                className="habit-delete-btn magnetic-btn"
                onClick={() => removeHabit(h.id)}
                aria-label="Delete habit"
              >
                <Trash2 size={14} />
              </button>
            </div>

            {/* FIX: habit edit toggle — inline edit form shown when editing */}
            {editingHabit === h.id && (
              <div className="habit-edit-inline">
                <div className="habit-edit-row">
                  <input
                    type="text"
                    className="habit-edit-input"
                    value={editDraft.name}
                    onChange={e => setEditDraft(d => ({ ...d, name: e.target.value }))}
                    placeholder="Habit name"
                    autoFocus
                  />
                </div>
                <div className="habit-edit-row">
                  <input
                    type="text"
                    className="habit-edit-input"
                    value={editDraft.identity}
                    onChange={e => setEditDraft(d => ({ ...d, identity: e.target.value }))}
                    placeholder="Identity (e.g. A Reader)"
                  />
                  <select
                    className="habit-difficulty-select"
                    value={editDraft.difficulty}
                    onChange={e => setEditDraft(d => ({ ...d, difficulty: e.target.value }))}
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
                <div className="habit-edit-actions">
                  <button type="button" className="habit-edit-save magnetic-btn" onClick={() => saveEdit(h.id)}>Save</button>
                  <button type="button" className="habit-edit-cancel magnetic-btn" onClick={cancelEdit}>Cancel</button>
                </div>
              </div>
            )}

            {/* Inline heatmap for selected habit */}
            {selectedHabit === h.id && (
              <div className="habit-heatmap-inline">
                <Heatmap logDates={heatmapData[h.id] || []} />
              </div>
            )}
          </div>
          );
        })}
      </div>

      {/* Combined legend */}
      {habits.length > 0 && (
        <div className="heatmap-legend">
          <span className="heatmap-legend-cell" style={{ background: 'var(--bg-glass)' }} />
          <span className="heatmap-legend-label">Not done</span>
          <span className="heatmap-legend-cell heatmap-done" />
          <span className="heatmap-legend-label">Done</span>
        </div>
      )}
    </div>
  );
}

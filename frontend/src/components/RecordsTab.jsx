import { useState } from 'react';
import { getYYYYMMDD } from '../hooks/useTasks';
import { ChevronDown, ChevronRight, Check, X, Clock, Search, Share2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import './RecordsTab.css';

export function RecordsTab({ tasks }) {
  const [expandedDays, setExpandedDays] = useState({});
  const [query, setQuery] = useState('');

  const toggleDay = (dtStr) => setExpandedDays(p => ({ ...p, [dtStr]: !p[dtStr] }));

  // Streaks Calculation
  const days = new Set(tasks.filter(t => t.status === 'completed').map(t => getYYYYMMDD(new Date(t.completedAt))));
  let best = 1, currentSeq = 1;
  const sortedDays = Array.from(days).sort();
  
  if (sortedDays.length === 0) { best = 0; currentSeq = 0; }
  else {
    for (let i = 1; i < sortedDays.length; i++) {
        const diff = Math.round((new Date(sortedDays[i]) - new Date(sortedDays[i-1])) / 86400000);
        if (diff === 1) {
            currentSeq++;
            if (currentSeq > best) best = currentSeq;
        } else if (diff > 1) {
            currentSeq = 1;
        }
    }
  }
  
  const todayStr = getYYYYMMDD(new Date());
  const isSunday = new Date().getDay() === 0;
  let yD = new Date(); yD.setDate(yD.getDate() - 1);
  const yestStr = getYYYYMMDD(yD);
  
  let current = 0;
  let cDateStr = days.has(todayStr) ? todayStr : (days.has(yestStr) ? yestStr : null);
  
  if (cDateStr) {
      current = 1;
      let d = new Date(cDateStr);
      while (true) {
          d.setDate(d.getDate() - 1);
          let pStr = getYYYYMMDD(d);
          if (days.has(pStr)) current++;
          else break;
      }
  }

  // Today's stats
  const completedTotal = tasks.filter(t => t.status === 'completed').length;
  const todaysTasks = tasks.filter(t => getYYYYMMDD(new Date(t.addedAt)) === todayStr);
  const todayCompleted = todaysTasks.filter(t => t.status === 'completed').length;
  const rate = todaysTasks.length ? Math.round((todayCompleted / todaysTasks.length) * 100) : 0;

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 6);
  const weeklyTasks = tasks.filter((t) => new Date(t.addedAt) >= weekStart);
  const weeklyCompleted = weeklyTasks.filter((t) => t.status === 'completed');
  const completedByDay = {};
  weeklyCompleted.forEach((t) => {
    const key = getYYYYMMDD(new Date(t.completedAt || t.addedAt));
    completedByDay[key] = (completedByDay[key] || 0) + 1;
  });
  let bestWeekDay = 'N/A';
  let bestWeekCount = 0;
  Object.entries(completedByDay).forEach(([k, v]) => {
    if (v > bestWeekCount) {
      bestWeekCount = v;
      bestWeekDay = new Date(k).toLocaleDateString('en-US', { weekday: 'long' });
    }
  });
  const missedByCategory = {};
  weeklyTasks.filter((t) => t.status === 'missed').forEach((t) => {
    const k = t.category || 'Personal';
    missedByCategory[k] = (missedByCategory[k] || 0) + 1;
  });
  let mostMissedCategory = 'None';
  let mostMissedCount = 0;
  Object.entries(missedByCategory).forEach(([k, v]) => {
    if (v > mostMissedCount) {
      mostMissedCount = v;
      mostMissedCategory = k;
    }
  });

  // Group History
  const daysMap = {}; 
  const q = query.trim().toLowerCase();
  tasks
    .filter((t) => {
      if (!q) return true;
      const title = (t.title || '').toLowerCase();
      const raw = (t.raw || '').toLowerCase();
      return title.includes(q) || raw.includes(q);
    })
    .forEach(t => {
      const dtStr = getYYYYMMDD(new Date(t.status === 'completed'? t.completedAt : t.addedAt));
      if (!daysMap[dtStr]) daysMap[dtStr] = [];
      daysMap[dtStr].push(t);
    });
  const sortedKeys = Object.keys(daysMap).sort((a,b) => new Date(b) - new Date(a));

  const shareStats = async () => {
    try {
      const node = document.getElementById('records-stats-share');
      if (!node) return;
      const canvas = await html2canvas(node, {
        backgroundColor: '#120d1d',
        scale: 2,
        useCORS: true
      });
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], 'kar-de-stats.png', { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: 'Kar De Stats' });
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'kar-de-stats.png';
        a.click();
        URL.revokeObjectURL(url);
      }, 'image/png');
    } catch {
      // ignore share failures silently
    }
  };

  return (
    <div className="view-content active">
      <div className="records-stats-header">
        <h3>Stats</h3>
        <button type="button" className="share-stats-btn glass-panel" onClick={shareStats}>
          <Share2 size={16} />
          Share
        </button>
      </div>
      {isSunday && (
        <div className="weekly-review-card glass-panel">
          <div className="weekly-title">This Week&apos;s Report 📊</div>
          <div className="weekly-row">Completed: {weeklyCompleted.length}</div>
          <div className="weekly-row">Best day: {bestWeekDay} {bestWeekCount ? `(${bestWeekCount})` : ''}</div>
          <div className="weekly-row">Most missed category: {mostMissedCategory}</div>
          <div className="weekly-row">Streak status: {current} day{current === 1 ? '' : 's'}</div>
        </div>
      )}
      <div className="stats-grid share-bg" id="records-stats-share">
        <div className="stat-card glass-panel">
          <div className="stat-label">Total Done</div>
          <div className="stat-value">{completedTotal}</div>
        </div>
        <div className="stat-card glass-panel">
          <div className="stat-label">Today's Rate</div>
          <div className="stat-value">{todayCompleted}/{todaysTasks.length} <span className="stat-sm">({rate}%)</span></div>
        </div>
        <div className="stat-card glass-panel">
          <div className="stat-label">Current Streak</div>
          <div className="stat-value glow-text-1">{current}</div>
        </div>
        <div className="stat-card glass-panel">
          <div className="stat-label">Best Streak</div>
          <div className="stat-value glow-text-2">{best}</div>
        </div>
      </div>
      <div className="search-wrap glass-panel">
        <Search size={16} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search records..."
          aria-label="Search records"
        />
        {query && <button type="button" className="clear-search-btn" onClick={() => setQuery('')}>X</button>}
      </div>

      <div className="history-list">
        {sortedKeys.length === 0 && (
          <div className="no-results glass-panel">Kuch nahi mila 🙁</div>
        )}
        {sortedKeys.map(dtStr => {
          let label = dtStr === todayStr ? 'Today' : new Date(dtStr).toLocaleDateString('en-US', {weekday:'short', month:'short', day:'numeric'});
          let arr = daysMap[dtStr];
          let compCount = arr.filter(x => x.status === 'completed').length;
          const isExpanded = expandedDays[dtStr] !== false; // default expanded

          return (
            <div key={dtStr} className="day-group">
              <div className="day-header" onClick={() => toggleDay(dtStr)}>
                <div className="day-label-group">
                  {isExpanded ? <ChevronDown size={18} strokeWidth={2.5} /> : <ChevronRight size={18} strokeWidth={2.5} />}
                  <span>{label}</span>
                </div>
                <span className="day-ratio">{compCount}/{arr.length}</span>
              </div>
              
              {isExpanded && (
                <div className="day-tasks">
                  {arr.map(t => {
                    let IconComponent = Clock;
                    let iconClass = 'pending';
                    if (t.status === 'completed') { IconComponent = Check; iconClass = 'completed'; }
                    if (t.status === 'missed') { IconComponent = X; iconClass = 'missed'; }

                    return (
                      <div key={t.id} className="history-task">
                        <IconComponent size={14} className={`history-icon ${iconClass}`} strokeWidth={3} />
                        <span className={t.status === 'completed' ? 'struck' : ''}>
                          {t.title || t.raw}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

      </div>
    </div>
  );
}

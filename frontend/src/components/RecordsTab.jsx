import { useState } from 'react';
import { getYYYYMMDD } from '../hooks/useTasks';
import { ChevronDown, ChevronRight, Check, X, Clock, Search, Share2, Download, FileText } from 'lucide-react';
import html2canvas from 'html2canvas';
import './RecordsTab.css';

// ─── CSV export helpers ───────────────────────────────────────────────────────
function toCSVRow(cells) {
  return cells.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',');
}
function downloadCSV(filename, rows) {
  const csv = rows.map(toCSVRow).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── PDF/Print export ────────────────────────────────────────────────────────
function generatePrintReport({ tasks, current, best, rate, completedTotal, todaysTasks, todayCompleted }) {
  const today = new Date();
  const todayStr = getYYYYMMDD(today);

  // 7-day bar data
  const barData = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const ds = getYYYYMMDD(d);
    const label = d.toLocaleDateString('en-US', { weekday: 'short' });
    const count = tasks.filter(t => t.status === 'completed' && getYYYYMMDD(new Date(t.completedAt)) === ds).length;
    barData.push({ label, count });
  }
  const maxBar = Math.max(...barData.map(b => b.count), 1);

  // Category breakdown
  const cats = { Work: 0, Health: 0, Home: 0, Personal: 0 };
  const catDone = { Work: 0, Health: 0, Home: 0, Personal: 0 };
  tasks.forEach(t => {
    const c = cats[t.category] !== undefined ? t.category : 'Personal';
    cats[c]++;
    if (t.status === 'completed') catDone[c]++;
  });

  // Full task history sorted newest first
  const sorted = [...tasks].sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));

  const html = `
    <div id="karde-print-report" style="display:none; font-family: Georgia, serif; color: var(--text-light); background: var(--bg-body); padding: 40px; max-width: 900px; margin: 0 auto;">
      <h1 style="font-size:32px; margin:0 0 4px;">Kar De — Productivity Report</h1>
      <p style="color:#555; margin:0 0 32px;">Exported: ${today.toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</p>
      <hr style="border:1px solid #eee; margin-bottom:32px;"/>

      <h2 style="font-size:18px; margin:0 0 16px;">Summary Stats</h2>
      <table style="width:100%; border-collapse:collapse; margin-bottom:32px;">
        <tr><td style="padding:8px 0; border-bottom:1px solid #eee; font-weight:bold;">Total Tasks Created</td><td style="border-bottom:1px solid #eee;">${tasks.length}</td></tr>
        <tr><td style="padding:8px 0; border-bottom:1px solid #eee; font-weight:bold;">Total Completed</td><td style="border-bottom:1px solid #eee;">${completedTotal}</td></tr>
        <tr><td style="padding:8px 0; border-bottom:1px solid #eee; font-weight:bold;">Today's Rate</td><td style="border-bottom:1px solid #eee;">${todayCompleted}/${todaysTasks} (${rate}%)</td></tr>
        <tr><td style="padding:8px 0; border-bottom:1px solid #eee; font-weight:bold;">Current Streak</td><td style="border-bottom:1px solid #eee;">${current} day(s)</td></tr>
        <tr><td style="padding:8px 0; font-weight:bold;">Best Streak</td><td>${best} day(s)</td></tr>
      </table>

      <h2 style="font-size:18px; margin:0 0 16px;">7-Day Performance</h2>
      <div style="display:flex; gap:12px; align-items:flex-end; height:120px; margin-bottom:8px;">
        ${barData.map(b => `
          <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:4px;">
            <span style="font-size:11px; color:#333;">${b.count}</span>
            <div style="width:100%; background:linear-gradient(to top,#5c5cff,#00d4ff); border-radius:4px; height:${Math.max(4,(b.count/maxBar)*80)}px;"></div>
            <span style="font-size:10px; color:#777;">${b.label}</span>
          </div>`).join('')}
      </div>
      <hr style="border:1px solid #eee; margin: 32px 0;"/>

      <h2 style="font-size:18px; margin:0 0 16px;">Category Breakdown</h2>
      <table style="width:100%; border-collapse:collapse; margin-bottom:32px;">
        <thead><tr style="background:#f5f5f5;">
          <th style="text-align:left; padding:8px;">Category</th>
          <th style="padding:8px;">Total</th>
          <th style="padding:8px;">Completed</th>
          <th style="padding:8px;">Rate %</th>
        </tr></thead>
        <tbody>
          ${Object.keys(cats).map(k => `
            <tr style="border-bottom:1px solid #eee;">
              <td style="padding:8px;">${k}</td>
              <td style="padding:8px; text-align:center;">${cats[k]}</td>
              <td style="padding:8px; text-align:center;">${catDone[k]}</td>
              <td style="padding:8px; text-align:center;">${cats[k] ? Math.round((catDone[k]/cats[k])*100) : 0}%</td>
            </tr>`).join('')}
        </tbody>
      </table>

      <h2 style="font-size:18px; margin:0 0 16px;">Full Task History</h2>
      <table style="width:100%; border-collapse:collapse; font-size:13px;">
        <thead><tr style="background:#f5f5f5;">
          <th style="text-align:left; padding:6px 8px;">Date</th>
          <th style="padding:6px 8px;">Title</th>
          <th style="padding:6px 8px;">Category</th>
          <th style="padding:6px 8px;">Priority</th>
          <th style="padding:6px 8px;">Status</th>
        </tr></thead>
        <tbody>
          ${sorted.slice(0,200).map(t => `
            <tr style="border-bottom:1px solid #eee;">
              <td style="padding:6px 8px; white-space:nowrap;">${getYYYYMMDD(new Date(t.addedAt))}</td>
              <td style="padding:6px 8px;">${(t.title||t.raw||'').slice(0,60)}</td>
              <td style="padding:6px 8px;">${t.category||'Personal'}</td>
              <td style="padding:6px 8px;">${t.priority||'medium'}</td>
              <td style="padding:6px 8px;">${t.status}</td>
            </tr>`).join('')}
        </tbody>
      </table>
      <p style="margin-top:32px; font-size:11px; color:#aaa; text-align:center;">Kar De • Generated ${today.toISOString()}</p>
    </div>
  `;
  return html;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function RecordsTab({ tasks }) {
  const [expandedDays, setExpandedDays] = useState({});
  const [query, setQuery] = useState('');

  const toggleDay = (dtStr) => setExpandedDays(p => ({ ...p, [dtStr]: !p[dtStr] }));
  const safeDateLabel = (dateLike, fallback = 'Unknown') => {
    const d = new Date(dateLike);
    if (isNaN(d.getTime())) return fallback;
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  // Streak calc
  const days = new Set(tasks.filter(t => t.status === 'completed').map(t => getYYYYMMDD(new Date(t.completedAt))));
  let best = 1, currentSeq = 1;
  const sortedDays = Array.from(days).sort();
  if (sortedDays.length === 0) { best = 0; currentSeq = 0; }
  else {
    for (let i = 1; i < sortedDays.length; i++) {
      const diff = Math.round((new Date(sortedDays[i]) - new Date(sortedDays[i-1])) / 86400000);
      if (diff === 1) { currentSeq++; if (currentSeq > best) best = currentSeq; }
      else if (diff > 1) currentSeq = 1;
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
      const pStr = getYYYYMMDD(d);
      if (days.has(pStr)) current++; else break;
    }
  }

  // Stats
  const completedTotal = tasks.filter(t => t.status === 'completed').length;
  const todaysTasks    = tasks.filter(t => getYYYYMMDD(new Date(t.addedAt)) === todayStr);
  const todayCompleted = todaysTasks.filter(t => t.status === 'completed').length;
  const rate           = todaysTasks.length ? Math.round((todayCompleted / todaysTasks.length) * 100) : 0;

  const yesterdayTasks = tasks.filter(t => getYYYYMMDD(new Date(t.addedAt)) === yestStr);
  const yesterdayCompleted = yesterdayTasks.filter(t => t.status === 'completed').length;
  const yesterdayRate = yesterdayTasks.length ? Math.round((yesterdayCompleted / yesterdayTasks.length) * 100) : 0;

  const rateDiff = rate - yesterdayRate;
  let performanceMsg = "Consistent effort today. Keep it up! 🌊";
  if (rateDiff > 10) performanceMsg = "Great job! You're performing better than yesterday. 🔥";
  else if (rateDiff < -10) performanceMsg = "A slight dip from yesterday. You can bounce back! 💪";
  else if (rate === 100 && rate > 0) performanceMsg = "Perfect day! You crushed everything. 🏆";

  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 6);
  const weeklyTasks     = tasks.filter(t => new Date(t.addedAt) >= weekStart);
  const weeklyCompleted = weeklyTasks.filter(t => t.status === 'completed');
  const completedByDay  = {};
  weeklyCompleted.forEach(t => {
    const key = getYYYYMMDD(new Date(t.completedAt || t.addedAt));
    completedByDay[key] = (completedByDay[key] || 0) + 1;
  });
  let bestWeekDay = 'N/A', bestWeekCount = 0;
  Object.entries(completedByDay).forEach(([k, v]) => {
    if (v > bestWeekCount) { bestWeekCount = v; const d = new Date(k); bestWeekDay = isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString('en-US', { weekday:'long' }); }
  });
  const missedByCategory = {};
  weeklyTasks.filter(t => t.status === 'missed').forEach(t => {
    const k = t.category || 'Personal'; missedByCategory[k] = (missedByCategory[k] || 0) + 1;
  });
  let mostMissedCategory = 'None', mostMissedCount = 0;
  Object.entries(missedByCategory).forEach(([k, v]) => { if (v > mostMissedCount) { mostMissedCount = v; mostMissedCategory = k; } });

  // History groups
  const daysMap = {};
  const q = query.trim().toLowerCase();
  tasks.filter(t => !q || (t.title||'').toLowerCase().includes(q) || (t.raw||'').toLowerCase().includes(q))
    .forEach(t => {
      const dtStr = getYYYYMMDD(new Date(t.status === 'completed' ? t.completedAt : t.addedAt));
      if (!daysMap[dtStr]) daysMap[dtStr] = [];
      daysMap[dtStr].push(t);
    });
  const sortedKeys = Object.keys(daysMap).sort((a, b) => new Date(b) - new Date(a));

  // ── Share stats PNG ───────────────────────────────────────────────────────
  const shareStats = async () => {
    try {
      const node = document.getElementById('records-stats-share');
      if (!node) return;
      const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--bg-body').trim() || '#120d1d';
      const canvas = await html2canvas(node, { backgroundColor: bgColor, scale: 2, useCORS: true });
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], 'kar-de-stats.png', { type:'image/png' });
        if (navigator.canShare?.({ files:[file] })) { await navigator.share({ files:[file], title:'Kar De Stats' }); return; }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'kar-de-stats.png'; a.click();
        URL.revokeObjectURL(url);
      }, 'image/png');
    } catch {}
  };

  // ── CSV export ────────────────────────────────────────────────────────────
  const exportTasksCSV = () => {
    const dateStr = getYYYYMMDD(new Date());
    const headers = ['Task Title','Category','Priority','Status','Created Date','Completed Date','Recurrence','Due Time'];
    const rows = tasks.map(t => [
      t.title || t.raw,
      t.category || 'Personal',
      t.priority || 'medium',
      t.status,
      getYYYYMMDD(new Date(t.addedAt)),
      t.completedAt ? getYYYYMMDD(new Date(t.completedAt)) : '',
      t.recurrence || '',
      t.due_time || '',
    ]);
    downloadCSV(`KarDe_Tasks_${dateStr}.csv`, [headers, ...rows]);
  };

  // ── PDF export ────────────────────────────────────────────────────────────
  const exportPDF = () => {
    const existing = document.getElementById('karde-print-report');
    if (existing) existing.remove();
    const html = generatePrintReport({ tasks, current, best, rate, completedTotal, todaysTasks: todaysTasks.length, todayCompleted });
    document.body.insertAdjacentHTML('beforeend', html);
    const el = document.getElementById('karde-print-report');
    el.style.display = 'block';
    window.print();
    setTimeout(() => { el.style.display = 'none'; }, 1000);
  };

  return (
    <div className="view-content active records-view">
      <div className="records-stats-header">
        <h3>Stats</h3>
        <div className="records-header-actions">
          <button type="button" className="export-btn glass-panel" onClick={exportTasksCSV} title="Export CSV">
            <Download size={15} /> CSV
          </button>
          <button type="button" className="export-btn glass-panel" onClick={exportPDF} title="Export PDF Report">
            <FileText size={15} /> PDF
          </button>
          <button type="button" className="share-stats-btn glass-panel" onClick={shareStats}>
            <Share2 size={16} /> Share
          </button>
        </div>
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

      <div className="stats-message-card glass-panel">
        <h4 className="stats-message-title">Today's Insight</h4>
        <p className="stats-message-text">{performanceMsg}</p>
        <div className="stats-message-details">
          <span>Today: {rate}%</span>
          <span>Yesterday: {yesterdayRate}%</span>
        </div>
      </div>

      <div className="stats-grid share-bg" id="records-stats-share">
        <div className="stat-card glass-panel">
          <div className="stat-label">Current Streak</div>
          <div className="stat-value glow-text-1">{current}</div>
        </div>
        <div className="stat-card glass-panel">
          <div className="stat-label">Best Streak</div>
          <div className="stat-value glow-text-2">{best}</div>
        </div>
        <div className="stat-card glass-panel">
          <div className="stat-label">Total Done</div>
          <div className="stat-value">{completedTotal}</div>
        </div>
      </div>

      <div className="search-wrap glass-panel">
        <Search size={16} />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search records..."
          aria-label="Search records"
        />
        {query && <button type="button" className="clear-search-btn" onClick={() => setQuery('')}>X</button>}
      </div>

      <div className="history-list">
        {sortedKeys.length === 0 && <div className="no-results glass-panel">Kuch nahi mila 🙁</div>}
        {sortedKeys.map(dtStr => {
          const label = dtStr === todayStr ? 'Today' : safeDateLabel(dtStr, dtStr);
          const arr = daysMap[dtStr];
          const compCount = arr.filter(x => x.status === 'completed').length;
          const isExpanded = expandedDays[dtStr] !== false;
          return (
            <div key={dtStr} className="day-group">
              <button
                type="button"
                className="day-header"
                onClick={() => toggleDay(dtStr)}
                aria-expanded={isExpanded}
                aria-label={`Toggle records for ${label}`}
              >
                <div className="day-label-group">
                  {isExpanded ? <ChevronDown size={18} strokeWidth={2.5} /> : <ChevronRight size={18} strokeWidth={2.5} />}
                  <span>{label}</span>
                </div>
                <span className="day-ratio">{compCount}/{arr.length}</span>
              </button>
              {isExpanded && (
                <div className="day-tasks">
                  {arr.map(t => {
                    let IconComponent = Clock, iconClass = 'pending';
                    if (t.status === 'completed') { IconComponent = Check; iconClass = 'completed'; }
                    if (t.status === 'missed')    { IconComponent = X;     iconClass = 'missed'; }
                    return (
                      <div key={t.id} className="history-task">
                        <IconComponent size={14} className={`history-icon ${iconClass}`} strokeWidth={3} />
                        <span className={t.status === 'completed' ? 'struck' : ''}>{t.title || t.raw}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

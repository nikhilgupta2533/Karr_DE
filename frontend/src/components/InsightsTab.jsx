import { useMemo, useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement,
  PointElement, LineElement, ArcElement,
  Tooltip, Filler
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import { getYYYYMMDD } from '../hooks/useTasks';
import {
  TrendingUp, TrendingDown, Zap, Target,
  Award, AlertTriangle, CheckCircle2, Calendar,
  BarChart2, Flame, Star
} from 'lucide-react';
import './InsightsTab.css';

// Hook to watch data-theme attribute changes
function useTheme() {
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'dark');
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(document.documentElement.getAttribute('data-theme') || 'dark');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);
  return theme;
}

ChartJS.register(
  CategoryScale, LinearScale, BarElement,
  PointElement, LineElement, ArcElement,
  Tooltip, Filler
);

// ── helpers ────────────────────────────────────────────────────────────────────
const DAY_NAMES  = ['Sundays','Mondays','Tuesdays','Wednesdays','Thursdays','Fridays','Saturdays'];
const DAY_SHORT  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const CAT_META   = {
  Work:     { emoji:'💼', color:'#7B61FF' },
  Health:   { emoji:'💪', color:'#00FF9D' },
  Home:     { emoji:'🏠', color:'#FFB347' },
  Personal: { emoji:'🌟', color:'#00D4FF' },
};

function dStr(iso) { return getYYYYMMDD(new Date(iso)); }

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, accent, delay = 0, trend, onClick }) {
  return (
    <div
      className={`ins-stat-card glass-panel${onClick ? ' ins-stat-card--clickable' : ''}`}
      style={{ '--accent': accent, animationDelay: `${delay}s` }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {/* Top row: icon + optional trend badge */}
      <div className="isc-top-row">
        <div className="isc-icon-wrap" style={{ background: `${accent}18` }}>
          <Icon size={16} style={{ color: accent }} strokeWidth={2.5} />
        </div>
        {trend !== undefined && (
          <div className={`isc-trend ${trend >= 0 ? 'up' : 'down'}`}>
            {trend >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            <span>{Math.abs(trend)}%</span>
          </div>
        )}
      </div>
      {/* Body */}
      <div className="isc-body">
        <p className="isc-label">{label}</p>
        <p className="isc-value">{value}</p>
        {sub && <p className="isc-sub">{sub}</p>}
      </div>
    </div>
  );
}

// ── Section Header ─────────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, title, sub, accent = 'var(--accent-1)' }) {
  return (
    <div className="ins-section-header">
      <div className="ish-icon" style={{ color: accent }}>
        <Icon size={16} strokeWidth={2.5} />
      </div>
      <div>
        <h3 className="ish-title">{title}</h3>
        {sub && <p className="ish-sub">{sub}</p>}
      </div>
    </div>
  );
}

// ── Streak Ring ────────────────────────────────────────────────────────────────
function StreakRing({ value, max, label, color }) {
  const pct   = Math.min(value / max, 1);
  const r     = 34;
  const circ  = 2 * Math.PI * r;
  const dash  = circ * pct;

  return (
    <div className="streak-ring-wrap">
      <svg width="90" height="90" viewBox="0 0 90 90">
        <circle cx="45" cy="45" r={r} stroke="rgba(255,255,255,.06)" strokeWidth="7" fill="none" />
        <circle
          cx="45" cy="45" r={r}
          stroke={color} strokeWidth="7" fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          transform="rotate(-90 45 45)"
          style={{ transition: 'stroke-dasharray 1s var(--ease-soft)', filter: `drop-shadow(0 0 6px ${color}60)` }}
        />
        <text x="45" y="48" textAnchor="middle" fill={color} fontSize="18" fontWeight="800" fontFamily="Space Grotesk">{value}</text>
      </svg>
      <p className="streak-ring-label">{label}</p>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export function InsightsTab({ tasks, setActiveTab }) {
  const theme = useTheme(); // re-render charts on theme change

  // ── Pre-computed analytics ─────────────────────────────────────────────────
  const analytics = useMemo(() => {
    const completed = tasks.filter(t => t.status === 'completed');
    const missed    = tasks.filter(t => t.status === 'missed');
    const pending   = tasks.filter(t => t.status === 'pending');

    // Today stats
    const todayStr = dStr(new Date().toISOString());
    const todayDone = completed.filter(t => t.completedAt && dStr(t.completedAt) === todayStr).length;

    // Last 7 days bar data
    const last7Labels = [], last7Data = [], last7MissedData = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const ds = dStr(d.toISOString());
      last7Labels.push(DAY_SHORT[d.getDay()]);
      last7Data.push(completed.filter(t => t.completedAt && dStr(t.completedAt) === ds).length);
      last7MissedData.push(missed.filter(t => dStr(t.addedAt) === ds).length);
    }

    // 30-day trend line
    const last30Labels = [], last30Data = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const ds = dStr(d.toISOString());
      last30Labels.push(i % 5 === 0 ? `${d.getDate()}/${d.getMonth()+1}` : '');
      last30Data.push(completed.filter(t => t.completedAt && dStr(t.completedAt) === ds).length);
    }

    // Weekly completion rate
    const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 7);
    const weeklyAll  = tasks.filter(t => new Date(t.addedAt) >= weekStart);
    const weeklyDone = weeklyAll.filter(t => t.status === 'completed');
    const weeklyRate = weeklyAll.length ? Math.round(weeklyDone.length / weeklyAll.length * 100) : 0;

    // Prev week for trend
    const prevWeekStart = new Date(); prevWeekStart.setDate(prevWeekStart.getDate() - 14);
    const prevWeekAll  = tasks.filter(t => new Date(t.addedAt) >= prevWeekStart && new Date(t.addedAt) < weekStart);
    const prevWeekRate = prevWeekAll.length ? Math.round(prevWeekAll.filter(t => t.status==='completed').length / prevWeekAll.length * 100) : 0;
    const weekTrend    = weeklyRate - prevWeekRate;

    // Best / worst day by completion rate (all time)
    const dayTotals = [0,0,0,0,0,0,0], dayDone = [0,0,0,0,0,0,0];
    tasks.forEach(t => {
      const d = new Date(t.addedAt).getDay();
      dayTotals[d]++;
      if (t.status === 'completed') dayDone[d]++;
    });
    const dayRates = dayTotals.map((tot, i) => tot > 0 ? dayDone[i] / tot : -1);
    const bestDayIdx  = dayRates.indexOf(Math.max(...dayRates.filter(r => r >= 0)));
    const worstDayIdx = dayRates.indexOf(Math.min(...dayRates.filter(r => r >= 0)));

    // Missed pattern
    let missedPatternDay = -1, missedMax = -1;
    const missedDayC = [0,0,0,0,0,0,0];
    missed.forEach(t => missedDayC[new Date(t.addedAt).getDay()]++);
    for (let i = 0; i < 7; i++) { if (missedDayC[i] > missedMax) { missedMax = missedDayC[i]; missedPatternDay = i; } }

    // Best single day count
    const countsByDate = {};
    completed.forEach(t => {
      if (!t.completedAt) return;
      const ds = dStr(t.completedAt);
      countsByDate[ds] = (countsByDate[ds] || 0) + 1;
    });
    const bestDayCount = Math.max(0, ...Object.values(countsByDate));
    const bestDayDate  = Object.entries(countsByDate).sort((a,b) => b[1]-a[1])[0]?.[0];
    const bestDayLabel = bestDayDate
      ? new Date(bestDayDate).toLocaleDateString('en-IN', { weekday:'short', month:'short', day:'numeric' })
      : 'N/A';

    // Category breakdown
    const catCounts = { Work:0, Health:0, Home:0, Personal:0 };
    completed.forEach(t => {
      const cat = t.category && catCounts[t.category] !== undefined ? t.category : 'Personal';
      catCounts[cat]++;
    });
    const catTotal = Object.values(catCounts).reduce((a,b) => a+b, 0);

    // Streak (consecutive days with at least 1 completion)
    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const ds = dStr(d.toISOString());
      if (completed.some(t => t.completedAt && dStr(t.completedAt) === ds)) streak++;
      else break;
    }

    // Discipline score
    const focusStatsStr = localStorage.getItem('karde_focus_stats');
    let focusScore = 100;
    try { if (focusStatsStr) focusScore = JSON.parse(focusStatsStr).score || 100; } catch {}
    const disciplineScore = weeklyAll.length === 0 ? 0 : Math.round((weeklyRate + focusScore) / 2);

    // Completion heatmap (last 7 weeks)
    const heatmap = [];
    for (let i = 48; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const ds = dStr(d.toISOString());
      heatmap.push({ date: ds, count: completed.filter(t => t.completedAt && dStr(t.completedAt) === ds).length });
    }

    return {
      completed: completed.length, missed: missed.length, pending: pending.length,
      todayDone, last7Labels, last7Data, last7MissedData,
      last30Labels, last30Data,
      weeklyRate, weekTrend, bestDayIdx, worstDayIdx,
      missedPatternDay, missedDayC, bestDayCount, bestDayLabel,
      catCounts, catTotal, streak, disciplineScore, heatmap,
    };
  }, [tasks]);

  const {
    completed, missed, pending, todayDone,
    last7Labels, last7Data, last7MissedData,
    last30Labels, last30Data,
    weeklyRate, weekTrend, bestDayIdx, worstDayIdx,
    missedPatternDay, bestDayCount, bestDayLabel,
    catCounts, catTotal, streak, disciplineScore, heatmap,
  } = analytics;

  // ── Theme-aware CSS vars (re-read when theme changes) ────────────────────
  const { textMuted, glassBorder, bgGlass } = useMemo(() => {
    const cs = getComputedStyle(document.documentElement);
    return {
      textMuted:   cs.getPropertyValue('--text-muted').trim()   || '#9491a6',
      glassBorder: cs.getPropertyValue('--glass-border').trim() || 'rgba(255,255,255,0.08)',
      bgGlass:     cs.getPropertyValue('--bg-glass').trim()     || 'rgba(10,5,20,.95)',
    };
  }, [theme]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Chart configs ──────────────────────────────────────────────────────────
  const barData = {
    labels: last7Labels,
    datasets: [
      {
        label: 'Done',
        data: last7Data,
        backgroundColor: (ctx) => {
          const { ctx: c, chartArea } = ctx.chart;
          if (!chartArea) return '#7B61FF';
          const g = c.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
          g.addColorStop(0, '#7B61FF'); g.addColorStop(1, '#00D4FF');
          return g;
        },
        borderRadius: 10, barThickness: 18, borderSkipped: false,
      },
      {
        label: 'Missed',
        data: last7MissedData,
        backgroundColor: 'rgba(255,59,48,.25)',
        borderRadius: 10, barThickness: 18, borderSkipped: false,
      }
    ]
  };

  const barOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: bgGlass, padding: 14, cornerRadius: 12,
        titleFont: { family:'Space Grotesk', weight:'bold', size:12 },
        bodyFont:  { family:'Space Grotesk', size:12 },
        displayColors: true, borderWidth: 1, borderColor: glassBorder,
      }
    },
    scales: {
      x: { grid:{display:false}, ticks:{color:textMuted, font:{family:'Space Grotesk', size:11, weight:'600'}}, border:{display:false} },
      y: { grid:{color:glassBorder}, ticks:{stepSize:1, color:textMuted, font:{family:'Space Grotesk', size:10}}, beginAtZero:true, border:{display:false} }
    }
  };

  const lineData = {
    labels: last30Labels,
    datasets: [{
      label: 'Tasks Done',
      data: last30Data,
      borderColor: '#00D4FF',
      backgroundColor: 'rgba(0,212,255,0.08)',
      fill: true, tension: 0.4,
      pointRadius: 2, pointHoverRadius: 6,
      pointBackgroundColor: '#00D4FF',
      borderWidth: 2,
    }]
  };
  const lineOptions = {
    responsive:true, maintainAspectRatio:false,
    plugins:{ legend:{display:false}, tooltip:{ backgroundColor:bgGlass, padding:12, cornerRadius:10, titleFont:{family:'Space Grotesk'}, bodyFont:{family:'Space Grotesk'}, displayColors:false, borderWidth:1, borderColor:glassBorder } },
    scales:{
      x:{ grid:{display:false}, ticks:{color:textMuted, font:{family:'Space Grotesk',size:9}}, border:{display:false} },
      y:{ grid:{color:glassBorder}, ticks:{stepSize:1, color:textMuted, font:{family:'Space Grotesk',size:9}}, beginAtZero:true, border:{display:false} }
    }
  };

  const doughnutColors = ['#7B61FF','#00D4FF','#FFB347','#00FF9D'];
  const doughnutData = {
    labels: Object.keys(catCounts),
    datasets:[{
      data: Object.values(catCounts),
      backgroundColor: doughnutColors,
      borderColor: 'transparent', borderWidth: 0,
      hoverOffset: 8,
    }]
  };
  const doughnutOptions = {
    responsive:true, maintainAspectRatio:false, cutout:'72%',
    plugins:{ legend:{display:false}, tooltip:{ backgroundColor:bgGlass, padding:12, cornerRadius:10, titleFont:{family:'Space Grotesk'}, bodyFont:{family:'Space Grotesk'}, displayColors:true, borderWidth:1, borderColor:glassBorder } }
  };

  // ── Heatmap cells ──────────────────────────────────────────────────────────
  const maxHeat = Math.max(1, ...heatmap.map(h => h.count));

  return (
    <div className="ins-page">

      {/* ── Hero KPI row ── */}
      <div className="ins-kpi-row">
        <StatCard icon={CheckCircle2} label="Total Done"   value={completed}  sub="all time"     accent="#00D4FF" delay={0}   trend={weekTrend} onClick={() => setActiveTab?.('records')} />
        <StatCard icon={Flame}        label="Streak"        value={`${streak}d`} sub="consecutive" accent="#FF6B6B" delay={0.06} onClick={() => setActiveTab?.('habits')} />
        <StatCard icon={Zap}          label="Today"         value={todayDone}  sub="tasks done"   accent="#00FF9D" delay={0.12} onClick={() => setActiveTab?.('today')} />
        <StatCard icon={Target}       label="Discipline"    value={`${disciplineScore}`} sub="/100 score" accent="#7B61FF" delay={0.18} onClick={() => setActiveTab?.('records')} />
      </div>

      {/* ── 7-day bar chart ── */}
      <div className="ins-card glass-panel ins-delay-1">
        <SectionHeader icon={BarChart2} title="Last 7 Days" sub="Tasks done vs missed each day" accent="#7B61FF" />
        <div className="ins-chart-wrap" style={{ height: 200 }}>
          <Bar data={barData} options={barOptions} />
        </div>
        <div className="ins-chart-legend">
          <span className="icl-dot" style={{ background:'#7B61FF' }} /> Done
          <span className="icl-dot" style={{ background:'rgba(255,59,48,.6)', marginLeft:16 }} /> Missed
        </div>
      </div>

      {/* ── 30-day trend ── */}
      <div className="ins-card glass-panel ins-delay-2">
        <SectionHeader icon={TrendingUp} title="30-Day Trend" sub="Task completion trend over past month" accent="#00D4FF" />
        <div className="ins-chart-wrap" style={{ height: 160 }}>
          <Line data={lineData} options={lineOptions} />
        </div>
      </div>

      {/* ── Streak rings ── */}
      <div className="ins-card glass-panel ins-delay-2">
        <SectionHeader icon={Award} title="Performance Rings" sub="Your key metrics at a glance" accent="#FFB347" />
        <div className="ins-rings-row">
          <StreakRing value={streak}          max={30}  label="Day Streak"  color="#FF6B6B" />
          <StreakRing value={weeklyRate}       max={100} label="This Week %"  color="#00D4FF" />
          <StreakRing value={disciplineScore}  max={100} label="Discipline"   color="#7B61FF" />
          <StreakRing value={bestDayCount}     max={Math.max(10, bestDayCount)} label="Best Day" color="#FFB347" />
        </div>
      </div>

      {/* ── Best day + Missed pattern ── */}
      <div className="ins-2col">
        <div className="ins-card glass-panel ins-delay-3">
          <SectionHeader icon={Star} title="Best Day Ever" accent="#FFB347" />
          <div className="ins-highlight-val" style={{ color:'#FFB347' }}>{bestDayCount}</div>
          <p className="ins-highlight-label">tasks on {bestDayLabel}</p>
          <div className="ins-day-badges">
            {DAY_SHORT.map((d, i) => (
              <div
                key={d}
                className={`ins-day-badge ${i === bestDayIdx ? 'best' : i === worstDayIdx ? 'worst' : ''}`}
              >{d}</div>
            ))}
          </div>
          <div className="ins-day-legend">
            <span className="idl-dot best" /> Best &nbsp;&nbsp;
            <span className="idl-dot worst" /> Worst
          </div>
        </div>

        <div className="ins-card glass-panel ins-delay-3">
          <SectionHeader icon={AlertTriangle} title="Missed Pattern" accent="#FF6B6B" />
          {missed === 0 ? (
            <div className="ins-zero-miss">
              <span className="ins-zero-miss-emoji">🎉</span>
              <p>No missed tasks yet!</p>
              <p className="ins-zero-miss-sub">Keep the momentum going.</p>
            </div>
          ) : (
            <>
              <div className="ins-highlight-val" style={{ color:'#FF6B6B' }}>{missed}</div>
              <p className="ins-highlight-label">tasks missed</p>
              {missedPatternDay >= 0 && (
                <div className="ins-pattern-pill">
                  <AlertTriangle size={12} /> Tends to slip on <strong>{DAY_NAMES[missedPatternDay]}</strong>
                </div>
              )}
              <p className="ins-suggestion">
                💡 Try scheduling fewer tasks on <strong>{DAY_NAMES[missedPatternDay] || 'that day'}</strong>, or start earlier to beat fatigue.
              </p>
            </>
          )}
        </div>
      </div>

      {/* ── Category breakdown ── */}
      <div className="ins-card glass-panel ins-delay-4">
        <SectionHeader icon={Calendar} title="Category Breakdown" sub="Where your completed effort goes" accent="#00FF9D" />
        {catTotal === 0 ? (
          <p className="ins-empty-hint">Complete some tasks to see your category breakdown.</p>
        ) : (
          <div className="ins-cat-layout">
            <div className="ins-doughnut-wrap" style={{ height: 160, width: 160 }}>
              <Doughnut data={doughnutData} options={doughnutOptions} />
            </div>
            <div className="ins-cat-list">
              {Object.entries(catCounts).map(([k, v], i) => {
                if (!v) return null;
                const meta = CAT_META[k] || { emoji:'📌', color:'#aaa' };
                const pct  = Math.round(v / catTotal * 100);
                return (
                  <div key={k} className="ins-cat-row">
                    <div className="icr-head">
                      <span className="icr-dot" style={{ background: meta.color }} />
                      <span className="icr-emoji">{meta.emoji}</span>
                      <span className="icr-name">{k}</span>
                      <span className="icr-count">{v}</span>
                      <span className="icr-pct" style={{ color: meta.color }}>{pct}%</span>
                    </div>
                    <div className="icr-bar-bg">
                      <div className="icr-bar-fill" style={{ width:`${pct}%`, background: meta.color, boxShadow:`0 0 10px ${meta.color}50` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Activity Heatmap ── */}
      <div className="ins-card glass-panel ins-delay-5">
        <SectionHeader icon={Calendar} title="Activity Heatmap" sub="Last 7 weeks of task completions" accent="#00D4FF" />
        <div className="ins-heatmap">
          {heatmap.map((h, i) => {
            const intensity = h.count === 0 ? 0 : Math.max(0.15, h.count / maxHeat);
            return (
              <div
                key={i}
                className="ins-heat-cell"
                style={{ opacity: h.count === 0 ? 0.12 : intensity, background: '#00D4FF' }}
                title={`${h.date}: ${h.count} done`}
              />
            );
          })}
        </div>
        <div className="ins-heatmap-legend">
          <span style={{ color: 'var(--text-muted)', fontSize:'0.75rem' }}>Less</span>
          {[0.12, 0.35, 0.6, 0.85, 1].map((o, i) => (
            <div key={i} className="ins-heat-cell" style={{ opacity: o, background:'#00D4FF' }} />
          ))}
          <span style={{ color: 'var(--text-muted)', fontSize:'0.75rem' }}>More</span>
        </div>
      </div>

    </div>
  );
}

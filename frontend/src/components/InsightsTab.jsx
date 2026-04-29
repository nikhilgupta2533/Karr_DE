import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  BarElement,
  Tooltip 
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { getYYYYMMDD } from '../hooks/useTasks';
import './InsightsTab.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

export function InsightsTab({ tasks }) {
  const safeDayLabel = (yyyyMMdd, fallback = 'No data') => {
    const d = new Date(yyyyMMdd);
    if (isNaN(d.getTime())) return fallback;
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  };

  // Last 7 Days Chart Data
  const labels = [];
  const data = [];
  for (let i = 6; i >= 0; i--) {
      let d = new Date(); d.setDate(d.getDate() - i);
      labels.push(d.toLocaleDateString('en-US', {weekday:'short'}));
      const dtStr = getYYYYMMDD(d);
      const count = tasks.filter(t => t.status === 'completed' && getYYYYMMDD(new Date(t.completedAt)) === dtStr).length;
      data.push(count);
  }

  const chartData = {
    labels: labels,
    datasets: [{
      data: data,
      backgroundColor: (context) => {
        const chart = context.chart;
        const { ctx, chartArea } = chart;
        if (!chartArea) return null;
        const style = getComputedStyle(document.documentElement);
        const c1 = style.getPropertyValue('--accent-2').trim() || '#bd5cff';
        const c2 = style.getPropertyValue('--accent-1').trim() || '#00f2ff';
        const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
        gradient.addColorStop(0, c1);
        gradient.addColorStop(1, c2);
        return gradient;
      },
      borderRadius: 12,
      barThickness: 14
    }]
  };

  const style = getComputedStyle(document.documentElement);
  const textMuted = style.getPropertyValue('--text-muted').trim() || '#9491a6';
  const glassBorder = style.getPropertyValue('--glass-border').trim() || 'rgba(255, 255, 255, 0.1)';
  const bgGlass = style.getPropertyValue('--bg-glass').trim() || 'rgba(10, 5, 20, 0.95)';

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { 
      legend: { display: false },
      tooltip: {
        backgroundColor: bgGlass,
        titleFont: { family: 'Space Grotesk', weight: 'bold' },
        bodyFont: { family: 'Space Grotesk' },
        padding: 16,
        cornerRadius: 16,
        displayColors: false,
        borderWidth: 1,
        borderColor: glassBorder
      }
    },
    scales: {
      x: { 
        grid: { display:false }, 
        ticks: { color: textMuted, font: { family: 'Space Grotesk', size: 10, weight: '600' } },
        border: { display: false }
      },
      y: { 
        grid: { color: glassBorder }, 
        ticks: { stepSize:1, color: textMuted, font: { family: 'Space Grotesk', size: 10 } }, 
        beginAtZero: true,
        border: { display: false }
      }
    }
  };


  // Best Day Calculation
  let counts = {}; let bCount = 0; let bDate = 'No data';
  tasks.filter(t => t.status === 'completed').forEach(t => {
      const dStr = getYYYYMMDD(new Date(t.completedAt));
      counts[dStr] = (counts[dStr] || 0) + 1;
      if (counts[dStr] > bCount) {
          bCount = counts[dStr];
          bDate = safeDayLabel(dStr, 'No data');
      }
  });
  const bestDayStr = bCount > 0 ? `${bDate} (${bCount} done)` : 'Complete tasks to see!';

  // Missed Pattern & Actionable Suggestion
  const missed = tasks.filter(t => t.status === 'missed');
  let missedPatternStr = "You haven't missed any tasks! 🎉";
  let actionableSuggestion = "Keep up the great consistency! You are building incredible momentum.";
  const dayNames = ['Sundays','Mondays','Tuesdays','Wednesdays','Thursdays','Fridays','Saturdays'];
  
  if (missed.length > 0) {
      const dayC = [0,0,0,0,0,0,0];
      missed.forEach(t => dayC[new Date(t.addedAt).getDay()]++);
      let wDay = 0; let maxM = -1;
      for(let i=0; i<7; i++) { if(dayC[i] > maxM){ maxM = dayC[i]; wDay = i; } }
      missedPatternStr = `You tend to miss tasks on ${dayNames[wDay]}.`;
      actionableSuggestion = `Consider reducing your planned workload on ${dayNames[wDay]}s or schedule a Focus Session earlier in the day to beat fatigue.`;
  }

  // Weekly Report
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 7);
  const weeklyTasks = tasks.filter(t => new Date(t.addedAt) >= weekStart);
  const weeklyCompleted = weeklyTasks.filter(t => t.status === 'completed');
  const weeklyCompletionRate = weeklyTasks.length ? Math.round((weeklyCompleted.length / weeklyTasks.length) * 100) : 0;
  
  const focusStatsStr = localStorage.getItem('karde_focus_stats');
  let focusScore = 100;
  if (focusStatsStr) {
      try { focusScore = JSON.parse(focusStatsStr).score || 100; } catch {}
  }

  // Discipline Score
  const disciplineScore = weeklyTasks.length === 0 ? 0 : Math.round((weeklyCompletionRate + focusScore) / 2);

  // Best / Worst Day of Week
  const weeklyDayC = [0,0,0,0,0,0,0];
  const weeklyCompC = [0,0,0,0,0,0,0];
  weeklyTasks.forEach(t => {
      const day = new Date(t.addedAt).getDay();
      weeklyDayC[day]++;
      if (t.status === 'completed') weeklyCompC[day]++;
  });
  
  let worstRate = 101; let worstDayIdx = -1;
  let bestRate = -1; let bestDayIdx = -1;
  
  for(let i=0; i<7; i++) {
      if (weeklyDayC[i] > 0) {
          const r = weeklyCompC[i] / weeklyDayC[i];
          if (r < worstRate) { worstRate = r; worstDayIdx = i; }
          if (r > bestRate) { bestRate = r; bestDayIdx = i; }
      }
  }
  const worstWeekDayStr = worstDayIdx >= 0 ? dayNames[worstDayIdx] : 'None';
  const bestWeekDayStr = bestDayIdx >= 0 ? dayNames[bestDayIdx] : 'None';

  // Category Breakdown
  const cats = { 'Work': 0, 'Health': 0, 'Home': 0, 'Personal': 0 };
  let cTotal = 0;
  tasks.filter(t => t.status === 'completed').forEach(t => {
      if (cats[t.category] !== undefined) { Object.keys(t).length > 0 && cats[t.category]++; cTotal++; }
      else { cats['Personal']++; cTotal++; } 
  });

  return (
    <div className="view-content active">
      <div className="chart-box glass-panel">
        <div className="insight-title">Last 7 Days</div>
        <div style={{ height: '200px' }}>
          <Bar data={chartData} options={chartOptions} />
        </div>
      </div>
      
      <div className="insight-card glass-panel">
        <div className="insight-title">Missed Pattern</div>
        <div className="insight-val" style={{marginBottom: '8px'}}>{missedPatternStr}</div>
        <div className="insight-suggestion">
           <strong>💡 Actionable Suggestion:</strong> {actionableSuggestion}
        </div>
      </div>
      
      <div className="weekly-report-card glass-panel">
        <div className="insight-title" style={{color: 'var(--accent-1)'}}>Weekly Report</div>
        <div className="weekly-report-grid">
          <div className="wr-stat">
             <span className="wr-label">Discipline Score</span>
             <span className="wr-value glow-text-1">{disciplineScore}/100</span>
          </div>
          <div className="wr-stat">
             <span className="wr-label">Completion Rate</span>
             <span className="wr-value">{weeklyCompletionRate}%</span>
          </div>
          <div className="wr-stat">
             <span className="wr-label">Best Day</span>
             <span className="wr-value">{bestWeekDayStr}</span>
          </div>
          <div className="wr-stat">
             <span className="wr-label">Worst Day</span>
             <span className="wr-value">{worstWeekDayStr}</span>
          </div>
        </div>
      </div>
      
      <div className="insight-card glass-panel">
        <div className="insight-title">Category Breakdown</div>
        {cTotal === 0 ? (
          <div className="insight-val" style={{ fontSize: '14px', color:'var(--text-muted)' }}>No data yet</div>
        ) : (
          Object.keys(cats).map(k => {
            if(cats[k] === 0) return null;
            const pct = Math.round((cats[k] / cTotal) * 100);
            return (
              <div key={k} className="category-row">
                <div style={{ flexGrow:1 }}>
                  <div className="cat-header">
                    <span>{k}</span> 
                    <span className="cat-pct">{pct}%</span>
                  </div>
                  <div className="cat-bar-bg">
                    <div className="cat-bar-fill" style={{ width:`${pct}%` }}></div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  );
}

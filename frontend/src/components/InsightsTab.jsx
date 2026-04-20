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
        const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
        gradient.addColorStop(0, '#bd5cff');
        gradient.addColorStop(1, '#00f2ff');
        return gradient;
      },
      borderRadius: 12,
      barThickness: 14
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { 
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(10, 5, 20, 0.95)',
        titleFont: { family: 'Space Grotesk', weight: 'bold' },
        bodyFont: { family: 'Space Grotesk' },
        padding: 16,
        cornerRadius: 16,
        displayColors: false,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)'
      }
    },
    scales: {
      x: { 
        grid: { display:false }, 
        ticks: { color:'#9491a6', font: { family: 'Space Grotesk', size: 10, weight: '600' } },
        border: { display: false }
      },
      y: { 
        grid: { color:'rgba(255,255,255,0.03)' }, 
        ticks: { stepSize:1, color:'#9491a6', font: { family: 'Space Grotesk', size: 10 } }, 
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
          bDate = new Date(dStr).toLocaleDateString('en-US', {weekday:'long', month:'short', day:'numeric'});
      }
  });
  const bestDayStr = bCount > 0 ? `${bDate} (${bCount} done)` : 'Complete tasks to see!';

  // Missed Pattern
  const missed = tasks.filter(t => t.status === 'missed');
  let missedPatternStr = "You haven't missed any tasks! 🎉";
  if (missed.length > 0) {
      const dayC = [0,0,0,0,0,0,0];
      missed.forEach(t => dayC[new Date(t.addedAt).getDay()]++);
      let wDay = 0; let maxM = -1;
      for(let i=0; i<7; i++) { if(dayC[i] > maxM){ maxM = dayC[i]; wDay = i; } }
      const dayNames = ['Sundays','Mondays','Tuesdays','Wednesdays','Thursdays','Fridays','Saturdays'];
      missedPatternStr = `You tend to miss tasks on ${dayNames[wDay]}.`;
  }

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
        <div style={{ height: '180px' }}>
          <Bar data={chartData} options={chartOptions} />
        </div>
      </div>
      
      <div className="insight-card glass-panel">
        <div className="insight-title">Meri best day</div>
        <div className="insight-val">{bestDayStr}</div>
      </div>

      <div className="insight-card glass-panel">
        <div className="insight-title">Missed pattern</div>
        <div className="insight-val">{missedPatternStr}</div>
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

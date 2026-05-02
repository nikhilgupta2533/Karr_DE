import { CalendarDays, BarChart, Activity, Flame, Lightbulb } from 'lucide-react';
import './BottomNav.css';

export function BottomNav({ activeTab, setActiveTab }) {
  const tabs = [
    { id: 'today',   icon: Activity,    label: 'Today' },
    { id: 'plan',    icon: Lightbulb,   label: 'Plan' },
    { id: 'records', icon: CalendarDays, label: 'Records' },
    { id: 'habits',  icon: Flame,        label: 'Habits' },
    { id: 'insights',icon: BarChart,     label: 'Insights' },
  ];

  return (
    <nav className="bottom-nav">
      {tabs.map((t) => {
        const Icon = t.icon;
        const isActive = activeTab === t.id;
        return (
          <button
            key={t.id}
            className={`nav-item magnetic-btn ${isActive ? 'active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            <div className="nav-icon-wrapper">
              <Icon size={22} className="nav-icon" />
              {isActive && <div className="nav-glow"></div>}
            </div>
            <span>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

import { useEffect, useRef, useState } from 'react';
import { useTasks, getYYYYMMDD } from './hooks/useTasks';
import { useHabits } from './hooks/useHabits';
import { useSound, closeAudioContext } from './hooks/useSound';
import { useAuth } from './hooks/useAuth';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { TodayTab } from './components/TodayTab';
import { RecordsTab } from './components/RecordsTab';
import { InsightsTab } from './components/InsightsTab';
import { HabitsTab } from './components/HabitsTab';
import { SettingsModal } from './components/SettingsModal';
import { AuthScreen } from './components/AuthScreen';
import { ReviewMissedModal } from './components/ReviewMissedModal';

// ── Theme helpers ─────────────────────────────────────────────────────────────
const THEME_KEY = 'kardeTheme';
function getInitialTheme() {
  try { return localStorage.getItem(THEME_KEY) || 'dark'; } catch { return 'dark'; }
}
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
}

// ── Splash loader ─────────────────────────────────────────────────────────────
function SplashLoader() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: '16px',
      background: 'var(--bg-body)', color: 'var(--text-muted)',
    }}>
      <div style={{
        fontSize: '48px', lineHeight: 1,
        background: 'linear-gradient(135deg, var(--accent-1), var(--accent-2))',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      }}>✦</div>
      <p style={{ fontSize: '14px', letterSpacing: '2px', textTransform: 'uppercase' }}>
        Loading…
      </p>
    </div>
  );
}

function App() {
  const { user, idToken, loading: authLoading, getFreshToken, deleteAccount } = useAuth();

  // Theme (Feature 6)
  const [theme, setTheme] = useState(getInitialTheme);
  useEffect(() => { applyTheme(theme); }, [theme]);
  const toggleTheme = () => {
    setTheme(t => {
      const next = t === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(THEME_KEY, next); } catch {}
      return next;
    });
  };

  const [activeTab, setActiveTab] = useState('today');
  const [showSettings, setShowSettings] = useState(false);
  const soundFns = useSound();

  const {
    tasks, addTask, toggleTask, deleteTask, togglePinTask,
    settings, setSettings, clearData,
    toast, confirmBulkComplete, updateTaskTitle, addTemplateTasks,
    updateTaskDueTime, updateTask, decomposeTask, planDay, toggleSubtask,
    productivityScore
  } = useTasks(idToken, getFreshToken);

  const habitsHook = useHabits(idToken, getFreshToken);

  useEffect(() => {
    const onOpenSettings = () => setShowSettings(true);
    window.addEventListener('karde:open-settings', onOpenSettings);
    return () => {
      window.removeEventListener('karde:open-settings', onOpenSettings);
      closeAudioContext();
    };
  }, []);

  // PWA: register service worker (handles offline + PWA install prompt)
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);

  // Smart Notifications: Evening reminder if nothing done
  useEffect(() => {
    if (!tasks.length) return;
    const todayStr = getYYYYMMDD(new Date());
    const todaysTasks = tasks.filter(t => getYYYYMMDD(new Date(t.addedAt)) === todayStr);
    const completedToday = todaysTasks.filter(t => t.status === 'completed').length;
    
    const hour = new Date().getHours();
    if (hour >= 18 && completedToday === 0 && todaysTasks.length > 0) {
      const lastReminded = localStorage.getItem(`reminded_${todayStr}`);
      if (!lastReminded && Notification.permission === 'granted') {
        new Notification('⏰ Kar De Flow', {
          body: "It's getting late! Let's get at least one task done to keep the momentum.",
          icon: '/favicon.ico',
        });
        localStorage.setItem(`reminded_${todayStr}`, 'true');
      }
    }
  }, [tasks]);

  // Missed pattern for Plan Day
  const missedPattern = (() => {
    const missed = tasks.filter(t => t.status === 'missed');
    if (!missed.length) return null;
    const dayC = [0,0,0,0,0,0,0];
    missed.forEach(t => dayC[new Date(t.addedAt).getDay()]++);
    let wDay = 0, maxM = -1;
    for (let i = 0; i < 7; i++) { if (dayC[i] > maxM) { maxM = dayC[i]; wDay = i; } }
    return ['Sundays','Mondays','Tuesdays','Wednesdays','Thursdays','Fridays','Saturdays'][wDay];
  })();

  // Show splash while Firebase is resolving auth state
  if (authLoading) return <SplashLoader />;

  // Show login screen if not signed in
  if (!user) return <AuthScreen />;

  return (
    <div className="app-container">
      <Header
        onOpenSettings={() => setShowSettings(true)}
        theme={theme}
        onToggleTheme={toggleTheme}
        user={user}
        productivityScore={productivityScore}
      />

      <main className="main-content">
        <div className="tab-content-wrapper">
          {activeTab === 'today' && (
            <TodayTab
              tasks={tasks}
              onAddTask={addTask}
              onToggleTask={(id) => { toggleTask(id); }}
              onDeleteTask={deleteTask}
              onTogglePinTask={togglePinTask}
              onBulkComplete={confirmBulkComplete}
              onUpdateTitle={updateTaskTitle}
              onAddTemplate={addTemplateTasks}
              onUpdateDueTime={updateTaskDueTime}
              onUpdateTask={updateTask}
              onDecomposeTask={decomposeTask}
              onPlanDay={(pending) => planDay(pending, missedPattern)}
              onToggleSubtask={toggleSubtask}
              soundFns={soundFns}
              missedPattern={missedPattern}
            />
          )}

          {activeTab === 'records' && (
            <RecordsTab tasks={tasks} />
          )}

          {activeTab === 'habits' && (
            <HabitsTab habitsHook={habitsHook} />
          )}

          {activeTab === 'insights' && (
            <InsightsTab tasks={tasks} />
          )}
        </div>
      </main>

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />

      <SettingsModal
        show={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        setSettings={setSettings}
        clearData={clearData}
        deleteAccount={deleteAccount}
      />

      {/* Toast */}
      <div className={`glass-panel app-toast ${toast.show ? 'show' : ''}`}>
        <span className="app-toast-message">{toast.msg}</span>
        <div className="app-toast-actions">
          {(toast.actions || []).map((action) => (
            <button
              key={action.label}
              onClick={action.onClick}
              className="app-toast-action-btn magnetic-btn"
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>

      <ReviewMissedModal tasks={tasks} updateTask={updateTask} />
    </div>
  );
}

export default App;

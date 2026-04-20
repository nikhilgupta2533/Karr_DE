import { useEffect, useState } from 'react';
import { useTasks } from './hooks/useTasks';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { TodayTab } from './components/TodayTab';
import { RecordsTab } from './components/RecordsTab';
import { InsightsTab } from './components/InsightsTab';
import { SettingsModal } from './components/SettingsModal';

function App() {
  const [activeTab, setActiveTab] = useState('today');
  const [showSettings, setShowSettings] = useState(false);
  
  const { 
    tasks, addTask, toggleTask, deleteTask, togglePinTask,
    settings, setSettings, clearData,
    toast, confirmBulkComplete, updateTaskTitle, addTemplateTasks, updateTaskDueTime
  } = useTasks();

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);

  useEffect(() => {
    const sendTasksToSw = () => {
      if (!('serviceWorker' in navigator)) return;
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'CHECK_TASKS', tasks });
        return;
      }
      navigator.serviceWorker.ready.then((registration) => {
        registration.active?.postMessage({ type: 'CHECK_TASKS', tasks });
      }).catch(() => {});
    };
    sendTasksToSw();
    const interval = setInterval(sendTasksToSw, 60000);
    return () => clearInterval(interval);
  }, [tasks]);

  return (
    <div className="app-container">
      <Header onOpenSettings={() => setShowSettings(true)} />
      
      <main className="main-content">
        <div className="tab-content-wrapper">
          {activeTab === 'today' && (
            <TodayTab 
              tasks={tasks}
              onAddTask={addTask}
              onToggleTask={toggleTask}
              onDeleteTask={deleteTask}
              onTogglePinTask={togglePinTask}
              onBulkComplete={confirmBulkComplete}
              onUpdateTitle={updateTaskTitle}
              onAddTemplate={addTemplateTasks}
              onUpdateDueTime={updateTaskDueTime}
            />
          )}

          {activeTab === 'records' && (
            <RecordsTab tasks={tasks} />
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
      />

      {/* Premium Toast Notification */}
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


    </div>
  );
}

export default App;

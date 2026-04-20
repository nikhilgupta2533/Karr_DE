import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import './SettingsModal.css';

export function SettingsModal({ show, onClose, settings, setSettings, clearData }) {
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    if (show) setApiKey(settings.apiKey || '');
  }, [show, settings]);

  if (!show) return null;

  const handleSave = () => {
    setSettings(prev => ({ ...prev, apiKey: apiKey.trim() }));
    onClose();
  };

  const handleClear = () => {
    if (confirm("Are you sure? This will delete all tasks and stats.")) {
      clearData();
      onClose();
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box glass-panel">
        <button className="close-modal" onClick={onClose}><X size={20} /></button>
        <h2>Settings</h2>
        <div className="input-group">
          <label>Gemini API Key</label>
          <input 
            type="password" 
            placeholder="AIzaSy..." 
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>
        <button className="btn-primary glow-btn" onClick={handleSave}>Save Key</button>
        
        <div className="settings-divider"></div>
        
        <button 
          className="btn-secondary" 
          onClick={() => {
            if (Notification.permission === 'granted') {
              new Notification('🔔 Notification Test', { body: 'This is how your task reminders will look!' });
            } else {
              Notification.requestPermission().then(p => {
                if (p === 'granted') new Notification('🔔 Notification Test', { body: 'Notifications enabled!' });
              });
            }
          }}
        >
          Test Notifications
        </button>

        <button className="btn-danger" onClick={handleClear}>Clear All Data</button>

      </div>
    </div>
  );
}

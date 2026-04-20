import { Settings } from 'lucide-react';
import './Header.css';

export function Header({ onOpenSettings }) {
  return (
    <header className="app-header">
      <div className="brand">
        <h1>Kar De</h1>
        <span>Intelligent Flow</span>
      </div>
      <button className="settings-btn magnetic-btn" onClick={onOpenSettings} aria-label="Settings">
        <Settings size={24} strokeWidth={2} />
      </button>
    </header>
  );
}


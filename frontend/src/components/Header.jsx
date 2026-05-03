import { useState } from 'react';
import { Settings, Volume2, VolumeX, Sun, Moon, LogOut } from 'lucide-react';
import { signOutUser } from '../lib/firebase';
import './Header.css';

const SOUND_KEY = 'karDeSoundEnabled';

function getSoundPref() {
  try {
    const v = localStorage.getItem(SOUND_KEY);
    return v === null ? true : v === 'true';
  } catch { return true; }
}

export function Header({ onOpenSettings, theme, onToggleTheme, user, productivityScore }) {
  const [soundOn, setSoundOn] = useState(getSoundPref);
  const [signingOut, setSigningOut] = useState(false);

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    try { localStorage.setItem(SOUND_KEY, String(next)); } catch {}
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try { await signOutUser(); } catch { setSigningOut(false); }
  };

  const isDark = theme !== 'light';

  return (
    <header className="app-header">
      <div className="brand">
        <h1>Kar De</h1>
        <span>Intelligent Flow</span>
      </div>

      {/* UX: score badge — clicking opens explanation popover via custom event */}
      <div
        className="productivity-badge"
        title="Click to learn about your Discipline Score"
        onClick={() => window.dispatchEvent(new Event('karde:open-score-popover'))}
        style={{ cursor: 'pointer' }}
      >
        <span className="score-label">Score</span>
        <span className="score-value">{productivityScore}</span>
      </div>
      <div className="header-actions">
        {/* Theme toggle */}
        <button
          className="sound-btn magnetic-btn"
          onClick={onToggleTheme}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={isDark ? 'Light Mode' : 'Dark Mode'}
        >
          {isDark
            ? <Sun size={20} strokeWidth={2} />
            : <Moon size={20} strokeWidth={2} />}
        </button>

        {/* Sound toggle */}
        <button
          className="sound-btn magnetic-btn"
          onClick={toggleSound}
          aria-label={soundOn ? 'Mute sounds' : 'Enable sounds'}
          title={soundOn ? 'Sound ON' : 'Sound OFF'}
        >
          {soundOn ? <Volume2 size={20} strokeWidth={2} /> : <VolumeX size={20} strokeWidth={2} />}
        </button>

        {/* User avatar */}
        {user && (
          <div className="user-avatar-wrap" title={user.displayName || user.email}>
            {user.photoURL
              ? <img src={user.photoURL} alt="avatar" className="user-avatar" referrerPolicy="no-referrer" />
              : <div className="user-avatar user-avatar--placeholder">
                  {(user.displayName || user.email || 'U')[0].toUpperCase()}
                </div>
            }
          </div>
        )}

        {/* Sign out */}
        {user && (
          <button
            className="sound-btn magnetic-btn"
            onClick={handleSignOut}
            disabled={signingOut}
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut size={18} strokeWidth={2} />
          </button>
        )}

        <button className="settings-btn magnetic-btn" onClick={onOpenSettings} aria-label="Settings">
          <Settings size={24} strokeWidth={2} />
        </button>
      </div>
    </header>
  );
}

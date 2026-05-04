import { useState, useEffect } from 'react';
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

function LiveClock() {
  const [now, setNow] = useState(new Date());
  const [colonOn, setColonOn] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
      setColonOn(c => !c);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const h = now.getHours();
  const hh = String(h % 12 || 12).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const date = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const secPct = (now.getSeconds() / 59) * 100;

  return (
    <div className="live-clock">
      {/* Time */}
      <div className="clock-time-row">
        <span className="clock-hm">
          {hh}
          <span className={colonOn ? 'clock-colon' : 'clock-colon clock-colon--off'}>:</span>
          {mm}
        </span>
        <div className="clock-sec-block">
          <span className="clock-ampm">{ampm}</span>
          <span className="clock-ss">{ss}</span>
        </div>
      </div>
      {/* Progress sweep */}
      <div className="clock-bar-track">
        <div className="clock-bar-fill" style={{ width: `${secPct}%` }} />
      </div>
      {/* Date */}
      <span className="clock-date">{date}</span>
    </div>
  );
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
      {/* LEFT: Brand */}
      <div className="brand">
        <h1>Kar De</h1>
        <span className="brand-sub">Intelligent Flow</span>
      </div>

      {/* RIGHT: clock + score + actions all in one flex row */}
      <div className="header-right">
        <LiveClock />

        <div
          className="productivity-badge"
          title="Click to learn about your Discipline Score"
          onClick={() => window.dispatchEvent(new Event('karde:open-score-popover'))}
        >
          <span className="score-label">Score</span>
          <span className="score-value">{productivityScore}</span>
        </div>

        <div className="header-actions">
          <button
            className="hdr-btn magnetic-btn"
            onClick={onToggleTheme}
            title={isDark ? 'Light Mode' : 'Dark Mode'}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? <Sun size={16} strokeWidth={2} /> : <Moon size={16} strokeWidth={2} />}
          </button>

          <button
            className="hdr-btn magnetic-btn"
            onClick={toggleSound}
            title={soundOn ? 'Sound ON' : 'Sound OFF'}
            aria-label={soundOn ? 'Mute sounds' : 'Enable sounds'}
          >
            {soundOn ? <Volume2 size={16} strokeWidth={2} /> : <VolumeX size={16} strokeWidth={2} />}
          </button>

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

          {user && (
            <button
              className="hdr-btn magnetic-btn"
              onClick={handleSignOut}
              disabled={signingOut}
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut size={16} strokeWidth={2} />
            </button>
          )}

          <button className="hdr-btn magnetic-btn" onClick={onOpenSettings} aria-label="Settings">
            <Settings size={18} strokeWidth={2} />
          </button>
        </div>
      </div>
    </header>
  );
}

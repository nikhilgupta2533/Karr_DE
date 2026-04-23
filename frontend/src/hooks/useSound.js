// useSound.js — Web Audio API sound synthesis (zero files, zero libraries)

const SOUND_KEY = 'karDeSoundEnabled';

function isSoundEnabled() {
  try {
    const v = localStorage.getItem(SOUND_KEY);
    return v === null ? true : v === 'true';
  } catch {
    return true;
  }
}

function getAudioCtx() {
  if (!window._kardeAudioCtx || window._kardeAudioCtx.state === 'closed') {
    window._kardeAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  // Resume if suspended (browser autoplay policy)
  if (window._kardeAudioCtx.state === 'suspended') {
    window._kardeAudioCtx.resume().catch(() => {});
  }
  return window._kardeAudioCtx;
}

function playNote(freq, durationMs, type = 'sine', gainValue = 0.3, startTime = 0, ctx = null) {
  try {
    const ac = ctx || getAudioCtx();
    const t = ac.currentTime + startTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(gainValue, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + durationMs / 1000);
    osc.start(t);
    osc.stop(t + durationMs / 1000 + 0.05);
  } catch { /* ignore */ }
}

// C5→E5→G5 ascending chime — task complete
export function playComplete() {
  if (!isSoundEnabled()) return;
  try {
    const ac = getAudioCtx();
    // C5=523.25, E5=659.25, G5=784
    playNote(523.25, 80, 'triangle', 0.25, 0,     ac);
    playNote(659.25, 80, 'triangle', 0.25, 0.09,  ac);
    playNote(784,    120,'triangle', 0.2,  0.18,  ac);
  } catch { /* ignore */ }
}

// G3 low tone — task missed
export function playMissed() {
  if (!isSoundEnabled()) return;
  playNote(196, 150, 'sine', 0.18);
}

// E5 bell — zen timer ends
export function playZenEnd() {
  if (!isSoundEnabled()) return;
  playNote(659.25, 400, 'sine', 0.28);
}

// C6 tick — sub-task checked
export function playSubtaskTick() {
  if (!isSoundEnabled()) return;
  playNote(1046.5, 40, 'square', 0.06);
}

export function useSound() {
  return { playComplete, playMissed, playZenEnd, playSubtaskTick };
}

export function closeAudioContext() {
  if (window._kardeAudioCtx && window._kardeAudioCtx.state !== 'closed') {
    window._kardeAudioCtx.close().catch(() => {});
    window._kardeAudioCtx = null;
  }
}

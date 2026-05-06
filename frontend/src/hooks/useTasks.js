import { useState, useEffect, useCallback, useRef } from 'react';
import { requestNotificationPermission, sendAppNotification } from '../utils/notifications';

const SETTINGS_KEY = 'karde_settings';
const PINNED_KEY   = 'karde_pinned';
const CACHE_KEY    = 'karde_tasks_cache';
const API_HOST = (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '');
const API_URL  = API_HOST ? `${API_HOST}/api/tasks` : '/api/tasks';

export const getYYYYMMDD = (d) =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

// ─── Notification scheduling helpers ─────────────────────────────────────────
function msUntilTime(hhmm) {
  if (!hhmm) return -1;
  const [h, m] = hhmm.split(':').map(Number);
  const now = new Date();
  const target = new Date(now);
  target.setHours(h, m, 0, 0);
  return target - now;
}

function scheduleNotif(task, timeoutMapRef) {
  if (!task.due_time || task.status !== 'pending') return;
  const ms = msUntilTime(task.due_time);
  if (ms <= 0) return;
  if (timeoutMapRef.current.has(task.id)) return; // already scheduled
  const tid = setTimeout(() => {
    if (Notification.permission === 'granted') {
      sendAppNotification('⏰ Kar De', {
        body: `${task.title || task.raw} — time to get it done!`,
        icon: '/favicon.ico',
      });
    }
    timeoutMapRef.current.delete(task.id);
  }, ms);
  timeoutMapRef.current.set(task.id, tid);
}

function cancelNotif(taskId, timeoutMapRef) {
  if (timeoutMapRef.current.has(taskId)) {
    clearTimeout(timeoutMapRef.current.get(taskId));
    timeoutMapRef.current.delete(taskId);
  }
}

// ─── Main hook ────────────────────────────────────────────────────────────────
export function useTasks(idToken = null, getFreshToken = null) {
  const [tasks, setTasks] = useState(() => {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '[]'); } catch { return []; }
  });
  const [settings, setSettings] = useState(() => {
    try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{"apiKey":""}'); } catch { return { apiKey: '' }; }
  });
  const [toast, setToast] = useState({ show: false, msg: '', actions: [] });
  const [dailyLimitToastShown, setDailyLimitToastShown] = useState(false);
  const toastTimerRef   = useRef(null);
  const notifTimeouts   = useRef(new Map()); // task.id → timeoutId
  const notifiedTasksRef = useRef(new Set());

  // ─── Pin helpers ─────────────────────────────────────────────────────────
  const getPinnedSet = useCallback(() => {
    try { return new Set(JSON.parse(localStorage.getItem(PINNED_KEY) || '[]')); } catch { return new Set(); }
  }, []);
  const setPinnedSet = useCallback((s) => {
    localStorage.setItem(PINNED_KEY, JSON.stringify(Array.from(s)));
  }, []);
  const hydratePinnedState = useCallback((rows) => {
    const pinnedIds = getPinnedSet();
    return rows.map(task => ({ ...task, is_pinned: bool(task.is_pinned) || pinnedIds.has(task.id) }));
    function bool(v) { return v === true || v === 1 || v === '1'; }
  }, [getPinnedSet]);

  // ─── Toast ───────────────────────────────────────────────────────────────
  const showToast = (msg, actions = []) => {
    setToast({ show: true, msg, actions });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(t => ({ ...t, show: false })), 4000);
  };

  // ─── Fetch ───────────────────────────────────────────────────────────────
  const fetchTasks = useCallback(async () => {
    // If we have no token and we expect one (auth is not explicitly null/guest), 
    // we wait until idToken is available. 
    // Note: idToken will be null initially and then set by useAuth.
    if (!idToken) return;

    try {
      const headers = {};
      const token = getFreshToken ? await getFreshToken() : idToken;
      if (token) headers['Authorization'] = `Bearer ${token}`;
      
      // FIX: date auto-update — call sync-recurring on every fetch to ensure overnight tasks are properly spawned
      try {
        await fetch(`${API_HOST}/api/tasks/sync-recurring`, {
          method: 'POST',
          headers: { ...headers, 'X-Local-Date': getYYYYMMDD(new Date()) }
        });
      } catch (e) { console.warn('sync-recurring failed', e); }

      const res = await fetch(API_URL, { headers });
      if (!res.ok) {
        if (res.status === 401) {
          // Token might be expired or invalid, don't overwrite cache with "default" data
          return;
        }
        throw new Error('fetch failed');
      }
      
      const data = await res.json();
      const hydrated = hydratePinnedState(data);
      setTasks(hydrated);
      localStorage.setItem(CACHE_KEY, JSON.stringify(hydrated));
      
      // schedule notifications for today's pending tasks
      if (Notification.permission === 'granted') {
        hydrated.forEach(t => {
          if (t.status === 'pending' && t.due_time && getYYYYMMDD(new Date(t.addedAt)) === getYYYYMMDD(new Date())) {
            scheduleNotif(t, notifTimeouts);
          }
        });
      }
    } catch {
      showToast('Backend connection failed. Using cached data.');
    }
  }, [hydratePinnedState, idToken, getFreshToken]);

  useEffect(() => { 
    if (idToken) fetchTasks(); 
  }, [fetchTasks, idToken]);
  useEffect(() => {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings || { apiKey: '' })); } catch {}
  }, [settings]);
  useEffect(() => {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(tasks || [])); } catch {}
  }, [tasks]);

  // ─── Request notification permission on mount ─────────────────────────────
  useEffect(() => {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      requestNotificationPermission();
    }
  }, []);

  // ─── Headers ─────────────────────────────────────────────────────────────
  const getHeaders = async () => {
    const h = { 
      'Content-Type': 'application/json',
      'X-Local-Date': getYYYYMMDD(new Date())
    };
    if (settings.apiKey) h['x-api-key'] = settings.apiKey;
    // Always use a fresh token so it auto-refreshes after expiry
    const token = getFreshToken ? await getFreshToken() : idToken;
    if (token) h['Authorization'] = `Bearer ${token}`;
    return h;
  };

  // ─── Duplicate detection ──────────────────────────────────────────────────
  const buildWordSet = (v) =>
    new Set(v.toLowerCase().replace(/[^\w\s]/g,' ').split(/\s+/).filter(Boolean));
  const getDuplicateTask = (rawString) => {
    const newWords = buildWordSet(rawString);
    if (!newWords.size) return null;
    for (const task of tasks.filter(t => t.status === 'pending')) {
      const ew = buildWordSet(task.raw || task.title || '');
      let overlap = 0;
      newWords.forEach(w => { if (ew.has(w)) overlap++; });
      if (overlap / newWords.size >= 0.7) return task;
    }
    return null;
  };

  // ─── Save task ────────────────────────────────────────────────────────────
  const saveTask = async (rawString, options = {}) => {
    if (!rawString) return;
    const tId = Date.now().toString();
    const nowIso = new Date().toISOString();
    const title = options.title || rawString;
    const tempTask = {
      id: tId, raw: rawString, title: title || 'New Task',
      status: 'pending', addedAt: nowIso,
      is_pinned: false, is_recurring: Boolean(options.is_recurring),
      recurrence: options.recurrence || null,
      due_time: options.due_time || null,
      subtasks: options.subtasks || null,
      priority: options.priority || 'medium',
      category: options.category || null,
      loading: true,
    };
    setTasks(prev => [tempTask, ...prev]);
    try {
      const res = await fetch(API_URL, {
        method: 'POST', headers: await getHeaders(),
        body: JSON.stringify({
          id: tId, raw: rawString, addedAt: tempTask.addedAt,
          title: options.title || null,
          category: options.category || null,
          skip_ai: Boolean(options.skip_ai),
          is_recurring: Boolean(options.is_recurring),
          recurrence: options.recurrence || null,
          due_time: options.due_time || null,
          subtasks: options.subtasks || null,
          priority: options.priority || 'medium',
          status: options.status || 'pending',
        }),
      });
      if (!res.ok) throw new Error();
      const realTask = await res.json();
      setTasks(prev => prev.map(t => t.id === tId ? { ...realTask, loading: false } : t));
      // schedule notification if due_time set
      if (realTask.due_time && Notification.permission === 'granted') {
        scheduleNotif(realTask, notifTimeouts);
      }
      if (realTask?.ai_failed) {
        const reason = realTask.ai_failure_reason || 'offline';
        if (reason === 'daily_limit' && !dailyLimitToastShown) {
          setDailyLimitToastShown(true);
          showToast('AI daily limit reached. Add your Gemini API key in Settings.', [
            { label: 'Open Settings', onClick: () => window.dispatchEvent(new Event('karde:open-settings')) },
          ]);
        } else if (['rate_limit','offline','model_not_found'].includes(reason)) {
          showToast('AI unavailable. Add your Gemini API key in Settings.', [
            { label: 'Open Settings', onClick: () => window.dispatchEvent(new Event('karde:open-settings')) },
          ]);
        }
      }
    } catch {
      setTasks(prev => prev.map(t => t.id === tId ? { ...t, loading: false, title } : t));
      showToast('Sync failed – saved locally.');
    }
  };

  const lastAddRef = useRef(0);

  const addTask = async (rawString, options = {}) => {
    const now = Date.now();
    if (now - lastAddRef.current < 300) return; // Debounce 300ms
    lastAddRef.current = now;

    if (options.skip_duplicate_check) { await saveTask(rawString, options); return; }
    const dup = getDuplicateTask(rawString);
    if (!dup) { await saveTask(rawString, options); return; }
    showToast(`Yeh task pehle se hai — '${dup.title || dup.raw}'. Phir bhi add karein?`, [
      { label: 'Add Anyway', onClick: () => saveTask(rawString, options) },
      { label: 'Cancel', onClick: () => {} },
    ]);
  };

  const toggleTask = async (id) => {
    const t = tasks.find(x => x.id === id);
    if (!t || t.loading) return;
    const oldStatus = t.status;
    const completing = oldStatus === 'pending';
    if (completing) cancelNotif(id, notifTimeouts);
    setTasks(prev => prev.map(x => {
      if (x.id !== id) return x;
      return x.status === 'pending'
        ? { ...x, status: 'completed', completedAt: new Date().toISOString() }
        : { ...x, status: 'pending', completedAt: null };
    }));
    try {
      const res = await fetch(`${API_URL}/${id}/toggle`, { method: 'PUT', headers: await getHeaders() });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setTasks(prev => prev.map(x => x.id === id ? { ...updated } : x));
    } catch {
      setTasks(prev => prev.map(x => x.id === id ? { ...x, status: oldStatus } : x));
      showToast('Toggle failed.');
    }
  };

  const deleteTask = async (id) => {
    cancelNotif(id, notifTimeouts);
    setTasks(prev => prev.filter(t => t.id !== id));
    try {
      const res = await fetch(`${API_URL}/${id}`, { method: 'DELETE', headers: await getHeaders() });
      if (!res.ok) throw new Error();
    } catch { fetchTasks(); showToast('Delete failed.'); }
  };

  const bulkCompleteToday = async (taskIds = []) => {
    const now = new Date().toISOString();
    taskIds.forEach(id => cancelNotif(id, notifTimeouts));
    setTasks(prev => prev.map(t => taskIds.includes(t.id) ? { ...t, status: 'completed', completedAt: now } : t));
    try {
      const updates = taskIds.map(id => ({ id, status: 'completed', completedAt: now }));
      const res = await fetch(`${API_URL}/bulk`, { method: 'PUT', headers: await getHeaders(), body: JSON.stringify(updates) });
      if (!res.ok) throw new Error();
      fetchTasks();
    } catch { showToast('Bulk update failed.'); fetchTasks(); }
  };

  const updateTaskTitle = async (id, title) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, title } : t));
    try { await fetch(`${API_URL}/${id}`, { method: 'PUT', headers: await getHeaders(), body: JSON.stringify({ title }) }); }
    catch { showToast('Update failed.'); }
  };

  const updateTaskDueTime = async (id, due_time) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, due_time } : t));
    try { await fetch(`${API_URL}/${id}`, { method: 'PUT', headers: await getHeaders(), body: JSON.stringify({ due_time }) }); }
    catch { showToast('Time update failed.'); }
  };

  // Full PATCH update (for inline editor — Feature 1)
  const updateTask = async (id, fields) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...fields } : t));
    try {
      const res = await fetch(`${API_URL}/${id}`, {
        method: 'PATCH', headers: await getHeaders(), body: JSON.stringify(fields),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setTasks(prev => prev.map(t => t.id === id ? { ...updated } : t));
      // reschedule notification if due_time changed
      cancelNotif(id, notifTimeouts);
      if (updated.due_time && Notification.permission === 'granted') {
        scheduleNotif(updated, notifTimeouts);
      }
    } catch { showToast('Update failed.'); }
  };

  const addTemplateTasks = async (templateTasks = []) => {
    for (const item of templateTasks) await addTask(item.title, { skip_ai: true });
  };

  const togglePinTask = async (id) => {
    const task = tasks.find(x => x.id === id);
    if (!task) return;
    const nextPinned = !task.is_pinned;
    const pinnedSet = getPinnedSet();
    if (nextPinned) pinnedSet.add(id); else pinnedSet.delete(id);
    setPinnedSet(pinnedSet);
    setTasks(prev => prev.map(x => x.id === id ? { ...x, is_pinned: nextPinned } : x));
    try {
      await fetch(`${API_URL}/${id}`, { method: 'PUT', headers: await getHeaders(), body: JSON.stringify({ is_pinned: nextPinned }) });
    } catch {
      const rb = getPinnedSet();
      if (nextPinned) rb.delete(id); else rb.add(id);
      setPinnedSet(rb);
      setTasks(prev => prev.map(x => x.id === id ? { ...x, is_pinned: !nextPinned } : x));
    }
  };

  // ─── AI Decompose (Feature 4) ─────────────────────────────────────────────
  const decomposeTask = async (title) => {
    try {
      const res = await fetch(`${API_URL}/decompose`, {
        method: 'POST', headers: await getHeaders(), body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      return data.steps || [];
    } catch (e) {
      showToast('Could not decompose task. Try again.');
      return [];
    }
  };

  // ─── AI Rewrite ─────────────────────────────────────────────
  const rewriteTaskTitle = async (title) => {
    try {
      const res = await fetch(`${API_URL}/rewrite`, {
        method: 'POST', headers: await getHeaders(), body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      return data.title || null;
    } catch (e) {
      showToast('Could not rewrite task. Try again.');
      return null;
    }
  };

  // ─── AI Plan Day (Feature 6) ──────────────────────────────────────────────
  const planDay = async (pendingTasks, missedPattern = null) => {
    try {
      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const res = await fetch(`${API_URL}/plan-day`, {
        method: 'POST', headers: await getHeaders(),
        body: JSON.stringify({
          tasks: pendingTasks.map(t => ({ id: t.id, title: t.title || t.raw, priority: t.priority })),
          missed_pattern: missedPattern,
          current_time: now,
        }),
      });
      if (!res.ok) throw new Error();
      return await res.json();
    } catch {
      showToast('Could not generate plan. Try again.');
      return null;
    }
  };

  // Toggle a single subtask (Feature 1 refinement)
  const toggleSubtask = async (taskId, subtaskIndex) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !task.subtasks) return;
    try {
      const steps = JSON.parse(task.subtasks);
      steps[subtaskIndex].done = !steps[subtaskIndex].done;
      const newSubtasks = JSON.stringify(steps);
      await updateTask(taskId, { subtasks: newSubtasks });
    } catch (e) {
      console.error('Failed to toggle subtask', e);
    }
  };

  // ─── Productivity Score Calculation ───────────────────────────────────────
  const calculateProductivityScore = useCallback(() => {
    const todayStr = getYYYYMMDD(new Date());
    const todaysTasks = tasks.filter(t => getYYYYMMDD(new Date(t.addedAt)) === todayStr);
    const completedToday = todaysTasks.filter(t => t.status === 'completed').length;
    const missedToday = todaysTasks.filter(t => t.status === 'missed').length;
    
    let taskScore = 0;
    if (todaysTasks.length > 0) {
      taskScore = (completedToday / todaysTasks.length) * 100;
    }

    // Focus sessions score
    const focusStatsStr = localStorage.getItem('karde_focus_stats');
    let focusScore = 100;
    if (focusStatsStr) {
      try { focusScore = JSON.parse(focusStatsStr).score || 100; } catch {}
    }

    // Combined score (70% tasks, 30% focus) - habits could be added too
    const totalScore = Math.round((taskScore * 0.7) + (focusScore * 0.3));
    return Math.min(100, Math.max(0, totalScore));
  }, [tasks]);

  const [productivityScore, setProductivityScore] = useState(0);
  useEffect(() => {
    setProductivityScore(calculateProductivityScore());
  }, [calculateProductivityScore]);

  return {
    tasks, addTask, toggleTask, deleteTask, togglePinTask,
    settings, setSettings, toast, bulkCompleteToday,
    updateTaskTitle, addTemplateTasks, updateTaskDueTime,
    updateTask, decomposeTask, planDay, toggleSubtask, rewriteTaskTitle,
    fetchTasks, productivityScore,
    clearData: async () => {
      if (confirm('Clear all?')) {
        await fetch(`${API_URL}/clear`, { method: 'POST', headers: await getHeaders() });
        setTasks([]);
        try { localStorage.removeItem(CACHE_KEY); localStorage.removeItem(PINNED_KEY); } catch {}
      }
    },
    confirmBulkComplete: (taskIds) => {
      showToast('Complete all?', [{ label: 'Confirm', onClick: () => bulkCompleteToday(taskIds) }]);
    },
  };
}

import { useState, useEffect, useCallback, useRef } from 'react';

const SETTINGS_KEY = 'karde_settings';
const PINNED_KEY = 'karde_pinned';
const CACHE_KEY = 'karde_tasks_cache';
const NOTIFY_DENIED_TOAST_KEY = 'karde_notify_denied_shown';
const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
const API_URL = `${API_BASE}/api/tasks`;

export const getYYYYMMDD = (d) => {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function useTasks() {
  const [tasks, setTasks] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(CACHE_KEY) || '[]');
    } catch {
      return [];
    }
  });
  const [settings, setSettings] = useState(() => JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{"apiKey":""}'));
  const [toast, setToast] = useState({ show: false, msg: '', actions: [] });
  const [dailyLimitToastShown, setDailyLimitToastShown] = useState(false);
  const toastTimerRef = useRef(null);
  const notifiedTasksRef = useRef(new Set());

  const getPinnedSet = useCallback(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(PINNED_KEY) || '[]'));
    } catch {
      return new Set();
    }
  }, []);

  const setPinnedSet = useCallback((setVal) => {
    localStorage.setItem(PINNED_KEY, JSON.stringify(Array.from(setVal)));
  }, []);

  const hydratePinnedState = useCallback((rows) => {
    const pinnedIds = getPinnedSet();
    return rows.map((task) => ({
      ...task,
      is_pinned: bool(task.is_pinned) || pinnedIds.has(task.id)
    }));
    function bool(v) { return v === true || v === 1 || v === "1"; }
  }, [getPinnedSet]);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json();
      const hydrated = hydratePinnedState(data);
      setTasks(hydrated);
      localStorage.setItem(CACHE_KEY, JSON.stringify(hydrated));
    } catch (e) {
      showToast("Backend connection failed. Using cached data.");
    }
  }, [hydratePinnedState]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  const showToast = (msg, actions = []) => {
    setToast({ show: true, msg, actions });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    const nextTimer = setTimeout(() => {
      setToast(t => ({ ...t, show: false }));
    }, 4000);
    toastTimerRef.current = nextTimer;
  };

  const checkNotifications = useCallback(() => {
    if (Notification.permission !== 'granted') return;
    const now = new Date();
    const currentTimeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    const todayStr = getYYYYMMDD(now);

    tasks.forEach(task => {
      if (task.status === 'pending' && task.due_time === currentTimeStr && !notifiedTasksRef.current.has(task.id)) {
        const taskDay = getYYYYMMDD(new Date(task.addedAt));
        if (taskDay === todayStr) {
          new Notification('💡 Kar De Reminder', { body: task.title || task.raw });
          notifiedTasksRef.current.add(task.id);
        }
      }
    });
  }, [tasks]);

  useEffect(() => {
    const nInterval = setInterval(checkNotifications, 10000);
    return () => clearInterval(nInterval);
  }, [checkNotifications]);

  const getHeaders = () => {
    const headers = { 'Content-Type': 'application/json' };
    if (settings.apiKey) headers['x-api-key'] = settings.apiKey;
    return headers;
  };

  const saveTask = async (rawString, options = {}) => {
    if (!rawString) return;
    const tId = Date.now().toString();
    const nowIso = new Date().toISOString();
    const title = options.title || rawString;
    const tempTask = {
      id: tId, raw: rawString, title, status: 'pending', addedAt: nowIso,
      is_pinned: false, is_recurring: Boolean(options.is_recurring),
      recurrence: options.recurrence || null, due_time: options.due_time || null, loading: true
    };

    setTasks(prev => [tempTask, ...prev]);

    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: getHeaders(),
        body: JSON.stringify({
          id: tId, raw: rawString, addedAt: tempTask.addedAt, title: options.title || null,
          skip_ai: Boolean(options.skip_ai), is_recurring: Boolean(options.is_recurring),
          recurrence: options.recurrence || null, due_time: options.due_time || null
        })
      });
      if (!res.ok) throw new Error();
      const realTask = await res.json();
      setTasks(prev => prev.map(t => t.id === tId ? { ...realTask, loading: false } : t));
    } catch {
      setTasks(prev => prev.map(t => t.id === tId ? { ...t, loading: false, title } : t));
      showToast("Sync failed – saved locally.");
    }
  };

  const buildWordSet = (value) => (
    new Set(
      value
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(Boolean)
    )
  );

  const getDuplicateTask = (rawString) => {
    const newWords = buildWordSet(rawString);
    if (newWords.size === 0) return null;
    const pendingTasks = tasks.filter(t => t.status === 'pending');
    for (const task of pendingTasks) {
      const existingWords = buildWordSet(task.raw || task.title || '');
      let overlap = 0;
      newWords.forEach(w => {
        if (existingWords.has(w)) overlap += 1;
      });
      const score = overlap / newWords.size;
      if (score >= 0.7) return task;
    }
    return null;
  };

  const addTask = async (rawString, options = {}) => {
    if (options.skip_duplicate_check) {
      await saveTask(rawString, options);
      return;
    }
    const dup = getDuplicateTask(rawString);
    if (!dup) {
      await saveTask(rawString, options);
      return;
    }
    showToast(`Yeh task pehle se hai — '${dup.title || dup.raw}'. Phir bhi add karein?`, [
      { label: 'Add Anyway', onClick: () => saveTask(rawString, options) },
      { label: 'Cancel', onClick: () => {} }
    ]);
  };

  const toggleTask = async (id) => {
    const t = tasks.find(x => x.id === id);
    if (!t || t.loading) return;
    const oldStatus = t.status;
    setTasks(prev => prev.map(x => {
      if (x.id === id) {
        if (x.status === 'pending') return { ...x, status: 'completed', completedAt: new Date().toISOString() };
        return { ...x, status: 'pending', completedAt: null };
      }
      return x;
    }));

    try {
      const res = await fetch(`${API_URL}/${id}/toggle`, { method: "PUT" });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setTasks(prev => prev.map(x => x.id === id ? { ...updated } : x));
    } catch {
      setTasks(prev => prev.map(x => x.id === id ? { ...x, status: oldStatus } : x));
      showToast("Toggle failed.");
    }
  };

  const deleteTask = async (id) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    try {
      const res = await fetch(`${API_URL}/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      fetchTasks();
      showToast("Delete failed.");
    }
  };

  const bulkCompleteToday = async (taskIds = []) => {
    const now = new Date().toISOString();
    setTasks(prev => prev.map(t => (taskIds.includes(t.id) ? { ...t, status: 'completed', completedAt: now } : t)));
    try {
      const updates = taskIds.map(id => ({ id, status: 'completed', completedAt: now }));
      const res = await fetch(`${API_URL}/bulk`, {
        method: 'PUT', headers: getHeaders(), body: JSON.stringify(updates)
      });
      if (!res.ok) throw new Error();
      fetchTasks();
    } catch {
      showToast("Bulk update failed.");
      fetchTasks();
    }
  };

  const updateTaskTitle = async (id, title) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, title } : t));
    try {
      await fetch(`${API_URL}/${id}`, {
        method: 'PUT', headers: getHeaders(), body: JSON.stringify({ title })
      });
    } catch { showToast("Update failed."); }
  };

  const updateTaskDueTime = async (id, due_time) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, due_time } : t));
    try {
      await fetch(`${API_URL}/${id}`, {
        method: 'PUT', headers: getHeaders(), body: JSON.stringify({ due_time })
      });
    } catch { showToast("Time update failed."); }
  };

  const addTemplateTasks = async (templateTasks = []) => {
    for (const item of templateTasks) {
      await addTask(item.title, { skip_ai: true });
    }
  };

  const togglePinTask = async (id) => {
    const task = tasks.find(x => x.id === id);
    if (!task) return;
    const nextPinned = !task.is_pinned;
    setTasks(prev => prev.map(x => x.id === id ? { ...x, is_pinned: nextPinned } : x));
    try {
      await fetch(`${API_URL}/${id}`, {
        method: "PUT", headers: getHeaders(), body: JSON.stringify({ is_pinned: nextPinned })
      });
    } catch {
      setTasks(prev => prev.map(x => x.id === id ? { ...x, is_pinned: !nextPinned } : x));
    }
  };

  return {
    tasks, addTask, toggleTask, deleteTask, togglePinTask,
    settings, setSettings, toast, bulkCompleteToday,
    updateTaskTitle, addTemplateTasks, updateTaskDueTime,
    clearData: async () => {
      if (confirm("Clear all?")) {
        await fetch(`${API_URL}/clear`, { method: "POST" });
        setTasks([]);
      }
    },
    confirmBulkComplete: (taskIds) => {
      showToast('Complete all?', [{ label: 'Confirm', onClick: () => bulkCompleteToday(taskIds) }]);
    }
  };
}



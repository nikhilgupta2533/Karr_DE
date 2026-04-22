import { useState, useCallback, useEffect } from 'react';

const API_HOST = (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '');
const HABITS_URL = API_HOST ? `${API_HOST}/api/habits` : '/api/habits';

export function useHabits(idToken = null, getFreshToken = null) {
  const [habits, setHabits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getHeaders = async (extra = {}) => {
    const h = { ...extra };
    const token = getFreshToken ? await getFreshToken() : idToken;
    if (token) h['Authorization'] = `Bearer ${token}`;
    return h;
  };

  const fetchHabits = useCallback(async () => {
    if (!idToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(HABITS_URL, { headers: await getHeaders() });
      if (!res.ok) {
        if (res.status === 401) return;
        throw new Error('fetch failed');
      }
      const data = await res.json();
      setHabits(data);
    } catch (e) {
      setError('Could not load habits');
    } finally {
      setLoading(false);
    }
  }, [idToken, getFreshToken]);

  // Auto-fetch on mount or when token changes
  useEffect(() => {
    if (idToken) fetchHabits();
  }, [idToken, fetchHabits]);

  const addHabit = useCallback(async (name, icon = '⭐') => {
    try {
      const res = await fetch(HABITS_URL, {
        method: 'POST',
        headers: { ...(await getHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, icon }),
      });
      if (!res.ok) throw new Error();
      const h = await res.json();
      setHabits(prev => [h, ...prev]);
    } catch {
      setError('Could not create habit');
    }
  }, [idToken]);

  const removeHabit = useCallback(async (id) => {
    setHabits(prev => prev.filter(h => h.id !== id));
    try {
      await fetch(`${HABITS_URL}/${id}`, { method: 'DELETE', headers: await getHeaders() });
    } catch {
      fetchHabits();
    }
  }, [fetchHabits, idToken]);

  const logHabit = useCallback(async (id) => {
    setHabits(prev => prev.map(h => h.id === id ? { ...h, logged_today: true, streak: h.streak + 1 } : h));
    try {
      await fetch(`${HABITS_URL}/${id}/log`, { method: 'POST', headers: await getHeaders() });
    } catch {
      fetchHabits();
    }
  }, [fetchHabits, idToken]);

  const unlogHabit = useCallback(async (id) => {
    setHabits(prev => prev.map(h => h.id === id ? { ...h, logged_today: false, streak: Math.max(0, h.streak - 1) } : h));
    try {
      await fetch(`${HABITS_URL}/${id}/log`, { method: 'DELETE', headers: await getHeaders() });
    } catch {
      fetchHabits();
    }
  }, [fetchHabits, idToken]);

  const fetchHeatmap = useCallback(async (id) => {
    try {
      const res = await fetch(`${HABITS_URL}/${id}/heatmap`, { headers: await getHeaders() });
      if (!res.ok) throw new Error();
      return await res.json();
    } catch {
      return [];
    }
  }, [idToken]);

  return { habits, loading, error, fetchHabits, addHabit, removeHabit, logHabit, unlogHabit, fetchHeatmap };
}

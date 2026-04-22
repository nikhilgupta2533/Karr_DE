import { useState, useEffect, useCallback } from 'react';
import { auth } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export function useAuth() {
  // undefined = still loading, null = signed out, object = signed in
  const [user, setUser]       = useState(undefined);
  const [idToken, setIdToken] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const token = await firebaseUser.getIdToken();
          setIdToken(token);
        } catch {
          setIdToken(null);
        }
        setUser(firebaseUser);
      } else {
        setUser(null);
        setIdToken(null);
      }
    });
    return unsubscribe;
  }, []);

  // Call before any API request to get a fresh (auto-refreshed) token
  const getFreshToken = useCallback(async () => {
    if (!auth.currentUser) return null;
    try {
      const token = await auth.currentUser.getIdToken();
      // Only update if it actually changed to avoid unnecessary re-renders
      setIdToken(prev => prev === token ? prev : token);
      return token;
    } catch {
      return null;
    }
  }, []);

  const deleteAccount = async () => {
    if (!auth.currentUser) return;
    try {
      const token = await getFreshToken();
      const API_HOST = (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '');
      const url = API_HOST ? `${API_HOST}/api/account` : '/api/account';
      
      // 1. Delete backend data FIRST
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(`BACKEND_ERROR: ${errData.detail || res.statusText}`);
      }

      // 2. Delete Firebase account
      try {
        await auth.currentUser.delete();
      } catch (fbErr) {
        if (fbErr.code === 'auth/requires-recent-login') {
          throw new Error('SECURITY_REAUTH');
        }
        throw fbErr;
      }
      
    } catch (err) {
      console.error('Delete account error:', err);
      throw err;
    }
  };

  return { user, idToken, loading: user === undefined, getFreshToken, deleteAccount };
}

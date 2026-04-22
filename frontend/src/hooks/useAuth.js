import { useState, useEffect } from 'react';
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
  const getFreshToken = async () => {
    if (!auth.currentUser) return null;
    try {
      const token = await auth.currentUser.getIdToken();
      setIdToken(token);
      return token;
    } catch {
      return null;
    }
  };

  return { user, idToken, loading: user === undefined, getFreshToken };
}

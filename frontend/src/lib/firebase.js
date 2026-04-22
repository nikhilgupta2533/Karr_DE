import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyA4u0JJjQeYLe2k3FXJz5uCd53b6vMxa80",
  authDomain: "karr-de-auth.firebaseapp.com",
  projectId: "karr-de-auth",
  storageBucket: "karr-de-auth.firebasestorage.app",
  messagingSenderId: "838029128375",
  appId: "1:838029128375:web:6577f255ff4c00ea8e9332"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export async function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export async function signOutUser() {
  return signOut(auth);
}

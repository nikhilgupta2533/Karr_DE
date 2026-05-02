import { useState, useEffect, useCallback } from 'react';
import { auth } from '../lib/firebase';

const API_BASE    = (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '');
const FOLDERS_KEY = 'karde_folders_v1';
const NOTES_KEY   = 'karde_notes_v1';

// ── Helpers ────────────────────────────────────────────────────────────────────
function genId() { return `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`; }

function load(key) {
  try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; }
}
function persist(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

async function getH() {
  try {
    if (!auth.currentUser) return { 'Content-Type': 'application/json' };
    const token = await auth.currentUser.getIdToken();
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
  } catch {
    return { 'Content-Type': 'application/json' };
  }
}

const url = (path) => API_BASE ? `${API_BASE}${path}` : path;

// Convert backend NoteDB row → frontend note object
function toNote(n) {
  let scheduled = [];
  try { scheduled = JSON.parse(n.scheduled || '[]'); } catch {}
  return {
    id: n.id,
    folderId: n.folder_id,
    title: n.title || '',
    body: n.body || '',
    scheduled,
    createdAt: n.created_at,
    updatedAt: n.updated_at,
  };
}
// Convert backend FolderDB row → frontend folder object
function toFolder(f) {
  return { id: f.id, name: f.name, emoji: f.emoji, createdAt: f.created_at };
}

// ── Hook ───────────────────────────────────────────────────────────────────────
export function useNotes() {
  const [folders, setFolders] = useState(() => load(FOLDERS_KEY));
  const [notes,   setNotes]   = useState(() => load(NOTES_KEY));
  const [synced,  setSynced]  = useState(false);

  // Persist locally whenever state changes
  useEffect(() => { persist(FOLDERS_KEY, folders); }, [folders]);
  useEffect(() => { persist(NOTES_KEY,   notes);   }, [notes]);

  // Sync from backend on mount (non-blocking — local data renders first)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const h = await getH();
        const [fRes, nRes] = await Promise.all([
          fetch(url('/api/notes/folders'), { headers: h }),
          fetch(url('/api/notes'),         { headers: h }),
        ]);
        if (!fRes.ok || !nRes.ok || cancelled) return;
        const [fData, nData] = await Promise.all([fRes.json(), nRes.json()]);
        if (cancelled) return;
        const remoteFolders = fData.map(toFolder);
        const remoteNotes   = nData.map(toNote);
        setFolders(remoteFolders);
        setNotes(remoteNotes);
        persist(FOLDERS_KEY, remoteFolders);
        persist(NOTES_KEY,   remoteNotes);
        setSynced(true);
      } catch {
        setSynced(false); // offline — local data still works fine
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Folder CRUD ──────────────────────────────────────────────────────────────
  const createFolder = useCallback(async ({ name, emoji }) => {
    const id  = genId();
    const now = new Date().toISOString();
    const folder = { id, name, emoji: emoji || '📁', createdAt: now };
    setFolders(prev => [...prev, folder]);
    try {
      const h = await getH();
      await fetch(url('/api/notes/folders'), {
        method: 'POST', headers: h,
        body: JSON.stringify({ id, name, emoji: emoji || '📁', created_at: now }),
      });
    } catch {}
    return folder;
  }, []);

  const deleteFolder = useCallback(async (id) => {
    setFolders(prev => prev.filter(f => f.id !== id));
    setNotes(prev => prev.filter(n => n.folderId !== id));
    try {
      const h = await getH();
      await fetch(url(`/api/notes/folders/${id}`), { method: 'DELETE', headers: h });
    } catch {}
  }, []);

  const renameFolder = useCallback(async (id, newName) => {
    setFolders(prev => prev.map(f => f.id === id ? { ...f, name: newName } : f));
    // Backend PATCH (best-effort; server doesn't have a PATCH endpoint yet so just PUT with full data)
    try {
      const h = await getH();
      const stored = (await (await fetch(url('/api/notes/folders'), { headers: h })).json());
      const folder  = stored.find(f => f.id === id);
      if (folder) {
        // Re-create with new name (delete + create is cleanest without a dedicated PATCH)
        await fetch(url(`/api/notes/folders/${id}`), { method: 'DELETE', headers: h });
        await fetch(url('/api/notes/folders'), {
          method: 'POST', headers: h,
          body: JSON.stringify({ id, name: newName, emoji: folder.emoji, created_at: folder.created_at }),
        });
      }
    } catch {}
  }, []);

  // ── Note CRUD ────────────────────────────────────────────────────────────────
  const createNote = useCallback(async (folderId) => {
    const id  = genId();
    const now = new Date().toISOString();
    const note = { id, folderId, title: '', body: '', scheduled: [], createdAt: now, updatedAt: now };
    setNotes(prev => [note, ...prev]);
    try {
      const h = await getH();
      await fetch(url('/api/notes'), {
        method: 'POST', headers: h,
        body: JSON.stringify({ id, folder_id: folderId, title: '', body: '', scheduled: '[]', created_at: now, updated_at: now }),
      });
    } catch {}
    return note;
  }, []);

  const updateNote = useCallback(async (updated) => {
    const now   = new Date().toISOString();
    const final = { ...updated, updatedAt: now };
    setNotes(prev => prev.map(n => n.id === final.id ? final : n));
    try {
      const h = await getH();
      await fetch(url(`/api/notes/${final.id}`), {
        method: 'PUT', headers: h,
        body: JSON.stringify({
          title:     final.title || '',
          body:      final.body  || '',
          scheduled: JSON.stringify(final.scheduled || []),
          updated_at: now,
        }),
      });
    } catch {}
  }, []);

  const deleteNote = useCallback(async (id) => {
    setNotes(prev => prev.filter(n => n.id !== id));
    try {
      const h = await getH();
      await fetch(url(`/api/notes/${id}`), { method: 'DELETE', headers: h });
    } catch {}
  }, []);

  return { folders, notes, synced, createFolder, deleteFolder, renameFolder, createNote, updateNote, deleteNote };
}

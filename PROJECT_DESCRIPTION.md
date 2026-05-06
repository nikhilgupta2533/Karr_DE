# Kar De - Complete As-Built Project Description

This document is the full implementation-level description of **Kar De** as currently built in this repository.
It captures architecture, modules, data model, API surface, AI behavior, UX systems, and deployed runtime behavior.

---

## 1) Product Overview

**Kar De** is an AI-assisted productivity web app focused on converting raw thoughts into executable action and sustained routines.

Core product pillars:
- AI-assisted task structuring (parse, rewrite, decompose, plan-day, note-to-task)
- Execution-first daily workflow (Today tab + Focus Mode)
- Behavioral consistency systems (habits, streaks, missed-day tracking, score)
- Visual analytics and long-term trends
- Cloud-authenticated, local-resilient UX

---

## 2) Monorepo & Runtime Layout

Root structure:
- `frontend/` -> React 19 + Vite single-page app
- `backend/` -> FastAPI API layer + SQLAlchemy models + Gemini orchestration
- `api/index.py` -> Vercel serverless entry wrapper
- `karde_tasks.db` -> SQLite persistence in local/dev setup
- `vercel.json` -> routing/deployment behavior

Execution model:
- Frontend runs at Vite dev server or static Vercel build.
- Backend runs as FastAPI (local uvicorn) or serverless (Vercel functions).
- API-first architecture: frontend features map directly to REST endpoints.

---

## 3) Technology Stack (Implemented)

### Frontend
- React 19, React DOM 19
- Vite 8
- Vanilla CSS (custom design system with CSS variables)
- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` (task reorder)
- `chart.js` + `react-chartjs-2` (analytics visuals)
- `lucide-react` (icon system)
- `firebase` web SDK (client auth)
- `html2canvas` (share/export image captures)

### Backend
- FastAPI + Uvicorn
- SQLAlchemy ORM
- Google Generative AI (`google-generativeai`)
- `python-dotenv`, `python-dateutil`, `mangum`, `psycopg2-binary`
- SQLite by default, with PostgreSQL-safe migration patterns in startup logic

---

## 4) Backend Architecture (FastAPI)

### 4.1 Startup & Dynamic Schema Hardening
At server startup, `backend/main.py`:
- creates metadata tables
- inspects existing DB schema
- auto-adds missing columns in `tasks` and `habits`
- ensures `habit_logs` table exists for legacy DBs

This provides lightweight migration resilience without Alembic.

### 4.2 Authentication Model
- Firebase ID token verification via Google Identity Toolkit REST API
- 30-minute in-memory token cache to reduce repeated network verification
- strict Bearer handling in `get_current_uid`
- token verification is moved off event loop using `asyncio.to_thread`

Behavior:
- with proper Firebase setup: unauthorized requests return 401
- local/dev fallback behavior exists for default project compatibility

### 4.3 AI Orchestration Layer (`backend/ai.py`)
Implemented safeguards:
- model fallback chain:
  - `models/gemini-2.5-flash`
  - `models/gemini-2.5-flash-lite`
  - `models/gemini-2.0-flash`
  - `models/gemini-2.0-flash-lite`
  - `models/gemini-pro-latest`
- enforced 300ms spacing between calls using lock + timestamp
- per-user per-day AI usage tracking via `ai_usage`
- default daily limit: `DAILY_AI_LIMIT = 900`
- markdown-fence tolerant JSON validation/repair path

Returned AI failure reasons include:
- `daily_limit`
- `rate_limit`
- `model_not_found`
- `offline`

### 4.4 REST API Surface (Implemented)

#### Root
- `GET /` -> health status

#### Tasks
- `GET /api/tasks`
- `PUT /api/tasks/bulk`
- `POST /api/tasks`
- `PUT /api/tasks/{task_id}/toggle`
- `PUT /api/tasks/{task_id}`
- `PATCH /api/tasks/{task_id}`
- `PUT /api/tasks/midnight-miss`
- `POST /api/tasks/clear`
- `POST /api/tasks/sync-recurring`
- `DELETE /api/tasks/{task_id}`

#### AI Task Utilities
- `POST /api/tasks/rewrite`
- `POST /api/tasks/decompose`
- `POST /api/tasks/plan-day`
- `POST /api/tasks/note-to-task`

#### Habits
- `GET /api/habits`
- `POST /api/habits`
- `PATCH /api/habits/{habit_id}`
- `DELETE /api/habits/{habit_id}`
- `POST /api/habits/{habit_id}/log`
- `DELETE /api/habits/{habit_id}/log`
- `GET /api/habits/{habit_id}/heatmap`

#### Notes & Folders
- `GET /api/notes/folders`
- `POST /api/notes/folders`
- `DELETE /api/notes/folders/{folder_id}`
- `GET /api/notes`
- `POST /api/notes`
- `PUT /api/notes/{note_id}`
- `DELETE /api/notes/{note_id}`

#### Account
- `DELETE /api/account` (task + habit data cascade delete in backend)

---

## 5) Data Model (SQLAlchemy + Pydantic)

### Primary DB tables
- `tasks`
- `habits`
- `habit_logs`
- `folders`
- `notes`
- `ai_usage`

### Key Task fields
- ids, raw input, AI title, category, priority
- status (`pending/completed/missed`)
- timestamps (`addedAt/completedAt`)
- pin flag, recurrence, due time
- `subtasks` (JSON string)
- `missed_reason`
- `user_id`

### Habit fields
- name, icon, identity, difficulty
- active soft-delete model
- calculated response fields: streak/logged_today/missed_days

### Notes fields
- folder relation, title/body
- `scheduled` (JSON string for planned links)
- created/updated timestamps

---

## 6) Frontend Architecture

### 6.1 Core app composition
Main shell (`App.jsx`) composes:
- `Header`
- tab body (`Today`, `Plan`, `Records`, `Habits`, `Insights`)
- `BottomNav`
- `SettingsModal`
- `ReviewMissedModal`
- toast system
- auth/splash guards

### 6.2 Hooks (state + side effects)
- `useAuth`
  - Firebase session listener
  - fresh token retrieval for each API call path
  - account deletion flow (backend delete, then Firebase delete)
- `useTasks`
  - optimistic task mutations + reconciliation
  - local cache fallback
  - duplicate detection
  - pin persistence
  - due-time notifications
  - AI flows (rewrite/decompose/plan)
  - productivity score calculation
  - midnight sync-recurring integration
- `useHabits`
  - CRUD + log/unlog + heatmap + patch update
- `useNotes`
  - local-first notes/folders
  - background sync with backend
  - folder rename workaround path (delete+recreate due to no dedicated folder patch route)
- `useSound`
  - synthesized interaction tones

### 6.3 Visual/interaction system
- glassmorphism + blur surfaces
- theme system (`data-theme` light/dark)
- animated splash screen
- responsive bottom nav + card layout
- non-intrusive toast action prompts

---

## 7) Major Implemented Features (User-Level)

### 7.1 Today execution workflow
- natural task input bar
- suggestion chips
- recurrence selector
- due time picker
- AI decomposition preview with per-step include/exclude
- templates (preset + user-editable)
- sortable task list (`dnd-kit`)
- 1-task-first visual emphasis

### 7.2 Task card capabilities
- quick and full edit modes
- AI title rewrite in full editor
- due-time inline edits
- priority/category/difficulty/recurrence controls
- pin, delete, focus, complete toggles
- subtasks with progress ring and completion toggle

### 7.3 Recurring + midnight correctness
- pending tasks auto-mark missed when date rolls
- recurring tasks spawn next instance (daily/weekly/monthly)
- explicit `sync-recurring` API used on fetch/open to avoid stale date state

### 7.4 Focus mode ecosystem
- full-screen distraction-free overlay
- zen timer with progress ring
- interruption confirmation flow
- focus score updates (+5 completed session, -10 interruption)
- focus session summary (time + tasks completed)
- score explanation popover

### 7.5 Planning and notes
- folder-based notes workspace
- create/edit/delete notes
- schedule metadata per note
- note-to-task AI endpoint integration path

### 7.6 Habits system
- create/edit/delete (soft delete)
- daily log/unlog
- streak + missed day calculations
- per-habit heatmap data API

### 7.7 Insights/records layer
- productivity score surfaced in header and insights flow
- chart-driven historical perspective via Chart.js pipeline
- records/history tab for completed and missed context

### 7.8 Notifications and reminders
- browser notifications permission flow
- due-time scheduled reminders per task
- evening reminder when no completion progress (app-level behavior)

---

## 8) AI Feature Matrix (What Exists Today)

- **Task Parse (create task)**: converts raw thought to cleaner title; category guessed with heuristics.
- **Task Rewrite**: rewrites title into cleaner/professional phrasing.
- **Task Decompose**: returns up to 5 sub-steps.
- **Plan Day**: returns ordered plan + reasons using pending tasks, current time, missed pattern.
- **Note to Task**: converts note title/body to actionable task title.

Safety and resilience:
- strict JSON validation for all AI response contracts
- fallback behavior to non-AI/local mode when unavailable
- user-facing toasts for limit/offline/rate-limit states

---

## 9) Reliability Patterns

- optimistic UI across task/habit/note operations
- server reconciliation after mutating operations
- local storage cache for tasks/settings/notes/folders/pins
- graceful offline messaging and fallback behavior
- defensive endpoint ordering for task routes to avoid dynamic path conflicts

---

## 10) Security & Data Ownership

- Firebase token based API authorization
- per-user data scoping in DB queries
- account delete endpoint removes user task and habit data (including habit logs)
- no hardcoded production API keys in source

Note:
- notes/folders are user-scoped and deletable individually
- account deletion path currently explicitly clears tasks/habits on backend

---

## 11) Configuration

Environment variables used:
- `GEMINI_API_KEY`
- `FIREBASE_API_KEY`
- `FIREBASE_PROJECT_ID`
- `DATABASE_URL` (optional override; SQLite default exists)
- `CORS_ORIGINS` (optional extra allowed origins)
- `VITE_API_URL` (frontend API host override)

---

## 12) Deployment Model

- Frontend builds through Vite and is served as static assets.
- Backend runs as FastAPI locally and via Vercel serverless wrapper in production.
- `vercel.json` routes `/api/*` into backend handler path.
- Database is SQLite in local/dev; code is written with PostgreSQL-compatible SQL patterns where practical.

---

## 13) Current Status Snapshot

Kar De is currently a feature-rich AI productivity platform with:
- complete task lifecycle management
- active AI assistant workflows
- focus and scoring mechanics
- habits and notes subsystems
- responsive production-style UI
- authenticated multi-user backend structure

**Status**: Active and operational  
**Doc Type**: Implementation-level as-built description  
**Last Updated**: May 2026

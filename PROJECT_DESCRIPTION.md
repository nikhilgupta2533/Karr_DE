# Kar De - Comprehensive Project Blueprint & Current State

This document serves as the absolute source of truth for the **Kar De** project's current state. It details the exact architecture, feature implementations, UI components, and logic flows currently present in the codebase. This description is intended for developer handoff, team planning, and as context for AI assistants to plan future feature integrations.

---

## 1. Project Overview & Philosophy
**Kar De** is a premium, AI-orchestrated productivity ecosystem designed to bridge the gap between unstructured thoughts and execution. It leverages the Google Gemini AI ecosystem to process multilingual input (e.g., "gym jaana hai") and output professional task hierarchies. The application emphasizes deep work, seamless task management, and rigorous behavioral analytics.

---

## 2. Monorepo Architecture & Tech Stack
The project uses a high-performance monorepo structure optimized for both local development and Vercel serverless deployment.

### 2.1 Backend Layer (Python 3.10+, FastAPI)
- **Framework**: FastAPI with asynchronous routing for high concurrency.
- **Database**: SQLite (`karde_tasks.db`) managed via SQLAlchemy ORM.
- **Dynamic Migrations**: `main.py` utilizes a lightweight runtime schema patching mechanism on startup to dynamically add new columns (e.g., `is_pinned`, `is_recurring`, `recurrence`, `due_time`, `subtasks`) without the overhead of heavy Alembic migrations.
- **Authentication**: Custom Firebase token verification implemented natively via the Identity Toolkit REST API (`_verify_token_sync`). Includes an in-memory 30-minute caching mechanism (`_token_cache`) to completely avoid the bulky Firebase Admin SDK dependency.
- **Entry Points**: 
  - `backend/main.py`: Core FastAPI application and routing.
  - `backend/ai.py`: Centralized Gemini AI orchestration.
  - `backend/models.py`: SQLAlchemy schemas and Pydantic validation models.
  - `api/index.py`: Vercel serverless entry handler.

### 2.2 Frontend Layer (React 19, Vite)
- **Framework**: React 19 built with Vite.
- **Styling**: Vanilla CSS utilizing a custom Glassmorphic design system. Features CSS Variables for dynamic Light/Dark mode and translucent surfaces (`backdrop-filter: blur(12px)`).
- **State Management**: Highly modular Custom React Hooks (`useAuth.js`, `useTasks.js`, `useHabits.js`, `useSound.js`).
- **Core Components**:
  - `App.jsx`: Main orchestrator, handles PWA service worker (`/sw.js`), theming, and toast notifications.
  - `AuthScreen.jsx`: Firebase email/Google authentication.
  - `TodayTab.jsx`: Main dashboard featuring task inputs, Zen Timer/Focus Mode, AI Planning, and pre-defined Templates.
  - `TaskCard.jsx`: Complex task representation supporting inline editing, subtask progress bars, pinning, recurrences, and due times.
  - `HabitsTab.jsx`: Habit tracking interface with a 365-day consistency heatmap.
  - `InsightsTab.jsx` & `RecordsTab.jsx`: Deep analytics, historical task views, weekly reports, and CSV/PDF/Image exports.
  - `SettingsModal.jsx`: App configuration and account management.

---

## 3. Intelligent AI Core (Gemini Orchestration)
All AI logic resides in `backend/ai.py` and `backend/prompts.py`, exposed via dedicated endpoints.

### 3.1 Multi-Model Fallback Engine
To ensure near 100% uptime against rate limits or outages, `call_gemini_with_fallback` iterates sequentially through an optimized model hierarchy:
1. `gemini-2.5-flash`
2. `gemini-2.5-flash-lite`
3. `gemini-2.0-flash`
4. `gemini-2.0-flash-lite`
5. `gemini-pro-latest`

### 3.2 Concurrency & Rate Limiting Controls
- **Global API Lock**: A Python `threading.Lock()` enforces a mandatory 300ms delay between consecutive Gemini API calls to prevent `429 Too Many Requests` errors.
- **Daily Usage Caps**: The database tracks AI usage per user per day in the `ai_usage` table. A hard limit of 900 calls per day (`DAILY_AI_LIMIT`) is enforced.
- **Resilient JSON Parsing**: `validate_and_repair_json` automatically strips Markdown code fences and repairs malformed AI outputs to ensure system stability.

### 3.3 Core AI Capabilities
- **Task Parsing (`/api/tasks`)**: Converts raw, multi-lingual user input into structured JSON containing clean titles and auto-categorizations.
- **Task Decomposition (`/api/tasks/decompose`)**: Breaks down complex tasks into 3-5 actionable sub-steps. The frontend allows users to preview and uncheck specific steps before creation.
- **Day Planning (`/api/tasks/plan-day`)**: Analyzes pending tasks, the user's historical weakest days, and the current time to output an optimal execution order with AI-generated reasoning.
- **Title Rewriting**: Users can invoke AI inline within `TaskCard.jsx` to professionally rewrite task titles.

---

## 4. Comprehensive Feature Sets

### 4.1 Task Lifecycle & Inline Management
- **Task Attributes**: ID, raw input, title, category, priority, status (pending, completed, missed), creation/completion timestamps, pinned state, recurring logic, due time, and JSON-serialized subtasks.
- **Subtask Progress**: Visual progress bars within task cards update in real-time as subtasks are checked off.
- **Inline Editor**: Double-clicking a task opens a quick editor. A full edit form allows modifying category, priority, recurrence, due time, and invoking the AI title rewriter.
- **Templates**: Pre-defined task bundles (e.g., "Morning Routine", "Work Day") can be injected with a single click.
- **Midnight Synchronization**: When tasks are fetched (`/api/tasks`), the backend checks for pending tasks from previous days. It automatically marks them as `missed` and invokes `spawn_next_recurring_task()` to create the next occurrence for recurring tasks.

### 4.2 Focus Mode & Zen Timer
- **Deep Work Environment**: An immersive overlay (`Focus Mode`) isolates the user with one task at a time.
- **Zen Timer**: A built-in 25-minute Pomodoro-style countdown timer with pause/resume functionality.
- **Audio Synthesis**: `useSound.js` utilizes the native Web Audio API to synthesize UI sounds locally (Triangle wave chime for completion, Sine wave bell for timers, Square wave tick for interactions), eliminating the need for bulky audio assets.

### 4.3 Habit & Consistency Tracking
- **Habit Entities**: Tracked independently with custom names and emojis.
- **Streak Calculation**: The backend dynamically walks backward from the current date through `habit_logs` to calculate the active streak.
- **GitHub-Style Heatmap**: The frontend renders a 365-day consistency grid reflecting `habit_logs` density.

### 4.4 Analytics, Exports & Reporting
- **Records & Weekly Review**: If the current day is Sunday, `RecordsTab.jsx` generates a weekly review highlighting the best day, most missed category, and streak status.
- **CSV Export**: Native generation of comprehensive CSV data files mapping out all task attributes.
- **PDF Generation**: Generates beautiful, styled HTML productivity reports (including bar charts and category breakdowns) and invokes native browser PDF printing.
- **Shareable Stats**: Integrates `html2canvas` to take high-fidelity screenshots of productivity stats for social sharing via the native `navigator.share` API.

### 4.5 Security & Data Sovereignty
- **Restricted-Identity Pattern**: Custom, lightweight token verification with in-memory caching.
- **User Isolation**: Strict filtering by `user_id` across all database operations.
- **Cascading Account Deletion**: The `/api/account` endpoint safely purges a user's tasks, habits, and logs from the database, ensuring complete data sovereignty.

---

## 5. Development & Deployment Configuration
- **Local Dev**: Run backend via `uvicorn backend.main:app --reload --port 8000` and frontend via `npm run dev`.
- **Environment Variables**: Requires `GEMINI_API_KEY`, `FIREBASE_API_KEY`, `FIREBASE_PROJECT_ID`. Optional: `DATABASE_URL`, `CORS_ORIGINS`.
- **Vercel Production**: Managed via `vercel.json` rewrites, mapping `/api/(.*)` to the FastAPI serverless handler (`api/index.py`) and letting Vite handle the static frontend routing. PWA capabilities are enabled via `sw.js`.

---
**Current Status**: Highly stable production build. Comprehensive logging, analytics, and deep-work mechanisms are fully implemented. Ready for team review and subsequent feature expansion.

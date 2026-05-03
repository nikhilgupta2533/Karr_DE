# Kar De - Comprehensive Project Blueprint & Technical Specification

This document serves as the definitive source of truth for the **Kar De** productivity ecosystem. It provides an exhaustive breakdown of the project's architecture, feature implementations, logic flows, and technical design decisions. This specification is intended for developer onboarding, system auditing, and as a comprehensive context for AI assistants to maintain project integrity during future expansions.

---

## 1. Core Philosophy & Value Proposition
**Kar De** is a premium, AI-orchestrated productivity powerhouse designed to transform unstructured human thoughts into disciplined execution. The application moves beyond simple "to-do lists" by leveraging the Google Gemini AI ecosystem to provide cognitive offloading, behavioral insights, and deep-work environments.

- **Cognitive Offloading**: Users can dump raw, multilingual thoughts (e.g., "kal gym jaana hai subah") which the AI structure into professional tasks.
- **Behavioral Science**: Integrated habit tracking and discipline scoring reward consistency and penalize interruptions.
- **Premium Aesthetics**: A "Glassmorphic" design system that feels alive, responsive, and distraction-free.

---

## 2. Technical Architecture & Monorepo Structure

### 2.1 Backend Layer (Python 3.10+, FastAPI)
- **Framework**: FastAPI utilizing asynchronous request handling for high performance.
- **Persistence**: SQLite (`karde_tasks.db`) managed via **SQLAlchemy ORM**.
- **Dynamic Schema Evolution**: The `main.py` entry point implements a lightweight runtime migration engine. On startup, it inspects the database and dynamically injects missing columns (e.g., `is_pinned`, `subtasks`, `missed_reason`) to ensure backward compatibility without heavy migration frameworks.
- **Native Firebase Auth**: Uses the Google Identity Toolkit REST API for token verification (`_verify_token_sync`), avoiding the heavy Firebase Admin SDK. Includes an in-memory 30-minute caching layer to minimize network overhead.
- **Deployment**: Configured for Vercel Serverless using `api/index.py` as the handler.

### 2.2 Frontend Layer (React 19, Vite)
- **Framework**: React 19 (Concurrent Mode ready) built with Vite for sub-second hot reloading.
- **Design System**: Vanilla CSS with a global variable-based theme engine. Features:
  - **Glassmorphism**: Translucent surfaces with `backdrop-filter: blur(12px)`.
  - **Dynamic Theming**: Real-time Light/Dark mode switching via `data-theme` attribute.
  - **Magnetic Interactions**: Custom logic for high-fidelity button feedback.
- **State Orchestration**: Logic is decoupled into modular custom hooks:
  - `useAuth`: Firebase authentication and token management.
  - `useTasks`: Task lifecycle, AI integration, and local persistence.
  - `useHabits`: Habit tracking logic and heatmap calculations.
  - `useNotes`: Folder-based note organization and persistence.
  - `useSound`: Native Web Audio API synthesis (no external assets).

---

## 3. Intelligent AI Engine (Gemini Orchestration)

The "AI Brain" resides in `backend/ai.py`, providing a resilient wrapper around Google's Generative AI.

### 3.1 Resiliency & Performance
- **Multi-Model Fallback**: Automatically cascades through `gemini-2.0-flash`, `gemini-2.0-flash-lite`, and `gemini-pro-latest` to ensure availability.
- **Concurrency Control**: A global `threading.Lock()` enforces a 300ms inter-call delay, preventing rate-limiting (429) errors during rapid user interaction.
- **Usage Governance**: Tracks `ai_usage` in the database with a `DAILY_AI_LIMIT` (default 900) per user.
- **Output Sanitization**: `validate_and_repair_json` utilizes regex to strip markdown fences and repair common LLM syntax errors before returning to the frontend.

### 3.2 Key AI Workflows
- **Natural Language Parsing**: Converts raw input into clean titles and auto-guesses categories (Work, Health, Home, Personal).
- **Smart Decomposition**: Breaks complex tasks into 3-5 actionable sub-steps. Users can preview, edit, or uncheck these steps before committing.
- **Day Planning (`/api/tasks/plan-day`)**: Analyzes the current task list, the current time, and historical "missed patterns" to output an optimized execution order with AI reasoning.
- **Note-to-Task**: AI reads long-form notes/journal entries and suggests a professional task title for scheduling.
- **Inline Title Rewriting**: Professionalizes existing task titles with a single click.

---

## 4. Feature Ecosystem: Deep Dive

### 4.1 Advanced Task Management
- **The "1 TASK RULE"**: Visually prioritizes the top pending task as the absolute focus.
- **Recurring Logic**: Support for Daily, Weekly, and Monthly recurrence. Midnight synchronization automatically spawns the next occurrence when the previous one is completed or missed.
- **Rich Task Attributes**: Pinned state, due times, priority levels, and JSON-serialized subtask lists.
- **Interactive Lifecycle**: Toggle completion, professional editor for fine-tuning, and drag-and-drop reordering via `@dnd-kit`.
- **Templates**: Pre-defined task bundles (e.g., "Deep Work", "Study Session") that can be customized and injected instantly.

### 4.2 Focus Mode & Zen Ecosystem
- **Immersive Environment**: Hides all UI distractions to show only the current task and its sub-steps.
- **Zen Timer (Pomodoro)**: A 25-minute visual progress ring with pulse animations.
- **Focus Scoring**: A behavioral metric (0-100) that increases with completed sessions (+5) and decreases with interruptions (-10).
- **Session Summaries**: Provides a "Post-Game" breakdown of time focused and objectives achieved.

### 4.3 Behavioral Insights & Analytics
- **KPI Stat Cards**: Real-time tracking of Total Done, Streak, Today's completions, and the Discipline Score.
- **Multi-Dimensional Charts**:
  - **7-Day Bar Chart**: Done vs. Missed tasks for weekly performance tracking.
  - **30-Day Trend**: Line chart showing completion momentum over time.
  - **Performance Rings**: Radial gauges for Day Streak, Weekly Rate, and Best Day.
- **Pattern Analysis**: Identifies the specific day of the week (e.g., "Tuesdays") where tasks tend to slip, offering AI-driven scheduling advice.
- **Activity Heatmap**: A 7-week grid reflecting the density of task completions.

### 4.4 Habits: Long-term Consistency
- **Identity Building**: Habits are linked to an identity (e.g., "I am a Reader") to reinforce behavioral psychology.
- **Difficulty Grading**: Easy, Medium, and Hard habits with varied impacts on the focus score.
- **52-Week Heatmap**: Full-year consistency tracking for every individual habit.
- **Streak Risk Detection**: Visual warnings (⚠️) when a habit is at risk of breaking due to missed days.

### 4.5 Planning & Note-taking (Plan Tab)
- **Folder Organization**: Categorize thoughts into folders with custom emojis.
- **Premium Writing Surface**: Utilizes the *Caveat* Google Font for a personal, handwritten journal aesthetic.
- **AI-Linked Scheduling**: Bridge the gap between a "thought" and a "task" by scheduling notes into the main task list.

### 4.6 Premium UX & Audio
- **Web Audio Synthesis**: `useSound.js` synthesizes Triangle (chime), Sine (bell), and Square (tick) waves in real-time, ensuring a zero-asset footprint.
- **Daily Check-In**: A mood-tracking modal that provides tailored productivity tips based on current energy levels (Focused, Tired, Lazy).
- **Social Sharing**: Generates high-fidelity screenshots of productivity stats using `html2canvas` for sharing via the Web Share API.

---

## 5. Security & Data Management
- **Firebase REST Auth**: Lightweight and secure. No client-side storage of sensitive credentials.
- **Data Sovereignty**: A "Delete Account" feature performs a cascading deletion of all tasks, habits, logs, folders, and notes from the database.
- **CSV/PDF Export**: Users can export their entire productivity history as structured CSV or professionally styled PDF reports.

---

## 6. Development & Deployment Roadmap

### 6.1 Environment Configuration
Required variables in `.env`:
- `GEMINI_API_KEY`: For all AI features.
- `FIREBASE_API_KEY` & `FIREBASE_PROJECT_ID`: For authentication.

### 6.2 Deployment Strategy
- **Frontend**: Deployed to Vercel as a static Vite application.
- **Backend**: Deployed as Vercel Serverless Functions. `vercel.json` rewrites all `/api/*` traffic to the FastAPI handler.
- **Database**: SQLite in development; compatible with PostgreSQL for production scale.

---
**Project Status**: v1.1.0 Stable. All core behavioral, AI, and analytic systems are operational.
**Last Updated**: May 2026.

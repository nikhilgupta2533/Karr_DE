# Kar De - Complete As-Built Project Description & Roadmap

This document serves as the full implementation-level description of **Kar De** as currently built, along with an in-depth analysis of its current state and a detailed roadmap for planned updates and changes. 

It captures the architecture, modules, data model, API surface, AI behavior, UX systems, deployed runtime behavior, and future technical strategies.

---

## 1) Product Overview

**Kar De** is an AI-assisted productivity web app focused on converting raw thoughts into executable actions and sustained routines.

Core product pillars:
- **AI-Assisted Task Structuring**: Parse, rewrite, decompose, plan-day, note-to-task functionalities.
- **Execution-First Daily Workflow**: "Today" tab and "Focus Mode" drive immediate action.
- **Behavioral Consistency Systems**: Habits, streaks, missed-day tracking, and productivity scores.
- **Visual Analytics**: Interactive data visualization of long-term trends and historical performance.
- **Resilient UX**: Cloud-authenticated with a robust, local-fallback design to handle network drops.

---

## 2) Monorepo & Runtime Layout

Root structure:
- `frontend/` -> React 19 + Vite single-page application.
- `backend/` -> FastAPI API layer + SQLAlchemy models + Gemini orchestration.
- `api/index.py` -> Vercel serverless entry wrapper.
- `karde_tasks.db` -> SQLite persistence (local/dev setup).
- `vercel.json` -> Routing/deployment behavior definition.

Execution model:
- **Frontend**: Runs via Vite dev server or static Vercel build.
- **Backend**: Runs as FastAPI (local uvicorn) or serverless (Vercel functions).
- **Architecture**: API-first architecture where frontend features map directly to REST endpoints.

---

## 3) Technology Stack (Implemented)

### Frontend
- **React 19** & **React DOM 19**
- **Vite 8**
- **Vanilla CSS**: Custom design system utilizing CSS variables, glassmorphism, and responsive breakpoints.
- **@dnd-kit** (`core`, `sortable`, `utilities`): Powers the highly interactive drag-and-drop task reordering.
- **Chart.js** & **react-chartjs-2**: Renders beautiful analytics visuals and heatmaps.
- **Lucide React**: Consistent and modern icon system.
- **Firebase Web SDK**: Client-side authentication.
- **html2canvas**: Enables sharing and exporting of image captures.

### Backend
- **FastAPI** + **Uvicorn**: High-performance async Python framework.
- **SQLAlchemy ORM**: Database interactions.
- **Google Generative AI** (`google-generativeai`): Powers the LLM-driven features (Gemini Flash & Pro models).
- **Firebase Admin/Auth**: Token validation.
- **SQLite** (Default) / **PostgreSQL**: Production-ready SQL patterns utilized in start-up logic.

---

## 4) What is DONE: In-Depth Feature Analysis

### 4.1 Task Lifecycle Management
- **Natural Input**: Raw thought capturing with heuristics guessing the task category.
- **Recurring Tasks**: Daily, weekly, monthly recurrences handling. Overnight roll-over handles missed logic dynamically.
- **Card Capabilities**: Quick/full edit modes, priority controls, completion toggles.
- **Subtasks**: Granular tracking with progress rings.
- **"Midnight Correctness"**: Seamless day transitions syncing missed tasks and spawning recurrences via a dedicated midnight sync endpoint.
- **Daily Check-In & Mood Tracking**: A prompt to capture user mood (Focused, Tired, Lazy) and provide contextual suggestions.
- **Smart Reminders**: Automated evening notifications reminding users to complete tasks if no progress has been made by 6:00 PM.

### 4.2 AI Assistant Ecosystem
- **Task Rewrite**: Upgrades user input to cleaner, professional phrasing.
- **Task Decompose**: Breaks down overwhelming tasks into up to 5 manageable sub-steps.
- **Plan Day**: Generates a tailored daily schedule using pending tasks, current time context, and historical missed patterns.
- **Note-to-Task**: AI reads user notes and extracts actionable task cards automatically.
- **Safeguards**: Model fallback chain (Flash -> Flash Lite -> Pro), 300ms call spacing, daily usage tracking, and markdown-fence JSON repairing.

### 4.3 Focus & Execution
- **Focus Mode**: A full-screen distraction-free overlay.
- **Zen Timer**: Includes a visual progress ring for deep work sessions.
- **Scoring System**: Awards points for completed sessions, penalizes interruptions, and provides score explanations.

### 4.4 Habits & Behavioral Tracking
- **Habit Management**: Create, edit (with inline forms), and soft-delete habits.
- **Daily Logging**: Log/unlog capabilities with streak calculations.
- **Visual Heatmaps**: Integration with Chart.js to map out consistency visually.
- **Identity & Difficulty**: Allows users to attach identity goals (e.g., "Become a writer") to habits.

### 4.5 Notes & Ideation
- **Folder Workspace**: Folder-based hierarchical notes organization.
- **Local-First + Sync**: Background syncing with the backend to ensure fast perceived performance.
- **Scheduling**: Attaching schedule metadata to notes.

### 4.6 Security & Resilience
- **Auth**: Firebase token verification with a 30-minute in-memory cache to reduce network overhead.
- **Optimistic UI**: Immediate UI updates with background server reconciliation.
- **Data Scoping**: Strict per-user isolation of data. Account deletion cascades through tasks and habits securely.

---

## 5) What is PLANNED: Future Roadmap & Upgrades

As **Kar De** evolves from a robust MVP to a premier productivity platform, the following features and architectural shifts are planned.

### 5.1 Advanced Progressive Web App (PWA) Integration
- **Full Offline-First Mode**: Implement Service Workers to intercept API calls, caching mutations locally using IndexedDB when offline, and automatically flushing them to the backend upon reconnection.
- **Installability**: Provide a standard `manifest.json` for proper mobile/desktop "Add to Home Screen" support.

### 5.2 Deeper Ecosystem Integrations
- **Google Calendar / Outlook Sync**: Two-way synchronization allowing tasks scheduled in Kar De to appear on calendars, and calendar events to reflect as time-blocked "focus" sessions.
- **Webhooks & APIs**: Exposing a safe public API or Zapier integration for power users to create custom pipelines (e.g., Slack messages to Kar De tasks).

### 5.3 Next-Gen AI Capabilities
- **Predictive Prioritization**: Utilizing historical analytics to predict which tasks the user is likely to avoid and suggesting behavioral interventions.
- **Conversational "Review" Agent**: A chatbot interface at the end of the week summarizing accomplishments, noting friction points, and helping the user plan the upcoming week dynamically.
- **Voice-to-Task Generation**: Native microphone integration feeding into an AI whisper model to capture highly unstructured audio dumps and translate them into organized project folders and tasks.

### 5.4 Enhanced Analytics & Insights
- **Burnout Predictors**: Analyzing "missed task" ratios and focus-session interruptions to warn users before productivity drops off.
- **Year-in-Review**: A Spotify-wrapped style yearly recap highlighting completed habits, longest streaks, and top productivity hours.

### 5.5 Social & Collaborative Features
- **Accountability Partners**: The ability to link accounts with a friend to share habit streaks and "check-in" statuses (without sharing personal task details).
- **Shared Folders/Projects**: Expanding the Data Model to allow multiple `user_id`s or `org_id`s access to specific Notes and Task categories.

### 5.6 UI/UX & Technical Polish
- **Push Notifications**: Moving from basic browser notification APIs to robust Firebase Cloud Messaging (FCM) for reliable cross-platform push reminders.
- **Customization Engine**: Allowing users to define custom color themes, overriding the default light/dark CSS variables.
- **Pagination & Infinite Scroll**: As the `tasks` and `habit_logs` tables grow over years, refactoring the `GET /api/tasks` endpoint to support cursor-based pagination for faster load times.
- **Database Migration Framework**: Graduating from the current dynamic auto-add column approach to a formal Alembic migration pipeline for safer production schema upgrades.

---

## 6) Database Schema Expansion Plan

To support the planned roadmap, the following adjustments to the SQLAlchemy models are anticipated:
- **`tasks` table**: Add `external_link_id` for Calendar sync mapping.
- **`habits` table**: Add `shared_with` (JSON array of user IDs) for accountability partner features.
- **`users` table**: Introduce a formal user preference table (theme settings, notification preferences, timezone overrides).
- **`push_subscriptions` table**: To store FCM tokens for reliable delivery.

---

**Status**: Active Development  
**Doc Type**: Implementation-level description & Product Roadmap  
**Last Updated**: May 2026

# Kar De - Project Description

## Overview
**Kar De** is a minimalist, single-page intelligent task manager that leverages AI to simplify task entry. Users can type tasks in raw, messy language (including Hindi, Hinglish, or English), and the system automatically rewrites them into clean, short 2-4 word English phrases accompanied by a relevant emoji. The application focuses heavily on a premium UI/UX, built around a responsive "glassmorphism" aesthetic.

## Architecture & Tech Stack

### Frontend
- **Framework & Build Tool:** React 19 via Vite.
- **Styling:** Vanilla CSS (`App.css`, `index.css`) designed with a dark-mode glassmorphism theme, CSS variables for theming, and modern typography (Google Fonts).
- **Charting:** `Chart.js` & `react-chartjs-2` used for the Insights tab.
- **Icons:** `lucide-react` for scalable and lightweight SVG iconography.
- **State Management:** React Hooks (`useState`, `useEffect`, `useCallback`) alongside a custom `useTasks.js` hook that connects all components to the Backend REST API. LocalStorage is used specifically to sync the user's Gemini API key settings (`karde_settings`).

### Backend
- **Framework:** FastAPI (Python).
- **Database:** SQLite (`karde_tasks.db`) managed via SQLAlchemy ORM.
- **AI Integration:** Google Generative AI SDK (`google-generativeai`) using the `gemini-2.5-flash` model.
- **Environment Management:** `python-dotenv` for securely loading backend variables (e.g., fallback API keys).
- **CORS:** Enabled specifically for `http://localhost:5173` and `http://127.0.0.1:5173`.

## Core Working Mechanism

1. **User Input:** The user submits a raw task string via the interface.
2. **Optimistic UI:** The frontend immediately adds the task to the local state with a "loading" flag.
3. **API Processing:** A `POST /api/tasks` request is sent to the backend. The backend retrieves the Gemini API key from the `x-api-key` header (provided by the user's settings) or a fallback `.env` variable.
4. **AI Generation:** The raw string is sent to `gemini-2.5-flash` with system instructions to format it strictly into a `[emoji] [short task title]` format. 
5. **Categorization & Storage:** The backend categorizes the generated title via heuristic keyword mapping into four buckets: `Health`, `Work`, `Home`, or `Personal`. The data is persisted in SQLite and returned to the frontend.

## Features Developed

### 1. The 3-Tab Navigation System
The UI is divided into 3 distinct views, selectable from a bottom navigation bar:
- **Today Tab:** 
  - Allows users to add tasks.
  - Lists current tasks categorized as 'pending', 'completed', or 'loading'.
  - Users can strike out tasks (toggle status). 
  - Backend operations are handled optimistically for immediate visual feedback.
- **Records Tab:**
  - Displays lifetime stats including "Total Done" tasks.
  - Calculates "Today's Rate" (completion percentage of today's tasks).
  - Tracks both **Current Streak** and **Best Streak** by scanning consecutive completion dates.
  - Presents an expandable accordion-style history, grouped by days, illustrating what was completed, missed, or remains pending.
- **Insights Tab:** 
  - Visualizes the last 7 days of completed tasks as a Bar Chart.
  - Displays the "Best Day" metric, highlighting the specific day yielding the highest throughput of completed tasks.
  - Exposes the "Missed Pattern" metric, recognizing on which day of the week tasks are most frequently missed.
  - Provides a category percentage breakdown (Health, Work, Home, Personal) via progress bars.

### 2. Midnight Check (Task Expiration)
Recurring background polling mechanisms are embedded within the frontend's `useTasks.js` (running every 60 seconds). It compares the `addedAt` timestamp of pending tasks. Once midnight passes, existing uncompleted tasks from prior days are pushed sequentially via `PUT /api/tasks/midnight-miss` to flag them as "missed", cleaning up today's slate automatically while logging the failure.

### 3. Custom Settings Modal
A centralized UI config hub where:
- Users can input their explicit Gemini API Keys (which overrides system fallback).
- A definitive action is provided to erase all data in the persistence layer (triggers a `POST /api/tasks/clear` backend event, clearing SQLite).

### 4. Toast Notification Engine
Custom-built Toast notifications appear globally anchored to the bottom. Used to relay system status: Database clears, backend connection errors, creation errors, and deletion notices.

## Database Schema Model (Tasks)
- `id` (String): Primary key matching frontend generation via `Date.now()`.
- `raw` (String): The original, unaltered user prompt.
- `title` (String): AI-generated final string (e.g., '🏋️ Go to Gym').
- `category` (String): Inferred category.
- `status` (String): Enum indicating state (`pending`, `completed`, `missed`).
- `addedAt` (String): UTC ISO string of creation date.
- `completedAt` (String): UTC ISO string of completion date.

## Execution & Deployment
The project is bound together by an orchestration script `start.bat`. Upon execution:
- It launches a `uvicorn` instance for the FastAPI backend on port `8000`.
- It concurrently serves the React Vite application on port `5173`.

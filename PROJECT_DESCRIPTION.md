# Kar De - Full-Spectrum Technical Blueprint & Documentation

## 1. Project Vision & Philosophy
**Kar De** (Hinglish for "Do It") is a premium, AI-orchestrated productivity ecosystem designed to bridge the gap between informal thought and structured execution. It uses Large Language Models (LLMs) to transform multilingual, raw input into a professional task architecture, combined with deep-work focus modules and long-term behavioral tracking.

---

## 2. Technical Architecture & Monorepo Structure
The project is organized as a high-performance monorepo, optimized for local development and serverless cloud deployment (Vercel).

- **`/frontend`**: React 19 + Vite application. Uses a "Vanilla CSS" first approach for extreme performance and custom glassmorphic aesthetics.
- **`/backend`**: FastAPI (Python 3.10+) asynchronous server. Handles database ORM, AI orchestration, and business logic.
- **`/api`**: Vercel-specific entry point for serverless deployment of the Python backend.
- **Root Files**:
  - `karde_tasks.db`: SQLite database for local persistence.
  - `requirements.txt`: Python dependency manifest.
  - `package.json`: Root project configuration.
  - `vercel.json`: Deployment configuration for monorepo routing.

---

## 3. The Intelligent AI Core (Gemini Orchestration)

### 3.1 Multi-Model Fallback Strategy
To ensure 99.9% availability, Kar De implements a tiered fallback hierarchy. If a primary model fails due to rate limits or maintenance, the system automatically cycles through:
1. `gemini-2.0-flash` (Primary for speed/quality)
2. `gemini-2.0-flash-lite` (Efficiency fallback)
3. `gemini-1.5-flash`
4. `gemini-1.5-flash-8b`
5. `gemini-1.5-pro` (High-reasoning fallback)

### 3.2 AI Logic Flows
- **Multilingual Rewriting**: Converts inputs like *"gym jaana hai"* into *"💪 Hit the Gym"*.
- **Task Decomposition**: Using the `/decompose` endpoint, the AI breaks complex tasks into 3-5 actionable sub-steps.
- **Smart Planning**: The `/plan-day` engine analyzes pending tasks and suggests an optimal order based on historical "weakest days" and current time.
- **Rate Limiting & Safety**:
  - **Daily Cap**: Hard limit of 900 AI calls per day to manage costs.
  - **Spacing**: Mandatory 300ms delay between API calls to prevent concurrency issues.
  - **Usage Tracking**: Persistent tracking in the `ai_usage` table.

---

## 4. Engineering: Frontend (React 19 & Vite)

### 4.1 Glassmorphic Design System
Built from scratch using **Vanilla CSS Variables**, the UI features:
- **Translucent Surfaces**: `backdrop-filter: blur(12px)` for a premium feel.
- **Dynamic Themes**: Light/Dark mode engine with high-contrast accent colors.
- **Tactile Physics**: Focus mode features "magnetic" buttons and smooth transition states.

### 4.2 Web Audio API Synthesis
Instead of heavy audio files, Kar De uses the **Web Audio API** (`useSound.js`) to synthesize sounds in real-time:
- **Triangle Wave Chime**: Ascending C5-E5-G5 sequence for task completion.
- **Sine Wave Bell**: Deep tone for zen timer completion.
- **Square Wave Tick**: High-frequency tick for subtask interactions.

### 4.3 Client-Side Reporting Engine
- **PDF Generation**: Uses `window.print()` with a dynamically injected DOM structure for high-fidelity reports.
- **Stats-to-PNG**: Uses `html2canvas` to capture the stats grid for social sharing.
- **Data Portability**: Custom CSV export logic for all task history.

---

## 5. Engineering: Backend (FastAPI & SQLAlchemy)

### 5.1 Persistence & Data Sovereignty
- **ORM**: SQLAlchemy manages the relationship between Python objects and the SQLite database.
- **Dynamic Migrations**: A lightweight auto-migration engine in `main.py` patches the schema at runtime (e.g., adding subtasks or user_id columns) without breaking existing data.
- **User Isolation**: All queries are filtered by `user_id` to ensure multi-user data privacy.

### 5.2 Task Lifecycle State Machine
- **Statuses**: `pending`, `completed`, `missed`.
- **Midnight Synchronization**: A backend process (triggered on fetch) scans for tasks from previous days and marks them as `missed` to maintain the "Daily Reset" philosophy.
- **Recurrence Engine**: Supports `daily`, `weekly`, and `monthly` cycles. Upon completion/miss, the system calculates the next occurrence and spawns a new task object.

### 5.3 Habit & Consistency Logic
- **GitHub-Style Heatmap**: Generates a 365-day grid of activity.
- **Streak Calculation**: A recursive logic engine that checks daily logs to find the longest and current sequences of habit consistency.

---

## 6. Security & Authentication

### 6.1 Firebase Identity Integration
Kar De uses a **Restricted-Identity REST Pattern**:
- **Verification**: Instead of using the bulky Firebase Admin SDK, the backend verifies ID tokens via the `Identity Toolkit` REST API.
- **Caching**: Verified tokens are cached for 30 minutes in memory to reduce latency.
- **Account Deletion**: A secure endpoint (`/api/account`) handles cascading deletion of all user tasks, habits, and logs.

---

## 7. Dependency Manifest (Full Stack)

### Backend (Python)
- `fastapi`: High-performance API framework.
- `sqlalchemy`: SQL Toolkit and ORM.
- `google-generativeai`: Native SDK for Gemini LLMs.
- `python-dateutil`: For complex recurrence calculations.
- `psycopg2-binary`: For PostgreSQL compatibility (Production).

### Frontend (JavaScript)
- `lucide-react`: Professional SVG iconography.
- `chart.js` & `react-chartjs-2`: Performance analytics visualization.
- `html2canvas`: Client-side screenshot generation.
- `firebase`: Authentication SDK.

---

## 8. Environment Configuration
To run Kar De, the following variables are required in `.env`:
```env
# AI Configuration
GEMINI_API_KEY=your_key_here

# Firebase Configuration
FIREBASE_API_KEY=your_key_here
FIREBASE_PROJECT_ID=your_project_id

# Database
DATABASE_URL=sqlite:///./karde_tasks.db

# Deployment
CORS_ORIGINS=http://localhost:5173,...
```

---

## 9. Feature Maturity Matrix (Version 3.0)
| Component | Functionality | Status |
| :--- | :--- | :--- |
| **Identity** | Google Auth & Data Purge | 💎 Production |
| **Logic** | AI Multilingual Orchestrator | 💎 Production |
| **Logic** | Subtask Decomposition | 💎 Production |
| **Habits** | Heatmap Consistency Grid | 💎 Production |
| **Stats** | PDF/CSV/PNG Export Engine | 💎 Production |
| **UI** | Focus Mode & Zen Timer | 💎 Production |
| **System** | Midnight Lifecycle Sync | 💎 Production |

---
**Document Status**: Final Technical Specifications
**Revision**: 3.0.0
**Author**: Kar De Engineering Group



# Kar De - Project Architecture & Technical Description

## 1. Executive Summary
**Kar De** is an AI-augmented, high-performance task management ecosystem designed for the modern productivity-focused user. It transcends traditional "To-Do" apps by integrating Large Language Models (LLMs) to handle informal, multilingual input (Hinglish/English/Hindi) and transform it into actionable, professional task architectures. The system is built with a heavy emphasis on **behavioral psychology** (streaks, patterns) and **immersive execution** (Focus Mode).

---

## 2. Core Intelligent Engine

### 2.1 Multilingual AI Orchestrator
- **Seamless Input Processing:** Accepts raw strings like *"gym jana hai"* or *"client call at 5"*. 
- **Resilient Model Fallback Strategy:** Implements a robust multi-model hierarchy (Gemini 2.5/2.0 series) that automatically switches models if one encounters rate limits or maintenance downtimes.
- **Systematic Spacing & Rate Limiting:** Built-in 300ms call spacing and a hard 900-request daily cap to ensure API stability and cost-efficiency.
- **Contextual Categorization:** Heuristic engines automatically bucket tasks into `Work`, `Health`, `Home`, or `Personal` for better data slicing.

### 2.2 Task Lifecycle Automation
- **Autonomous Recurrence Engine:** Supports Daily, Weekly, and Monthly cycles. When a task is completed or missed, the backend automatically spawns the next instance for the future cycle.
- **Midnight State Synchronization:** An automated background process scans for pending tasks as a new day begins, marking them as `missed` to maintain a "clean slate" philosophy while logging performance gaps.
- **Priority Pinning:** Allows users to anchor critical objectives to the top of their flow.

---

## 3. High-Performance Frontend (UX/UI)

### 3.1 Immersive "Focus Mode"
- **Zen Experience:** A full-screen overlay that isolates a single task, removing all peripheral distractions.
- **Pomodoro Integration:** Includes a 25-minute Zen Timer to facilitate deep-work sessions.
- **Magnetic Interaction:** Custom "magnetic button" physics and glassmorphism styling provide a premium, tactile feel.

### 3.2 Advanced Analytics & Insights
- **Behavioral Pattern Recognition:** 
  - **Missed Pattern:** Analyzes historical data to tell the user *which day of the week* they are most likely to fail.
  - **Best Day:** Identifies peak productivity periods.
- **Visual Data Layer:** Dynamic bar charts (Chart.js) visualizing a rolling 7-day performance window.
- **Weekly Review Reports:** A special Sunday-only card providing an executive summary of the week's throughput and streak status.

### 3.3 Records & Archiving
- **Global Search:** Instant filtering across the entire history of thousands of tasks.
- **Expansion Logic:** Grouped history by day with smart aggregation (Success/Total ratio).
- **Social Proofing:** Integration with `html2canvas` allows users to export and share their productivity stats as a high-quality PNG image.

---

## 4. Technical Stack & Infrastructure

### 4.1 Backend (Python API)
- **Framework:** FastAPI (Asynchronous, Type-hinted).
- **Database:** SQLite/PostgreSQL managed via SQLAlchemy ORM.
- **Security:** Support for user-provided API keys via headers (Data Sovereignty).
- **Auto-Migrations:** Automated schema patches ensure the database evolves without data loss during feature updates.

### 4.2 Frontend (React & CSS)
- **Framework:** React 19 + Vite (Modern, fast HMR).
- **Styling:** Pure Vanilla CSS with a Custom Design System (Glassmorphic).
- **Icons:** Lucide-React for consistent, professional SVG iconography.

### 4.3 Deployment & DevOps
- **Monorepo Architecture:** Structured for seamless deployment on **Vercel** with dedicated Serverless Functions.
- **Environment Management:** Multi-tier environment loading (.env) for local vs. production parity.

---

## 5. Current Feature Maturity Matrix
| Category | Feature | Status |
| :--- | :--- | :--- |
| **Logic** | AI Multilingual Rewriting | ✅ Production Ready |
| **Logic** | Recurrence Engine (D/W/M) | ✅ Production Ready |
| **UX** | Focus Mode + Zen Timer | ✅ Production Ready |
| **UX** | Insights (Patterns/Charts) | ✅ Production Ready |
| **UX** | Exportable Stats (PNG) | ✅ Production Ready |
| **System** | Midnight Auto-Archive | ✅ Production Ready |
| **System** | Multi-Model Fallback | ✅ Production Ready |

---

## 6. Proposed Feature Expansion Path (Roadmap)
*The following features are primed for implementation based on the existing robust architecture:*
- **Voice-to-Task Engine:** Native speech-to-text integration for even faster task entry.
- **Collaborative Flow:** Shared task lists with real-time sync for teams.
- **AI Task Decomposition:** Allowing the AI to break a large raw task into 3-4 sub-steps.
- **Browser/Mobile Notifications:** Integration with Service Workers for due-time pings.

---
**Report Generated for:** Organizational Stakeholder Review
**Project Status:** Version 2.0 (Stable / Feature-Rich)

# 🚀 Kar De - AI-Powered Productivity Ecosystem

> **Transform chaos into clarity.** Kar De is a premium, AI-orchestrated productivity platform that converts multilingual, unstructured thoughts into actionable task hierarchies. Powered by Gemini LLMs, it combines intelligent task decomposition, deep-work focus modes, and behavioral analytics into a unified productivity powerhouse.

![React](https://img.shields.io/badge/React-19-blue?logo=react) ![FastAPI](https://img.shields.io/badge/FastAPI-0.109-green?logo=fastapi) ![Python](https://img.shields.io/badge/Python-3.10+-yellow?logo=python) ![Node.js](https://img.shields.io/badge/Node.js-16+-brightgreen?logo=node.js) ![License](https://img.shields.io/badge/License-Proprietary-red)

---

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Running the Project](#running-the-project)
- [Project Structure](#project-structure)
- [Technology Stack](#technology-stack)
- [Key Features](#key-features)
- [Configuration](#configuration)
- [Development](#development)
- [Troubleshooting](#troubleshooting)
- [Deployment](#deployment)

---

## ⚡ Quick Start

### System Requirements

| Requirement | Version | Notes |
|-------------|---------|-------|
| **Python** | 3.10+ | Backend runtime |
| **Node.js** | 16+ | Frontend tooling |
| **npm** | 7+ | Package manager |
| **Git** | Latest | Version control |

### Installation

```bash
# 1. Clone/navigate to project
cd e:\Karr_DE

# 2. Create and activate Python virtual environment
python -m venv venv
venv\Scripts\Activate.ps1

# 3. Install dependencies
pip install -r requirements.txt
```

---

## 🎯 Running the Project

### Start the Full Stack

Open **two separate terminal windows** from the project root (`e:\Karr_DE`) and run:

| Component | Command | URL |
|-----------|---------|-----|
| **🖥️ Backend API** | `python -m uvicorn backend.main:app --reload --port 8000` | [http://127.0.0.1:8000](http://127.0.0.1:8000) |
| **⚛️ Frontend App** | `cd frontend && npm install && npm run dev` | [http://localhost:5173](http://localhost:5173) |

### ✅ Verify Services

Once both are running, open your browser:
```
http://localhost:5173
```

Check backend health:
```
http://127.0.0.1:8000/docs  (Interactive API docs)
```

---

## 📁 Project Structure

```
kar-de/
├── 📂 frontend/                    # ⚛️ React 19 + Vite SPA
│   ├── src/
│   │   ├── 🎨 components/         # UI components (Today, Insights, Plan, Habits, Records)
│   │   ├── 🪝 hooks/              # Custom React hooks (useAuth, useTasks, useNotes, useSound)
│   │   ├── 🔧 lib/                # Firebase config & utilities
│   │   ├── 🎭 assets/             # Images & static files
│   │   └── main.jsx               # Entry point
│   ├── package.json               # Dependencies
│   └── vite.config.js             # Build configuration
│
├── 📂 backend/                     # 🐍 FastAPI Server
│   ├── main.py                    # FastAPI app & routes (Auth, Tasks, Habits, Notes)
│   ├── ai.py                      # 🤖 Gemini AI orchestration & fallback engine
│   ├── database.py                # 🗄️ SQLAlchemy ORM setup
│   ├── models.py                  # Data models & dynamic migrations
│   ├── prompts.py                 # AI prompt templates for decomposition & planning
│   └── requirements.txt            # Python dependencies
│
├── 📂 api/                         # 🚀 Vercel Serverless Entry
│   └── index.py                   # Production handler
│
├── 📄 karde_tasks.db              # 💾 SQLite Database (auto-generated)
├── 📄 requirements.txt             # Root dependencies
├── 📄 package.json                 # Monorepo configuration
├── 📄 vercel.json                  # Deployment config
├── 📄 PROJECT_DESCRIPTION.md       # Technical architecture blueprint
└── 📄 README.md                    # This file
```

---

## 🛠️ Technology Stack

### Frontend Layer
- **React 19**: Latest UI framework with concurrent rendering.
- **Vite**: Lightning-fast build tool and dev server.
- **Glassmorphic CSS**: Premium, custom-designed UI with dynamic theme engine.
- **Dnd-kit**: Intuitive drag-and-drop task reordering.
- **Chart.js**: Advanced data visualization for productivity trends.
- **Firebase REST**: Secure, lightweight authentication without heavy SDKs.

### Backend Layer
- **FastAPI**: Async-first Python framework for high-performance APIs.
- **SQLAlchemy**: Powerful ORM with dynamic runtime schema patching.
- **Google Generative AI**: Native Gemini integration with multi-model fallback.
- **SQLite**: Local-first storage with easy portability.

---

## ⭐ Key Features

### 🤖 Intelligent AI Core
- **Multi-lingual Task Parsing**: Converts raw thoughts (e.g., *"gym jaana hai"*) into structured, professional tasks.
- **Smart Decomposition**: Breaks complex goals into 3-5 actionable sub-steps automatically.
- **Day Planning**: AI analyzes your pending list and generates an optimized execution plan for your day.
- **Note-to-Task**: Transform long-form ideas from your journal into scheduled tasks with one click.

### 📊 Advanced Productivity Analytics
- **KPI Dashboard**: Track Total Done, Active Streaks, and your daily Discipline Score.
- **Trend Analysis**: 7-day and 30-day performance charts to visualize your momentum.
- **Missed Pattern Detection**: AI identifies which days you're most likely to slip and suggests scheduling adjustments.
- **Activity Heatmap**: 365-day consistency grid (GitHub-style) to visualize your long-term commitment.

### 🎯 Deep Work & Focus
- **Focus Mode**: An immersive, distraction-free environment for executing a single task.
- **Zen Timer**: Integrated Pomodoro-style timer with visual progress rings.
- **Focus Scoring**: Rewards consistency and tracks interruptions to calculate your "Discipline" metric.
- **Web Audio Synthesis**: Native UI sounds (Chimes, Bells, Ticks) synthesized in real-time.

### 📝 Strategic Planning & Ideas
- **Folders & Notes**: Organize your thoughts, project ideas, and daily reflections.
- **AI Scheduling**: Link notes directly to your task list for seamless transition from thought to action.
- **Templates**: Create and manage reusable task bundles for common routines like "Morning Session" or "Workout".

### 🔐 Security & Data Portability
- **Secure Exports**: Export your entire history as CSV or beautiful, printable PDF reports.
- **Social Sharing**: Generate and share high-fidelity screenshots of your productivity stats.
- **Full Data Sovereignty**: Secure account management with cascading data deletion.

---

## ⚙️ Configuration

Create a `.env` file in the project root:

```env
# 🤖 Google Gemini API
GEMINI_API_KEY=your_key

# 🔐 Firebase Config
FIREBASE_API_KEY=your_key
FIREBASE_PROJECT_ID=your_id
FIREBASE_AUTH_DOMAIN=your_domain
```

---

## 🚀 Deployment

Kar De is optimized for **Vercel** deployment:
1. Connect your repository to Vercel.
2. Set the `e:\Karr_DE` folder as the root.
3. Configure environment variables.
4. Push to deploy!

---

**Last Updated**: May 2026  
**Status**: Stable Production Build  
**Version**: 1.1.0

<div align="center">
**Made with ❤️ by the Kar De Team**
</div>

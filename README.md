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

<table>
  <tr>
    <th>Component</th>
    <th>Command</th>
    <th>URL</th>
  </tr>
  <tr>
    <td><strong>🖥️ Backend API</strong></td>
    <td><code>python -m uvicorn backend.main:app --reload --port 8000</code></td>
    <td><a href="http://127.0.0.1:8000">http://127.0.0.1:8000</a></td>
  </tr>
  <tr>
    <td><strong>⚛️ Frontend App</strong></td>
    <td><code>cd frontend && npm install && npm run dev</code></td>
    <td><a href="http://localhost:5173">http://localhost:5173</a></td>
  </tr>
</table>

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
│   │   ├── 🎨 components/         # UI components (Auth, Tasks, Habits, etc.)
│   │   ├── 🪝 hooks/              # Custom React hooks (useAuth, useTasks, etc.)
│   │   ├── 🔧 lib/                # Firebase config & utilities
│   │   ├── 🎭 assets/             # Images & static files
│   │   └── main.jsx               # Entry point
│   ├── package.json               # Dependencies
│   └── vite.config.js             # Build configuration
│
├── 📂 backend/                     # 🐍 FastAPI Server
│   ├── main.py                    # FastAPI app & routes
│   ├── ai.py                      # 🤖 Gemini AI orchestration
│   ├── database.py                # 🗄️ SQLAlchemy ORM setup
│   ├── models.py                  # Data models
│   ├── prompts.py                 # AI prompt templates
│   ├── test_gemini.py             # AI integration tests
│   └── requirements.txt            # Python dependencies
│
├── 📂 api/                         # 🚀 Vercel Serverless Entry
│   └── index.py                   # Production handler
│
├── 📄 karde_tasks.db              # 💾 SQLite Database (auto-generated)
├── 📄 requirements.txt             # Root dependencies
├── 📄 package.json                 # Monorepo configuration
├── 📄 vercel.json                  # Deployment config
├── 📄 PROJECT_DESCRIPTION.md       # Technical architecture
└── 📄 README.md                    # This file
```

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        🌐 BROWSER                            │
│                    localhost:5173                            │
└────────────────┬──────────────────────────────────────────────┘
                 │ HTTP/WebSocket
                 ▼
┌─────────────────────────────────────────────────────────────┐
│              ⚛️ FRONTEND (React 19 + Vite)                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ • Task Management      • Habit Tracking             │   │
│  │ • Focus Mode           • Analytics Dashboard        │   │
│  │ • Glassmorphic UI      • PDF/CSV Export             │   │
│  └─────────────────────────────────────────────────────┘   │
└────────────────┬──────────────────────────────────────────────┘
                 │ REST API
                 ▼
┌─────────────────────────────────────────────────────────────┐
│              🐍 BACKEND (FastAPI + SQLAlchemy)              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ • Task Decomposition   • Rate Limiting (900/day)    │   │
│  │ • Habit Analysis       • User Isolation             │   │
│  │ • AI Orchestration     • Token Caching (30min)      │   │
│  └─────────────────────────────────────────────────────┘   │
│           127.0.0.1:8000                                    │
└────────────────┬──────────────────────────────────────────────┘
                 │
        ┌────────┴────────┐
        ▼                 ▼
    🤖 GEMINI API    💾 SQLite DB
   (AI Models)       (Local)
```

---

## 🛠️ Technology Stack

### Frontend Layer

| Technology | Purpose | Details |
|------------|---------|---------|
| **React 19** | UI Framework | Latest with concurrent rendering |
| **Vite** | Build Tool | Lightning-fast dev server & bundling |
| **Vanilla CSS** | Styling | Custom variables, glassmorphic design |
| **Firebase** | Authentication | OAuth identity & token management |
| **Chart.js** | Data Visualization | Interactive habit & analytics charts |
| **html2canvas** | Screenshot Export | High-fidelity PNG generation |
| **Lucide React** | Icons | Modern SVG icon library |

### Backend Layer

| Technology | Purpose | Details |
|------------|---------|---------|
| **FastAPI** | Web Framework | Async-first, high performance |
| **SQLAlchemy** | ORM | Database abstraction layer |
| **Uvicorn** | ASGI Server | Production-grade async server |
| **Google Generative AI** | LLM Integration | Gemini multi-model fallback |
| **SQLite** | Local Database | Development & single-user |
| **PostgreSQL** | Production DB | Optional for scalability |
| **python-dateutil** | Date Logic | Recurrence calculations |

### Infrastructure

| Component | Technology | Use Case |
|-----------|-----------|----------|
| **Deployment** | Vercel | Serverless functions & static hosting |
| **Database** | SQLite/PostgreSQL | Persistent data storage |
| **Authentication** | Firebase + REST | Secure identity verification |
| **APIs** | REST + WebSocket | Real-time communication |

---

## ⭐ Key Features

### 🤖 AI-Powered Intelligence
- **Multi-Model Fallback Strategy** - 5-tier model hierarchy (2.0-flash → 2.0-flash-lite → 1.5-flash → 1.5-flash-8b → 1.5-pro)
- **Multilingual Task Rewriting** - Convert *"gym jaana hai"* → *"💪 Hit the Gym"*
- **Intelligent Decomposition** - Break complex tasks into 3-5 actionable sub-steps
- **Smart Day Planning** - AI-optimized scheduling based on historical performance

### 📊 Behavioral Analytics
- **GitHub-Style Heatmap** - 365-day activity visualization
- **Streak Calculation** - Longest & current consistency sequences
- **Performance Insights** - Identify weakest days & optimal times
- **Data Portability** - CSV export & PDF reports

### 🎯 Focus & Productivity
- **Deep Work Mode** - Distraction-free task execution
- **Magnetic Button Physics** - Tactile focus state feedback
- **Web Audio Synthesis** - Real-time sound generation
  - Triangle wave chime for task completion
  - Sine wave bell for timer completion
  - Square wave tick for interactions

### 🔐 Security & Privacy
- **User Isolation** - All queries filtered by `user_id`
- **Firebase Integration** - Industry-standard OAuth
- **Cascading Deletion** - Secure account removal
- **Token Caching** - 30-minute verification cache

### 📱 Modern UX
- **Responsive Design** - Mobile-first glassmorphic UI
- **Dark/Light Mode** - Dynamic theme engine with accents
- **Tactile Feedback** - Smooth transitions & interactions
- **Real-time Updates** - Live task synchronization

---

## ⚙️ Configuration

### Environment Setup

Create a `.env` file in the project root with the following variables:

```env
# 🤖 Google Gemini API Configuration
GOOGLE_API_KEY=your_gemini_api_key_here

# 🔐 Firebase Configuration
FIREBASE_API_KEY=your_firebase_api_key
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_AUTH_DOMAIN=your_auth_domain
FIREBASE_STORAGE_BUCKET=your_bucket
FIREBASE_MESSAGING_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_app_id

# 💾 Database (Optional - for production)
DATABASE_URL=postgresql://user:password@localhost/karde_db

# 🔧 Application Settings (Optional)
AI_RATE_LIMIT=900          # Daily AI call limit
AI_CALL_SPACING=300        # Milliseconds between API calls
CACHE_TOKEN_TTL=1800       # Firebase token cache TTL (seconds)
```

### Backend Configuration Details

The backend automatically:

| Feature | Configuration | Default |
|---------|---|---------|
| **Database** | Auto-creates `karde_tasks.db` | SQLite (local) |
| **Migrations** | Runtime schema patching | Automatic |
| **AI Rate Limit** | Daily cap per user | 900 calls/day |
| **Token Cache** | Firebase verification cache | 30 minutes |
| **User Isolation** | Query filtering by `user_id` | Enabled |

### Getting API Keys

#### 🤖 Google Generative AI
1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Click "Create API Key"
3. Select your GCP project
4. Copy key to `.env` as `GOOGLE_API_KEY`

#### 🔐 Firebase
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create new project
3. Register web app
4. Copy config to `.env`
5. Enable Authentication (Email/Google)

---

## 👨‍💻 Development

### Frontend Development

```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Start dev server with hot reload (Vite)
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview

# Run linter
npm run lint
```

### Backend Development

```bash
# Start dev server with auto-reload
python -m uvicorn backend.main:app --reload --port 8000

# Start without reload (production-like)
python -m uvicorn backend.main:app --port 8000

# Run with specific host
python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000

# Run tests
python -m pytest backend/

# Test Gemini integration
python backend/test_gemini.py
```

### API Documentation

Once backend is running, access interactive documentation:

```
http://127.0.0.1:8000/docs          # Swagger UI
http://127.0.0.1:8000/redoc         # ReDoc
```

### Database Inspection

```bash
# Using sqlite3 CLI
sqlite3 karde_tasks.db

# List all tables
sqlite3 karde_tasks.db "SELECT name FROM sqlite_master WHERE type='table';"

# View table schema
sqlite3 karde_tasks.db ".schema table_name"

# Query sample data
sqlite3 karde_tasks.db "SELECT * FROM tasks LIMIT 10;"
```

### Development Workflow

1. **Start Backend**: `python -m uvicorn backend.main:app --reload --port 8000`
2. **Start Frontend**: `cd frontend && npm run dev`
3. **Make Changes**: Edit code in your IDE
4. **Hot Reload**: Changes auto-apply (frontend) or restart (backend)
5. **Test**: Check browser console & API docs
6. **Commit**: Use meaningful commit messages

---

## 🔧 Troubleshooting

### Backend Fails: "ModuleNotFoundError: No module named 'backend'"

**Root Cause**: Running uvicorn from inside the backend folder instead of project root

**✅ Solution**:
```bash
# Correct: Run from project root
cd e:\Karr_DE
python -m uvicorn backend.main:app --reload --port 8000

# ❌ Wrong: Don't run from backend folder
cd backend
uvicorn main:app --reload --port 8000
```

### Port Already in Use

**Error**: `Address already in use` or `Port 8000/5173 is in use`

**✅ Solution**:
```bash
# Backend on different port
python -m uvicorn backend.main:app --reload --port 8001

# Frontend on different port
cd frontend
npm run dev -- --port 5174
```

### Missing Python Dependencies

**Error**: `ModuleNotFoundError` for FastAPI, SQLAlchemy, etc.

**✅ Solution**:
```bash
# Reinstall all dependencies
pip install --upgrade -r requirements.txt

# Or use requirement file from backend
pip install -r backend/requirements.txt

# Verify installation
pip list
```

### Missing Node Dependencies

**Error**: `Cannot find module` in frontend

**✅ Solution**:
```bash
cd frontend

# Clean install
rm -r node_modules package-lock.json
npm install

# Or just force reinstall
npm ci
```

### Google API Key Issues

**Error**: `API key not found` or `401 Unauthorized`

**✅ Solution**:
- Verify `.env` file exists in project root
- Check `GOOGLE_API_KEY` is set correctly (no extra spaces)
- Ensure Generative AI API is enabled in [Google Cloud Console](https://console.cloud.google.com)
- Check API quotas and rate limits
- Verify API key has appropriate permissions

### Firebase Authentication Not Working

**Error**: `Firebase not initialized` or `401 Unauthorized`

**✅ Solution**:
- Verify all Firebase config keys in `.env`
- Check Firebase project has Authentication enabled
- Ensure firestore rules are properly configured
- Verify CORS settings if calling from different origin

### Database Lock Issues

**Error**: `database is locked` when accessing `karde_tasks.db`

**✅ Solution**:
```bash
# Backup current database
cp karde_tasks.db karde_tasks.db.backup

# Reset database (will lose data)
rm karde_tasks.db

# Restart backend - database will be recreated
python -m uvicorn backend.main:app --reload --port 8000
```

### Virtual Environment Issues

**Error**: `Command not found: python` or dependency problems

**✅ Solution**:
```bash
# Recreate virtual environment
python -m venv venv --upgrade-deps
venv\Scripts\Activate.ps1

# Reinstall all packages
pip install -r requirements.txt
```

### Vite/Hot Reload Not Working

**Error**: Changes don't reflect in browser

**✅ Solution**:
```bash
# Hard refresh browser
Ctrl + Shift + R (Windows/Linux)
Cmd + Shift + R (macOS)

# Restart Vite dev server
# Press 'r' in terminal to reload
```

### CORS Errors When Calling API

**Error**: `Access to XMLHttpRequest blocked by CORS policy`

**✅ Solution**:
Backend automatically allows localhost requests. If using different origin:

1. Update `backend/main.py` to include your origin in CORS config
2. Or use a proxy during development

---

## 🚀 Deployment

### Vercel Deployment (Recommended)

Kar De is optimized for Vercel's serverless architecture.

#### Prerequisites
- GitHub account with repo pushed
- Vercel account (free tier available)
- Environment variables configured

#### Deployment Steps

1. **Connect Repository**
   - Go to [Vercel Dashboard](https://vercel.com)
   - Click "New Project"
   - Select your GitHub repository
   - Select "Karr_DE" folder as root

2. **Configure Environment Variables**
   - In Vercel project settings → Environment Variables
   - Add all keys from `.env`:
     ```
     GOOGLE_API_KEY
     FIREBASE_API_KEY
     FIREBASE_PROJECT_ID
     FIREBASE_AUTH_DOMAIN
     DATABASE_URL (PostgreSQL connection)
     ```

3. **Deploy**
   - Vercel automatically deploys on git push
   - Or click "Deploy" button manually
   - Check deployment status in Dashboard

#### Production Architecture

| Component | Deployment | URL |
|-----------|-----------|-----|
| **Frontend** | Vercel Static | `https://your-app.vercel.app` |
| **Backend** | Vercel Serverless | `https://your-app.vercel.app/api` |
| **Database** | External PostgreSQL | `postgresql://...` |

#### Monitoring

Monitor deployments at:
- **Logs**: Vercel Dashboard → Deployments → Logs
- **Errors**: Vercel Dashboard → Monitoring
- **Analytics**: Built-in Vercel Analytics

### Database Migration (Production)

For production, use PostgreSQL instead of SQLite:

```bash
# Update DATABASE_URL in .env
DATABASE_URL=postgresql://user:password@host:5432/karde_db

# Run migrations (if applicable)
python -m alembic upgrade head
```

### Custom Domain

1. Go to Vercel Project Settings → Domains
2. Add your custom domain
3. Update DNS records as instructed
4. SSL certificate auto-generated

### Rollback

```bash
# Revert to previous deployment
# In Vercel Dashboard: Deployments → Select version → Redeploy
```

---

## 📚 Additional Resources

### Documentation
- **[PROJECT_DESCRIPTION.md](PROJECT_DESCRIPTION.md)** - Comprehensive technical architecture & design decisions
- **[API Docs](http://127.0.0.1:8000/docs)** - Interactive Swagger UI (when backend running)
- **[ReDoc](http://127.0.0.1:8000/redoc)** - Alternative API documentation

### External References
- [React 19 Documentation](https://react.dev)
- [FastAPI Documentation](https://fastapi.tiangolo.com)
- [Vite Documentation](https://vitejs.dev)
- [SQLAlchemy Documentation](https://www.sqlalchemy.org)
- [Google Generative AI Docs](https://ai.google.dev)
- [Firebase Documentation](https://firebase.google.com/docs)

### Community & Support
- **GitHub Issues** - Report bugs or request features
- **Discussions** - Technical discussions
- **Wiki** - Community knowledge base

---

## 🔒 Security Best Practices

- ✅ Never commit `.env` files (use `.env.example`)
- ✅ Rotate API keys regularly
- ✅ Use HTTPS in production (Vercel provides SSL)
- ✅ Validate all user inputs server-side
- ✅ Keep dependencies updated (`npm audit`, `pip list --outdated`)
- ✅ Use environment-specific configurations
- ✅ Enable Firebase security rules
- ✅ Monitor API quotas and rate limits

---

## 📊 Performance Tips

### Frontend
- Use DevTools Lighthouse for audits
- Enable code splitting with dynamic imports
- Optimize images & assets
- Use CSS variables for theming (already optimized)

### Backend
- Monitor uvicorn worker threads
- Use connection pooling for database
- Implement caching for repeated queries
- Monitor AI API usage vs daily limits

### Database
- Index frequently queried columns
- Archive old records periodically
- Use `.indexes` in SQLite CLI to check indexes

---

## 📝 Contributing Guidelines

1. **Branch Naming**: `feature/feature-name`, `fix/bug-name`
2. **Commit Messages**: `[FEATURE/FIX/DOCS] Brief description`
3. **Code Style**: Follow project conventions
4. **Testing**: Write tests for new features
5. **Documentation**: Update README for user-facing changes

---

## 📄 License

This project is **private and proprietary**. All rights reserved.

---

## 💬 Support & Contact

For issues, questions, or suggestions:

1. **Check Troubleshooting** - Most issues are covered above
2. **Review Logs** - Check terminal output and browser console
3. **GitHub Issues** - Report bugs with reproduction steps
4. **Documentation** - See PROJECT_DESCRIPTION.md for architecture

**Last Updated**: April 2026  
**Status**: Active Development  
**Version**: 1.0.0

---

<div align="center">

**Made with ❤️ by the Kar De Team**

[⬆ Back to Top](#-kar-de---ai-powered-productivity-ecosystem)

</div>

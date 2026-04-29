# Kar De - AI-Powered Productivity Ecosystem

**Kar De** (Hinglish for "Do It") is a premium, AI-orchestrated productivity application designed to bridge the gap between informal thought and structured execution. It uses Large Language Models (LLMs) to transform multilingual input into professional task architecture, combined with deep-work focus modules and long-term behavioral tracking.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Technology Stack](#technology-stack)
- [Configuration](#configuration)
- [Running the Project](#running-the-project)
- [Development](#development)

---

## Quick Start

### Prerequisites

- **Python 3.10+** (with pip)
- **Node.js 16+** (with npm)
- **Git**

### Installation

1. **Clone and navigate to the project:**
   ```powershell
   cd e:\Karr_DE
   ```

2. **Create and activate a Python virtual environment:**
   ```powershell
   python -m venv venv
   # On Windows:
   venv\Scripts\Activate.ps1
   ```

3. **Install Python dependencies:**
   ```powershell
   pip install -r requirements.txt
   ```

---

## Running the Project

### Start Both Services (Recommended)

Run these commands in **separate terminal windows**:

#### Terminal 1: Backend Server
```powershell
python -m uvicorn backend.main:app --reload --port 8000
```

**Backend URL:** `http://127.0.0.1:8000`

#### Terminal 2: Frontend Development Server
```powershell
cd frontend
npm install
npm run dev
```

**Frontend URL:** `http://localhost:5173`

### Access the Application

Open your browser and navigate to:
```
http://localhost:5173
```

---

## Project Structure

```
kar-de/
├── frontend/                 # React 19 + Vite application
│   ├── src/
│   │   ├── components/       # React components (auth, tasks, habits, etc.)
│   │   ├── hooks/            # Custom React hooks (useAuth, useTasks, etc.)
│   │   ├── lib/              # Firebase configuration
│   │   └── main.jsx          # Entry point
│   ├── package.json          # Frontend dependencies
│   └── vite.config.js        # Vite configuration
│
├── backend/                  # FastAPI Python server
│   ├── main.py               # FastAPI app and routes
│   ├── ai.py                 # Gemini AI orchestration
│   ├── database.py           # SQLAlchemy ORM setup
│   ├── models.py             # Database models
│   ├── prompts.py            # AI prompt templates
│   └── requirements.txt       # Python dependencies
│
├── api/                      # Vercel serverless entry point
│   └── index.py              # Production API handler
│
├── karde_tasks.db            # SQLite database (generated on first run)
├── requirements.txt          # Root Python dependencies
├── package.json              # Root project config
├── vercel.json               # Vercel deployment config
└── PROJECT_DESCRIPTION.md    # Detailed technical documentation
```

---

## Technology Stack

### Frontend
- **React 19** - UI framework
- **Vite** - Build tool and dev server
- **Vanilla CSS** - Custom glassmorphic styling
- **Firebase** - Authentication
- **Chart.js** - Data visualization
- **html2canvas** - Screenshot/export functionality

### Backend
- **FastAPI** - High-performance async API framework
- **SQLAlchemy** - SQL ORM
- **Uvicorn** - ASGI server
- **Google Generative AI** - Gemini LLM integration
- **SQLite** - Local database (development)
- **PostgreSQL** - Production database support

---

## Configuration

### Environment Variables

Create a `.env` file in the project root with:

```env
# Google Gemini API
GOOGLE_API_KEY=your_gemini_api_key_here

# Firebase Configuration
FIREBASE_API_KEY=your_firebase_api_key_here
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_AUTH_DOMAIN=your_auth_domain

# Optional: Database URL (for production)
# DATABASE_URL=postgresql://user:password@localhost/karde
```

### Backend Configuration

The backend automatically:
- Creates SQLite database (`karde_tasks.db`) on first run
- Handles schema migrations dynamically
- Implements AI rate limiting (900 calls/day max)
- Caches Firebase tokens for 30 minutes

---

## Development

### Frontend Development

```powershell
cd frontend

# Install dependencies
npm install

# Start dev server with hot reload
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm lint
```

### Backend Development

```powershell
# Start dev server with auto-reload
python -m uvicorn backend.main:app --reload --port 8000

# Without reload (production-like)
python -m uvicorn backend.main:app --port 8000

# Run tests
python -m pytest backend/

# Check Gemini integration
python backend/test_gemini.py
```

### Database

The SQLite database (`karde_tasks.db`) is created automatically on first run. To inspect:

```powershell
# Using sqlite3 CLI
sqlite3 karde_tasks.db

# Or using Python
python -c "import sqlite3; conn = sqlite3.connect('karde_tasks.db'); print(conn.execute('SELECT name FROM sqlite_master WHERE type=\"table\";').fetchall())"
```

---

## Troubleshooting

### Backend fails to start with "ModuleNotFoundError: No module named 'backend'"

**Solution:** Ensure you're running the command from the project root (not the backend folder):

```powershell
# ✅ Correct
python -m uvicorn backend.main:app --reload --port 8000

# ❌ Wrong
cd backend
uvicorn main:app --reload --port 8000
```

### Port Already in Use

If port 8000 or 5173 is already in use:

```powershell
# Backend on different port
python -m uvicorn backend.main:app --reload --port 8001

# Frontend on different port
cd frontend
npm run dev -- --port 5174
```

### Missing Dependencies

```powershell
# Reinstall all Python packages
pip install --upgrade -r requirements.txt

# Reinstall all Node packages
cd frontend
rm -r node_modules package-lock.json
npm install
```

### Google API Key Issues

- Ensure `GOOGLE_API_KEY` is set in `.env`
- Check API quotas at [Google Cloud Console](https://console.cloud.google.com)
- Verify Generative AI API is enabled

---

## Production Deployment

### Vercel Deployment

1. Push code to GitHub
2. Connect to Vercel
3. Configure environment variables in Vercel dashboard
4. Deploy (automatic or manual)

The app uses:
- Vercel's serverless functions for backend (`/api`)
- Vercel's static hosting for frontend

See `vercel.json` for routing configuration.

---

## Features

- 🤖 **AI-Powered Task Decomposition** - Break complex tasks into actionable steps
- 🌍 **Multilingual Support** - Input tasks in any language
- 📊 **Habit Tracking** - GitHub-style heatmap and streak calculations
- 🔊 **Web Audio Synthesis** - Tactile sound feedback using Web Audio API
- 📱 **Responsive Design** - Mobile-first glassmorphic UI
- 🔐 **Firebase Authentication** - Secure user identity management
- 📈 **Smart Day Planning** - AI-optimized task scheduling
- 📄 **Export Functionality** - PDF reports and CSV data export

---

## Documentation

For detailed technical architecture, data models, and API specifications, see:
- [PROJECT_DESCRIPTION.md](PROJECT_DESCRIPTION.md) - Comprehensive technical blueprint

---

## License

This project is private and proprietary.

---

## Support

For issues or questions, please check:
1. Troubleshooting section above
2. Terminal output for error messages
3. Browser console (F12) for frontend errors
4. Backend logs at `http://127.0.0.1:8000/docs` (API documentation)

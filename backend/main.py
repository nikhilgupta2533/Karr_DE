import os
import json
import threading
import time
import urllib.request
import urllib.error
import google.generativeai as genai
from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from dotenv import load_dotenv, find_dotenv
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from backend.database import engine, Base, get_db
from backend import models
from dateutil.relativedelta import relativedelta
import logging
import asyncio

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

Base.metadata.create_all(bind=engine)

# ─── Lightweight SQLite migrations ───────────────────────────────────────────
db_url = os.getenv("DATABASE_URL", "sqlite:///./karde_tasks.db")
if "sqlite" in db_url:
    with engine.connect() as conn:
        # tasks table columns
        cols = [row[1] for row in conn.execute(text("PRAGMA table_info(tasks)")).fetchall()]
        for col, defn in [
            ("is_pinned",   "INTEGER NOT NULL DEFAULT 0"),
            ("is_recurring","INTEGER NOT NULL DEFAULT 0"),
            ("recurrence",  "TEXT"),
            ("due_time",    "TEXT"),
            ("priority",    "TEXT DEFAULT 'medium'"),
            ("subtasks",    "TEXT"),
            ("user_id",     "TEXT DEFAULT 'default'"),
        ]:
            if col not in cols:
                conn.execute(text(f"ALTER TABLE tasks ADD COLUMN {col} {defn}"))
                conn.commit()

        # habits table
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS habits (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL DEFAULT 'default',
                name TEXT NOT NULL,
                icon TEXT DEFAULT '⭐',
                created_at TEXT,
                is_active INTEGER NOT NULL DEFAULT 1
            )
        """))
        conn.commit()

        # habit_logs table
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS habit_logs (
                id TEXT PRIMARY KEY,
                habit_id TEXT NOT NULL,
                logged_date TEXT NOT NULL,
                created_at TEXT
            )
        """))
        conn.commit()

load_dotenv(find_dotenv(), override=False)
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"), override=False)

app = FastAPI()

# ─── Firebase token verification ─────────────────────────────────────────────
FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "karr-de-auth")
FIREBASE_API_KEY    = os.getenv("FIREBASE_API_KEY") # No hardcoded default for security

# Simple in-memory cache: token -> (uid, expires_at)
_token_cache: dict = {}

def _verify_token_sync(token: str) -> str:
    """Verify a Firebase ID token via Identity Toolkit REST API. Returns UID or 'default'."""
    now = time.time()
    if token in _token_cache:
        uid, exp = _token_cache[token]
        if exp > now:
            return uid
        del _token_cache[token]
    if not FIREBASE_API_KEY:
        return "default"
    try:
        url = f"https://identitytoolkit.googleapis.com/v1/accounts:lookup?key={FIREBASE_API_KEY}"
        body = json.dumps({"idToken": token}).encode()
        req  = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=6) as resp:
            data  = json.loads(resp.read())
            users = data.get("users", [])
            if not users:
                return "default"
            uid = users[0].get("localId", "default")
            # Cache for 30 minutes; cleanup if cache grows too large
            _token_cache[token] = (uid, now + 1800)
            if len(_token_cache) > 200:
                _token_cache.clear()
            return uid
    except Exception as exc:
        logger.warning(f"Firebase token verify failed: {str(exc)[:80]}")
        return "default"

    return uid

async def get_current_uid(authorization: Optional[str] = Header(None)) -> str:
    """FastAPI dependency — extracts and verifies the Firebase Bearer token."""
    if not authorization:
        # Strict mode: If a project ID is configured, we SHOULD require auth.
        # But for local testing/backwards compatibility, we fallback to 'default'.
        if not FIREBASE_PROJECT_ID or FIREBASE_PROJECT_ID == "karr-de-auth":
            return "default"
        raise HTTPException(status_code=401, detail="Authentication required")
        
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header format")
        
    token = authorization.split(" ", 1)[1]
    # Run the blocking sync verification in a thread to keep the event loop free
    uid = await asyncio.to_thread(_verify_token_sync, token)
    
    if uid == "default":
        raise HTTPException(status_code=401, detail="Invalid or expired authentication token")
        
    return uid

gemini_lock = threading.Lock()
last_gemini_call_at = 0.0
DAILY_AI_LIMIT = 900

FALLBACK_MODELS = [
    "models/gemini-2.0-flash",
    "models/gemini-2.0-flash-lite",
    "models/gemini-1.5-flash",
    "models/gemini-1.5-flash-8b",
    "models/gemini-1.5-pro",
]

cors_origins = ["http://localhost:5173", "http://127.0.0.1:5173"]
extra_origins = os.getenv("CORS_ORIGINS")
if extra_origins:
    cors_origins.extend([o.strip() for o in extra_origins.split(",")])

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Helpers ─────────────────────────────────────────────────────────────────

def guess_category(title: str) -> str:
    t = (title or "").lower()
    if any(k in t for k in ['gym','workout','health','doctor','water','sleep','run','walk','exercise','medical','pill','medicine']):
        return 'Health'
    if any(k in t for k in ['assignment','email','call','meet','work','project','code','study','read','boss','client','school','homework']):
        return 'Work'
    if any(k in t for k in ['clean','laundry','cook','dinner','lunch','breakfast','groceries','house','home','wash','sweep','mop']):
        return 'Home'
    return 'Personal'

def today_key() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")

def get_or_create_usage_row(db: Session, day: str) -> models.AIUsageDB:
    row = db.query(models.AIUsageDB).filter(models.AIUsageDB.day_key == day).first()
    if row:
        return row
    row = models.AIUsageDB(day_key=day, count=0)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row

def enforce_gemini_spacing():
    global last_gemini_call_at
    with gemini_lock:
        elapsed = time.time() - last_gemini_call_at
        if elapsed < 0.3:
            time.sleep(0.3 - elapsed)
        last_gemini_call_at = time.time()

def serialize_task(row: models.TaskDB, ai_failed: bool = False, ai_failure_reason: Optional[str] = None):
    setattr(row, "ai_failed", ai_failed)
    setattr(row, "ai_failure_reason", ai_failure_reason)
    setattr(row, "is_pinned", bool(row.is_pinned))
    setattr(row, "is_recurring", bool(row.is_recurring))
    return row

def get_next_recurrence_date(recurrence: Optional[str]) -> str:
    now = datetime.utcnow()
    if recurrence == "weekly":
        next_dt = now + relativedelta(weeks=1)
    elif recurrence == "monthly":
        next_dt = now + relativedelta(months=1)
    else:
        next_dt = now + relativedelta(days=1)
    return next_dt.isoformat() + "Z"

def normalized_recurrence(raw: Optional[str]) -> Optional[str]:
    if raw is None:
        return None
    value = raw.strip().lower()
    return value if value in {"daily", "weekly", "monthly"} else None

def normalized_due_time(raw: Optional[str]) -> Optional[str]:
    if raw is None:
        return None
    value = raw.strip()
    try:
        datetime.strptime(value, "%H:%M")
        return value
    except ValueError:
        return None

def spawn_next_recurring_task(db: Session, source: models.TaskDB, previous_status: Optional[str] = None):
    if not source.is_recurring or source.status not in {"completed", "missed"}:
        return
    if previous_status is not None and previous_status != "pending":
        return
    next_date = get_next_recurrence_date(source.recurrence)
    next_date_d = next_date.split("T")[0]
    existing = db.query(models.TaskDB).filter(
        models.TaskDB.raw == source.raw,
        models.TaskDB.status == "pending",
        models.TaskDB.addedAt.like(f"{next_date_d}%")
    ).first()
    if existing:
        return
    next_task = models.TaskDB(
        id=str(uuid4()),
        raw=source.raw,
        title=source.title,
        category=source.category,
        priority=source.priority,
        status="pending",
        addedAt=next_date,
        completedAt=None,
        is_pinned=source.is_pinned,
        is_recurring=source.is_recurring,
        recurrence=source.recurrence,
        due_time=source.due_time,
    )
    db.add(next_task)

def call_gemini(api_key: str, system_prompt: str, user_prompt: str, db: Session) -> Optional[str]:
    """Call Gemini with fallback. Returns text or None on failure."""
    current_day = today_key()
    usage_row = get_or_create_usage_row(db, current_day)
    # Only enforce server-side limit if using the default server API key
    is_default_key = (api_key == os.getenv("GEMINI_API_KEY"))
    if is_default_key and usage_row.count >= DAILY_AI_LIMIT:
        return None
    genai.configure(api_key=api_key)
    for model_name in FALLBACK_MODELS:
        try:
            enforce_gemini_spacing()
            model = genai.GenerativeModel(model_name=model_name, system_instruction=system_prompt)
            response = model.generate_content(user_prompt)
            text_out = (response.text or "").strip()
            if text_out:
                usage_row.count += 1
                db.commit()
                return text_out
        except Exception as exc:
            logger.warning(f"Model {model_name} failed: {str(exc)[:120]}")
            continue
    return None

async def call_gemini_async(api_key: str, system_prompt: str, user_prompt: str, db: Session) -> Optional[str]:
    """Wraps the blocking call_gemini in a thread."""
    return await asyncio.to_thread(call_gemini, api_key, system_prompt, user_prompt, db)

# ─── Root ─────────────────────────────────────────────────────────────────────

@app.get("/")
def read_root():
    return {"status": "Kar De API is running"}

# ─── Task Endpoints ───────────────────────────────────────────────────────────

@app.get("/api/tasks", response_model=List[models.TaskResponse])
def get_tasks(db: Session = Depends(get_db), uid: str = Depends(get_current_uid)):
    now_utc = datetime.now(timezone.utc)
    today_str = now_utc.strftime("%Y-%m-%d")
    q = db.query(models.TaskDB).filter(models.TaskDB.user_id == uid)
    all_pending = q.filter(models.TaskDB.status == "pending").all()
    any_changed = False
    for t in all_pending:
        t_date = t.addedAt.split("T")[0]
        if t_date < today_str:
            previous_status = t.status
            t.status = "missed"
            spawn_next_recurring_task(db, t, previous_status)
            any_changed = True
    if any_changed:
        db.commit()
    rows = q.order_by(models.TaskDB.is_pinned.desc(), models.TaskDB.addedAt.desc()).all()
    return [serialize_task(row) for row in rows]

@app.put("/api/tasks/bulk", response_model=List[models.TaskResponse])
def bulk_update_tasks(payload: List[models.TaskUpdateWithId], db: Session = Depends(get_db), uid: str = Depends(get_current_uid)):
    results = []
    for item in payload:
        db_task = db.query(models.TaskDB).filter(models.TaskDB.id == item.id, models.TaskDB.user_id == uid).first()
        if not db_task:
            continue
        previous_status = db_task.status
        if item.status is not None:
            db_task.status = item.status
        if item.completedAt is not None or item.status == "pending":
            db_task.completedAt = item.completedAt
        if item.is_pinned is not None:
            db_task.is_pinned = 1 if item.is_pinned else 0
        if item.title is not None and item.title.strip():
            db_task.title = item.title.strip()
        if item.due_time is not None:
            db_task.due_time = normalized_due_time(item.due_time)
        if item.subtasks is not None:
            db_task.subtasks = item.subtasks
        spawn_next_recurring_task(db, db_task, previous_status)
        results.append(serialize_task(db_task))
    db.commit()
    return results

# NOTE: /decompose and /plan-day must be registered BEFORE /{task_id} routes
@app.post("/api/tasks/decompose", response_model=models.DecomposeResponse)
async def decompose_task(payload: models.DecomposeRequest, x_api_key: Optional[str] = Header(None), db: Session = Depends(get_db)):
    api_key = x_api_key if x_api_key else os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="No Gemini API key configured")

    system_prompt = (
        "You are a productivity assistant. The user will give you a task in English or Hinglish. "
        "Break it into 3 to 5 small, specific, actionable sub-steps. "
        "Respond ONLY with a JSON array of strings. No explanation, no markdown, no preamble. "
        'Example: ["Step one", "Step two", "Step three"]'
    )
    result = await call_gemini_async(api_key, system_prompt, payload.title, db)
    if not result:
        raise HTTPException(status_code=503, detail="AI service unavailable")
    try:
        # Strip markdown code fences if present
        cleaned = result.strip().strip('`').strip()
        if cleaned.startswith("json"):
            cleaned = cleaned[4:].strip()
        steps = json.loads(cleaned)
        if not isinstance(steps, list):
            raise ValueError("Not a list")
        steps = [str(s) for s in steps if s]
        return models.DecomposeResponse(steps=steps[:5])
    except Exception:
        raise HTTPException(status_code=422, detail="AI returned invalid JSON. Please try again.")

@app.post("/api/tasks/plan-day", response_model=models.PlanDayResponse)
async def plan_day(payload: models.PlanDayRequest, x_api_key: Optional[str] = Header(None), db: Session = Depends(get_db)):
    api_key = x_api_key if x_api_key else os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="No Gemini API key configured")

    system_prompt = (
        "You are a smart productivity coach. The user will give you their pending tasks for today "
        "and some context about their productivity patterns. Suggest the optimal order to complete "
        "these tasks with a one-line reason for each. Be concise, motivating, and realistic. "
        "Respond ONLY in this JSON format with no extra text:\n"
        '{"message": "One encouraging sentence", "plan": [{"task_id": "id", "order": 1, "reason": "reason"}]}'
    )
    task_list = ", ".join([f"[{t.get('id','')}] {t.get('title', t.get('raw',''))}" for t in payload.tasks])
    missed_day = payload.missed_pattern or "unknown"
    current_time = payload.current_time or datetime.now().strftime("%I:%M %p")
    user_prompt = f"Tasks: {task_list}\nMy weakest day is usually {missed_day}.\nCurrent time: {current_time}"

    result = await call_gemini_async(api_key, system_prompt, user_prompt, db)
    if not result:
        raise HTTPException(status_code=503, detail="AI service unavailable")
    try:
        cleaned = result.strip().strip('`').strip()
        if cleaned.startswith("json"):
            cleaned = cleaned[4:].strip()
        data = json.loads(cleaned)
        plan_items = [models.PlanTaskItem(**item) for item in data.get("plan", [])]
        return models.PlanDayResponse(message=data.get("message", "Let's have a great day!"), plan=plan_items)
    except Exception:
        raise HTTPException(status_code=422, detail="AI returned invalid plan format. Please try again.")

@app.post("/api/tasks", response_model=models.TaskResponse)
async def create_task(task: models.TaskCreate, x_api_key: Optional[str] = Header(None), db: Session = Depends(get_db), uid: str = Depends(get_current_uid)):
    api_key_to_use = x_api_key if x_api_key else os.getenv("GEMINI_API_KEY")
    title = task.raw
    category = "Personal"
    ai_failed = False
    ai_failure_reason = None
    recurrence = normalized_recurrence(task.recurrence)
    due_time = normalized_due_time(task.due_time)

    if task.skip_ai:
        title = task.title if task.title else task.raw
        category = guess_category(title)
    elif api_key_to_use:
        current_day = today_key()
        usage_row = get_or_create_usage_row(db, current_day)
        is_default_key = (api_key_to_use == os.getenv("GEMINI_API_KEY"))
        
        if is_default_key and usage_row.count >= DAILY_AI_LIMIT:
            ai_failed = True
            ai_failure_reason = "daily_limit"
        else:
            system_prompt = (
                "You are 'Kar De', an intelligent task architect. "
                "Format the input into a professional English task title. "
                "Rules: 1. Keep it 2-5 words. 2. Start with a relevant emoji. "
                "3. Handle Hindi/Hinglish accurately (e.g. 'gym jana hai' -> '💪 Hit the Gym'). "
                "4. Return ONLY the formatted string: [Emoji] [Title]."
            )
            genai.configure(api_key=api_key_to_use)
            ai_success = False
            last_failure_reason = None
            for model_name in FALLBACK_MODELS:
                try:
                    # We still run these in thread via call_gemini if we refactored,
                    # but let's keep it simple here since it's already inside a loop.
                    # Actually, let's wrap the whole loop logic in call_gemini_async style if possible.
                    # For now, I'll just use asyncio.to_thread for the specific model call.
                    def _call_single_model(m_name, s_prompt, u_prompt):
                        enforce_gemini_spacing()
                        model = genai.GenerativeModel(model_name=m_name, system_instruction=s_prompt)
                        return model.generate_content(u_prompt)

                    response = await asyncio.to_thread(_call_single_model, model_name, system_prompt, task.raw)
                    maybe_title = (response.text or "").strip().strip('"')
                    if maybe_title:
                        title = maybe_title
                    category = guess_category(title)
                    usage_row.count += 1
                    db.commit()
                    ai_success = True
                    logger.info(f"AI success with model: {model_name}")
                    break
                except Exception as exc:
                    lowered = str(exc).lower()
                    is_quota = "429" in lowered or "resource_exhausted" in lowered or "quota" in lowered
                    is_unavailable = "503" in lowered or "unavailable" in lowered
                    is_not_found = "404" in lowered or "not found" in lowered or "is not found for api version" in lowered
                    last_failure_reason = "rate_limit" if is_quota else "offline" if is_unavailable else "model_not_found" if is_not_found else "offline"
                    logger.warning(f"Model {model_name} failed: {str(exc)[:120]}")
                    if is_quota or is_unavailable or is_not_found:
                        continue
                    break
            if not ai_success:
                ai_failed = True
                ai_failure_reason = last_failure_reason or "offline"
    else:
        ai_failed = True
        ai_failure_reason = "offline"

    db_task = models.TaskDB(
        id=task.id,
        raw=task.raw,
        title=title,
        category=category,
        priority=task.priority or "medium",
        status="pending",
        addedAt=task.addedAt,
        is_pinned=0,
        is_recurring=1 if task.is_recurring and recurrence else 0,
        recurrence=recurrence,
        due_time=due_time,
        subtasks=task.subtasks,
        user_id=uid,
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return serialize_task(db_task, ai_failed, ai_failure_reason)

@app.put("/api/tasks/{task_id}/toggle", response_model=models.TaskResponse)
def toggle_task(task_id: str, db: Session = Depends(get_db), uid: str = Depends(get_current_uid)):
    db_task = db.query(models.TaskDB).filter(models.TaskDB.id == task_id, models.TaskDB.user_id == uid).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    previous_status = db_task.status
    if db_task.status == "pending":
        db_task.status = "completed"
        db_task.completedAt = datetime.utcnow().isoformat() + "Z"
    elif db_task.status == "completed":
        db_task.status = "pending"
        db_task.completedAt = None
    spawn_next_recurring_task(db, db_task, previous_status)
    db.commit()
    db.refresh(db_task)
    return serialize_task(db_task)

@app.put("/api/tasks/{task_id}", response_model=models.TaskResponse)
def update_task(task_id: str, payload: models.TaskUpdate, db: Session = Depends(get_db), uid: str = Depends(get_current_uid)):
    db_task = db.query(models.TaskDB).filter(models.TaskDB.id == task_id, models.TaskDB.user_id == uid).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    previous_status = db_task.status
    if payload.status is not None:
        db_task.status = payload.status
    if payload.completedAt is not None or payload.status == "pending":
        db_task.completedAt = payload.completedAt
    if payload.is_pinned is not None:
        db_task.is_pinned = 1 if payload.is_pinned else 0
    if payload.title is not None and payload.title.strip():
        db_task.title = payload.title.strip()
    if payload.due_time is not None:
        db_task.due_time = normalized_due_time(payload.due_time)
    if payload.subtasks is not None:
        db_task.subtasks = payload.subtasks
    spawn_next_recurring_task(db, db_task, previous_status)
    db.commit()
    db.refresh(db_task)
    return serialize_task(db_task)

@app.patch("/api/tasks/{task_id}", response_model=models.TaskResponse)
def patch_task(task_id: str, payload: models.TaskUpdateRequest, db: Session = Depends(get_db), uid: str = Depends(get_current_uid)):
    db_task = db.query(models.TaskDB).filter(models.TaskDB.id == task_id, models.TaskDB.user_id == uid).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    if db_task.status in {"completed", "missed"}:
        raise HTTPException(status_code=400, detail="Cannot edit completed or missed tasks")
    if payload.title is not None and payload.title.strip():
        db_task.title = payload.title.strip()
    if payload.category is not None:
        db_task.category = payload.category
    if payload.priority is not None:
        db_task.priority = payload.priority
    if payload.recurrence is not None:
        rec = normalized_recurrence(payload.recurrence)
        db_task.recurrence = rec
        db_task.is_recurring = 1 if rec else 0
    if payload.due_time is not None:
        db_task.due_time = normalized_due_time(payload.due_time) if payload.due_time else None
    if payload.subtasks is not None:
        db_task.subtasks = payload.subtasks
    db.commit()
    db.refresh(db_task)
    return serialize_task(db_task)

@app.put("/api/tasks/midnight-miss")
def mark_missed(task_id: str, db: Session = Depends(get_db), uid: str = Depends(get_current_uid)):
    db_task = db.query(models.TaskDB).filter(models.TaskDB.id == task_id, models.TaskDB.user_id == uid).first()
    if db_task and db_task.status == "pending":
        previous_status = db_task.status
        db_task.status = "missed"
        spawn_next_recurring_task(db, db_task, previous_status)
        db.commit()
    return {"status": "ok"}

@app.delete("/api/tasks/{task_id}")
def delete_task(task_id: str, db: Session = Depends(get_db), uid: str = Depends(get_current_uid)):
    db_task = db.query(models.TaskDB).filter(models.TaskDB.id == task_id, models.TaskDB.user_id == uid).first()
    if db_task:
        db.delete(db_task)
        db.commit()
    return {"status": "deleted"}

@app.post("/api/tasks/clear")
def clear_tasks(db: Session = Depends(get_db), uid: str = Depends(get_current_uid)):
    db.query(models.TaskDB).filter(models.TaskDB.user_id == uid).delete()
    db.commit()
    return {"status": "cleared"}

@app.delete("/api/account")
def delete_account(db: Session = Depends(get_db), uid: str = Depends(get_current_uid)):
    if uid == "default":
        raise HTTPException(status_code=400, detail="Cannot delete default account")
    
    # Delete tasks
    db.query(models.TaskDB).filter(models.TaskDB.user_id == uid).delete()
    
    # Delete habits and their logs
    habits = db.query(models.HabitDB).filter(models.HabitDB.user_id == uid).all()
    habit_ids = [h.id for h in habits]
    if habit_ids:
        db.query(models.HabitLogDB).filter(models.HabitLogDB.habit_id.in_(habit_ids)).delete(synchronize_session=False)
    db.query(models.HabitDB).filter(models.HabitDB.user_id == uid).delete()
    
    db.commit()
    return {"status": "account_data_deleted"}

# ─── Habit Endpoints ──────────────────────────────────────────────────────────

@app.get("/api/habits", response_model=List[models.HabitResponse])
def get_habits(db: Session = Depends(get_db), uid: str = Depends(get_current_uid)):
    habits = db.query(models.HabitDB).filter(models.HabitDB.user_id == uid, models.HabitDB.is_active == True).all()
    today_str = today_key()
    result = []
    for h in habits:
        logs = db.query(models.HabitLogDB).filter(models.HabitLogDB.habit_id == h.id).all()
        logged_dates = sorted(set(l.logged_date for l in logs))
        logged_today = today_str in logged_dates
        # streak calc
        streak = 0
        if logged_dates:
            check_date = datetime.strptime(today_str, "%Y-%m-%d")
            while True:
                ds = check_date.strftime("%Y-%m-%d")
                if ds in logged_dates:
                    streak += 1
                    check_date -= timedelta(days=1)
                else:
                    break
        r = models.HabitResponse(
            id=h.id, name=h.name, icon=h.icon or "⭐",
            created_at=h.created_at, is_active=h.is_active,
            streak=streak, logged_today=logged_today
        )
        result.append(r)
    return result

@app.post("/api/habits", response_model=models.HabitResponse)
def create_habit(payload: models.HabitCreate, db: Session = Depends(get_db), uid: str = Depends(get_current_uid)):
    h = models.HabitDB(
        id=str(uuid4()),
        user_id=uid,
        name=payload.name,
        icon=payload.icon or "⭐",
        created_at=datetime.utcnow().isoformat() + "Z",
        is_active=True,
    )
    db.add(h)
    db.commit()
    db.refresh(h)
    return models.HabitResponse(id=h.id, name=h.name, icon=h.icon, created_at=h.created_at, is_active=h.is_active, streak=0, logged_today=False)

@app.delete("/api/habits/{habit_id}")
def delete_habit(habit_id: str, db: Session = Depends(get_db), uid: str = Depends(get_current_uid)):
    h = db.query(models.HabitDB).filter(models.HabitDB.id == habit_id, models.HabitDB.user_id == uid).first()
    if not h:
        raise HTTPException(status_code=404, detail="Habit not found")
    h.is_active = False
    db.commit()
    return {"status": "deleted"}

@app.post("/api/habits/{habit_id}/log")
def log_habit(habit_id: str, db: Session = Depends(get_db), uid: str = Depends(get_current_uid)):
    # Verify habit ownership
    h = db.query(models.HabitDB).filter(models.HabitDB.id == habit_id, models.HabitDB.user_id == uid).first()
    if not h:
        raise HTTPException(status_code=404, detail="Habit not found")
    today_str = today_key()
    existing = db.query(models.HabitLogDB).filter(
        models.HabitLogDB.habit_id == habit_id,
        models.HabitLogDB.logged_date == today_str
    ).first()
    if not existing:
        log = models.HabitLogDB(
            id=str(uuid4()),
            habit_id=habit_id,
            logged_date=today_str,
            created_at=datetime.utcnow().isoformat() + "Z"
        )
        db.add(log)
        db.commit()
    return {"status": "logged", "date": today_str}

@app.delete("/api/habits/{habit_id}/log")
def unlog_habit(habit_id: str, db: Session = Depends(get_db), uid: str = Depends(get_current_uid)):
    # Verify habit ownership
    h = db.query(models.HabitDB).filter(models.HabitDB.id == habit_id, models.HabitDB.user_id == uid).first()
    if not h:
        raise HTTPException(status_code=404, detail="Habit not found")
    today_str = today_key()
    db.query(models.HabitLogDB).filter(
        models.HabitLogDB.habit_id == habit_id,
        models.HabitLogDB.logged_date == today_str
    ).delete()
    db.commit()
    return {"status": "unlogged"}

@app.get("/api/habits/{habit_id}/heatmap", response_model=List[models.HeatmapEntry])
def get_heatmap(habit_id: str, db: Session = Depends(get_db), uid: str = Depends(get_current_uid)):
    # Verify habit ownership
    h = db.query(models.HabitDB).filter(models.HabitDB.id == habit_id, models.HabitDB.user_id == uid).first()
    if not h:
        raise HTTPException(status_code=404, detail="Habit not found")
    logs = db.query(models.HabitLogDB).filter(models.HabitLogDB.habit_id == habit_id).all()
    logged_set = set(l.logged_date for l in logs)
    result = []
    today = datetime.utcnow().date()
    for i in range(364, -1, -1):
        d = today - timedelta(days=i)
        ds = d.strftime("%Y-%m-%d")
        result.append(models.HeatmapEntry(date=ds, done=ds in logged_set, count=1 if ds in logged_set else 0))
    return result

import os
import json
import threading
import time
import urllib.request
import urllib.error
import google.generativeai as genai
from fastapi import FastAPI, Depends, HTTPException, Header, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text, inspect
from dotenv import load_dotenv, find_dotenv
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from backend.database import engine, Base, get_db
from backend import models
from dateutil.relativedelta import relativedelta
import logging
import asyncio
from backend.ai import call_gemini_async, validate_and_repair_json
from backend.prompts import task_parser_prompt, task_decompose_prompt, daily_planner_prompt, note_to_task_prompt

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

Base.metadata.create_all(bind=engine)

# ─── Lightweight startup migrations (SQLite + PostgreSQL-safe) ──────────────
db_url = os.getenv("DATABASE_URL", "sqlite:///./karde_tasks.db")
is_sqlite = "sqlite" in db_url

TASK_COLUMN_DEFS = {
    "is_pinned": "INTEGER NOT NULL DEFAULT 0",
    "is_recurring": "INTEGER NOT NULL DEFAULT 0",
    "recurrence": "TEXT",
    "due_time": "TEXT",
    "priority": "TEXT DEFAULT 'medium'",
    "subtasks": "TEXT",
    "user_id": "TEXT DEFAULT 'default'",
    "missed_reason": "TEXT",
    "cognitive_weight": "INTEGER DEFAULT 1",
    "reschedule_count": "INTEGER DEFAULT 0",
    "target_date": "TEXT",
}

HABIT_COLUMN_DEFS = {
    "identity": "TEXT",
    "difficulty": "TEXT DEFAULT 'medium' NOT NULL",
}

with engine.connect() as conn:
    inspector = inspect(conn)

    # Keep this resilient for older production schemas.
    if inspector.has_table("tasks"):
        task_cols = {c["name"] for c in inspector.get_columns("tasks")}
        for col, defn in TASK_COLUMN_DEFS.items():
            if col not in task_cols:
                conn.execute(text(f"ALTER TABLE tasks ADD COLUMN {col} {defn}"))
                conn.commit()

    if inspector.has_table("habits"):
        habit_cols = {c["name"] for c in inspector.get_columns("habits")}
        for col, defn in HABIT_COLUMN_DEFS.items():
            if col not in habit_cols:
                conn.execute(text(f"ALTER TABLE habits ADD COLUMN {col} {defn}"))
                conn.commit()

    # For legacy DBs, ensure habit_logs exists even when table creation predates this model.
    if not inspector.has_table("habit_logs"):
        if is_sqlite:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS habit_logs (
                    id TEXT PRIMARY KEY,
                    habit_id TEXT NOT NULL,
                    logged_date TEXT NOT NULL,
                    created_at TEXT
                )
            """))
        else:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS habit_logs (
                    id VARCHAR PRIMARY KEY,
                    habit_id VARCHAR NOT NULL,
                    logged_date VARCHAR NOT NULL,
                    created_at VARCHAR
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

# Removed inline Gemini variables (now in backend.ai)

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

# Helpers migrated to backend.ai: today_key, get_or_create_usage_row, enforce_gemini_spacing

def serialize_task(row: models.TaskDB, ai_failed: bool = False, ai_failure_reason: Optional[str] = None):
    setattr(row, "ai_failed", ai_failed)
    setattr(row, "ai_failure_reason", ai_failure_reason)
    setattr(row, "is_pinned", bool(row.is_pinned))
    setattr(row, "is_recurring", bool(row.is_recurring))
    return row

def get_next_recurrence_date(recurrence: Optional[str], base_date_str: str) -> str:
    try:
        base_date = datetime.strptime(base_date_str.split("T")[0], "%Y-%m-%d")
    except Exception:
        base_date = datetime.utcnow()
        
    if recurrence == "weekly":
        next_dt = base_date + relativedelta(weeks=1)
    elif recurrence == "monthly":
        next_dt = base_date + relativedelta(months=1)
    else:
        next_dt = base_date + relativedelta(days=1)
    return next_dt.strftime("%Y-%m-%dT00:00:00Z")

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
    next_date = get_next_recurrence_date(source.recurrence, source.addedAt)
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

# call_gemini migrated to backend.ai

# ─── Root ─────────────────────────────────────────────────────────────────────

@app.get("/")
def read_root():
    return {"status": "Kar De API is running"}

# ─── Task Endpoints ───────────────────────────────────────────────────────────

@app.get("/api/tasks", response_model=List[models.TaskResponse])
def get_tasks(db: Session = Depends(get_db), uid: str = Depends(get_current_uid), x_local_date: Optional[str] = Header(None)):
    today_str = x_local_date if x_local_date else datetime.now(timezone.utc).strftime("%Y-%m-%d")
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
        if item.missed_reason is not None:
            db_task.missed_reason = item.missed_reason
        spawn_next_recurring_task(db, db_task, previous_status)
        results.append(serialize_task(db_task))
    db.commit()
    return results

@app.post("/api/tasks/rewrite", response_model=models.RewriteResponse)
async def rewrite_task(payload: models.RewriteRequest, x_api_key: Optional[str] = Header(None), x_local_date: Optional[str] = Header(None), db: Session = Depends(get_db), uid: str = Depends(get_current_uid)):
    api_key = x_api_key if x_api_key else os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="No Gemini API key configured")

    system_prompt, user_prompt = task_parser_prompt(payload.title)
    local_date = x_local_date if x_local_date else datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    result, error_reason = await call_gemini_async(api_key, system_prompt, user_prompt, db, uid, local_date)
    if not result:
        raise HTTPException(status_code=503, detail=f"AI service unavailable: {error_reason}")
    try:
        data = validate_and_repair_json(result, dict)
        parsed_title = data.get("title", "").strip().strip('"')
        if not parsed_title:
            raise ValueError()
        return models.RewriteResponse(title=parsed_title)
    except Exception:
        raise HTTPException(status_code=422, detail="AI returned invalid title format. Please try again.")

# NOTE: /decompose and /plan-day must be registered BEFORE /{task_id} routes
@app.post("/api/tasks/decompose", response_model=models.DecomposeResponse)
async def decompose_task(payload: models.DecomposeRequest, x_api_key: Optional[str] = Header(None), x_local_date: Optional[str] = Header(None), db: Session = Depends(get_db), uid: str = Depends(get_current_uid)):
    api_key = x_api_key if x_api_key else os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="No Gemini API key configured")

    system_prompt, user_prompt = task_decompose_prompt(payload.title)
    local_date = x_local_date if x_local_date else datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    result, error_reason = await call_gemini_async(api_key, system_prompt, user_prompt, db, uid, local_date)
    if not result:
        raise HTTPException(status_code=503, detail=f"AI service unavailable: {error_reason}")
    try:
        steps = validate_and_repair_json(result, list)
        steps = [str(s) for s in steps if s]
        return models.DecomposeResponse(steps=steps[:5])
    except Exception:
        raise HTTPException(status_code=422, detail="AI returned invalid JSON. Please try again.")

@app.post("/api/tasks/plan-day", response_model=models.PlanDayResponse)
async def plan_day(payload: models.PlanDayRequest, x_api_key: Optional[str] = Header(None), x_local_date: Optional[str] = Header(None), db: Session = Depends(get_db), uid: str = Depends(get_current_uid)):
    api_key = x_api_key if x_api_key else os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="No Gemini API key configured")

    missed_day = payload.missed_pattern or "unknown"
    current_time = payload.current_time or datetime.now().strftime("%I:%M %p")
    system_prompt, user_prompt = daily_planner_prompt(payload.tasks, current_time, missed_day)
    local_date = x_local_date if x_local_date else datetime.now(timezone.utc).strftime("%Y-%m-%d")

    result, error_reason = await call_gemini_async(api_key, system_prompt, user_prompt, db, uid, local_date)
    if not result:
        raise HTTPException(status_code=503, detail=f"AI service unavailable: {error_reason}")
    try:
        data = validate_and_repair_json(result, dict)
        plan_items = [models.PlanTaskItem(**item) for item in data.get("plan", [])]
        return models.PlanDayResponse(message=data.get("message", "Let's have a great day!"), plan=plan_items)
    except Exception:
        raise HTTPException(status_code=422, detail="AI returned invalid plan format. Please try again.")


@app.post("/api/tasks", response_model=models.TaskResponse)
async def create_task(task: models.TaskCreate, x_api_key: Optional[str] = Header(None), x_local_date: Optional[str] = Header(None), db: Session = Depends(get_db), uid: str = Depends(get_current_uid)):
    api_key_to_use = x_api_key if x_api_key else os.getenv("GEMINI_API_KEY")
    title = task.raw
    # If a Plan: category is explicitly provided, preserve it and skip AI/guess
    incoming_category = task.category or ""
    is_plan_task = incoming_category.startswith("Plan:") or incoming_category == "Plan"
    category = incoming_category if incoming_category else "Personal"
    ai_failed = False
    ai_failure_reason = None
    recurrence = normalized_recurrence(task.recurrence)
    due_time = normalized_due_time(task.due_time)

    if is_plan_task or task.skip_ai:
        title = task.title if task.title else task.raw
        if not is_plan_task:
            category = guess_category(title)
    elif api_key_to_use:
        local_date = x_local_date if x_local_date else datetime.now(timezone.utc).strftime("%Y-%m-%d")
        system_prompt, user_prompt = task_parser_prompt(task.raw)
        
        result, error_reason = await call_gemini_async(api_key_to_use, system_prompt, user_prompt, db, uid, local_date)
        
        if result:
            try:
                data = validate_and_repair_json(result, dict)
                parsed_title = data.get("title", "").strip().strip('"')
                if parsed_title:
                    title = parsed_title
                    category = guess_category(title)
            except Exception:
                pass # Fallback to raw if JSON parse fails
        else:
            ai_failed = True
            ai_failure_reason = error_reason or "offline"
    else:
        ai_failed = True
        ai_failure_reason = "offline"

    db_task = models.TaskDB(
        id=task.id,
        raw=task.raw,
        title=title,
        category=category,
        priority=task.priority or "medium",
        status=task.status or "pending",
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
    if payload.missed_reason is not None:
        db_task.missed_reason = payload.missed_reason
    spawn_next_recurring_task(db, db_task, previous_status)
    db.commit()
    db.refresh(db_task)
    return serialize_task(db_task)

@app.patch("/api/tasks/{task_id}", response_model=models.TaskResponse)
def patch_task(task_id: str, payload: models.TaskUpdateRequest, db: Session = Depends(get_db), uid: str = Depends(get_current_uid)):
    db_task = db.query(models.TaskDB).filter(models.TaskDB.id == task_id, models.TaskDB.user_id == uid).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    previous_status = db_task.status
    if payload.status is not None:
        db_task.status = payload.status
    if payload.addedAt is not None:
        db_task.addedAt = payload.addedAt
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
    if payload.missed_reason is not None:
        db_task.missed_reason = payload.missed_reason
        
    spawn_next_recurring_task(db, db_task, previous_status)
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

# ── CLEAN SLATE ENGINE ────────────────────────────────────────────────────────
def execute_midnight_clean_slate(db: Session, uid: str):
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_str = today.strftime("%Y-%m-%d")
    
    stale_tasks = db.query(models.TaskDB).filter(
        models.TaskDB.user_id == uid,
        models.TaskDB.status == "pending"
    ).all()
    
    parked_count = 0
    spawned_count = 0
    for task in stale_tasks:
        t_date = task.addedAt.split("T")[0] if task.addedAt else today_str
        if t_date < today_str:
            previous_status = task.status
            task.status = "parked"
            
            event = models.TaskEventDB(
                id=str(uuid4()),
                task_id=task.id,
                user_id=task.user_id,
                event_type="parked",
                event_metadata={"missed_date": t_date}
            )
            db.add(event)
            parked_count += 1
            
            spawn_next_recurring_task(db, task, previous_status)
            spawned_count += 1
            
    db.commit()

@app.post("/api/system/trigger-midnight-sync")
async def trigger_midnight_sync(background_tasks: BackgroundTasks, db: Session = Depends(get_db), uid: str = Depends(get_current_uid)):
    background_tasks.add_task(execute_midnight_clean_slate, db, uid)
    return {"status": "Clean Slate processing started in background."}


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
def get_habits(date: Optional[str] = None, x_local_date: Optional[str] = Header(None), db: Session = Depends(get_db), uid: str = Depends(get_current_uid)):
    habits = db.query(models.HabitDB).filter(models.HabitDB.user_id == uid, models.HabitDB.is_active == True).all()
    today_str = date or x_local_date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    result = []
    for h in habits:
        logs = db.query(models.HabitLogDB).filter(models.HabitLogDB.habit_id == h.id).all()
        logged_dates = sorted(set(l.logged_date for l in logs))
        logged_today = today_str in logged_dates
        # streak calc
        streak = 0
        if logged_dates:
            check_date = datetime.strptime(today_str, "%Y-%m-%d")
            if today_str not in logged_dates:
                # If not logged today, start checking from yesterday
                check_date -= timedelta(days=1)
            
            while True:
                ds = check_date.strftime("%Y-%m-%d")
                if ds in logged_dates:
                    streak += 1
                    check_date -= timedelta(days=1)
                else:
                    break
        # missed calc
        missed_days = 0
        if not logged_today:
            check_date = datetime.strptime(today_str, "%Y-%m-%d") - timedelta(days=1)
            while check_date.strftime("%Y-%m-%d") not in logged_dates and check_date.strftime("%Y-%m-%dT00:00:00Z") >= (h.created_at or ""):
                missed_days += 1
                check_date -= timedelta(days=1)
                
        r = models.HabitResponse(
            id=h.id, name=h.name, icon=h.icon or "⭐",
            identity=h.identity, difficulty=h.difficulty,
            created_at=h.created_at, is_active=h.is_active,
            streak=streak, logged_today=logged_today,
            missed_days=missed_days
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
        identity=payload.identity,
        difficulty=payload.difficulty or "medium",
        created_at=datetime.utcnow().isoformat() + "Z",
        is_active=True,
    )
    db.add(h)
    db.commit()
    db.refresh(h)
    return models.HabitResponse(id=h.id, name=h.name, icon=h.icon, identity=h.identity, difficulty=h.difficulty, created_at=h.created_at, is_active=h.is_active, streak=0, logged_today=False, missed_days=0)

@app.delete("/api/habits/{habit_id}")
def delete_habit(habit_id: str, db: Session = Depends(get_db), uid: str = Depends(get_current_uid)):
    h = db.query(models.HabitDB).filter(models.HabitDB.id == habit_id, models.HabitDB.user_id == uid).first()
    if not h:
        raise HTTPException(status_code=404, detail="Habit not found")
    h.is_active = False
    db.commit()
    return {"status": "deleted"}

# FIX: habit edit toggle — PATCH endpoint for updating habit fields
@app.patch("/api/habits/{habit_id}", response_model=models.HabitResponse)
def update_habit(habit_id: str, payload: models.HabitUpdate, db: Session = Depends(get_db), uid: str = Depends(get_current_uid)):
    h = db.query(models.HabitDB).filter(models.HabitDB.id == habit_id, models.HabitDB.user_id == uid).first()
    if not h:
        raise HTTPException(status_code=404, detail="Habit not found")
    if payload.name is not None and payload.name.strip():
        h.name = payload.name.strip()
    if payload.icon is not None:
        h.icon = payload.icon
    if payload.identity is not None:
        h.identity = payload.identity
    if payload.difficulty is not None and payload.difficulty in {"easy", "medium", "hard"}:
        h.difficulty = payload.difficulty
    db.commit()
    db.refresh(h)
    # Recalculate streak/logged_today for response
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    logs = db.query(models.HabitLogDB).filter(models.HabitLogDB.habit_id == h.id).all()
    logged_dates = sorted(set(l.logged_date for l in logs))
    logged_today = today_str in logged_dates
    streak = 0
    if logged_dates:
        check_date = datetime.strptime(today_str, "%Y-%m-%d")
        if today_str not in logged_dates:
            check_date -= timedelta(days=1)
        while True:
            ds = check_date.strftime("%Y-%m-%d")
            if ds in logged_dates:
                streak += 1
                check_date -= timedelta(days=1)
            else:
                break
    return models.HabitResponse(
        id=h.id, name=h.name, icon=h.icon or "⭐",
        identity=h.identity, difficulty=h.difficulty,
        created_at=h.created_at, is_active=h.is_active,
        streak=streak, logged_today=logged_today, missed_days=0
    )


@app.post("/api/habits/{habit_id}/log")
def log_habit(habit_id: str, date: Optional[str] = None, x_local_date: Optional[str] = Header(None), db: Session = Depends(get_db), uid: str = Depends(get_current_uid)):
    # Verify habit ownership
    h = db.query(models.HabitDB).filter(models.HabitDB.id == habit_id, models.HabitDB.user_id == uid).first()
    if not h:
        raise HTTPException(status_code=404, detail="Habit not found")
    today_str = date or x_local_date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
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
def unlog_habit(habit_id: str, date: Optional[str] = None, x_local_date: Optional[str] = Header(None), db: Session = Depends(get_db), uid: str = Depends(get_current_uid)):
    # Verify habit ownership
    h = db.query(models.HabitDB).filter(models.HabitDB.id == habit_id, models.HabitDB.user_id == uid).first()
    if not h:
        raise HTTPException(status_code=404, detail="Habit not found")
    today_str = date or x_local_date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    db.query(models.HabitLogDB).filter(
        models.HabitLogDB.habit_id == habit_id,
        models.HabitLogDB.logged_date == today_str
    ).delete()
    db.commit()
    return {"status": "unlogged"}

@app.get("/api/habits/{habit_id}/heatmap", response_model=List[models.HeatmapEntry])
def get_heatmap(habit_id: str, x_local_date: Optional[str] = Header(None), db: Session = Depends(get_db), uid: str = Depends(get_current_uid)):
    # Verify habit ownership
    h = db.query(models.HabitDB).filter(models.HabitDB.id == habit_id, models.HabitDB.user_id == uid).first()
    if not h:
        raise HTTPException(status_code=404, detail="Habit not found")
    logs = db.query(models.HabitLogDB).filter(models.HabitLogDB.habit_id == habit_id).all()
    # Return all logs. The frontend handles the grid construction and padding.
    result = []
    for log in logs:
        result.append(models.HeatmapEntry(date=log.logged_date, done=True, count=1))
    return result


@app.post("/api/tasks/note-to-task", response_model=models.NoteToTaskResponse)
async def note_to_task(
    payload: models.NoteToTaskRequest,
    x_api_key: Optional[str] = Header(None),
    x_local_date: Optional[str] = Header(None),
    db: Session = Depends(get_db),
    uid: str = Depends(get_current_uid)
):
    """Convert a free-form note/idea into a clean, actionable task title using AI."""
    api_key = x_api_key if x_api_key else os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="No Gemini API key configured")

    system_prompt, user_prompt = note_to_task_prompt(payload.note_title, payload.note_body)
    local_date = x_local_date if x_local_date else datetime.now(timezone.utc).strftime("%Y-%m-%d")

    result, error_reason = await call_gemini_async(api_key, system_prompt, user_prompt, db, uid, local_date)
    if not result:
        raise HTTPException(status_code=503, detail=f"AI unavailable: {error_reason}")

    try:
        data = validate_and_repair_json(result, dict)
        title = data.get("title", "").strip().strip('"')
        if not title:
            raise ValueError("empty title")
        return models.NoteToTaskResponse(title=title)
    except Exception:
        raise HTTPException(status_code=422, detail="AI returned invalid format. Please try again.")

# ── FOLDERS ───────────────────────────────────────────────────────────────────

@app.get("/api/notes/folders", response_model=List[models.FolderResponse])
def list_folders(db: Session = Depends(get_db), uid: str = Depends(get_current_uid)):
    return db.query(models.FolderDB).filter(models.FolderDB.user_id == uid).order_by(models.FolderDB.created_at).all()

@app.post("/api/notes/folders", response_model=models.FolderResponse)
def create_folder(folder: models.FolderCreate, db: Session = Depends(get_db), uid: str = Depends(get_current_uid)):
    now = datetime.now(timezone.utc).isoformat()
    db_folder = models.FolderDB(
        id=folder.id,
        user_id=uid,
        name=folder.name,
        emoji=folder.emoji or "📁",
        created_at=folder.created_at or now,
    )
    db.add(db_folder)
    db.commit()
    db.refresh(db_folder)
    return db_folder

@app.delete("/api/notes/folders/{folder_id}")
def delete_folder(folder_id: str, db: Session = Depends(get_db), uid: str = Depends(get_current_uid)):
    folder = db.query(models.FolderDB).filter(models.FolderDB.id == folder_id, models.FolderDB.user_id == uid).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    db.query(models.NoteDB).filter(models.NoteDB.folder_id == folder_id, models.NoteDB.user_id == uid).delete()
    db.delete(folder)
    db.commit()
    return {"ok": True}


# ── NOTES ─────────────────────────────────────────────────────────────────────

@app.get("/api/notes", response_model=List[models.NoteResponse])
def list_notes(folder_id: Optional[str] = None, db: Session = Depends(get_db), uid: str = Depends(get_current_uid)):
    q = db.query(models.NoteDB).filter(models.NoteDB.user_id == uid)
    if folder_id:
        q = q.filter(models.NoteDB.folder_id == folder_id)
    return q.order_by(models.NoteDB.updated_at.desc()).all()

@app.post("/api/notes", response_model=models.NoteResponse)
def create_note(note: models.NoteCreate, db: Session = Depends(get_db), uid: str = Depends(get_current_uid)):
    now = datetime.now(timezone.utc).isoformat()
    db_note = models.NoteDB(
        id=note.id,
        folder_id=note.folder_id,
        user_id=uid,
        title=note.title or "",
        body=note.body or "",
        scheduled=note.scheduled or "[]",
        created_at=note.created_at or now,
        updated_at=note.updated_at or now,
    )
    db.add(db_note)
    db.commit()
    db.refresh(db_note)
    return db_note

@app.put("/api/notes/{note_id}", response_model=models.NoteResponse)
def update_note(note_id: str, update: models.NoteUpdatePayload, db: Session = Depends(get_db), uid: str = Depends(get_current_uid)):
    note = db.query(models.NoteDB).filter(models.NoteDB.id == note_id, models.NoteDB.user_id == uid).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    if update.title is not None:
        note.title = update.title
    if update.body is not None:
        note.body = update.body
    if update.scheduled is not None:
        note.scheduled = update.scheduled
    note.updated_at = update.updated_at or datetime.now(timezone.utc).isoformat()
    db.commit()
    db.refresh(note)
    return note

@app.delete("/api/notes/{note_id}")
def delete_note(note_id: str, db: Session = Depends(get_db), uid: str = Depends(get_current_uid)):
    note = db.query(models.NoteDB).filter(models.NoteDB.id == note_id, models.NoteDB.user_id == uid).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    db.delete(note)
    db.commit()
    return {"ok": True}

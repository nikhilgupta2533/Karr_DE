import os
import threading
import time
import google.generativeai as genai
from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from dotenv import load_dotenv, find_dotenv
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from .database import engine, Base, get_db
from . import models
from dateutil.relativedelta import relativedelta
import logging

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Re-create tables if not exists
Base.metadata.create_all(bind=engine)

# Lightweight migration - only for SQLite
db_url = os.getenv("DATABASE_URL", "sqlite:///./karde_tasks.db")
if "sqlite" in db_url:
    with engine.connect() as conn:
        cols = [row[1] for row in conn.execute(text("PRAGMA table_info(tasks)")).fetchall()]
        if "is_pinned" not in cols:
            conn.execute(text("ALTER TABLE tasks ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0"))
            conn.commit()
        if "is_recurring" not in cols:
            conn.execute(text("ALTER TABLE tasks ADD COLUMN is_recurring INTEGER NOT NULL DEFAULT 0"))
            conn.commit()
        if "recurrence" not in cols:
            conn.execute(text("ALTER TABLE tasks ADD COLUMN recurrence TEXT"))
            conn.commit()
        if "due_time" not in cols:
            conn.execute(text("ALTER TABLE tasks ADD COLUMN due_time TEXT"))
            conn.commit()

# Load env vars deterministically regardless of cwd.
# - Prefer a repo/root `.env` if present (find_dotenv)
# - Always load `backend/.env` (relative to this file) so GEMINI_API_KEY works locally
load_dotenv(find_dotenv(), override=False)
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"), override=False)
app = FastAPI()

gemini_lock = threading.Lock()
last_gemini_call_at = 0.0
DAILY_AI_LIMIT = 900

# Dynamic CORS setup for production
cors_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
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

@app.get("/")
def read_root():
    return {"status": "Kar De API is running"}

def guess_category(title: str) -> str:
    t = (title or "").lower()
    if any(k in t for k in ['gym', 'workout', 'health', 'doctor', 'water', 'sleep', 'run', 'walk', 'exercise', 'medical', 'pill', 'medicine']):
        return 'Health'
    if any(k in t for k in ['assignment', 'email', 'call', 'meet', 'work', 'project', 'code', 'study', 'read', 'boss', 'client', 'school', 'homework']):
        return 'Work'
    if any(k in t for k in ['clean', 'laundry', 'cook', 'dinner', 'lunch', 'breakfast', 'groceries', 'house', 'home', 'wash', 'sweep', 'mop']):
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
    # Ensure transient attributes are attached for Pydantic TaskResponse
    setattr(row, "ai_failed", ai_failed)
    setattr(row, "ai_failure_reason", ai_failure_reason)
    # Ensure these are booleans in the response object
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
    if value in {"daily", "weekly", "monthly"}:
        return value
    return None


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
    # Deduplication check: Has this task already been spawned for this next cycle?
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
        status="pending",
        addedAt=next_date,
        completedAt=None,
        is_pinned=source.is_pinned,
        is_recurring=source.is_recurring,
        recurrence=source.recurrence,
        due_time=source.due_time,
    )
    db.add(next_task)

@app.get("/api/tasks", response_model=List[models.TaskResponse])
def get_tasks(db: Session = Depends(get_db)):
    # Perfection: Auto-mark missed tasks on fetch
    now_utc = datetime.now(timezone.utc)
    today_str = now_utc.strftime("%Y-%m-%d")
    
    all_pending = db.query(models.TaskDB).filter(models.TaskDB.status == "pending").all()
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

    rows = db.query(models.TaskDB).order_by(models.TaskDB.is_pinned.desc(), models.TaskDB.addedAt.desc()).all()
    return [serialize_task(row) for row in rows]

@app.put("/api/tasks/bulk", response_model=List[models.TaskResponse])
def bulk_update_tasks(payload: List[models.TaskUpdateWithId], db: Session = Depends(get_db)):
    results = []
    for item in payload:
        db_task = db.query(models.TaskDB).filter(models.TaskDB.id == item.id).first()
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
        
        spawn_next_recurring_task(db, db_task, previous_status)
        results.append(serialize_task(db_task))
        
    db.commit()
    return results

@app.post("/api/tasks", response_model=models.TaskResponse)
def create_task(task: models.TaskCreate, x_api_key: Optional[str] = Header(None), db: Session = Depends(get_db)):
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
        if usage_row.count >= DAILY_AI_LIMIT:
            ai_failed = True
            ai_failure_reason = "daily_limit"
        else:
            # Valid Gemini models
            FALLBACK_MODELS = [
                # Use exact model IDs returned by genai.list_models() for this API key.
                "models/gemini-2.5-flash",
                "models/gemini-2.5-pro",
                "models/gemini-2.0-flash",
                "models/gemini-2.0-flash-lite",
            ]
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
                    enforce_gemini_spacing()
                    model = genai.GenerativeModel(
                        model_name=model_name,
                        system_instruction=system_prompt
                    )
                    response = model.generate_content(task.raw)
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
                    logger.warning(
                        f"Model {model_name} failed ({'quota' if is_quota else 'unavail' if is_unavailable else 'not_found' if is_not_found else 'error'}): {str(exc)[:120]}"
                    )
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
        status="pending",
        addedAt=task.addedAt,
        is_pinned=0,
        is_recurring=1 if task.is_recurring and recurrence else 0,
        recurrence=recurrence,
        due_time=due_time,
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return serialize_task(db_task, ai_failed, ai_failure_reason)

@app.put("/api/tasks/{task_id}/toggle", response_model=models.TaskResponse)
def toggle_task(task_id: str, db: Session = Depends(get_db)):
    db_task = db.query(models.TaskDB).filter(models.TaskDB.id == task_id).first()
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
def update_task(task_id: str, payload: models.TaskUpdate, db: Session = Depends(get_db)):
    db_task = db.query(models.TaskDB).filter(models.TaskDB.id == task_id).first()
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

    spawn_next_recurring_task(db, db_task, previous_status)

    db.commit()
    db.refresh(db_task)
    return serialize_task(db_task)

@app.put("/api/tasks/midnight-miss")
def mark_missed(task_id: str, db: Session = Depends(get_db)):
    db_task = db.query(models.TaskDB).filter(models.TaskDB.id == task_id).first()
    if db_task and db_task.status == "pending":
        previous_status = db_task.status
        db_task.status = "missed"
        spawn_next_recurring_task(db, db_task, previous_status)
        db.commit()
    return {"status": "ok"}

@app.delete("/api/tasks/{task_id}")
def delete_task(task_id: str, db: Session = Depends(get_db)):
    db_task = db.query(models.TaskDB).filter(models.TaskDB.id == task_id).first()
    if db_task:
        db.delete(db_task)
        db.commit()
    return {"status": "deleted"}

@app.post("/api/tasks/clear")
def clear_tasks(db: Session = Depends(get_db)):
    db.query(models.TaskDB).delete()
    db.commit()
    return {"status": "cleared"}


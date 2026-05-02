from sqlalchemy import Column, Integer, String, Boolean, Date
from backend.database import Base
from pydantic import BaseModel
from typing import Optional, List
import datetime

# ─── SQLAlchemy ORM Models ────────────────────────────────────────────────────

class TaskDB(Base):
    __tablename__ = "tasks"

    id = Column(String, primary_key=True, index=True)
    raw = Column(String, nullable=False)
    title = Column(String, nullable=True)
    category = Column(String, default="Personal")
    priority = Column(String, default="medium", nullable=True)
    status = Column(String, default="pending")  # pending, completed, missed
    addedAt = Column(String)
    completedAt = Column(String, nullable=True)
    is_pinned = Column(Integer, default=0, nullable=False)
    is_recurring = Column(Integer, default=0, nullable=False)
    recurrence = Column(String, nullable=True)
    due_time = Column(String, nullable=True)
    subtasks = Column(String, nullable=True)  # JSON array string
    user_id = Column(String, default="default", nullable=True)
    missed_reason = Column(String, nullable=True)


class AIUsageDB(Base):
    __tablename__ = "ai_usage"

    day_key = Column(String, primary_key=True, index=True)
    count = Column(Integer, default=0, nullable=False)


class HabitDB(Base):
    __tablename__ = "habits"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, default="default", nullable=False)
    name = Column(String, nullable=False)
    icon = Column(String, default="⭐", nullable=True)
    identity = Column(String, nullable=True)
    difficulty = Column(String, default="medium", nullable=False)
    created_at = Column(String, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)


class HabitLogDB(Base):
    __tablename__ = "habit_logs"

    id = Column(String, primary_key=True, index=True)
    habit_id = Column(String, nullable=False, index=True)
    logged_date = Column(String, nullable=False)   # YYYY-MM-DD string
    created_at = Column(String, nullable=True)


# ─── Pydantic Schemas — Tasks ─────────────────────────────────────────────────

class TaskCreate(BaseModel):
    id: str
    raw: str
    addedAt: str
    title: Optional[str] = None
    category: Optional[str] = "Personal"
    priority: Optional[str] = "medium"
    skip_ai: bool = False
    is_recurring: bool = False
    recurrence: Optional[str] = None
    due_time: Optional[str] = None
    subtasks: Optional[str] = None  # JSON array string
    status: Optional[str] = "pending"


class TaskResponse(BaseModel):
    id: str
    raw: str
    title: Optional[str]
    category: str
    priority: Optional[str] = "medium"
    status: str
    addedAt: str
    completedAt: Optional[str]
    is_pinned: bool = False
    is_recurring: bool = False
    recurrence: Optional[str] = None
    due_time: Optional[str] = None
    subtasks: Optional[str] = None
    user_id: Optional[str] = "default"
    ai_failed: bool = False
    ai_failure_reason: Optional[str] = None
    missed_reason: Optional[str] = None

    class Config:
        from_attributes = True


class TaskUpdate(BaseModel):
    status: Optional[str] = None
    completedAt: Optional[str] = None
    is_pinned: Optional[bool] = None
    title: Optional[str] = None
    due_time: Optional[str] = None
    subtasks: Optional[str] = None
    missed_reason: Optional[str] = None


class TaskUpdateRequest(BaseModel):
    """Full partial-update schema for PATCH /api/tasks/{id}"""
    title: Optional[str] = None
    category: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    addedAt: Optional[str] = None
    recurrence: Optional[str] = None
    due_time: Optional[str] = None
    subtasks: Optional[str] = None
    missed_reason: Optional[str] = None


class TaskUpdateWithId(TaskUpdate):
    id: str


# ─── Pydantic Schemas — AI ───────────────────────────────────────────────────

class DecomposeRequest(BaseModel):
    title: str


class DecomposeResponse(BaseModel):
    steps: List[str]


class RewriteRequest(BaseModel):
    title: str


class RewriteResponse(BaseModel):
    title: str


class PlanTaskItem(BaseModel):
    task_id: str
    order: int
    reason: str


class PlanDayRequest(BaseModel):
    tasks: List[dict]
    missed_pattern: Optional[str] = None
    current_time: Optional[str] = None


class PlanDayResponse(BaseModel):
    message: str
    plan: List[PlanTaskItem]


# ─── Pydantic Schemas — Habits ───────────────────────────────────────────────

class HabitCreate(BaseModel):
    name: str
    icon: Optional[str] = "⭐"
    identity: Optional[str] = None
    difficulty: Optional[str] = "medium"


class HabitResponse(BaseModel):
    id: str
    name: str
    icon: Optional[str]
    identity: Optional[str]
    difficulty: str
    created_at: Optional[str]
    is_active: bool
    streak: int = 0
    logged_today: bool = False
    missed_days: int = 0

    class Config:
        from_attributes = True


class HeatmapEntry(BaseModel):
    date: str   # YYYY-MM-DD
    done: bool
    count: int = 0

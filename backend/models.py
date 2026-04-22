from sqlalchemy import Column, Integer, String
from backend.database import Base
from pydantic import BaseModel
from typing import Optional

class TaskDB(Base):
    __tablename__ = "tasks"

    id = Column(String, primary_key=True, index=True)
    raw = Column(String, nullable=False)
    title = Column(String, nullable=True)
    category = Column(String, default="Personal")
    status = Column(String, default="pending")  # pending, completed, missed
    addedAt = Column(String)
    completedAt = Column(String, nullable=True)
    is_pinned = Column(Integer, default=0, nullable=False)
    is_recurring = Column(Integer, default=0, nullable=False)
    recurrence = Column(String, nullable=True)
    due_time = Column(String, nullable=True)


class AIUsageDB(Base):
    __tablename__ = "ai_usage"

    day_key = Column(String, primary_key=True, index=True)
    count = Column(Integer, default=0, nullable=False)

# Pydantic Schemas
class TaskCreate(BaseModel):
    id: str
    raw: str
    addedAt: str
    title: Optional[str] = None
    category: Optional[str] = "Personal"
    skip_ai: bool = False
    is_recurring: bool = False
    recurrence: Optional[str] = None
    due_time: Optional[str] = None

class TaskResponse(BaseModel):
    id: str
    raw: str
    title: Optional[str]
    category: str
    status: str
    addedAt: str
    completedAt: Optional[str]
    is_pinned: bool = False
    is_recurring: bool = False
    recurrence: Optional[str] = None
    due_time: Optional[str] = None
    ai_failed: bool = False
    ai_failure_reason: Optional[str] = None

    class Config:
        from_attributes = True


class TaskUpdate(BaseModel):
    status: Optional[str] = None
    completedAt: Optional[str] = None
    is_pinned: Optional[bool] = None
    title: Optional[str] = None
    due_time: Optional[str] = None

class TaskUpdateWithId(TaskUpdate):
    id: str


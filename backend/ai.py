import os
import time
import json
import logging
import asyncio
from typing import Optional
from sqlalchemy.orm import Session
import google.generativeai as genai
from backend import models

logger = logging.getLogger(__name__)

FALLBACK_MODELS = [
    "models/gemini-2.5-flash",
    "models/gemini-2.5-flash-lite",
    "models/gemini-2.0-flash",
    "models/gemini-2.0-flash-lite",
    "models/gemini-pro-latest",
]

DAILY_AI_LIMIT = 900

# We use a lock to ensure we don't spam the API concurrently from the same worker
import threading
gemini_lock = threading.Lock()
last_gemini_call_at = 0.0

def enforce_gemini_spacing():
    """Ensures at least 300ms between Gemini calls to avoid rate limits."""
    global last_gemini_call_at
    with gemini_lock:
        elapsed = time.time() - last_gemini_call_at
        if elapsed < 0.3:
            time.sleep(0.3 - elapsed)
        last_gemini_call_at = time.time()

def get_or_create_usage_row(db: Session, usage_key: str) -> models.AIUsageDB:
    row = db.query(models.AIUsageDB).filter(models.AIUsageDB.day_key == usage_key).first()
    if row:
        return row
    row = models.AIUsageDB(day_key=usage_key, count=0)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row

def enforce_ai_rate_limit(db: Session, user_id: str, local_date_str: str) -> models.AIUsageDB:
    """
    Checks the daily limit for the specific user in their local timezone.
    Returns the usage row if allowed, otherwise raises an exception.
    """
    # Composite key to isolate by user and date without schema changes
    usage_key = f"{user_id}_{local_date_str}"
    usage_row = get_or_create_usage_row(db, usage_key)
    
    if usage_row.count >= DAILY_AI_LIMIT:
        raise ValueError("daily_limit_reached")
        
    return usage_row

def increment_ai_usage(db: Session, usage_row: models.AIUsageDB):
    """Increments the usage count safely."""
    usage_row.count += 1
    db.commit()

def validate_and_repair_json(raw_text: str, expected_type=dict):
    """
    Strips markdown fences, attempts json.loads, and repairs if needed.
    """
    cleaned = raw_text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`").strip()
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].strip()
            
    try:
        data = json.loads(cleaned)
        if not isinstance(data, expected_type):
            raise ValueError(f"Expected JSON {expected_type.__name__}, got {type(data).__name__}")
        return data
    except Exception as e:
        logger.error(f"JSON Parse Error: {e} on text: {cleaned[:100]}...")
        raise

def call_gemini_with_fallback(
    api_key: str, 
    system_prompt: str, 
    user_prompt: str, 
    db: Session,
    user_id: str,
    local_date_str: str
) -> tuple[Optional[str], Optional[str]]:
    """
    Calls Gemini, falling back through models on failure.
    Returns (response_text, error_reason)
    """
    is_default_key = (api_key == os.getenv("GEMINI_API_KEY"))
    
    usage_row = None
    if is_default_key:
        try:
            usage_row = enforce_ai_rate_limit(db, user_id, local_date_str)
        except ValueError as e:
            if str(e) == "daily_limit_reached":
                logger.warning(f"Rate limit reached for user {user_id} on {local_date_str}")
                return None, "daily_limit"

    genai.configure(api_key=api_key)
    last_failure_reason = "offline"
    
    for model_name in FALLBACK_MODELS:
        try:
            enforce_gemini_spacing()
            model = genai.GenerativeModel(
                model_name=model_name, 
                system_instruction=system_prompt,
                generation_config=genai.types.GenerationConfig(temperature=0.2)
            )
            response = model.generate_content(user_prompt)
            text_out = (response.text or "").strip()
            
            if text_out:
                if usage_row:
                    increment_ai_usage(db, usage_row)
                logger.info(f"AI success with model: {model_name}")
                return text_out, None
                
        except Exception as exc:
            lowered = str(exc).lower()
            is_quota = "429" in lowered or "resource_exhausted" in lowered or "quota" in lowered
            is_unavailable = "503" in lowered or "unavailable" in lowered
            is_not_found = "404" in lowered or "not found" in lowered
            
            last_failure_reason = "rate_limit" if is_quota else "offline" if is_unavailable else "model_not_found" if is_not_found else "offline"
            logger.warning(f"Model {model_name} failed: {str(exc)[:120]}")
            
            if is_quota or is_unavailable or is_not_found:
                continue
            break # other critical errors, don't fallback endlessly
            
    return None, last_failure_reason

async def call_gemini_async(*args, **kwargs) -> tuple[Optional[str], Optional[str]]:
    """Wraps call_gemini_with_fallback in an asyncio thread."""
    return await asyncio.to_thread(call_gemini_with_fallback, *args, **kwargs)

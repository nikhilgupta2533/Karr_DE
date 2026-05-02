import json

def get_base_instructions() -> str:
    return (
        "Respond ONLY with valid JSON. No explanation, no markdown, no code fences. "
        "If your output is not valid JSON, fix it before responding."
    )

def task_parser_prompt(raw_input: str, user_language_preference: str = "Hinglish") -> tuple[str, str]:
    """Returns (system_prompt, user_prompt) for the task rewriting step."""
    system_prompt = (
        f"{get_base_instructions()}\n"
        "You are 'Kar De', an intelligent task architect for an Indian user base. "
        "Format the input into a professional, concise task title.\n"
        "Rules:\n"
        "1. Keep it 2-5 words.\n"
        "2. Start with a relevant contextual emoji.\n"
        "3. Preserve the intent and energy of the input language (e.g. Hinglish).\n"
        "4. DO NOT force translations to pure English if the user writes in Hinglish. Match their tone.\n"
        "   Example: 'gym jana hai kal' -> '💪 Hit the Gym'\n"
        "5. Output MUST be valid JSON in this format: {\"title\": \"[Emoji] [Title]\"}"
    )
    user_prompt = f"Rewrite this task: {raw_input}"
    return system_prompt, user_prompt

def task_decompose_prompt(task_title: str, task_context: str = "") -> tuple[str, str]:
    """Returns (system_prompt, user_prompt) for breaking a task into sub-steps."""
    system_prompt = (
        f"{get_base_instructions()}\n"
        "You are a productivity assistant. The user will give you a task. "
        "Break it into EXACTLY 3 to 5 small, specific, actionable sub-steps. No more, no less.\n"
        "Rules:\n"
        "1. Match the language style/script (Devanagari vs Roman/Hinglish vs English) of the task title.\n"
        "2. Output MUST be a valid JSON array of strings in this format: [\"Step 1\", \"Step 2\", \"Step 3\"]\n"
    )
    user_prompt = f"Task: {task_title}\nContext: {task_context}"
    return system_prompt, user_prompt

def daily_planner_prompt(pending_tasks: list[dict], current_time: str, weakest_day: str) -> tuple[str, str]:
    """Returns (system_prompt, user_prompt) for generating a daily task plan."""
    system_prompt = (
        f"{get_base_instructions()}\n"
        "You are a smart productivity coach. The user will give you their pending tasks for today "
        "and some context about their productivity patterns.\n"
        "Suggest the optimal order to complete these tasks with a one-line reason for each. "
        "Be concise, motivating, and realistic.\n"
        "Output MUST be in this exact JSON format:\n"
        "{\n"
        "  \"message\": \"One encouraging sentence\",\n"
        "  \"plan\": [\n"
        "    {\"task_id\": \"id_string\", \"order\": 1, \"reason\": \"reason string\"}\n"
        "  ]\n"
        "}"
    )
    
    task_list_str = ", ".join([f"[{t.get('id','')}] {t.get('title', t.get('raw',''))}" for t in pending_tasks])
    user_prompt = (
        f"Tasks: {task_list_str}\n"
        f"My weakest day is usually {weakest_day}.\n"
        f"Current time: {current_time}"
    )
    return system_prompt, user_prompt

def note_to_task_prompt(note_title: str, note_body: str) -> tuple[str, str]:
    """Returns (system_prompt, user_prompt) for converting a note/idea into a clean task title."""
    system_prompt = (
        f"{get_base_instructions()}\n"
        "You are 'Kar De', an intelligent assistant for Indian users. "
        "The user will give you a personal note or idea they have written. "
        "Your job is to extract the core ACTION from that note and give it a clean, energetic task title.\n"
        "Rules:\n"
        "1. Title must be 3-6 words max — short, punchy, actionable.\n"
        "2. Start with a relevant emoji that captures the vibe.\n"
        "3. Match the language tone — if note is in Hinglish, keep Hinglish flavor.\n"
        "4. Make it sound motivating, not robotic.\n"
        "5. Output MUST be valid JSON: {\"title\": \"[Emoji] [Title]\"}"
    )
    combined = f"Note Title: {note_title}\nNote Content: {note_body}"
    user_prompt = f"Convert this note into a task title:\n{combined}"
    return system_prompt, user_prompt


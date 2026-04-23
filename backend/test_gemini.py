import os
from dotenv import load_dotenv
import google.generativeai as genai
import sys

load_dotenv("e:/Karr_DE/backend/.env")

api_key = os.getenv("GEMINI_API_KEY")
print("API_KEY starting with:", api_key[:10] if api_key else None)

try:
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(
        model_name="models/gemini-2.5-flash",
        generation_config=genai.types.GenerationConfig(temperature=0.2)
    )
    response = model.generate_content("Say hello")
    print("Response:", response.text)
except Exception as e:
    print("Error:", e)
    sys.exit(1)

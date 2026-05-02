import sys
import os

# Add the root directory to the path
sys.path.insert(0, os.path.dirname(__file__) + "/..")

from backend.main import app
from mangum import Mangum

# Wrap FastAPI app with Mangum for Vercel serverless
handler = Mangum(app)

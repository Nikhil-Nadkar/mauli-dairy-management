"""Vercel entry point for the FastAPI backend.

Vercel runs every file in api/ as a serverless function. vercel.json sends every /api/... request here,
and the FastAPI app (backend/src/main.py) handles it with its normal routes.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from src.main import app  # noqa: E402,F401  (Vercel looks for a variable named "app")

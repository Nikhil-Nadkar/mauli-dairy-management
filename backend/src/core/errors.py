"""Central error handling: every error reaches the frontend as {"detail": "plain sentence"}."""
import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

logger = logging.getLogger("dairy")


def _friendly_validation_message(exc: RequestValidationError) -> str:
    parts = []
    for err in exc.errors():
        field = str(err["loc"][-1]) if err.get("loc") else "input"
        msg = str(err.get("msg", "is not valid")).removeprefix("Value error, ")
        parts.append(msg if field in msg else f"{field.replace('_', ' ').capitalize()}: {msg}")
    return "Please check your entry. " + "; ".join(parts)


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError):
        return JSONResponse(status_code=422, content={"detail": _friendly_validation_message(exc)})

    @app.exception_handler(IntegrityError)
    async def integrity_error(request: Request, exc: IntegrityError):
        logger.warning("Integrity error: %s", exc.orig)
        return JSONResponse(status_code=409, content={"detail": "This could not be saved because it clashes with existing data."})

    @app.exception_handler(Exception)
    async def unexpected_error(request: Request, exc: Exception):
        logger.exception("Unhandled error")
        return JSONResponse(status_code=500, content={"detail": "Something went wrong. Please try again."})

import sqlite3

from fastapi import Depends, HTTPException, Request

from app.db import get_db as _get_db
from app.security import is_same_origin, session_user_id


def db_dep() -> sqlite3.Connection:
    return _get_db()


def require_same_origin(request: Request) -> None:
    if not is_same_origin(request):
        raise HTTPException(status_code=403, detail="Invalid request origin")


def current_user_id(request: Request, db: sqlite3.Connection = Depends(db_dep)) -> str:
    user_id = session_user_id(request, db)
    if not user_id:
        raise HTTPException(status_code=401, detail="Sign in required")
    return user_id


def optional_user_id(request: Request, db: sqlite3.Connection = Depends(db_dep)) -> str | None:
    return session_user_id(request, db)

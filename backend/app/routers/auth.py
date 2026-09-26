import re
import sqlite3
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.config import get_settings
from app.dependencies import db_dep, optional_user_id, require_same_origin
from app.schemas import LoginRequest, RegisterRequest, UserSummary
from app.security import (
    end_session,
    hash_password,
    invite_code_matches,
    start_session,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


@router.post("/register", response_model=UserSummary, status_code=201)
def register(
    body: RegisterRequest,
    request: Request,
    response: Response,
    db: sqlite3.Connection = Depends(db_dep),
    _origin: None = Depends(require_same_origin),
):
    if not _EMAIL_RE.match(body.email):
        raise HTTPException(status_code=400, detail="Invalid registration details")
    expected = get_settings().pilot_invite_code
    if not expected:
        raise HTTPException(status_code=503, detail="Registration is not configured")
    if not invite_code_matches(body.invite_code, expected):
        raise HTTPException(status_code=403, detail="Invalid invite code")

    normalized_email = body.email.strip().lower()
    if db.execute("SELECT id FROM users WHERE email = ?", (normalized_email,)).fetchone():
        raise HTTPException(status_code=409, detail="Account already exists")

    user_id = str(uuid.uuid4())
    try:
        with db:
            db.execute(
                "INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
                (user_id, normalized_email, hash_password(body.password), datetime.now(timezone.utc).isoformat()),
            )
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="Account already exists")

    start_session(user_id, response, db)
    return UserSummary(id=user_id, email=normalized_email)


@router.post("/login", response_model=UserSummary)
def login(
    body: LoginRequest,
    response: Response,
    db: sqlite3.Connection = Depends(db_dep),
    _origin: None = Depends(require_same_origin),
):
    row = db.execute(
        "SELECT id, email, password_hash FROM users WHERE email = ?", (body.email.strip().lower(),)
    ).fetchone()
    if not row or not verify_password(body.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    start_session(row["id"], response, db)
    return UserSummary(id=row["id"], email=row["email"])


@router.post("/logout")
def logout(
    request: Request,
    response: Response,
    db: sqlite3.Connection = Depends(db_dep),
    _origin: None = Depends(require_same_origin),
):
    end_session(request, response, db)
    return {"ok": True}


@router.get("/me")
def me(response: Response, user_id: str | None = Depends(optional_user_id), db: sqlite3.Connection = Depends(db_dep)):
    if not user_id:
        response.status_code = 401
        return {"authenticated": False}
    row = db.execute("SELECT id, email FROM users WHERE id = ?", (user_id,)).fetchone()
    return {"authenticated": True, "user": {"id": row["id"], "email": row["email"]}}

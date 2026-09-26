import base64
import hashlib
import hmac
import os
import re

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from fastapi import Request, Response

from app.config import get_settings

SESSION_COOKIE = "nemo_session"
SESSION_SECONDS = 60 * 60 * 24 * 14
_TOKEN_HEX_RE = re.compile(r"^[a-f0-9]{64}$")

# Matches Node's scryptSync defaults (N=16384, r=8, p=1).
_SCRYPT_N, _SCRYPT_R, _SCRYPT_P, _SCRYPT_MAXMEM = 16384, 8, 1, 64 * 1024 * 1024


def _scrypt(secret: str, salt: bytes, dklen: int) -> bytes:
    return hashlib.scrypt(
        secret.encode("utf-8"), salt=salt, n=_SCRYPT_N, r=_SCRYPT_R, p=_SCRYPT_P,
        maxmem=_SCRYPT_MAXMEM, dklen=dklen,
    )


def hash_password(password: str) -> str:
    salt = os.urandom(16).hex()
    digest = _scrypt(password, salt.encode("utf-8"), 64).hex()
    return f"{salt}:{digest}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt, expected_hex = stored.split(":", 1)
    except ValueError:
        return False
    actual = _scrypt(password, salt.encode("utf-8"), 64)
    try:
        expected = bytes.fromhex(expected_hex)
    except ValueError:
        return False
    return hmac.compare_digest(actual, expected)


def hash_invite_code(code: str) -> bytes:
    return _scrypt(code, b"pilot-invite", 32)


def invite_code_matches(provided: str, expected: str) -> bool:
    return hmac.compare_digest(hash_invite_code(provided), hash_invite_code(expected))


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def is_same_origin(request: Request) -> bool:
    """Validates the Origin header is one of the configured allowed origins.

    The frontend is now a separate origin (Vite dev server / static host), so
    this checks against an explicit allowlist rather than exact same-origin
    equality like the original Next.js implementation did.
    """
    origin = request.headers.get("origin")
    if not origin:
        return False
    return origin in get_settings().allowed_origin_list


def session_user_id(request: Request, db) -> str | None:
    token = request.cookies.get(SESSION_COOKIE)
    if not token or not _TOKEN_HEX_RE.match(token):
        return None
    from datetime import datetime, timezone

    row = db.execute(
        "SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > ?",
        (_token_hash(token), datetime.now(timezone.utc).isoformat()),
    ).fetchone()
    return row["user_id"] if row else None


def _cookie_kwargs() -> dict:
    settings = get_settings()
    return {
        "httponly": True,
        "secure": settings.cookie_secure,
        # "none" is required for a cross-site (different domain) frontend in
        # production; "lax" is enough for same-site localhost dev across ports.
        "samesite": "none" if settings.cookie_secure else "lax",
        "path": "/",
    }


def start_session(user_id: str, response: Response, db) -> None:
    token = os.urandom(32).hex()
    from datetime import datetime, timedelta, timezone

    expires_at = (datetime.now(timezone.utc) + timedelta(seconds=SESSION_SECONDS)).isoformat()
    with db:
        db.execute(
            "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
            (_token_hash(token), user_id, expires_at),
        )
    response.set_cookie(SESSION_COOKIE, token, max_age=SESSION_SECONDS, **_cookie_kwargs())


def end_session(request: Request, response: Response, db) -> None:
    token = request.cookies.get(SESSION_COOKIE)
    if token and _TOKEN_HEX_RE.match(token):
        with db:
            db.execute("DELETE FROM sessions WHERE token_hash = ?", (_token_hash(token),))
    response.delete_cookie(SESSION_COOKIE, path="/")


def _encryption_key() -> bytes:
    raw = get_settings().app_encryption_key
    key = bytes.fromhex(raw) if re.match(r"^[a-fA-F0-9]{64}$", raw or "") else base64.b64decode(raw or "")
    if len(key) != 32:
        raise ValueError("APP_ENCRYPTION_KEY must be a 32-byte hex or base64 value")
    return key


def encrypt_url(value: str) -> str:
    nonce = os.urandom(12)
    ciphertext = AESGCM(_encryption_key()).encrypt(nonce, value.encode("utf-8"), None)
    return base64.b64encode(nonce + ciphertext).decode("ascii")


def decrypt_url(value: str) -> str:
    raw = base64.b64decode(value)
    nonce, ciphertext = raw[:12], raw[12:]
    return AESGCM(_encryption_key()).decrypt(nonce, ciphertext, None).decode("utf-8")

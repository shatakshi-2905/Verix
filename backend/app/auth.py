from fastapi import Depends, HTTPException, Header
from supabase import create_client, Client
from .config import get_settings

settings = get_settings()
_supabase: Client | None = None
_public: Client | None = None

def supabase_admin() -> Client:
    global _supabase
    if _supabase is None:
        _supabase = create_client(settings.supabase_url, settings.supabase_service_role_key)
    return _supabase

def require_user(authorization: str | None = Header(default=None)):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")
    token = authorization.split(" ", 1)[1].strip()
    try:
        user = supabase_admin().auth.get_user(token)
        if not user or not user.user:
            raise ValueError("invalid user")
        return user.user
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired session") from exc


def supabase_public() -> Client:
    global _public
    if _public is None:
        _public = create_client(settings.supabase_url, settings.supabase_anon_key)
    return _public

from typing import Any
from .db import db


def audit(user_id: str | None, action: str, resource_type: str | None = None,
          resource_id: str | None = None, run_id: str | None = None,
          metadata: dict[str, Any] | None = None, status: str = "success") -> None:
    """Write an audit event without persisting source text, prompts, secrets or PII values."""
    try:
        db().table("audit_logs").insert({
            "user_id": user_id,
            "action": action,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "run_id": run_id,
            "status": status,
            "metadata": metadata or {},
        }).execute()
    except Exception:
        # Audit failure must not turn a successful product operation into a 500.
        pass

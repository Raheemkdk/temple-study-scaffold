import sqlite3

from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import current_user_id, db_dep

router = APIRouter(prefix="/api/assignments", tags=["assignments"])


@router.get("")
def list_assignments(user_id: str = Depends(current_user_id), db: sqlite3.Connection = Depends(db_dep)):
    rows = db.execute(
        """
        SELECT id, title, due_at, source_timezone, source_date, date_only, completed, reminder_eligible
        FROM assignments WHERE user_id = ? ORDER BY due_at LIMIT 500
        """,
        (user_id,),
    ).fetchall()
    assignments = [
        {
            "id": row["id"],
            "title": row["title"],
            "dueAt": row["due_at"],
            "sourceTimezone": row["source_timezone"],
            "sourceDate": row["source_date"],
            "dateOnly": bool(row["date_only"]),
            "completed": bool(row["completed"]),
            "reminderEligible": bool(row["reminder_eligible"]),
            "sourceType": "canvas",
        }
        for row in rows
    ]
    connection = db.execute(
        "SELECT last_synced_at FROM canvas_connections WHERE user_id = ?", (user_id,)
    ).fetchone()
    return {
        "assignments": assignments,
        "lastSyncedAt": connection["last_synced_at"] if connection else None,
        "hasCanvasFeed": bool(connection),
    }


# TODO: Owner 2/4 (see original README): update local completion and cancel
# queued reminders once the reminders worker exists. Contract: docs/API.md.
@router.patch("/{assignment_id}")
def update_assignment(assignment_id: str, user_id: str = Depends(current_user_id)):
    raise HTTPException(status_code=501, detail="Not implemented")

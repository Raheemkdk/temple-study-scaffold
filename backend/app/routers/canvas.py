import sqlite3

from fastapi import APIRouter, Depends, HTTPException

from app.canvas_ics import CanvasImportError, import_canvas_feed
from app.dependencies import current_user_id, db_dep, require_same_origin
from app.schemas import CanvasImportRequest

router = APIRouter(prefix="/api/canvas", tags=["canvas"])


@router.post("/import")
async def import_feed(
    body: CanvasImportRequest,
    user_id: str = Depends(current_user_id),
    db: sqlite3.Connection = Depends(db_dep),
    _origin: None = Depends(require_same_origin),
):
    try:
        result = await import_canvas_feed(db, user_id, body.feed_url)
    except CanvasImportError as error:
        raise HTTPException(status_code=error.status, detail=error.message)
    return {"importedCount": result["imported_count"], "lastSyncedAt": result["last_synced_at"]}

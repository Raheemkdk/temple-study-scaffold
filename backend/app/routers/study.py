from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.db import get_db
from app.gemini_client import generate_study_task
from app.security import is_same_origin, session_user_id

router = APIRouter(tags=["study"])

MAX_TOPIC_LEN = 300
MAX_TITLE_LEN = 300


@router.websocket("/ws/study-plan")
async def study_plan(websocket: WebSocket):
    # WebSocket and Request both derive from Starlette's HTTPConnection, so
    # is_same_origin/session_user_id (written against Request) work here too.
    if not is_same_origin(websocket):
        await websocket.close(code=4403, reason="Invalid request origin")
        return

    db = get_db()
    user_id = session_user_id(websocket, db)
    if not user_id:
        await websocket.close(code=4401, reason="Sign in required")
        return

    await websocket.accept()
    try:
        while True:
            payload = await websocket.receive_json()
            assignment_title = str(payload.get("assignmentTitle", ""))[:MAX_TITLE_LEN]
            difficult_topic = str(payload.get("difficultTopic", ""))[:MAX_TOPIC_LEN]
            try:
                minutes = int(payload.get("minutes", 20))
            except (TypeError, ValueError):
                minutes = 20

            if not assignment_title or not difficult_topic:
                await websocket.send_json({"type": "error", "message": "assignmentTitle and difficultTopic are required"})
                continue

            async for kind, value in generate_study_task(assignment_title, difficult_topic, minutes):
                if kind == "chunk":
                    await websocket.send_json({"type": "chunk", "text": value})
                else:
                    await websocket.send_json({"type": "done", "source": value})
    except WebSocketDisconnect:
        return

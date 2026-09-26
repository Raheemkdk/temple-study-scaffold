from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/reminders", tags=["reminders"])

# TODO: Owner 4 (see original README): send an explicitly labeled immediate
# test push. Contract and privacy requirements: docs/API.md. No feature logic
# is implemented here yet. The durable 48/24-hour scheduler and worker
# (originally lib/reminders/scheduler.ts and worker/) are also not ported.


@router.post("/test")
def send_test_reminder():
    raise HTTPException(status_code=501, detail="Not implemented")

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from app.twilio_client import send_sms

router = APIRouter(prefix="/api/reminders", tags=["reminders"])

class TestReminderRequest(BaseModel):
    phone_number: str

@router.post("/test")
def send_test_reminder(payload: TestReminderRequest, background_tasks: BackgroundTasks):
    try:
        test_message = "sms_appointment_reminders"
        background_tasks.add_task(send_sms, payload.phone_number, test_message)
        return {"status": "success", "detail": f"Test reminder queued for {payload.phone_number}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
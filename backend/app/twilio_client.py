from twilio.rest import Client
from app.config import get_settings

settings = get_settings()

def get_twilio_client() -> Client:
    return Client(settings.twilio_account_sid, settings.twilio_auth_token)

def send_sms(to_number: str, message_body: str) -> str:
    """
    Sends an SMS message to a given recipient.
    Returns the Twilio Message SID upon success.
    """
    client = get_twilio_client()
    message = client.messages.create(
        body=message_body,
        from_=settings.twilio_phone_number,
        to=to_number
    )
    return message.sid
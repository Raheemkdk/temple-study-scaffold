from pydantic import BaseModel, Field


class RegisterRequest(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(min_length=12, max_length=256)
    invite_code: str = Field(alias="inviteCode")

    model_config = {"populate_by_name": True}


class LoginRequest(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(max_length=256)


class UserSummary(BaseModel):
    id: str
    email: str


class CanvasImportRequest(BaseModel):
    feed_url: str | None = Field(default=None, alias="feedUrl", max_length=2048)

    model_config = {"populate_by_name": True}


class CanvasImportResponse(BaseModel):
    imported_count: int = Field(serialization_alias="importedCount")
    last_synced_at: str = Field(serialization_alias="lastSyncedAt")


class GradeScenarioRequest(BaseModel):
    target: float
    earned_points: float = Field(alias="earnedPoints")
    remaining_weight: float = Field(alias="remainingWeight")

    model_config = {"populate_by_name": True}


class AssignmentUpdateRequest(BaseModel):
    completed: bool | None = None
    reminder_eligible: bool | None = Field(default=None, alias="reminderEligible")

    model_config = {"populate_by_name": True}

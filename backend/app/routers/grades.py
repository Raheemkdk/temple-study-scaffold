import math

from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import current_user_id, require_same_origin
from app.schemas import GradeScenarioRequest

router = APIRouter(prefix="/api/grades", tags=["grades"])


def calculate_required_average(target: float, earned_points: float, remaining_weight: float) -> float | None:
    if remaining_weight == 0:
        return None
    return (target - earned_points) / (remaining_weight / 100)


@router.post("/scenario")
def scenario(
    body: GradeScenarioRequest,
    _user_id: str = Depends(current_user_id),
    _origin: None = Depends(require_same_origin),
):
    target, earned_points, remaining_weight = body.target, body.earned_points, body.remaining_weight

    if not all(math.isfinite(value) for value in (target, earned_points, remaining_weight)):
        raise HTTPException(status_code=400, detail="Grade inputs must be finite numbers")
    if remaining_weight < 0 or remaining_weight > 100:
        raise HTTPException(status_code=400, detail="Remaining weight must be between 0 and 100")
    if target < 0 or target > 100 or earned_points < 0 or earned_points > 100 - remaining_weight:
        raise HTTPException(status_code=400, detail="Grade inputs are outside the valid range")

    if remaining_weight == 0:
        final_grade = earned_points
        status = "achieved" if final_grade >= target else "unreachable"
        return {"requiredAverage": None, "status": status, "finalGrade": final_grade}

    required_average = calculate_required_average(target, earned_points, remaining_weight)
    if earned_points >= target:
        status = "achieved"
    elif target - earned_points > remaining_weight:
        status = "unreachable"
    else:
        status = "possible"

    return {"requiredAverage": required_average, "status": status}

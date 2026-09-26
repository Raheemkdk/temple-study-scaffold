from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/push", tags=["push"])

# TODO: Owner 4 (see original README): return the public VAPID key / register a
# browser push subscription. Contract and privacy requirements: docs/API.md.
# No feature logic is implemented here yet.


@router.get("/subscribe")
def get_subscribe_key():
    raise HTTPException(status_code=501, detail="Not implemented")


@router.post("/subscribe")
def post_subscribe():
    raise HTTPException(status_code=501, detail="Not implemented")

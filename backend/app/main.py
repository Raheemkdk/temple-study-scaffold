from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.routers import assignments, auth, canvas, grades, push, reminders, study

app = FastAPI(title="Nemo.AI API")

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(HTTPException)
async def http_error_shape(request: Request, exc: HTTPException) -> JSONResponse:
    # Keep the same { "error": "..." } response body the original Next.js routes used.
    return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})


app.include_router(auth.router)
app.include_router(canvas.router)
app.include_router(grades.router)
app.include_router(assignments.router)
app.include_router(push.router)
app.include_router(reminders.router)
app.include_router(study.router)


@app.get("/health")
def health():
    return {"ok": True}

from fastapi import FastAPI, Response, status
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import dependency_status
from app.routers import admin, bookings, clothing, coaches, diet


app = FastAPI(
    title="FitConnect Core API",
    description="Fitness coach matching, booking, diet, clothing, and health APIs.",
    version="1.0.0",
)

cors_origins = settings.cors_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials="*" not in cors_origins,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["X-Booking-Notification"],
)

app.include_router(coaches.router, prefix="/api/v1")
app.include_router(bookings.router, prefix="/api/v1")
app.include_router(diet.router, prefix="/api/v1")
app.include_router(clothing.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")


@app.on_event("startup")
async def validate_runtime_configuration():
    settings.assert_production_ready()


@app.get("/")
async def root():
    return {"message": "FitConnect Core API v1.0", "status": "running"}


@app.get("/health")
@app.get("/api/v1/health")
async def health_check():
    return {
        "status": "healthy",
        "version": "1.0.0",
        "environment": settings.environment,
        "dependencies": dependency_status(),
    }


@app.get("/ready")
@app.get("/api/v1/ready")
async def readiness_check(response: Response):
    deps = dependency_status()
    ready = (deps["supabase"]["configured"] or settings.demo_fallback_enabled) and not deps[
        "production"
    ]["config_errors"]
    if not ready:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return {
        "status": "ready" if ready else "not_ready",
        "version": "1.0.0",
        "dependencies": deps,
    }

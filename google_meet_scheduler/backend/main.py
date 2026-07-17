import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from .database.connection import engine, Base
from .routers import auth, meetings, websockets

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="MeetFlow Meeting Scheduler",
    description="Backend service for scheduling meetings with Google Meet integration.",
    version="1.0.0"
)

# CORS configuration
origins = [
    os.getenv("FRONTEND_URL", "http://localhost:3000"),
    "http://127.0.0.1:3000",
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(meetings.router)
app.include_router(websockets.router)

@app.get("/")
def read_root():
    return {
        "status": "healthy",
        "service": "MeetFlow Meeting Scheduler Backend"
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("google_meet_scheduler.backend.main:app", host="0.0.0.0", port=port, reload=True)

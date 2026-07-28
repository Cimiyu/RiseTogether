import os

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine
from app import models
from app.routes import (
    users,
    posts,
    comments,
    likes,
    follows,
    notifications,
    messages,
    uploads,
    feed,
    search,
    profile_upload,
)

app = FastAPI(
    title="RiseTogether API",
    version="1.0.0",
    debug=True
)

origins = [
    "http://localhost:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create database tables
models.Base.metadata.create_all(bind=engine)

# Register routers
app.include_router(users.router)
app.include_router(posts.router)
app.include_router(comments.router)
app.include_router(likes.router)
app.include_router(follows.router)
app.include_router(notifications.router)
app.include_router(messages.router)
app.include_router(uploads.router)
app.include_router(feed.router)
app.include_router(search.router)
app.include_router(profile_upload.router)

# Create uploads folder if it doesn't exist
os.makedirs("uploads", exist_ok=True)
os.makedirs("uploads/profiles", exist_ok=True)

app.mount(
    "/uploads",
    StaticFiles(directory="uploads"),
    name="uploads"
)


@app.get("/")
def home():
    return {
        "message": "Welcome to the RiseTogether API!",
        "status": "Backend is running successfully."
    }


@app.get("/health")
def health():
    return {
        "status": "OK"
    }
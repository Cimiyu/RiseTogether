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
    friend_requests,
    chat,
    friends,
)


# =====================================================
# APPLICATION
# =====================================================

app = FastAPI(
    title="RiseTogether API",
    version="1.0.0",
    debug=True,
)


# =====================================================
# CORS
# =====================================================

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =====================================================
# DATABASE
# =====================================================

models.Base.metadata.create_all(
    bind=engine
)


# =====================================================
# UPLOAD DIRECTORIES
# =====================================================

os.makedirs(
    "uploads",
    exist_ok=True,
)

os.makedirs(
    "uploads/profiles",
    exist_ok=True,
)

os.makedirs(
    "uploads/posts",
    exist_ok=True,
)


# =====================================================
# STATIC FILES
# =====================================================

app.mount(
    "/uploads",
    StaticFiles(
        directory="uploads"
    ),
    name="uploads",
)


# =====================================================
# ROUTERS
# =====================================================

app.include_router(
    users.router
)

app.include_router(
    posts.router
)

app.include_router(
    comments.router
)

app.include_router(
    likes.router
)

app.include_router(
    follows.router
)

app.include_router(
    notifications.router
)

app.include_router(
    messages.router
)

app.include_router(
    uploads.router
)

app.include_router(
    feed.router
)

app.include_router(
    search.router
)

app.include_router(
    profile_upload.router
)

app.include_router(
    friend_requests.router
)

app.include_router(
    chat.router
)

app.include_router(
    friends.router
)


# =====================================================
# ROOT
# =====================================================

@app.get("/")
def home():
    return {
        "message": "Welcome to the RiseTogether API!",
        "status": "Backend is running successfully.",
    }


# =====================================================
# HEALTH CHECK
# =====================================================

@app.get("/health")
def health():
    return {
        "status": "OK",
    }
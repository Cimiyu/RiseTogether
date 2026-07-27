from fastapi import FastAPI

from app.database import engine
from app import models
from app.routes import (
    users,
    posts,
    comments,
    likes,
    follows,
    notifications,
)

app = FastAPI(
    title="RiseTogether API",
    version="1.0.0",
    debug=True
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
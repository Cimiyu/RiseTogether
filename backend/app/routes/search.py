from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas

router = APIRouter(
    prefix="/search",
    tags=["Search"]
)


@router.get("/users", response_model=list[schemas.UserResponse])
def search_users(
    q: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
):
    users = (
        db.query(models.User)
        .filter(
            or_(
                models.User.first_name.ilike(f"%{q}%"),
                models.User.last_name.ilike(f"%{q}%"),
                models.User.university.ilike(f"%{q}%"),
                models.User.course.ilike(f"%{q}%"),
            )
        )
        .all()
    )

    return users


@router.get("/posts", response_model=list[schemas.PostResponse])
def search_posts(
    q: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
):
    posts = (
        db.query(models.Post)
        .filter(
            models.Post.content.ilike(f"%{q}%")
        )
        .order_by(models.Post.created_at.desc())
        .all()
    )

    return posts
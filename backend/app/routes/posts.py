from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.auth import get_current_user

router = APIRouter(
    prefix="/posts",
    tags=["Posts"]
)


@router.post("/", response_model=schemas.PostResponse)
def create_post(
    post: schemas.PostCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    new_post = models.Post(
        content=post.content,
        image_url=post.image_url,
        owner_id=current_user.id
    )

    db.add(new_post)
    db.commit()
    db.refresh(new_post)

    return new_post

@router.get("/", response_model=list[schemas.PostResponse])
def get_posts(
    db: Session = Depends(get_db)
):
    posts = (
        db.query(models.Post)
        .order_by(models.Post.created_at.desc())
        .all()
    )

    return posts

@router.put("/{post_id}", response_model=schemas.PostResponse)
def update_post(
    post_id: int,
    post_update: schemas.PostCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    post = (
        db.query(models.Post)
        .filter(models.Post.id == post_id)
        .first()
    )

    if not post:
        raise HTTPException(
            status_code=404,
            detail="Post not found."
        )

    if post.owner_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You are not allowed to edit this post."
        )

    post.content = post_update.content
    post.image_url = post_update.image_url

    db.commit()
    db.refresh(post)

    return post

@router.delete("/{post_id}")
def delete_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    post = (
        db.query(models.Post)
        .filter(models.Post.id == post_id)
        .first()
    )

    if not post:
        raise HTTPException(
            status_code=404,
            detail="Post not found."
        )

    if post.owner_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You are not allowed to delete this post."
        )

    db.delete(post)
    db.commit()

    return {
        "message": "Post deleted successfully."
    }
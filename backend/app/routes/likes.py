from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.auth import get_current_user

router = APIRouter(
    prefix="/likes",
    tags=["Likes"]
)


@router.post("/{post_id}", response_model=schemas.LikeResponse)
def like_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    post = db.query(models.Post).filter(
        models.Post.id == post_id
    ).first()

    if not post:
        raise HTTPException(
            status_code=404,
            detail="Post not found."
        )

    existing_like = db.query(models.Like).filter(
        models.Like.owner_id == current_user.id,
        models.Like.post_id == post_id
    ).first()

    if existing_like:
        raise HTTPException(
            status_code=400,
            detail="You already liked this post."
        )

    like = models.Like(
        owner_id=current_user.id,
        post_id=post_id
    )

    db.add(like)
    db.commit()
    db.refresh(like)

    return like


@router.delete("/{post_id}")
def unlike_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    like = db.query(models.Like).filter(
        models.Like.owner_id == current_user.id,
        models.Like.post_id == post_id
    ).first()

    if not like:
        raise HTTPException(
            status_code=404,
            detail="Like not found."
        )

    db.delete(like)
    db.commit()

    return {
        "message": "Post unliked successfully."
    }


@router.get("/{post_id}")
def get_post_likes(
    post_id: int,
    db: Session = Depends(get_db),
):
    likes = db.query(models.Like).filter(
        models.Like.post_id == post_id
    ).count()

    return {
        "post_id": post_id,
        "likes": likes
    }
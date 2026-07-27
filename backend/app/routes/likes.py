from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.auth import get_current_user

router = APIRouter(
    prefix="/likes",
    tags=["Likes"]
)


# -------------------------
# LIKE POST
# -------------------------

@router.post("/{post_id}")
def like_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # Check that post exists
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

    # Prevent liking your own post
    if post.owner_id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail="You cannot like your own post."
        )

    # Prevent duplicate likes
    existing_like = (
        db.query(models.Like)
        .filter(
            models.Like.owner_id == current_user.id,
            models.Like.post_id == post_id
        )
        .first()
    )

    if existing_like:
        raise HTTPException(
            status_code=400,
            detail="You already liked this post."
        )

    # Create like
    new_like = models.Like(
        owner_id=current_user.id,
        post_id=post_id
    )

    db.add(new_like)
    db.flush()

    # Create notification for post owner
    notification = models.Notification(
        user_id=post.owner_id,
        sender_id=current_user.id,
        notification_type="like",
        message=(
            f"{current_user.first_name} "
            f"{current_user.last_name} liked your post."
        ),
        is_read=False
    )

    db.add(notification)

    db.commit()
    db.refresh(new_like)

    return {
        "message": "Post liked successfully.",
        "like_id": new_like.id
    }


# -------------------------
# UNLIKE POST
# -------------------------

@router.delete("/{post_id}")
def unlike_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    like = (
        db.query(models.Like)
        .filter(
            models.Like.owner_id == current_user.id,
            models.Like.post_id == post_id
        )
        .first()
    )

    if not like:
        raise HTTPException(
            status_code=404,
            detail="You have not liked this post."
        )

    db.delete(like)
    db.commit()

    return {
        "message": "Post unliked successfully."
    }


# -------------------------
# GET POST LIKES
# -------------------------

@router.get(
    "/post/{post_id}",
    response_model=list[schemas.LikeResponse]
)
def get_post_likes(
    post_id: int,
    db: Session = Depends(get_db),
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

    likes = (
        db.query(models.Like)
        .filter(models.Like.post_id == post_id)
        .all()
    )

    return likes
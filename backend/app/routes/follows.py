from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.auth import get_current_user

router = APIRouter(
    prefix="/follows",
    tags=["Follows"]
)


# -------------------------
# FOLLOW USER
# -------------------------

@router.post(
    "/{user_id}",
    response_model=schemas.FollowResponse
)
def follow_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # Prevent following yourself
    if user_id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail="You cannot follow yourself."
        )

    # Check that target user exists
    user = (
        db.query(models.User)
        .filter(models.User.id == user_id)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found."
        )

    # Prevent duplicate follows
    existing_follow = (
        db.query(models.Follow)
        .filter(
            models.Follow.follower_id == current_user.id,
            models.Follow.following_id == user_id
        )
        .first()
    )

    if existing_follow:
        raise HTTPException(
            status_code=400,
            detail="You already follow this user."
        )

    new_follow = models.Follow(
        follower_id=current_user.id,
        following_id=user_id
    )

    db.add(new_follow)
    db.commit()
    db.refresh(new_follow)

    return new_follow


# -------------------------
# UNFOLLOW USER
# -------------------------

@router.delete("/{user_id}")
def unfollow_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    follow = (
        db.query(models.Follow)
        .filter(
            models.Follow.follower_id == current_user.id,
            models.Follow.following_id == user_id
        )
        .first()
    )

    if not follow:
        raise HTTPException(
            status_code=404,
            detail="You are not following this user."
        )

    db.delete(follow)
    db.commit()

    return {
        "message": "User unfollowed successfully."
    }


# -------------------------
# GET FOLLOWERS
# -------------------------

@router.get(
    "/followers/{user_id}",
    response_model=list[schemas.FollowResponse]
)
def get_followers(
    user_id: int,
    db: Session = Depends(get_db),
):
    user = (
        db.query(models.User)
        .filter(models.User.id == user_id)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found."
        )

    followers = (
        db.query(models.Follow)
        .filter(models.Follow.following_id == user_id)
        .all()
    )

    return followers


# -------------------------
# GET FOLLOWING
# -------------------------

@router.get(
    "/following/{user_id}",
    response_model=list[schemas.FollowResponse]
)
def get_following(
    user_id: int,
    db: Session = Depends(get_db),
):
    user = (
        db.query(models.User)
        .filter(models.User.id == user_id)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found."
        )

    following = (
        db.query(models.Follow)
        .filter(models.Follow.follower_id == user_id)
        .all()
    )

    return following
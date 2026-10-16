import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
)

router = APIRouter(
    prefix="/users",
    tags=["Users"],
)


# =====================================================
# REGISTER
# =====================================================

@router.post(
    "/register",
    response_model=schemas.UserResponse,
)
def register_user(
    user: schemas.UserCreate,
    db: Session = Depends(get_db),
):
    existing_user = (
        db.query(models.User)
        .filter(models.User.email == user.email)
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered.",
        )

    new_user = models.User(
        first_name=user.first_name,
        last_name=user.last_name,
        email=user.email,
        hashed_password=hash_password(user.password),
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user


# =====================================================
# LOGIN
# =====================================================

@router.post("/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    db_user = (
        db.query(models.User)
        .filter(models.User.email == form_data.username)
        .first()
    )

    if not db_user:
        raise HTTPException(
            status_code=400,
            detail="Invalid email or password",
        )

    if not verify_password(
        form_data.password,
        db_user.hashed_password,
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid email or password",
        )

    access_token = create_access_token(
        data={"sub": db_user.email}
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
    }


# =====================================================
# GET CURRENT USER
# =====================================================

@router.get(
    "/me",
    response_model=schemas.UserResponse,
)
def get_me(
    current_user: models.User = Depends(get_current_user),
):
    return current_user


# =====================================================
# UPDATE CURRENT USER
# =====================================================

@router.put(
    "/me",
    response_model=schemas.UserResponse,
)
def update_me(
    user_update: schemas.UserUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    update_data = user_update.model_dump(
        exclude_unset=True
    )

    # Never allow an empty update
    if not update_data:
        raise HTTPException(
            status_code=400,
            detail="No profile information was provided.",
        )

    # We don't update the profile picture here.
    # Profile pictures are handled by /users/me/photo.
    update_data.pop("profile_picture", None)

    # Update allowed fields
    for field, value in update_data.items():
        setattr(current_user, field, value)

    db.commit()
    db.refresh(current_user)

    return current_user


# =====================================================
# GET USER BASIC INFORMATION
# =====================================================

@router.get(
    "/{user_id}/basic",
    response_model=schemas.UserResponse,
)
def get_user(
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
            detail="User not found.",
        )

    return user


# =====================================================
# GET PUBLIC USER PROFILE
# =====================================================

@router.get(
    "/{user_id}",
    response_model=schemas.PublicProfileResponse,
)
def get_user_profile(
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
            detail="User not found.",
        )

    return {
        "id": user.id,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "email": user.email,
        "bio": user.bio,
        "university": user.university,
        "course": user.course,
        "year_of_study": user.year_of_study,
        "profile_picture": user.profile_picture,
        "posts_count": len(user.posts),
        "followers_count": len(user.followers),
        "following_count": len(user.following),
        "created_at": user.created_at,
    }


# =====================================================
# GET USER POSTS
# =====================================================

@router.get(
    "/{user_id}/posts",
    response_model=list[schemas.PostResponse],
)
def get_user_posts(
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
            detail="User not found.",
        )

    posts = (
        db.query(models.Post)
        .filter(models.Post.owner_id == user_id)
        .order_by(models.Post.created_at.desc())
        .all()
    )

    return posts

   # =====================================================
# UPLOAD PROFILE PICTURE
# =====================================================

@router.post(
    "/me/photo",
    response_model=schemas.UserResponse,
)
def upload_profile_picture(
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # -------------------------------------------------
    # Validate file type
    # -------------------------------------------------

    allowed_types = {
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/jpg",
    }

    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Only JPG, JPEG, PNG and WEBP images are allowed.",
        )

    # -------------------------------------------------
    # Create upload directory
    # -------------------------------------------------

    upload_dir = "uploads/profile"

    os.makedirs(
        upload_dir,
        exist_ok=True,
    )

    # -------------------------------------------------
    # Generate unique filename
    # -------------------------------------------------

    extension = os.path.splitext(
        file.filename or ""
    )[1].lower()

    if not extension:
        extension = ".jpg"

    filename = f"{uuid.uuid4().hex}{extension}"

    file_path = os.path.join(
        upload_dir,
        filename,
    )

    # -------------------------------------------------
    # Save file
    # -------------------------------------------------

    try:
        with open(file_path, "wb") as buffer:
            while True:
                chunk = file.file.read(1024 * 1024)

                if not chunk:
                    break

                buffer.write(chunk)

    except Exception as error:
        print("Profile picture upload error:", error)

        raise HTTPException(
            status_code=500,
            detail="Failed to upload profile picture.",
        )

    # -------------------------------------------------
    # Delete old profile picture
    # -------------------------------------------------

    if current_user.profile_picture:

        old_path = current_user.profile_picture.lstrip("/")

        if os.path.exists(old_path):
            try:
                os.remove(old_path)
            except Exception as error:
                print(
                    "Could not delete old profile picture:",
                    error,
                )

    # -------------------------------------------------
    # Save URL in database
    # -------------------------------------------------

    current_user.profile_picture = (
        f"/uploads/profile/{filename}"
    )

    db.commit()
    db.refresh(current_user)

    return current_user
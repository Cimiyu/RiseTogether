import os
import shutil
import uuid

from fastapi import (
    APIRouter,
    Depends,
    UploadFile,
    File,
    HTTPException,
)
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.auth import get_current_user


router = APIRouter(
    prefix="/users",
    tags=["Profile"]
)


# =========================================================
# UPLOAD / CHANGE PROFILE PHOTO
# =========================================================

@router.put(
    "/me/photo",
    response_model=schemas.UserResponse
)
def upload_profile_photo(
    photo: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):

    # -----------------------------------------------------
    # CHECK FILE
    # -----------------------------------------------------

    if not photo.filename:
        raise HTTPException(
            status_code=400,
            detail="No image was selected."
        )

    if not photo.content_type:
        raise HTTPException(
            status_code=400,
            detail="Could not determine the file type."
        )

    if not photo.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail="Only image files are allowed."
        )

    # -----------------------------------------------------
    # ALLOWED IMAGE TYPES
    # -----------------------------------------------------

    allowed_types = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/gif": ".gif",
    }

    if photo.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Supported images are JPG, PNG, WEBP and GIF."
        )

    extension = allowed_types[photo.content_type]

    # -----------------------------------------------------
    # CREATE UPLOAD DIRECTORY
    # -----------------------------------------------------

    upload_directory = os.path.join(
        "uploads",
        "profiles"
    )

    os.makedirs(
        upload_directory,
        exist_ok=True
    )

    # -----------------------------------------------------
    # GENERATE UNIQUE FILE NAME
    # -----------------------------------------------------

    filename = f"{uuid.uuid4()}{extension}"

    filepath = os.path.join(
        upload_directory,
        filename
    )

    # -----------------------------------------------------
    # SAVE NEW PHOTO
    # -----------------------------------------------------

    try:

        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(
                photo.file,
                buffer
            )

    except Exception as error:

        print(
            f"Profile image upload error: {error}"
        )

        raise HTTPException(
            status_code=500,
            detail="Failed to save profile picture."
        )
    finally:
     photo.file.close()

    # -----------------------------------------------------
    # DELETE OLD PROFILE PHOTO
    # -----------------------------------------------------

    old_profile_picture = current_user.profile_picture

    if old_profile_picture:

        old_path = old_profile_picture.lstrip("/")

        if os.path.isfile(old_path):

            try:

                os.remove(old_path)

            except Exception as error:

                print(
                    f"Could not delete old profile picture: {error}"
                )

    # -----------------------------------------------------
    # UPDATE DATABASE
    # -----------------------------------------------------

    current_user.profile_picture = (
        f"/uploads/profiles/{filename}"
    )

    try:

        db.commit()
        db.refresh(current_user)

    except Exception as error:

        db.rollback()

        # Remove newly uploaded file if database update fails

        if os.path.isfile(filepath):

            try:
                os.remove(filepath)
            except Exception:
                pass

        print(
            f"Database profile update error: {error}"
        )

        raise HTTPException(
            status_code=500,
            detail="Failed to update profile picture."
        )

    # -----------------------------------------------------
    # RETURN UPDATED USER
    # -----------------------------------------------------

    return current_user
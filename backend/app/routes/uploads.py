import os
import shutil
import uuid

from fastapi import (
    APIRouter,
    Depends,
    File,
    UploadFile,
    HTTPException,
)
from sqlalchemy.orm import Session

from app.database import get_db
from app import models
from app.auth import get_current_user

router = APIRouter(
    prefix="/uploads",
    tags=["Uploads"]
)

PROFILE_FOLDER = "uploads/profiles"
POST_FOLDER = "uploads/posts"

os.makedirs(PROFILE_FOLDER, exist_ok=True)
os.makedirs(POST_FOLDER, exist_ok=True)


# -------------------------
# UPLOAD PROFILE PICTURE
# -------------------------

@router.post("/profile")
def upload_profile_picture(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail="Only image files are allowed."
        )

    extension = file.filename.split(".")[-1]
    filename = f"{uuid.uuid4()}.{extension}"

    filepath = os.path.join(
        PROFILE_FOLDER,
        filename
    )

    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    current_user.profile_picture = (
        f"/uploads/profiles/{filename}"
    )

    db.commit()
    db.refresh(current_user)

    return {
        "message": "Profile picture uploaded successfully.",
        "profile_picture": current_user.profile_picture
    }


# -------------------------
# UPLOAD POST IMAGE
# -------------------------

@router.post("/post")
def upload_post_image(
    file: UploadFile = File(...),
):
    if not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail="Only image files are allowed."
        )

    extension = file.filename.split(".")[-1]
    filename = f"{uuid.uuid4()}.{extension}"

    filepath = os.path.join(
        POST_FOLDER,
        filename
    )

    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return {
        "message": "Image uploaded successfully.",
        "image_url": f"/uploads/posts/{filename}"
    }
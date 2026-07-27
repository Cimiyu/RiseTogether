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


@router.put(
    "/me/photo",
    response_model=schemas.UserResponse
)
def upload_profile_photo(
    photo: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not photo.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail="Only image files are allowed."
        )

    os.makedirs("uploads/profiles", exist_ok=True)

    extension = photo.filename.split(".")[-1]
    filename = f"{uuid.uuid4()}.{extension}"

    filepath = os.path.join(
        "uploads/profiles",
        filename
    )

    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(photo.file, buffer)

    # Delete old photo if it exists
    if current_user.profile_picture:
        old_path = current_user.profile_picture.lstrip("/")

        if os.path.exists(old_path):
            os.remove(old_path)

    current_user.profile_picture = f"/uploads/profiles/{filename}"

    db.commit()
    db.refresh(current_user)

    return current_user
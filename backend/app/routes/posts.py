import os
import shutil
import uuid

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    UploadFile,
    File,
    Form,
)
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.auth import get_current_user

router = APIRouter(
    prefix="/posts",
    tags=["Posts"]
)


# -------------------------
# CREATE POST
# -------------------------

@router.post("/", response_model=schemas.PostResponse)
def create_post(
    content: str = Form(...),
    image: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    image_url = None

    if image:
        if not image.content_type.startswith("image/"):
            raise HTTPException(
                status_code=400,
                detail="Only image files are allowed."
            )

        os.makedirs("uploads/posts", exist_ok=True)

        extension = image.filename.split(".")[-1]
        filename = f"{uuid.uuid4()}.{extension}"

        filepath = os.path.join(
            "uploads/posts",
            filename
        )

        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(image.file, buffer)

        image_url = f"/uploads/posts/{filename}"

    new_post = models.Post(
        content=content,
        image_url=image_url,
        owner_id=current_user.id
    )

    db.add(new_post)
    db.commit()
    db.refresh(new_post)

    return new_post


# -------------------------
# GET ALL POSTS
# -------------------------

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


# -------------------------
# GET SINGLE POST
# -------------------------

@router.get("/{post_id}", response_model=schemas.PostResponse)
def get_post(
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

    return post


# -------------------------
# UPDATE POST
# -------------------------

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


# -------------------------
# DELETE POST
# -------------------------

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

    # Delete image file if it exists
    if post.image_url:
        file_path = post.image_url.lstrip("/")

        if os.path.exists(file_path):
            os.remove(file_path)

    db.delete(post)
    db.commit()

    return {
        "message": "Post deleted successfully."
    }

# -------------------------
# GET SINGLE POST
# -------------------------

@router.get("/{post_id}", response_model=schemas.PostResponse)
def get_post(
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

    return post
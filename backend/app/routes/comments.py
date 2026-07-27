from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.auth import get_current_user

router = APIRouter(
    prefix="/comments",
    tags=["Comments"]
)


# -------------------------
# CREATE COMMENT
# -------------------------

@router.post(
    "/posts/{post_id}",
    response_model=schemas.CommentResponse
)
def create_comment(
    post_id: int,
    comment: schemas.CommentCreate,
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

    # Create comment
    new_comment = models.Comment(
        content=comment.content,
        owner_id=current_user.id,
        post_id=post.id
    )

    db.add(new_comment)
    db.flush()

    # Create notification for post owner
    # Don't notify someone when they comment on their own post.
    if post.owner_id != current_user.id:
        notification = models.Notification(
            user_id=post.owner_id,
            sender_id=current_user.id,
            notification_type="comment",
            message=(
                f"{current_user.first_name} "
                f"{current_user.last_name} commented on your post."
            ),
            is_read=False
        )

        db.add(notification)

    db.commit()
    db.refresh(new_comment)

    return new_comment


# -------------------------
# GET COMMENTS
# -------------------------

@router.get(
    "/posts/{post_id}",
    response_model=list[schemas.CommentResponse]
)
def get_comments(
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

    comments = (
        db.query(models.Comment)
        .filter(models.Comment.post_id == post_id)
        .order_by(models.Comment.created_at.asc())
        .all()
    )

    return comments


# -------------------------
# UPDATE COMMENT
# -------------------------

@router.put(
    "/{comment_id}",
    response_model=schemas.CommentResponse
)
def update_comment(
    comment_id: int,
    comment_update: schemas.CommentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    comment = (
        db.query(models.Comment)
        .filter(models.Comment.id == comment_id)
        .first()
    )

    if not comment:
        raise HTTPException(
            status_code=404,
            detail="Comment not found."
        )

    if comment.owner_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You are not allowed to edit this comment."
        )

    comment.content = comment_update.content

    db.commit()
    db.refresh(comment)

    return comment


# -------------------------
# DELETE COMMENT
# -------------------------

@router.delete("/{comment_id}")
def delete_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    comment = (
        db.query(models.Comment)
        .filter(models.Comment.id == comment_id)
        .first()
    )

    if not comment:
        raise HTTPException(
            status_code=404,
            detail="Comment not found."
        )

    if comment.owner_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You are not allowed to delete this comment."
        )

    db.delete(comment)
    db.commit()

    return {
        "message": "Comment deleted successfully."
    }
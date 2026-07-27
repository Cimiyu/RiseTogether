from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.auth import get_current_user

router = APIRouter(
    prefix="/feed",
    tags=["Feed"]
)


@router.get("/", response_model=schemas.FeedResponse)
def get_feed(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # Get IDs of users the current user follows
    following_ids = (
        db.query(models.Follow.following_id)
        .filter(models.Follow.follower_id == current_user.id)
        .all()
    )

    following_ids = [user_id for (user_id,) in following_ids]

    # Include current user's own posts
    following_ids.append(current_user.id)

    # Total posts for pagination
    total_posts = (
        db.query(models.Post)
        .filter(models.Post.owner_id.in_(following_ids))
        .count()
    )

    offset = (page - 1) * limit

    posts = (
        db.query(models.Post)
        .filter(models.Post.owner_id.in_(following_ids))
        .order_by(models.Post.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    feed_posts = []

    for post in posts:
        feed_posts.append(
            {
                "id": post.id,
                "content": post.content,
                "image_url": post.image_url,
                "created_at": post.created_at,

                "owner": {
                    "id": post.owner.id,
                    "first_name": post.owner.first_name,
                    "last_name": post.owner.last_name,
                    "profile_picture": post.owner.profile_picture,
                },

                "likes_count": len(post.likes),
                "comments_count": len(post.comments),

                "liked": any(
                    like.owner_id == current_user.id
                    for like in post.likes
                ),
            }
        )

    return {
        "page": page,
        "limit": limit,
        "total_posts": total_posts,
        "posts": feed_posts,
    }
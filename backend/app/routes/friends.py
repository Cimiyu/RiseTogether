from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app import models
from app.auth import get_current_user


router = APIRouter(
    prefix="/friends",
    tags=["Friends"]
)


# =====================================================
# GET MY FRIENDS
# =====================================================

@router.get("/my-friends")
def get_my_friends(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Return all users who are accepted friends
    with the currently logged-in user.
    """

    friends = []

    # =================================================
    # FRIEND REQUESTS SENT BY CURRENT USER
    # =================================================

    sent_requests = (
        db.query(models.FriendRequest)
        .filter(
            models.FriendRequest.sender_id == current_user.id,
            models.FriendRequest.status == "accepted"
        )
        .all()
    )

    # =================================================
    # FRIEND REQUESTS RECEIVED BY CURRENT USER
    # =================================================

    received_requests = (
        db.query(models.FriendRequest)
        .filter(
            models.FriendRequest.receiver_id == current_user.id,
            models.FriendRequest.status == "accepted"
        )
        .all()
    )

    # =================================================
    # ADD FRIENDS FROM SENT REQUESTS
    # =================================================

    for request in sent_requests:

        friend = (
            db.query(models.User)
            .filter(
                models.User.id == request.receiver_id
            )
            .first()
        )

        if friend:
            friends.append({
                "id": friend.id,
                "first_name": friend.first_name,
                "last_name": friend.last_name,
                "email": friend.email,
                "profile_picture": friend.profile_picture,
                "online": False
            })

    # =================================================
    # ADD FRIENDS FROM RECEIVED REQUESTS
    # =================================================

    for request in received_requests:

        friend = (
            db.query(models.User)
            .filter(
                models.User.id == request.sender_id
            )
            .first()
        )

        if friend:
            friends.append({
                "id": friend.id,
                "first_name": friend.first_name,
                "last_name": friend.last_name,
                "email": friend.email,
                "profile_picture": friend.profile_picture,
                "online": False
            })

    # =================================================
    # REMOVE DUPLICATES
    # =================================================

    unique_friends = []
    seen_ids = set()

    for friend in friends:

        if friend["id"] not in seen_ids:
            unique_friends.append(friend)
            seen_ids.add(friend["id"])

    # =================================================
    # RETURN FRIENDS
    # =================================================

    return unique_friends
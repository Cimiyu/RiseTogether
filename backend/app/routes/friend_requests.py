from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from app.database import get_db
from app.auth import get_current_user
from app import models


router = APIRouter(
    prefix="/friends",
    tags=["Friend Requests"]
)


# =========================================================
# SEND FRIEND REQUEST
# =========================================================

@router.post("/send/{user_id}")
def send_friend_request(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # -----------------------------------------------------
    # CANNOT ADD YOURSELF
    # -----------------------------------------------------

    if current_user.id == user_id:
        raise HTTPException(
            status_code=400,
            detail="You cannot send a friend request to yourself."
        )

    # -----------------------------------------------------
    # FIND RECEIVER
    # -----------------------------------------------------

    receiver = (
        db.query(models.User)
        .filter(models.User.id == user_id)
        .first()
    )

    if not receiver:
        raise HTTPException(
            status_code=404,
            detail="User not found."
        )

    # -----------------------------------------------------
    # CHECK EXISTING REQUEST / FRIENDSHIP
    # -----------------------------------------------------

    existing = (
        db.query(models.FriendRequest)
        .filter(
            or_(
                and_(
                    models.FriendRequest.sender_id == current_user.id,
                    models.FriendRequest.receiver_id == user_id,
                ),
                and_(
                    models.FriendRequest.sender_id == user_id,
                    models.FriendRequest.receiver_id == current_user.id,
                ),
            )
        )
        .first()
    )

    if existing:

        if existing.status == "accepted":
            raise HTTPException(
                status_code=400,
                detail="You are already friends with this user."
            )

        if existing.status == "pending":
            raise HTTPException(
                status_code=400,
                detail="A friend request already exists."
            )

        # If an old request was rejected,
        # remove it so a new request can be sent.
        if existing.status in ["rejected", "declined"]:
            db.delete(existing)
            db.flush()

    # -----------------------------------------------------
    # CREATE FRIEND REQUEST
    # -----------------------------------------------------

    request = models.FriendRequest(
        sender_id=current_user.id,
        receiver_id=user_id,
        status="pending",
    )

    db.add(request)
    db.flush()

    # -----------------------------------------------------
    # CREATE NOTIFICATION
    # -----------------------------------------------------

    notification = models.Notification(
        user_id=user_id,
        sender_id=current_user.id,
        notification_type="friend_request",
        message=(
            f"{current_user.first_name} "
            f"{current_user.last_name} "
            f"sent you a friend request."
        ),
        is_read=False,
    )

    db.add(notification)

    # -----------------------------------------------------
    # SAVE
    # -----------------------------------------------------

    db.commit()
    db.refresh(request)

    return {
        "message": "Friend request sent.",
        "request_id": request.id,
    }


# =========================================================
# ACCEPT FRIEND REQUEST
# =========================================================

@router.put("/accept/{request_id}")
def accept_friend_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # -----------------------------------------------------
    # FIND REQUEST
    # -----------------------------------------------------

    request = (
        db.query(models.FriendRequest)
        .filter(
            models.FriendRequest.id == request_id
        )
        .first()
    )

    if not request:
        raise HTTPException(
            status_code=404,
            detail="Friend request not found."
        )

    # -----------------------------------------------------
    # ONLY RECEIVER CAN ACCEPT
    # -----------------------------------------------------

    if request.receiver_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You are not allowed to accept this request."
        )

    # -----------------------------------------------------
    # CHECK STATUS
    # -----------------------------------------------------

    if request.status != "pending":
        raise HTTPException(
            status_code=400,
            detail="Request already handled."
        )

    # -----------------------------------------------------
    # ACCEPT
    # -----------------------------------------------------

    request.status = "accepted"

    # -----------------------------------------------------
    # NOTIFY ORIGINAL SENDER
    # -----------------------------------------------------

    notification = models.Notification(
        user_id=request.sender_id,
        sender_id=current_user.id,
        notification_type="friend_request_accepted",
        message=(
            f"{current_user.first_name} "
            f"{current_user.last_name} "
            f"accepted your friend request."
        ),
        is_read=False,
    )

    db.add(notification)

    # -----------------------------------------------------
    # SAVE
    # -----------------------------------------------------

    db.commit()
    db.refresh(request)

    return {
        "message": "Friend request accepted.",
        "request_id": request.id,
    }


# =========================================================
# REJECT FRIEND REQUEST
# =========================================================

@router.put("/reject/{request_id}")
def reject_friend_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # -----------------------------------------------------
    # FIND REQUEST
    # -----------------------------------------------------

    request = (
        db.query(models.FriendRequest)
        .filter(
            models.FriendRequest.id == request_id
        )
        .first()
    )

    if not request:
        raise HTTPException(
            status_code=404,
            detail="Friend request not found."
        )

    # -----------------------------------------------------
    # ONLY RECEIVER CAN REJECT
    # -----------------------------------------------------

    if request.receiver_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You are not allowed to reject this request."
        )

    # -----------------------------------------------------
    # CHECK STATUS
    # -----------------------------------------------------

    if request.status != "pending":
        raise HTTPException(
            status_code=400,
            detail="Request already handled."
        )

    # -----------------------------------------------------
    # REJECT
    # -----------------------------------------------------

    request.status = "rejected"

    db.commit()
    db.refresh(request)

    return {
        "message": "Friend request rejected.",
        "request_id": request.id,
    }


# =========================================================
# GET PENDING FRIEND REQUESTS
# =========================================================

@router.get("/pending")
def get_pending_requests(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    requests = (
        db.query(models.FriendRequest)
        .filter(
            models.FriendRequest.receiver_id == current_user.id,
            models.FriendRequest.status == "pending"
        )
        .order_by(
            models.FriendRequest.created_at.desc()
        )
        .all()
    )

    results = []

    for request in requests:

        sender = (
            db.query(models.User)
            .filter(
                models.User.id == request.sender_id
            )
            .first()
        )

        if not sender:
            continue

        results.append({
            "request_id": request.id,
            "sender_id": sender.id,
            "first_name": sender.first_name,
            "last_name": sender.last_name,
            "profile_picture": sender.profile_picture,
            "created_at": request.created_at,
        })

    return results


# =========================================================
# GET SENT FRIEND REQUESTS
# =========================================================

@router.get("/sent")
def get_sent_requests(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    requests = (
        db.query(models.FriendRequest)
        .filter(
            models.FriendRequest.sender_id == current_user.id,
            models.FriendRequest.status == "pending"
        )
        .order_by(
            models.FriendRequest.created_at.desc()
        )
        .all()
    )

    results = []

    for request in requests:

        receiver = (
            db.query(models.User)
            .filter(
                models.User.id == request.receiver_id
            )
            .first()
        )

        if not receiver:
            continue

        results.append({
            "request_id": request.id,
            "receiver_id": receiver.id,
            "first_name": receiver.first_name,
            "last_name": receiver.last_name,
            "profile_picture": receiver.profile_picture,
            "created_at": request.created_at,
        })

    return results


# =========================================================
# CANCEL FRIEND REQUEST
# =========================================================

@router.delete("/cancel/{request_id}")
def cancel_friend_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    request = (
        db.query(models.FriendRequest)
        .filter(
            models.FriendRequest.id == request_id,
            models.FriendRequest.sender_id == current_user.id
        )
        .first()
    )

    if not request:
        raise HTTPException(
            status_code=404,
            detail="Friend request not found."
        )

    # -----------------------------------------------------
    # ONLY PENDING REQUESTS CAN BE CANCELLED
    # -----------------------------------------------------

    if request.status != "pending":
        raise HTTPException(
            status_code=400,
            detail="Only pending requests can be cancelled."
        )

    db.delete(request)
    db.commit()

    return {
        "message": "Friend request cancelled successfully."
    }


# =========================================================
# GET MY FRIENDS
# =========================================================

@router.get("/my-friends")
def get_my_friends(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # -----------------------------------------------------
    # REQUESTS I SENT AND WERE ACCEPTED
    # -----------------------------------------------------

    sent = (
        db.query(models.FriendRequest)
        .filter(
            models.FriendRequest.sender_id == current_user.id,
            models.FriendRequest.status == "accepted"
        )
        .all()
    )

    # -----------------------------------------------------
    # REQUESTS I RECEIVED AND WERE ACCEPTED
    # -----------------------------------------------------

    received = (
        db.query(models.FriendRequest)
        .filter(
            models.FriendRequest.receiver_id == current_user.id,
            models.FriendRequest.status == "accepted"
        )
        .all()
    )

    friends = []
    friend_ids = set()

    # -----------------------------------------------------
    # SENT FRIENDSHIPS
    # -----------------------------------------------------

    for request in sent:

        user = (
            db.query(models.User)
            .filter(
                models.User.id == request.receiver_id
            )
            .first()
        )

        if user and user.id not in friend_ids:

            friend_ids.add(user.id)

            friends.append({
                "id": user.id,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "profile_picture": user.profile_picture,
            })

    # -----------------------------------------------------
    # RECEIVED FRIENDSHIPS
    # -----------------------------------------------------

    for request in received:

        user = (
            db.query(models.User)
            .filter(
                models.User.id == request.sender_id
            )
            .first()
        )

        if user and user.id not in friend_ids:

            friend_ids.add(user.id)

            friends.append({
                "id": user.id,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "profile_picture": user.profile_picture,
            })

    return friends


# =========================================================
# REMOVE FRIEND
# =========================================================

@router.delete("/remove/{user_id}")
def remove_friend(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # -----------------------------------------------------
    # FIND ACCEPTED FRIENDSHIP
    # -----------------------------------------------------

    friendship = (
        db.query(models.FriendRequest)
        .filter(
            or_(
                and_(
                    models.FriendRequest.sender_id == current_user.id,
                    models.FriendRequest.receiver_id == user_id,
                ),
                and_(
                    models.FriendRequest.sender_id == user_id,
                    models.FriendRequest.receiver_id == current_user.id,
                ),
            ),
            models.FriendRequest.status == "accepted"
        )
        .first()
    )

    if not friendship:
        raise HTTPException(
            status_code=404,
            detail="Friend not found."
        )

    # -----------------------------------------------------
    # REMOVE FRIENDSHIP
    # -----------------------------------------------------

    db.delete(friendship)
    db.commit()

    return {
        "message": "Friend removed successfully."
    }


# =========================================================
# FRIEND COUNT
# =========================================================

@router.get("/count")
def friend_count(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    sent = (
        db.query(models.FriendRequest)
        .filter(
            models.FriendRequest.sender_id == current_user.id,
            models.FriendRequest.status == "accepted"
        )
        .count()
    )

    received = (
        db.query(models.FriendRequest)
        .filter(
            models.FriendRequest.receiver_id == current_user.id,
            models.FriendRequest.status == "accepted"
        )
        .count()
    )

    return {
        "friends": sent + received
    }

# =========================================================
# GET RELATIONSHIP STATUS
# =========================================================

@router.get("/status/{user_id}")
def get_friend_status(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # Cannot check yourself
    if user_id == current_user.id:
        return {
            "status": "self"
        }

    # Check existing request/friendship in either direction
    request = (
        db.query(models.FriendRequest)
        .filter(
            or_(
                and_(
                    models.FriendRequest.sender_id == current_user.id,
                    models.FriendRequest.receiver_id == user_id,
                ),
                and_(
                    models.FriendRequest.sender_id == user_id,
                    models.FriendRequest.receiver_id == current_user.id,
                ),
            )
        )
        .first()
    )

    # No relationship
    if not request:
        return {
            "status": "none"
        }

    # Already friends
    if request.status == "accepted":
        return {
            "status": "friends",
            "request_id": request.id
        }

    # Current user sent the request
    if (
        request.sender_id == current_user.id
        and request.status == "pending"
    ):
        return {
            "status": "sent",
            "request_id": request.id
        }

    # Other user sent the request
    if (
        request.receiver_id == current_user.id
        and request.status == "pending"
    ):
        return {
            "status": "received",
            "request_id": request.id
        }

    return {
        "status": "none"
    }
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from app.database import get_db
from app.auth import get_current_user
from app import models


router = APIRouter(
    prefix="/messages",
    tags=["Messages"],
)


# =========================================================
# CHECK WHETHER TWO USERS ARE FRIENDS
# =========================================================

def are_friends(
    db: Session,
    user1_id: int,
    user2_id: int,
) -> bool:

    friendship = (
        db.query(models.FriendRequest)
        .filter(
            or_(
                and_(
                    models.FriendRequest.sender_id == user1_id,
                    models.FriendRequest.receiver_id == user2_id,
                ),
                and_(
                    models.FriendRequest.sender_id == user2_id,
                    models.FriendRequest.receiver_id == user1_id,
                ),
            ),
            models.FriendRequest.status == "accepted",
        )
        .first()
    )

    return friendship is not None


# =========================================================
# UNREAD MESSAGE COUNT
# =========================================================

@router.get("/unread/count")
def unread_message_count(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    count = (
        db.query(models.Message)
        .filter(
            models.Message.receiver_id == current_user.id,
            models.Message.is_read == False,
        )
        .count()
    )

    return {
        "unread": count
    }


# =========================================================
# CONVERSATION LIST
# =========================================================

@router.get("/conversations/list")
def get_conversations(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    messages = (
        db.query(models.Message)
        .filter(
            or_(
                models.Message.sender_id == current_user.id,
                models.Message.receiver_id == current_user.id,
            )
        )
        .order_by(
            models.Message.created_at.desc()
        )
        .all()
    )

    conversations = {}

    for message in messages:

        # -------------------------------------------------
        # DETERMINE OTHER USER
        # -------------------------------------------------

        if message.sender_id == current_user.id:
            other_user_id = message.receiver_id
        else:
            other_user_id = message.sender_id

        # -------------------------------------------------
        # ONLY KEEP NEWEST MESSAGE
        # -------------------------------------------------

        if other_user_id in conversations:
            continue

        other_user = (
            db.query(models.User)
            .filter(
                models.User.id == other_user_id
            )
            .first()
        )

        if not other_user:
            continue

        # -------------------------------------------------
        # COUNT UNREAD MESSAGES
        # -------------------------------------------------

        unread = (
            db.query(models.Message)
            .filter(
                models.Message.sender_id == other_user_id,
                models.Message.receiver_id == current_user.id,
                models.Message.is_read == False,
            )
            .count()
        )

        conversations[other_user_id] = {
            "user_id": other_user.id,
            "first_name": other_user.first_name,
            "last_name": other_user.last_name,
            "profile_picture": other_user.profile_picture,
            "last_message": message.content,
            "last_message_at": message.created_at,
            "unread": unread,
        }

    return list(
        conversations.values()
    )


# =========================================================
# MARK CONVERSATION AS READ
# =========================================================

@router.put("/{user_id}/read")
def mark_messages_as_read(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # -----------------------------------------------------
    # CANNOT USE YOUR OWN ID
    # -----------------------------------------------------

    if user_id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail="Invalid user.",
        )

    # -----------------------------------------------------
    # CHECK USER
    # -----------------------------------------------------

    other_user = (
        db.query(models.User)
        .filter(
            models.User.id == user_id
        )
        .first()
    )

    if not other_user:
        raise HTTPException(
            status_code=404,
            detail="User not found.",
        )

    # -----------------------------------------------------
    # CHECK FRIENDSHIP
    # -----------------------------------------------------

    if not are_friends(
        db,
        current_user.id,
        user_id,
    ):
        raise HTTPException(
            status_code=403,
            detail="You are not friends with this user.",
        )

    # -----------------------------------------------------
    # MARK RECEIVED MESSAGES AS READ
    # -----------------------------------------------------

    updated = (
        db.query(models.Message)
        .filter(
            models.Message.sender_id == user_id,
            models.Message.receiver_id == current_user.id,
            models.Message.is_read == False,
        )
        .update(
            {
                models.Message.is_read: True
            },
            synchronize_session=False,
        )
    )

    db.commit()

    return {
        "message": "Messages marked as read.",
        "updated": updated,
    }


# =========================================================
# SEND MESSAGE
# =========================================================

@router.post("/{receiver_id}")
def send_message(
    receiver_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # -----------------------------------------------------
    # CANNOT MESSAGE YOURSELF
    # -----------------------------------------------------

    if receiver_id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail="You cannot send a message to yourself.",
        )

    # -----------------------------------------------------
    # CHECK RECEIVER
    # -----------------------------------------------------

    receiver = (
        db.query(models.User)
        .filter(
            models.User.id == receiver_id
        )
        .first()
    )

    if not receiver:
        raise HTTPException(
            status_code=404,
            detail="User not found.",
        )

    # -----------------------------------------------------
    # ONLY FRIENDS CAN CHAT
    # -----------------------------------------------------

    if not are_friends(
        db,
        current_user.id,
        receiver_id,
    ):
        raise HTTPException(
            status_code=403,
            detail="You can only message your friends.",
        )

    # -----------------------------------------------------
    # GET MESSAGE CONTENT
    # -----------------------------------------------------

    content = str(
        data.get("content", "")
    ).strip()

    if not content:
        raise HTTPException(
            status_code=400,
            detail="Message cannot be empty.",
        )

    if len(content) > 5000:
        raise HTTPException(
            status_code=400,
            detail="Message is too long.",
        )

    # -----------------------------------------------------
    # CREATE MESSAGE
    # -----------------------------------------------------

    message = models.Message(
        sender_id=current_user.id,
        receiver_id=receiver_id,
        content=content,
        is_read=False,
    )

    db.add(message)

    # -----------------------------------------------------
    # CREATE NOTIFICATION
    # -----------------------------------------------------

    notification = models.Notification(
        user_id=receiver_id,
        sender_id=current_user.id,
        notification_type="message",
        message=(
            f"{current_user.first_name} "
            f"{current_user.last_name} "
            f"sent you a message."
        ),
        is_read=False,
    )

    db.add(notification)

    # -----------------------------------------------------
    # SAVE TO DATABASE
    # -----------------------------------------------------

    db.commit()
    db.refresh(message)

    # -----------------------------------------------------
    # RETURN MESSAGE
    # -----------------------------------------------------

    return {
        "id": message.id,
        "sender_id": message.sender_id,
        "receiver_id": message.receiver_id,
        "content": message.content,
        "is_read": message.is_read,
        "created_at": message.created_at,
    }


# =========================================================
# GET CONVERSATION
# =========================================================

@router.get("/{user_id}")
def get_conversation(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # -----------------------------------------------------
    # CANNOT CHAT WITH YOURSELF
    # -----------------------------------------------------

    if user_id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail="You cannot message yourself.",
        )

    # -----------------------------------------------------
    # CHECK USER
    # -----------------------------------------------------

    other_user = (
        db.query(models.User)
        .filter(
            models.User.id == user_id
        )
        .first()
    )

    if not other_user:
        raise HTTPException(
            status_code=404,
            detail="User not found.",
        )

    # -----------------------------------------------------
    # ONLY FRIENDS CAN VIEW CHAT
    # -----------------------------------------------------

    if not are_friends(
        db,
        current_user.id,
        user_id,
    ):
        raise HTTPException(
            status_code=403,
            detail="You can only chat with your friends.",
        )

    # -----------------------------------------------------
    # GET CONVERSATION
    # -----------------------------------------------------

    messages = (
        db.query(models.Message)
        .filter(
            or_(
                and_(
                    models.Message.sender_id == current_user.id,
                    models.Message.receiver_id == user_id,
                ),
                and_(
                    models.Message.sender_id == user_id,
                    models.Message.receiver_id == current_user.id,
                ),
            )
        )
        .order_by(
            models.Message.created_at.asc()
        )
        .all()
    )

    # -----------------------------------------------------
    # MARK RECEIVED MESSAGES AS READ
    # -----------------------------------------------------

    for message in messages:

        if (
            message.receiver_id == current_user.id
            and not message.is_read
        ):
            message.is_read = True

    db.commit()

    # -----------------------------------------------------
    # RETURN CONVERSATION
    # -----------------------------------------------------

    return [
        {
            "id": message.id,
            "sender_id": message.sender_id,
            "receiver_id": message.receiver_id,
            "content": message.content,
            "is_read": message.is_read,
            "created_at": message.created_at,
        }
        for message in messages
    ]
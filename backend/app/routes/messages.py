from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from app.database import get_db
from app import models, schemas
from app.auth import get_current_user

router = APIRouter(
    prefix="/messages",
    tags=["Messages"]
)


# -------------------------
# SEND MESSAGE
# -------------------------

@router.post("/", response_model=schemas.MessageResponse)
def send_message(
    message: schemas.MessageCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    receiver = (
        db.query(models.User)
        .filter(models.User.id == message.receiver_id)
        .first()
    )

    if not receiver:
        raise HTTPException(
            status_code=404,
            detail="Receiver not found."
        )

    if receiver.id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail="You cannot send a message to yourself."
        )

    new_message = models.Message(
        sender_id=current_user.id,
        receiver_id=message.receiver_id,
        content=message.content
    )

    db.add(new_message)
    db.commit()
    db.refresh(new_message)

    return new_message


# -------------------------
# GET MY INBOX
# -------------------------

@router.get(
    "/inbox",
    response_model=list[schemas.MessageResponse]
)
def get_inbox(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    messages = (
        db.query(models.Message)
        .filter(
            models.Message.receiver_id == current_user.id
        )
        .order_by(models.Message.created_at.desc())
        .all()
    )

    return messages


# -------------------------
# GET SENT MESSAGES
# -------------------------

@router.get(
    "/sent",
    response_model=list[schemas.MessageResponse]
)
def get_sent_messages(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    messages = (
        db.query(models.Message)
        .filter(
            models.Message.sender_id == current_user.id
        )
        .order_by(models.Message.created_at.desc())
        .all()
    )

    return messages


# -------------------------
# GET CONVERSATION
# -------------------------

@router.get(
    "/conversation/{user_id}",
    response_model=list[schemas.MessageResponse]
)
def get_conversation(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    user = (
        db.query(models.User)
        .filter(models.User.id == user_id)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found."
        )

    messages = (
        db.query(models.Message)
        .filter(
            or_(
                and_(
                    models.Message.sender_id == current_user.id,
                    models.Message.receiver_id == user_id
                ),
                and_(
                    models.Message.sender_id == user_id,
                    models.Message.receiver_id == current_user.id
                )
            )
        )
        .order_by(models.Message.created_at.asc())
        .all()
    )

    return messages


# -------------------------
# MARK AS READ
# -------------------------

@router.put("/{message_id}/read")
def mark_message_read(
    message_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    message = (
        db.query(models.Message)
        .filter(
            models.Message.id == message_id,
            models.Message.receiver_id == current_user.id
        )
        .first()
    )

    if not message:
        raise HTTPException(
            status_code=404,
            detail="Message not found."
        )

    message.is_read = True

    db.commit()
    db.refresh(message)

    return {
        "message": "Message marked as read."
    }


# -------------------------
# DELETE MESSAGE
# -------------------------

@router.delete("/{message_id}")
def delete_message(
    message_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    message = (
        db.query(models.Message)
        .filter(
            models.Message.id == message_id
        )
        .first()
    )

    if not message:
        raise HTTPException(
            status_code=404,
            detail="Message not found."
        )

    if (
        message.sender_id != current_user.id
        and
        message.receiver_id != current_user.id
    ):
        raise HTTPException(
            status_code=403,
            detail="Not authorized."
        )

    db.delete(message)
    db.commit()

    return {
        "message": "Message deleted successfully."
    }

# -------------------------
# GET CONVERSATIONS
# -------------------------

@router.get(
    "/conversations",
    response_model=list[schemas.ConversationResponse]
)
def get_conversations(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    messages = (
        db.query(models.Message)
        .filter(
            or_(
                models.Message.sender_id == current_user.id,
                models.Message.receiver_id == current_user.id
            )
        )
        .order_by(models.Message.created_at.desc())
        .all()
    )

    conversations = {}

    for message in messages:

        # Determine the other participant
        if message.sender_id == current_user.id:
            other_user = (
                db.query(models.User)
                .filter(models.User.id == message.receiver_id)
                .first()
            )
        else:
            other_user = (
                db.query(models.User)
                .filter(models.User.id == message.sender_id)
                .first()
            )

        if not other_user:
            continue

        # Skip if we've already added this conversation
        if other_user.id in conversations:
            continue

        unread_count = (
            db.query(models.Message)
            .filter(
                models.Message.sender_id == other_user.id,
                models.Message.receiver_id == current_user.id,
                models.Message.is_read == False
            )
            .count()
        )

        conversations[other_user.id] = {
            "user": {
                "id": other_user.id,
                "first_name": other_user.first_name,
                "last_name": other_user.last_name,
                "profile_picture": other_user.profile_picture,
            },
            "last_message": message.content,
            "last_message_time": message.created_at,
            "unread_count": unread_count,
        }

    return list(conversations.values())
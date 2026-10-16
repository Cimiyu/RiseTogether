from typing import Dict, Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from jose import JWTError, jwt
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app import models
from app.config import SECRET_KEY, ALGORITHM
from app.database import SessionLocal


router = APIRouter(
    prefix="/chat",
    tags=["Realtime Chat"],
)


# =========================================================
# CONNECTION MANAGER
# =========================================================

class ConnectionManager:

    def __init__(self):
        self.connections: Dict[int, Set[WebSocket]] = {}

    async def connect(
        self,
        user_id: int,
        websocket: WebSocket,
    ):
        await websocket.accept()

        if user_id not in self.connections:
            self.connections[user_id] = set()

        self.connections[user_id].add(websocket)

        print(
            f"[WebSocket] User {user_id} connected. "
            f"Connections: {len(self.connections[user_id])}"
        )

    def disconnect(
        self,
        user_id: int,
        websocket: WebSocket,
    ):
        connections = self.connections.get(user_id)

        if not connections:
            return

        connections.discard(websocket)

        if not connections:
            self.connections.pop(user_id, None)

        print(
            f"[WebSocket] User {user_id} disconnected."
        )

    async def send_to_user(
        self,
        user_id: int,
        data: dict,
    ):
        connections = self.connections.get(
            user_id,
            set(),
        )

        if not connections:
            print(
                f"[WebSocket] User {user_id} is offline."
            )
            return False

        failed = []

        for websocket in list(connections):

            try:
                await websocket.send_json(data)

            except Exception as error:

                print(
                    f"[WebSocket] Send failed for "
                    f"user {user_id}: {repr(error)}"
                )

                failed.append(websocket)

        for websocket in failed:

            self.disconnect(
                user_id,
                websocket,
            )

        return True

    def is_online(
        self,
        user_id: int,
    ) -> bool:

        return user_id in self.connections


manager = ConnectionManager()


# =========================================================
# JWT AUTHENTICATION
# =========================================================

def get_user_from_token(
    token: str,
    db: Session,
):
    """
    Authenticate a WebSocket using the same JWT
    SECRET_KEY and ALGORITHM used by normal login.
    """

    if not token:

        print(
            "[WebSocket] Token missing."
        )

        return None

    try:

        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM],
        )

        email = payload.get("sub")

        if not email:

            print(
                "[WebSocket] JWT has no 'sub' claim."
            )

            return None

        print(
            f"[WebSocket] JWT authenticated for: {email}"
        )

    except JWTError as error:

        print(
            f"[WebSocket] JWT ERROR: {repr(error)}"
        )

        return None

    except Exception as error:

        print(
            f"[WebSocket] JWT unexpected ERROR: "
            f"{repr(error)}"
        )

        return None

    user = (
        db.query(models.User)
        .filter(
            models.User.email == email
        )
        .first()
    )

    if not user:

        print(
            f"[WebSocket] No user found for: {email}"
        )

        return None

    return user


# =========================================================
# FRIENDSHIP CHECK
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
                    models.FriendRequest.sender_id
                    == user1_id,

                    models.FriendRequest.receiver_id
                    == user2_id,
                ),

                and_(
                    models.FriendRequest.sender_id
                    == user2_id,

                    models.FriendRequest.receiver_id
                    == user1_id,
                ),
            ),

            models.FriendRequest.status
            == "accepted",
        )
        .first()
    )

    return friendship is not None


# =========================================================
# WEBSOCKET ENDPOINT
# =========================================================

@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
):

    print()
    print("=" * 60)
    print("[WebSocket] CONNECTION ATTEMPT")
    print(f"[WebSocket] Client: {websocket.client}")
    print(f"[WebSocket] URL: {websocket.url}")
    print("=" * 60)

    # -----------------------------------------------------
    # GET TOKEN
    # -----------------------------------------------------

    token = websocket.query_params.get(
        "token"
    )

    # -----------------------------------------------------
    # DATABASE SESSION
    # -----------------------------------------------------

    db = SessionLocal()

    user = None

    try:

        # =================================================
        # TOKEN CHECK
        # =================================================

        if not token:

            print(
                "[WebSocket] REJECTED: No token."
            )

            await websocket.close(
                code=1008,
                reason="Authentication token missing",
            )

            return

        print(
            "[WebSocket] Token received."
        )

        # =================================================
        # AUTHENTICATE
        # =================================================

        user = get_user_from_token(
            token,
            db,
        )

        if not user:

            print(
                "[WebSocket] REJECTED: "
                "Authentication failed."
            )

            await websocket.close(
                code=1008,
                reason="Authentication failed",
            )

            return

        user_id = int(
            user.id
        )

        print(
            "[WebSocket] AUTHENTICATED"
        )

        print(
            f"[WebSocket] User ID: {user_id}"
        )

        print(
            f"[WebSocket] Email: {user.email}"
        )

        # =================================================
        # ACCEPT CONNECTION
        # =================================================

        await manager.connect(
            user_id,
            websocket,
        )

        # =================================================
        # CONNECTION CONFIRMATION
        # =================================================

        await websocket.send_json({
            "type": "connected",
            "user_id": user_id,
        })

        print(
            f"[WebSocket] User {user_id} is ONLINE."
        )

        # =================================================
        # MESSAGE LOOP
        # =================================================

        while True:

            data = await websocket.receive_json()

            print(
                f"[WebSocket] Received from "
                f"user {user_id}: {data}"
            )

            # -------------------------------------------------
            # MESSAGE TYPE
            # -------------------------------------------------

            if data.get("type") != "message":
                continue

            # =================================================
            # RECEIVER ID
            # =================================================

            receiver_id = data.get(
                "receiver_id"
            )

            if receiver_id is None:

                await websocket.send_json({
                    "type": "error",
                    "message": "Receiver is required.",
                })

                continue

            try:

                receiver_id = int(
                    receiver_id
                )

            except (
                TypeError,
                ValueError,
            ):

                await websocket.send_json({
                    "type": "error",
                    "message": "Invalid receiver ID.",
                })

                continue

            # =================================================
            # SELF MESSAGE
            # =================================================

            if receiver_id == user_id:

                await websocket.send_json({
                    "type": "error",
                    "message": (
                        "You cannot message yourself."
                    ),
                })

                continue

            # =================================================
            # FIND RECEIVER
            # =================================================

            receiver = (
                db.query(models.User)
                .filter(
                    models.User.id
                    == receiver_id
                )
                .first()
            )

            if not receiver:

                await websocket.send_json({
                    "type": "error",
                    "message": "User not found.",
                })

                continue

            # =================================================
            # FRIENDSHIP CHECK
            # =================================================

            if not are_friends(
                db,
                user_id,
                receiver_id,
            ):

                await websocket.send_json({
                    "type": "error",
                    "message": (
                        "You can only message "
                        "your friends."
                    ),
                })

                continue

            # =================================================
            # MESSAGE CONTENT
            # =================================================

            content = str(
                data.get(
                    "content",
                    "",
                )
            ).strip()

            if not content:

                await websocket.send_json({
                    "type": "error",
                    "message": (
                        "Message cannot be empty."
                    ),
                })

                continue

            if len(content) > 5000:

                await websocket.send_json({
                    "type": "error",
                    "message": (
                        "Message cannot exceed "
                        "5000 characters."
                    ),
                })

                continue

            # =================================================
            # CREATE MESSAGE
            # =================================================

            message = models.Message(
                sender_id=user_id,
                receiver_id=receiver_id,
                content=content,
                is_read=False,
            )

            db.add(message)

            # =================================================
            # CREATE NOTIFICATION
            # =================================================

            notification = models.Notification(
                user_id=receiver_id,
                sender_id=user_id,
                notification_type="message",
                message=(
                    f"{user.first_name} "
                    f"{user.last_name} "
                    f"sent you a message."
                ),
                is_read=False,
            )

            db.add(notification)

            # =================================================
            # DATABASE COMMIT
            # =================================================

            try:

                db.commit()

                db.refresh(
                    message
                )

            except Exception as error:

                db.rollback()

                print(
                    "[WebSocket] DATABASE ERROR:",
                    repr(error),
                )

                await websocket.send_json({
                    "type": "error",
                    "message": (
                        "Unable to save message."
                    ),
                })

                continue

            # =================================================
            # MESSAGE DATA
            # =================================================

            message_data = {
                "type": "message",

                "id": message.id,

                "sender_id":
                    message.sender_id,

                "receiver_id":
                    message.receiver_id,

                "content":
                    message.content,

                "is_read":
                    message.is_read,

                "created_at": (
                    message.created_at.isoformat()
                    if message.created_at
                    else None
                ),
            }

            # =================================================
            # SEND TO RECEIVER
            # =================================================

            await manager.send_to_user(
                receiver_id,
                message_data,
            )

            # =================================================
            # SEND BACK TO SENDER
            # =================================================

            await websocket.send_json(
                message_data
            )

    # =====================================================
    # CLIENT DISCONNECTED
    # =====================================================

    except WebSocketDisconnect:

        print(
            "[WebSocket] Client disconnected."
        )

        if user:

            manager.disconnect(
                user.id,
                websocket,
            )

    # =====================================================
    # UNEXPECTED ERROR
    # =====================================================

    except Exception as error:

        print(
            "[WebSocket] UNEXPECTED ERROR:",
            repr(error),
        )

        if user:

            manager.disconnect(
                user.id,
                websocket,
            )

    # =====================================================
    # CLEANUP
    # =====================================================

    finally:

        db.close()

        print(
            "[WebSocket] Database session closed."
        )
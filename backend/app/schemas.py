from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr


# -------------------------
# USER SCHEMAS
# -------------------------

class UserCreate(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    bio: Optional[str] = None
    university: Optional[str] = None
    course: Optional[str] = None
    year_of_study: Optional[str] = None
    profile_picture: Optional[str] = None


class UserResponse(BaseModel):
    id: int
    first_name: str
    last_name: str
    email: EmailStr
    bio: Optional[str] = None
    university: Optional[str] = None
    course: Optional[str] = None
    year_of_study: Optional[str] = None
    profile_picture: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# -------------------------
# POST SCHEMAS
# -------------------------

class PostCreate(BaseModel):
    content: str
    image_url: Optional[str] = None


class PostResponse(BaseModel):
    id: int
    content: str
    image_url: Optional[str] = None
    owner_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# -------------------------
# COMMENT SCHEMAS
# -------------------------

class CommentCreate(BaseModel):
    content: str


class CommentResponse(BaseModel):
    id: int
    content: str
    owner_id: int
    post_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# -------------------------
# LIKE SCHEMAS
# -------------------------

class LikeCreate(BaseModel):
    post_id: int


class LikeResponse(BaseModel):
    id: int
    owner_id: int
    post_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# -------------------------
# FOLLOW SCHEMAS
# -------------------------

class FollowCreate(BaseModel):
    following_id: int


class FollowResponse(BaseModel):
    id: int
    follower_id: int
    following_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# -------------------------
# NOTIFICATION SCHEMAS
# -------------------------

class NotificationResponse(BaseModel):
    id: int
    user_id: int
    sender_id: Optional[int] = None
    notification_type: str
    message: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


# -------------------------
# MESSAGE SCHEMAS
# -------------------------

class MessageCreate(BaseModel):
    receiver_id: int
    content: str


class MessageResponse(BaseModel):
    id: int
    sender_id: int
    receiver_id: int
    content: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


# -------------------------
# FEED SCHEMAS
# -------------------------

class FeedResponse(BaseModel):
    page: int
    limit: int
    total_posts: int
    posts: list[PostResponse]

    class Config:
        from_attributes = True

        # -------------------------
# PUBLIC PROFILE SCHEMAS
# -------------------------

class PublicProfileResponse(BaseModel):
    id: int
    first_name: str
    last_name: str
    email: EmailStr
    bio: Optional[str] = None
    university: Optional[str] = None
    course: Optional[str] = None
    year_of_study: Optional[str] = None
    profile_picture: Optional[str] = None

    posts_count: int
    followers_count: int
    following_count: int

    created_at: datetime

    class Config:
        from_attributes = True

 # -------------------------
# FEED POST SCHEMAS
# -------------------------

class FeedOwner(BaseModel):
    id: int
    first_name: str
    last_name: str
    profile_picture: Optional[str] = None

    class Config:
        from_attributes = True


class FeedPostResponse(BaseModel):
    id: int
    content: str
    image_url: Optional[str] = None
    created_at: datetime

    owner: FeedOwner

    likes_count: int
    comments_count: int
    liked: bool


# -------------------------
# FEED RESPONSE
# -------------------------

class FeedResponse(BaseModel):
    page: int
    limit: int
    total_posts: int
    posts: list[FeedPostResponse]

    class Config:
        from_attributes = True


# -------------------------
# PUBLIC PROFILE SCHEMAS
# -------------------------

class PublicProfileResponse(BaseModel):
    id: int
    first_name: str
    last_name: str
    email: EmailStr
    bio: Optional[str] = None
    university: Optional[str] = None
    course: Optional[str] = None
    year_of_study: Optional[str] = None
    profile_picture: Optional[str] = None

    posts_count: int
    followers_count: int
    following_count: int

    created_at: datetime

    class Config:
        from_attributes = True

        # -------------------------
# CONVERSATION SCHEMAS
# -------------------------

class ConversationUser(BaseModel):
    id: int
    first_name: str
    last_name: str
    profile_picture: Optional[str] = None

    class Config:
        from_attributes = True


class ConversationResponse(BaseModel):
    user: ConversationUser
    last_message: str
    last_message_time: datetime
    unread_count: int
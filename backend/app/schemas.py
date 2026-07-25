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

    class Config:
        from_attributes = True
from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey,
    Text,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


# -------------------------
# USER MODEL
# -------------------------

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    first_name = Column(String, nullable=False)

    last_name = Column(String, nullable=False)

    email = Column(String, unique=True, index=True, nullable=False)

    hashed_password = Column(String, nullable=False)

    profile_picture = Column(String, nullable=True)

    bio = Column(Text, nullable=True)

    university = Column(String, nullable=True)

    course = Column(String, nullable=True)

    year_of_study = Column(String, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    posts = relationship(
        "Post",
        back_populates="owner",
        cascade="all, delete-orphan"
    )

    comments = relationship(
        "Comment",
        back_populates="owner",
        cascade="all, delete-orphan"
    )

    likes = relationship(
        "Like",
        back_populates="owner",
        cascade="all, delete-orphan"
    )


# -------------------------
# POST MODEL
# -------------------------

class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True, index=True)

    content = Column(Text, nullable=False)

    image_url = Column(String, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    owner_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False
    )

    owner = relationship(
        "User",
        back_populates="posts"
    )

    comments = relationship(
        "Comment",
        back_populates="post",
        cascade="all, delete-orphan"
    )

    likes = relationship(
        "Like",
        back_populates="post",
        cascade="all, delete-orphan"
    )


# -------------------------
# COMMENT MODEL
# -------------------------

class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)

    content = Column(Text, nullable=False)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    owner_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )

    post_id = Column(
        Integer,
        ForeignKey("posts.id", ondelete="CASCADE"),
        nullable=False
    )

    owner = relationship(
        "User",
        back_populates="comments"
    )

    post = relationship(
        "Post",
        back_populates="comments"
    )


# -------------------------
# LIKE MODEL
# -------------------------

class Like(Base):
    __tablename__ = "likes"

    id = Column(Integer, primary_key=True, index=True)

    owner_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )

    post_id = Column(
        Integer,
        ForeignKey("posts.id", ondelete="CASCADE"),
        nullable=False
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    owner = relationship(
        "User",
        back_populates="likes"
    )

    post = relationship(
        "Post",
        back_populates="likes"
    )
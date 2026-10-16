import { useEffect, useState } from "react";

import api from "../api/axios";
import MainLayout from "../layout/MainLayout";
import Comments from "../components/Comments";

interface Post {
  id: number;
  content: string;
  image_url: string | null;
  created_at: string;

  owner: {
    id: number;
    first_name: string;
    last_name: string;
    profile_picture: string | null;
  };

  likes_count: number;
  comments_count: number;
  liked?: boolean;
}

type FriendStatus =
  | "none"
  | "sent"
  | "received"
  | "friends"
  | "self";

function Dashboard() {
  // =====================================================
  // STATE
  // =====================================================

  const [editingPost, setEditingPost] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");

  const [content, setContent] = useState("");
  const [image, setImage] = useState<File | null>(null);

  const [posts, setPosts] = useState<Post[]>([]);

  const [loading, setLoading] = useState(false);

  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  const [followingUsers, setFollowingUsers] = useState<number[]>([]);

  /*
   * Stores friendship status for each user.
   *
   * Example:
   *
   * {
   *   2: "sent",
   *   3: "friends",
   *   4: "none"
   * }
   */
  const [friendStatuses, setFriendStatuses] = useState<
    Record<number, FriendStatus>
  >({});

  const [processingFriendId, setProcessingFriendId] =
    useState<number | null>(null);

  // =====================================================
  // LOAD CURRENT USER
  // =====================================================

  // =====================================================
  // LOAD POSTS
  // =====================================================

  async function loadPosts() {
    try {
      setLoading(true);

      const response = await api.get("/posts");

      setPosts(response.data);
    } catch (error: any) {
      console.error("Failed to load posts:", error);

      if (error.response?.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("token");

        window.location.href = "/login";
      }
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // LOAD FOLLOWING
  // =====================================================

  async function loadFollowing(userId?: number) {
    const id = userId ?? currentUserId;

    if (id === null || id === undefined) {
      return;
    }

    try {
      const response = await api.get(
        `/follows/following/${id}`
      );

      const ids = response.data.map(
        (follow: any) => follow.following_id
      );

      setFollowingUsers(ids);
    } catch (error) {
      console.error(
        "Failed to load following:",
        error
      );
    }
  }

  // =====================================================
  // LOAD FRIENDSHIP STATUSES
  // =====================================================

  async function loadFriendStatuses(
    userId?: number,
    postList?: Post[]
  ) {
    const id = userId ?? currentUserId;
    const currentPosts = postList ?? posts;

    if (id === null || id === undefined) {
      return;
    }

    try {
      /*
       * Get all users appearing on the feed.
       */
      const otherUsers = currentPosts
        .map((post) => post.owner.id)
        .filter((ownerId) => ownerId !== id);

      /*
       * Remove duplicate user IDs.
       */
      const uniqueUsers = [...new Set(otherUsers)];

      const statuses: Record<number, FriendStatus> = {};

      /*
       * Ask the backend for every user's relationship status.
       */
      await Promise.all(
        uniqueUsers.map(async (otherUserId) => {
          try {
            const response = await api.get(
              `/friends/status/${otherUserId}`
            );

            statuses[otherUserId] =
              response.data.status as FriendStatus;
          } catch (error) {
            console.error(
              `Failed to get friendship status for user ${otherUserId}:`,
              error
            );

            /*
             * If the request fails, default to none.
             */
            statuses[otherUserId] = "none";
          }
        })
      );

      setFriendStatuses(statuses);
    } catch (error) {
      console.error(
        "Failed to load friendship statuses:",
        error
      );
    }
  }

  // =====================================================
  // INITIALIZE DASHBOARD
  // =====================================================

  useEffect(() => {
    async function initializeDashboard() {
      try {
        /*
         * Load user and posts first.
         */
        const [userResponse, postsResponse] =
          await Promise.all([
            api.get("/users/me"),
            api.get("/posts"),
          ]);

        const userId = userResponse.data.id;
        const loadedPosts = postsResponse.data;

        setCurrentUserId(userId);
        setPosts(loadedPosts);

        /*
         * Load following and friendship statuses
         * immediately after getting the user ID.
         */
        await Promise.all([
          loadFollowing(userId),
          loadFriendStatuses(userId, loadedPosts),
        ]);
      } catch (error: any) {
        console.error(
          "Failed to initialize dashboard:",
          error
        );

        if (error.response?.status === 401) {
          localStorage.removeItem("access_token");
          localStorage.removeItem("token");

          window.location.href = "/login";
        }
      }
    }

    initializeDashboard();
  }, []);

  // =====================================================
  // RELOAD FRIEND STATUSES WHEN POSTS CHANGE
  // =====================================================

  useEffect(() => {
    if (
      currentUserId !== null &&
      posts.length > 0
    ) {
      loadFriendStatuses();
    }
  }, [currentUserId, posts.length]);

  // =====================================================
  // CREATE POST
  // =====================================================

  async function createPost() {
    if (!content.trim()) {
      alert(
        "Please write something before posting."
      );

      return;
    }

    try {
      const formData = new FormData();

      formData.append("content", content);

      if (image) {
        formData.append("image", image);
      }

      await api.post("/posts", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setContent("");
      setImage(null);

      await loadPosts();
    } catch (error) {
      console.error(
        "Failed to create post:",
        error
      );

      alert("Failed to create post.");
    }
  }

  // =====================================================
  // EDIT POST
  // =====================================================

  async function updatePost(postId: number) {
    if (!editContent.trim()) {
      alert("Post content cannot be empty.");

      return;
    }

    try {
      await api.put(`/posts/${postId}`, {
        content: editContent,
        image_url: null,
      });

      setEditingPost(null);
      setEditContent("");

      await loadPosts();
    } catch (error) {
      console.error(
        "Failed to update post:",
        error
      );

      alert("Failed to update post.");
    }
  }

  // =====================================================
  // DELETE POST
  // =====================================================

  async function deletePost(postId: number) {
    if (!window.confirm("Delete this post?")) {
      return;
    }

    try {
      await api.delete(`/posts/${postId}`);

      await loadPosts();
    } catch (error) {
      console.error(
        "Failed to delete post:",
        error
      );

      alert("Failed to delete.");
    }
  }

  // =====================================================
  // LIKE / UNLIKE
  // =====================================================

  async function toggleLike(post: Post) {
    try {
      if (post.liked) {
        await api.delete(`/likes/${post.id}`);
      } else {
        await api.post(`/likes/${post.id}`);
      }

      await loadPosts();
    } catch (error: any) {
      console.error("Like error:", error);

      if (error.response?.data?.detail) {
        alert(error.response.data.detail);
      } else {
        alert("Unable to update like.");
      }
    }
  }

  // =====================================================
  // FOLLOW / UNFOLLOW
  // =====================================================

  async function toggleFollow(userId: number) {
    try {
      if (followingUsers.includes(userId)) {
        await api.delete(`/follows/${userId}`);

        setFollowingUsers((prev) =>
          prev.filter((id) => id !== userId)
        );
      } else {
        await api.post(`/follows/${userId}`);

        setFollowingUsers((prev) => [
          ...prev,
          userId,
        ]);
      }
    } catch (error: any) {
      console.error("Follow error:", error);

      if (error.response?.data?.detail) {
        alert(error.response.data.detail);
      } else {
        alert("Unable to update follow.");
      }
    }
  }

  // =====================================================
  // SEND FRIEND REQUEST
  // =====================================================

  async function sendFriendRequest(userId: number) {
    try {
      setProcessingFriendId(userId);

      const response = await api.post(
        `/friends/send/${userId}`
      );

      /*
       * IMPORTANT:
       *
       * Update the actual friendship status.
       *
       * We no longer depend on friendRequestsSent.
       */
      setFriendStatuses((prev) => ({
        ...prev,
        [userId]: "sent",
      }));

      alert(
        response.data?.message ||
          "Friend request sent successfully."
      );
    } catch (error: any) {
      console.error(
        "Friend request error:",
        error
      );

      if (error.response?.data?.detail) {
        alert(error.response.data.detail);
      } else {
        alert(
          "Unable to send friend request."
        );
      }
    } finally {
      setProcessingFriendId(null);
    }
  }

  // =====================================================
  // REMOVE FRIEND
  // =====================================================

  async function removeFriend(userId: number) {
    if (
      !window.confirm(
        "Are you sure you want to remove this friend?"
      )
    ) {
      return;
    }

    try {
      setProcessingFriendId(userId);

      await api.delete(
        `/friends/remove/${userId}`
      );

      /*
       * Immediately update UI.
       */
      setFriendStatuses((prev) => ({
        ...prev,
        [userId]: "none",
      }));
    } catch (error: any) {
      console.error(
        "Remove friend error:",
        error
      );

      if (error.response?.data?.detail) {
        alert(error.response.data.detail);
      } else {
        alert("Unable to remove friend.");
      }
    } finally {
      setProcessingFriendId(null);
    }
  }

  // =====================================================
  // CANCEL SENT FRIEND REQUEST
  // =====================================================

  async function cancelFriendRequest(
    userId: number,
    requestId?: number
  ) {
    try {
      setProcessingFriendId(userId);

      let id = requestId;

      /*
       * If request ID isn't available in state,
       * get the current relationship status.
       */
      if (!id) {
        const response = await api.get(
          `/friends/status/${userId}`
        );

        id = response.data.request_id;
      }

      if (!id) {
        throw new Error(
          "Friend request ID not found."
        );
      }

      await api.delete(
        `/friends/cancel/${id}`
      );

      setFriendStatuses((prev) => ({
        ...prev,
        [userId]: "none",
      }));
    } catch (error: any) {
      console.error(
        "Cancel friend request error:",
        error
      );

      if (error.response?.data?.detail) {
        alert(error.response.data.detail);
      } else {
        alert(
          "Unable to cancel friend request."
        );
      }
    } finally {
      setProcessingFriendId(null);
    }
  }

  // =====================================================
  // FRIEND BUTTON
  // =====================================================

  function renderFriendButton(
    userId: number
  ) {
    const status =
      friendStatuses[userId] || "none";

    const processing =
      processingFriendId === userId;

    // -----------------------------------------------
    // ALREADY FRIENDS
    // -----------------------------------------------

    if (status === "friends") {
      return (
        <button
          onClick={() => removeFriend(userId)}
          disabled={processing}
          className="px-4 py-2 rounded-lg font-medium bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-700 disabled:opacity-50 transition"
        >
          {processing
            ? "..."
            : "✓ Friends"}
        </button>
      );
    }

    // -----------------------------------------------
    // REQUEST SENT
    // -----------------------------------------------

    if (status === "sent") {
      return (
        <button
          onClick={() =>
            cancelFriendRequest(userId)
          }
          disabled={processing}
          className="px-4 py-2 rounded-lg font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 transition"
        >
          {processing
            ? "..."
            : "✓ Request Sent"}
        </button>
      );
    }

    // -----------------------------------------------
    // REQUEST RECEIVED
    // -----------------------------------------------

    if (status === "received") {
      return (
        <button
          onClick={() =>
            window.location.href =
              "/friends"
          }
          className="px-4 py-2 rounded-lg font-medium bg-yellow-100 text-yellow-800 hover:bg-yellow-200 transition"
        >
          🤝 Respond
        </button>
      );
    }

    // -----------------------------------------------
    // NO RELATIONSHIP
    // -----------------------------------------------

    return (
      <button
        onClick={() =>
          sendFriendRequest(userId)
        }
        disabled={processing}
        className="px-4 py-2 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition"
      >
        {processing
          ? "..."
          : "🤝 Add Friend"}
      </button>
    );
  }

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <MainLayout>

      {/* =================================================
          CREATE POST
      ================================================= */}

      <div className="bg-white rounded-xl shadow-md p-6 mb-6">

        <h2 className="text-2xl font-bold">
          Welcome to RiseTogether 🎉
        </h2>

        <p className="text-gray-600 mt-2">
          Share something with your friends.
        </p>

        <textarea
          rows={4}
          value={content}
          onChange={(e) =>
            setContent(e.target.value)
          }
          placeholder="What's on your mind?"
          className="w-full mt-5 border rounded-lg p-4 focus:outline-none focus:ring-2 focus:ring-red-500"
        />

        <input
          type="file"
          accept="image/*"
          className="mt-4"
          onChange={(e) => {
            if (
              e.target.files &&
              e.target.files.length > 0
            ) {
              setImage(e.target.files[0]);
            }
          }}
        />

        {/* IMAGE PREVIEW */}

        {image && (
          <div className="mt-4">

            <img
              src={URL.createObjectURL(image)}
              alt="Preview"
              className="rounded-lg max-h-72 border"
            />

            <button
              onClick={() =>
                setImage(null)
              }
              className="mt-2 text-red-600 text-sm hover:underline"
            >
              Remove Image
            </button>

          </div>
        )}

        <button
          onClick={createPost}
          className="mt-5 bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg transition"
        >
          Create Post
        </button>

      </div>

      {/* =================================================
          LOADING
      ================================================= */}

      {loading && (
        <div className="bg-white rounded-xl shadow-md p-6 text-center">
          Loading posts...
        </div>
      )}

      {/* =================================================
          EMPTY
      ================================================= */}

      {!loading &&
        posts.length === 0 && (
          <div className="bg-white rounded-xl shadow-md p-6 text-center text-gray-500">
            No posts yet.
          </div>
        )}

      {/* =================================================
          POSTS
      ================================================= */}

      {!loading &&
        posts.length > 0 && (
          <div className="space-y-6">

            {posts.map((post) => {

              const friendStatus =
                friendStatuses[
                  post.owner.id
                ];

              return (
                <div
                  key={post.id}
                  className="bg-white rounded-xl shadow-md overflow-hidden"
                >

                  {/* =================================================
                      POST HEADER
                  ================================================= */}

                  <div className="flex items-center p-5">

                    <img
                      src={
                        post.owner
                          .profile_picture
                          ? `http://127.0.0.1:8000${post.owner.profile_picture}`
                          : `https://ui-avatars.com/api/?name=${encodeURIComponent(
                              `${post.owner.first_name} ${post.owner.last_name}`
                            )}&background=dc2626&color=ffffff`
                      }
                      alt="Profile"
                      className="w-12 h-12 rounded-full object-cover border"
                    />

                    <div className="ml-3 flex-1">

                      <div className="flex items-center justify-between">

                        <div>

                          <h3 className="font-semibold">
                            {post.owner.first_name}{" "}
                            {post.owner.last_name}
                          </h3>

                          <p className="text-sm text-gray-500">
                            {new Date(
                              post.created_at
                            ).toLocaleString()}
                          </p>

                        </div>

                        {/* =================================================
                            FOLLOW + FRIEND
                        ================================================= */}

                        {currentUserId !== null &&
                          currentUserId !==
                            post.owner.id && (

                            <div className="flex items-center gap-2 ml-4">

                              {/* FOLLOW */}

                              <button
                                onClick={() =>
                                  toggleFollow(
                                    post.owner.id
                                  )
                                }
                                className={`px-4 py-2 rounded-lg font-medium transition ${
                                  followingUsers.includes(
                                    post.owner.id
                                  )
                                    ? "bg-gray-200 text-gray-800 hover:bg-gray-300"
                                    : "bg-red-600 text-white hover:bg-red-700"
                                }`}
                              >
                                {followingUsers.includes(
                                  post.owner.id
                                )
                                  ? "Following"
                                  : "Follow"}
                              </button>

                              {/* FRIEND */}

                              {renderFriendButton(
                                post.owner.id
                              )}

                            </div>
                          )}

                      </div>

                    </div>

                  </div>

                  {/* =================================================
                      CONTENT
                  ================================================= */}

                  <div className="px-5 pb-4">

                    {editingPost ===
                    post.id ? (

                      <>
                        <textarea
                          value={
                            editContent
                          }
                          onChange={(e) =>
                            setEditContent(
                              e.target.value
                            )
                          }
                          className="w-full border rounded-lg p-3"
                          rows={4}
                        />

                        <div className="flex gap-2 mt-3">

                          <button
                            onClick={() =>
                              updatePost(
                                post.id
                              )
                            }
                            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                          >
                            Save
                          </button>

                          <button
                            onClick={() => {
                              setEditingPost(
                                null
                              );

                              setEditContent(
                                ""
                              );
                            }}
                            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                          >
                            Cancel
                          </button>

                        </div>
                      </>

                    ) : (

                      <p className="whitespace-pre-wrap text-gray-800">
                        {post.content}
                      </p>

                    )}

                  </div>

                  {/* =================================================
                      POST IMAGE
                  ================================================= */}

                  {post.image_url && (
                    <img
                      src={`http://127.0.0.1:8000${post.image_url}`}
                      alt="Post"
                      className="w-full max-h-[500px] object-cover"
                    />
                  )}

                  {/* =================================================
                      COUNTS
                  ================================================= */}

                  <div className="flex justify-between text-sm text-gray-600 px-5 py-3 border-b">

                    <span>
                      ❤️{" "}
                      {post.likes_count}{" "}
                      Like
                      {post.likes_count !==
                      1
                        ? "s"
                        : ""}
                    </span>

                    <span>
                      💬{" "}
                      {post.comments_count}{" "}
                      Comment
                      {post.comments_count !==
                      1
                        ? "s"
                        : ""}
                    </span>

                  </div>

                  {/* =================================================
                      ACTIONS
                  ================================================= */}

                  <div className="border-b">

                    <div className="flex">

                      <button
                        onClick={() =>
                          toggleLike(post)
                        }
                        className={`flex-1 py-3 font-medium transition ${
                          post.liked
                            ? "bg-red-600 text-white hover:bg-red-700"
                            : "hover:bg-gray-100"
                        }`}
                      >
                        {post.liked
                          ? "❤️ Liked"
                          : "🤍 Like"}
                      </button>

                      <button
                        className="flex-1 py-3 font-medium hover:bg-gray-100 transition"
                      >
                        💬 Comment
                      </button>

                    </div>

                    {/* EDIT / DELETE */}

                    {currentUserId ===
                      post.owner.id && (

                      <div className="flex border-t">

                        <button
                          onClick={() => {
                            setEditingPost(
                              post.id
                            );

                            setEditContent(
                              post.content
                            );
                          }}
                          className="flex-1 py-3 bg-blue-600 text-white hover:bg-blue-700"
                        >
                          ✏️ Edit
                        </button>

                        <button
                          onClick={() =>
                            deletePost(
                              post.id
                            )
                          }
                          className="flex-1 py-3 bg-red-600 text-white hover:bg-red-700"
                        >
                          🗑 Delete
                        </button>

                      </div>
                    )}

                  </div>

                  {/* =================================================
                      COMMENTS
                  ================================================= */}

                  <div className="p-5">

                    <Comments
                      postId={post.id}
                    />

                  </div>

                </div>
              );
            })}

          </div>
        )}

    </MainLayout>
  );
}

export default Dashboard;
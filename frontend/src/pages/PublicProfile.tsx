import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/axios";
import MainLayout from "../layout/MainLayout";

interface Profile {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  bio: string | null;
  university: string | null;
  course: string | null;
  year_of_study: string | null;
  profile_picture: string | null;
  posts_count: number;
  followers_count: number;
  following_count: number;
  created_at: string;
}

interface Post {
  id: number;
  content: string;
  image_url: string | null;
  created_at: string;
}

function PublicProfile() {
  const { userId } = useParams();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [friendLoading, setFriendLoading] = useState(false);

  async function loadProfile() {
    try {
      setLoading(true);

      const id = Number(userId);

      const [
        currentUserResponse,
        profileResponse,
        postsResponse,
        followingResponse,
      ] = await Promise.all([
        api.get("/users/me"),
        api.get(`/users/${id}`),
        api.get(`/users/${id}/posts`),
        api.get(`/follows/following/${id}`),
      ]);

      setCurrentUserId(currentUserResponse.data.id);
      setProfile(profileResponse.data);
      setPosts(postsResponse.data);

      const followingList = followingResponse.data;

      const currentUser = currentUserResponse.data.id;

      const isFollowing = followingList.some(
        (follow: any) =>
          follow.follower_id === id &&
          follow.following_id === currentUser
      );

      setFollowing(isFollowing);

    } catch (error) {
      console.error("Failed to load profile:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, [userId]);

  async function toggleFollow() {
    if (!profile) return;

    try {
      setFollowLoading(true);

      if (following) {
        await api.delete(`/follows/${profile.id}`);

        setFollowing(false);

        setProfile((prev) =>
          prev
            ? {
                ...prev,
                followers_count: Math.max(
                  0,
                  prev.followers_count - 1
                ),
              }
            : prev
        );
      } else {
        await api.post(`/follows/${profile.id}`);

        setFollowing(true);

        setProfile((prev) =>
          prev
            ? {
                ...prev,
                followers_count:
                  prev.followers_count + 1,
              }
            : prev
        );
      }
    } catch (error: any) {
      console.error("Follow error:", error);

      alert(
        error.response?.data?.detail ||
          "Unable to update follow."
      );
    } finally {
      setFollowLoading(false);
    }
  }

  async function sendFriendRequest() {
    if (!profile) return;

    try {
      setFriendLoading(true);

      await api.post(`/friends/send/${profile.id}`);

      alert("Friend request sent successfully.");

    } catch (error: any) {
      console.error("Friend request error:", error);

      alert(
        error.response?.data?.detail ||
          "Unable to send friend request."
      );
    } finally {
      setFriendLoading(false);
    }
  }

  function openChat() {
    if (!profile) return;

    navigate(`/chat?user=${profile.id}`);
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="bg-white rounded-xl shadow-md p-6 text-center">
          Loading profile...
        </div>
      </MainLayout>
    );
  }

  if (!profile) {
    return (
      <MainLayout>
        <div className="bg-white rounded-xl shadow-md p-6 text-center text-red-600">
          User not found.
        </div>
      </MainLayout>
    );
  }

  // Don't show follow/friend buttons on your own profile
  const isOwnProfile =
    currentUserId === profile.id;

  const profileImage = profile.profile_picture
    ? `http://127.0.0.1:8000${profile.profile_picture}`
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(
        `${profile.first_name} ${profile.last_name}`
      )}&background=dc2626&color=ffffff&size=200`;

  return (
    <MainLayout>

      <div className="max-w-4xl mx-auto">

        {/* PROFILE HEADER */}

        <div className="bg-white rounded-xl shadow-md overflow-hidden">

          {/* COVER */}

          <div className="h-40 bg-gradient-to-r from-red-600 to-red-400" />

          <div className="px-6 pb-6">

            {/* PROFILE TOP */}

            <div className="flex flex-col md:flex-row md:items-end md:justify-between">

              <div className="flex items-end -mt-16">

                <img
                  src={profileImage}
                  alt="Profile"
                  className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-md"
                />

                <div className="ml-4 mb-2">

                  <h1 className="text-2xl font-bold">
                    {profile.first_name}{" "}
                    {profile.last_name}
                  </h1>

                  <p className="text-gray-500">
                    {profile.email}
                  </p>

                </div>

              </div>

              {/* ACTIONS */}

              {!isOwnProfile && (

                <div className="flex gap-2 mt-5 md:mt-0">

                  <button
                    onClick={toggleFollow}
                    disabled={followLoading}
                    className={`px-5 py-2 rounded-lg font-medium ${
                      following
                        ? "bg-gray-200 text-gray-800 hover:bg-gray-300"
                        : "bg-red-600 text-white hover:bg-red-700"
                    }`}
                  >
                    {followLoading
                      ? "..."
                      : following
                      ? "Following"
                      : "Follow"}
                  </button>

                  <button
                    onClick={sendFriendRequest}
                    disabled={friendLoading}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg"
                  >
                    {friendLoading
                      ? "..."
                      : "Add Friend"}
                  </button>

                  <button
                    onClick={openChat}
                    className="bg-gray-800 hover:bg-gray-900 text-white px-5 py-2 rounded-lg"
                  >
                    Message
                  </button>

                </div>

              )}

            </div>

            {/* BIO */}

            <div className="mt-6">

              <p className="text-gray-700">
                {profile.bio || "No bio yet."}
              </p>

            </div>

            {/* EDUCATION */}

            <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">

              <div className="bg-gray-50 rounded-lg p-4">

                <p className="text-sm text-gray-500">
                  University
                </p>

                <p className="font-semibold">
                  {profile.university ||
                    "Not specified"}
                </p>

              </div>

              <div className="bg-gray-50 rounded-lg p-4">

                <p className="text-sm text-gray-500">
                  Course
                </p>

                <p className="font-semibold">
                  {profile.course ||
                    "Not specified"}
                </p>

              </div>

              <div className="bg-gray-50 rounded-lg p-4">

                <p className="text-sm text-gray-500">
                  Year of Study
                </p>

                <p className="font-semibold">
                  {profile.year_of_study ||
                    "Not specified"}
                </p>

              </div>

            </div>

            {/* COUNTS */}

            <div className="flex gap-8 mt-6 border-t pt-5">

              <div>
                <p className="text-xl font-bold">
                  {profile.posts_count}
                </p>

                <p className="text-gray-500 text-sm">
                  Posts
                </p>
              </div>

              <div>
                <p className="text-xl font-bold">
                  {profile.followers_count}
                </p>

                <p className="text-gray-500 text-sm">
                  Followers
                </p>
              </div>

              <div>
                <p className="text-xl font-bold">
                  {profile.following_count}
                </p>

                <p className="text-gray-500 text-sm">
                  Following
                </p>
              </div>

            </div>

          </div>

        </div>

        {/* POSTS */}

        <div className="mt-6">

          <h2 className="text-xl font-bold mb-4">
            {profile.first_name}'s Posts
          </h2>

          {posts.length === 0 ? (

            <div className="bg-white rounded-xl shadow-md p-6 text-center text-gray-500">
              No posts yet.
            </div>

          ) : (

            <div className="space-y-5">

              {posts.map((post) => (

                <div
                  key={post.id}
                  className="bg-white rounded-xl shadow-md overflow-hidden"
                >

                  <div className="p-5">

                    <p className="whitespace-pre-wrap text-gray-800">
                      {post.content}
                    </p>

                    <p className="text-sm text-gray-500 mt-3">
                      {new Date(
                        post.created_at
                      ).toLocaleString()}
                    </p>

                  </div>

                  {post.image_url && (

                    <img
                      src={`http://127.0.0.1:8000${post.image_url}`}
                      alt="Post"
                      className="w-full max-h-[500px] object-cover"
                    />

                  )}

                </div>

              ))}

            </div>

          )}

        </div>

      </div>

    </MainLayout>
  );
}

export default PublicProfile;
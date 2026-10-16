
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import api from "../api/axios";
import MainLayout from "../layout/MainLayout";
import { API_BASE_URL } from "../api/config";

// =====================================================
// TYPES
// =====================================================

interface Friend {
  id: number;
  first_name: string;
  last_name: string;
  email?: string | null;
  profile_picture?: string | null;
  online?: boolean;
}

// =====================================================
// COMPONENT
// =====================================================

function Friends() {
  const navigate = useNavigate();

  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // =====================================================
  // GET PROFILE IMAGE
  // =====================================================

  const getProfileImage = (friend: Friend): string => {
    const picture = friend.profile_picture?.trim();

    if (picture) {
      // Preserve absolute URLs.
      if (/^https?:\/\//i.test(picture)) {
        return picture;
      }

      // Resolve relative paths against the configured backend.
      return `${API_BASE_URL}/${picture.replace(/^\/+/, "")}`;
    }

    return `https://ui-avatars.com/api/?name=${encodeURIComponent(
      `${friend.first_name} ${friend.last_name}`
    )}&background=dc2626&color=ffffff&bold=true`;
  };

  // =====================================================
  // HANDLE UNAUTHORIZED USER
  // =====================================================

  const handleUnauthorized = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("access_token");
    navigate("/login", { replace: true });
  };

  // =====================================================
  // LOAD FRIENDS
  // =====================================================

  const loadFriends = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.get("/friends/my-friends");

      console.log("Friends API response:", response.data);

      if (Array.isArray(response.data)) {
        setFriends(response.data);
        return;
      }

      if (
        response.data &&
        Array.isArray(response.data.friends)
      ) {
        setFriends(response.data.friends);
        return;
      }

      console.warn("Unexpected friends response:", response.data);
      setFriends([]);
    } catch (error: any) {
      console.error("Failed to load friends:", error);

      if (error.response?.status === 401) {
        handleUnauthorized();
        return;
      }

      if (error.response?.status === 404) {
        setError(
          "The friends endpoint was not found. Please check that the friends router is registered in the backend."
        );
        return;
      }

      if (error.response?.status >= 500) {
        setError(
          "The server encountered an error while loading your friends."
        );
        return;
      }

      setError("Unable to load your friends. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  // =====================================================
  // INITIAL LOAD
  // =====================================================

  useEffect(() => {
    void loadFriends();
  }, [loadFriends]);

  // =====================================================
  // NAVIGATION
  // =====================================================

  const openChat = (friendId: number) => {
    navigate(`/chat/${friendId}`);
  };

  const viewProfile = (friendId: number) => {
    navigate(`/profile/${friendId}`);
  };

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <MainLayout>
      <div className="bg-white rounded-2xl shadow-md overflow-hidden">
        {/* HEADER */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                Friends
              </h1>
              <p className="text-gray-500 mt-1">
                People you are connected with
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate("/friend-requests")}
              className="bg-red-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-red-700 active:bg-red-800 transition"
            >
              Friend Requests
            </button>
          </div>
        </div>

        {/* CONTENT */}
        <div className="p-6">
          {/* LOADING */}
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <div className="text-5xl mb-4">👥</div>
                <p className="text-gray-500">
                  Loading your friends...
                </p>
              </div>
            </div>
          )}

          {/* ERROR */}
          {!loading && error && (
            <div className="text-center py-12">
              <div className="text-5xl mb-4">⚠️</div>
              <h2 className="text-lg font-semibold text-gray-700">
                Something went wrong
              </h2>
              <p className="text-gray-500 mt-2 max-w-lg mx-auto">
                {error}
              </p>
              <button
                type="button"
                onClick={() => void loadFriends()}
                className="mt-5 bg-red-600 text-white px-5 py-2 rounded-xl font-semibold hover:bg-red-700 active:bg-red-800 transition"
              >
                Try Again
              </button>
            </div>
          )}

          {/* EMPTY */}
          {!loading && !error && friends.length === 0 && (
            <div className="text-center py-16">
              <div className="text-6xl mb-5">👥</div>
              <h2 className="text-xl font-bold text-gray-700">
                No friends yet
              </h2>
              <p className="text-gray-500 mt-2">
                Start connecting with people on RiseTogether.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => navigate("/search")}
                  className="w-full sm:w-auto bg-red-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-red-700 active:bg-red-800 transition"
                >
                  Find People
                </button>

                <button
                  type="button"
                  onClick={() => navigate("/friend-requests")}
                  className="w-full sm:w-auto border border-gray-300 text-gray-700 px-5 py-2.5 rounded-xl font-semibold hover:bg-gray-50 transition"
                >
                  Friend Requests
                </button>
              </div>
            </div>
          )}

          {/* FRIEND LIST */}
          {!loading && !error && friends.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {friends.map((friend) => (
                <div
                  key={friend.id}
                  className="border border-gray-200 rounded-2xl p-4 hover:shadow-md transition"
                >
                  {/* USER INFORMATION */}
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => viewProfile(friend.id)}
                      className="relative flex-shrink-0"
                      aria-label={`View ${friend.first_name}'s profile`}
                    >
                      <img
                        src={getProfileImage(friend)}
                        alt={`${friend.first_name} ${friend.last_name}`}
                        className="w-14 h-14 rounded-full object-cover border border-gray-200"
                        onError={(event) => {
                          event.currentTarget.onerror = null;
                          event.currentTarget.src =
                            `https://ui-avatars.com/api/?name=${encodeURIComponent(
                              `${friend.first_name} ${friend.last_name}`
                            )}&background=dc2626&color=ffffff&bold=true`;
                        }}
                      />

                      {friend.online === true && (
                        <span
                          className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-white rounded-full"
                          title="Online"
                        />
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={() => viewProfile(friend.id)}
                        className="font-bold text-gray-800 hover:text-red-600 transition text-left truncate block max-w-full"
                      >
                        {friend.first_name} {friend.last_name}
                      </button>

                      {friend.email && (
                        <p className="text-sm text-gray-500 truncate mt-1">
                          {friend.email}
                        </p>
                      )}

                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            friend.online === true
                              ? "bg-green-500"
                              : "bg-gray-300"
                          }`}
                        />
                        <span className="text-xs text-gray-400">
                          {friend.online === true ? "Online" : "Friend"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ACTIONS */}
                  <div className="flex gap-2 mt-4">
                    <button
                      type="button"
                      onClick={() => openChat(friend.id)}
                      className="flex-1 bg-red-600 text-white py-2 rounded-xl font-semibold hover:bg-red-700 active:bg-red-800 transition"
                    >
                      💬 Message
                    </button>

                    <button
                      type="button"
                      onClick={() => viewProfile(friend.id)}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition"
                    >
                      Profile
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}

export default Friends;

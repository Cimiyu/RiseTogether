import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";

import api from "../api/axios";
import MainLayout from "../layout/MainLayout";
import { API_BASE_URL } from "../api/config";

interface UserResult {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  profile_picture: string | null;
}

interface PostResult {
  id: number;
  content: string;
  image_url: string | null;
  created_at: string;
  owner_id: number;
}

function Search() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [query, setQuery] = useState(
    searchParams.get("q") || ""
  );

  const [users, setUsers] = useState<UserResult[]>([]);
  const [posts, setPosts] = useState<PostResult[]>([]);

  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");

  // =====================================================
  // PERFORM SEARCH
  // =====================================================

  async function performSearch(searchQuery: string) {
    const cleanQuery = searchQuery.trim();

    if (!cleanQuery) {
      setUsers([]);
      setPosts([]);
      setSearched(false);
      setError("");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSearched(true);

      // Update URL
      setSearchParams({
        q: cleanQuery,
      });

      const [usersResponse, postsResponse] =
        await Promise.all([
          api.get<UserResult[]>("/search/users", {
            params: {
              q: cleanQuery,
            },
          }),

          api.get<PostResult[]>("/search/posts", {
            params: {
              q: cleanQuery,
            },
          }),
        ]);

      setUsers(usersResponse.data);
      setPosts(postsResponse.data);

    } catch (error: any) {
      console.error("Search error:", error);

      setUsers([]);
      setPosts([]);

      if (error.response?.data?.detail) {
        setError(error.response.data.detail);
      } else {
        setError("Failed to perform search. Please try again.");
      }

    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // LOAD SEARCH FROM URL
  // =====================================================

  useEffect(() => {
    const urlQuery = searchParams.get("q");

    if (urlQuery) {
      setQuery(urlQuery);
      performSearch(urlQuery);
    }
  }, []);

  // =====================================================
  // SEARCH
  // =====================================================

  function handleSearch() {
    performSearch(query);
  }

  function handleKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>
  ) {
    if (event.key === "Enter") {
      handleSearch();
    }
  }

  // =====================================================
  // PROFILE IMAGE
  // =====================================================

  function getProfileImage(user: UserResult) {
    if (user.profile_picture) {
      return `${API_BASE_URL}${user.profile_picture}`;
    }

    return `https://ui-avatars.com/api/?name=${encodeURIComponent(
      `${user.first_name} ${user.last_name}`
    )}&background=dc2626&color=ffffff&size=200`;
  }

  // =====================================================
  // POST IMAGE
  // =====================================================

  function getPostImage(imageUrl: string | null) {
    if (!imageUrl) {
      return "";
    }

    if (imageUrl.startsWith("http")) {
      return imageUrl;
    }

    return `${API_BASE_URL}${imageUrl}`;
  }

  return (
    <MainLayout>

      <div className="max-w-4xl mx-auto">

        {/* =================================================
            SEARCH HEADER
        ================================================== */}

        <div className="bg-white rounded-xl shadow-md p-6">

          <h1 className="text-2xl font-bold">
            🔎 Search RiseTogether
          </h1>

          <p className="text-gray-500 mt-1">
            Find users and posts.
          </p>

          <div className="flex gap-2 mt-5">

            <input
              type="text"
              value={query}
              onChange={(event) =>
                setQuery(event.target.value)
              }
              onKeyDown={handleKeyDown}
              placeholder="Search users, posts..."
              className="flex-1 border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500"
            />

            <button
              type="button"
              onClick={handleSearch}
              disabled={loading}
              className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium transition"
            >
              {loading ? "Searching..." : "Search"}
            </button>

          </div>

        </div>

        {/* =================================================
            ERROR
        ================================================== */}

        {error && (
          <div className="mt-6 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">
            {error}
          </div>
        )}

        {/* =================================================
            LOADING
        ================================================== */}

        {loading && (
          <div className="mt-6 bg-white rounded-xl shadow-md p-8 text-center">

            <div className="text-3xl mb-3">
              🔎
            </div>

            <p className="text-gray-600">
              Searching RiseTogether...
            </p>

          </div>
        )}

        {/* =================================================
            RESULTS
        ================================================== */}

        {searched && !loading && !error && (

          <div className="mt-6 space-y-6">

            {/* =================================================
                USERS
            ================================================== */}

            <div className="bg-white rounded-xl shadow-md p-6">

              <div className="flex items-center justify-between mb-4">

                <h2 className="text-xl font-bold">
                  👥 Users
                </h2>

                <span className="text-sm text-gray-500">
                  {users.length} result
                  {users.length !== 1 ? "s" : ""}
                </span>

              </div>

              {users.length === 0 ? (

                <div className="text-center py-8">

                  <div className="text-4xl mb-3">
                    👤
                  </div>

                  <p className="text-gray-500">
                    No users found.
                  </p>

                </div>

              ) : (

                <div className="space-y-3">

                  {users.map((user) => (

                    <div
                      key={user.id}
                      className="flex items-center justify-between border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition"
                    >

                      {/* USER INFORMATION */}

                      <div className="flex items-center min-w-0">

                        <img
                          src={getProfileImage(user)}
                          alt={`${user.first_name} ${user.last_name}`}
                          className="w-12 h-12 rounded-full object-cover border border-gray-200 flex-shrink-0"
                        />

                        <div className="ml-3 min-w-0">

                          <p className="font-semibold text-gray-800 truncate">

                            {user.first_name}{" "}
                            {user.last_name}

                          </p>

                          <p className="text-sm text-gray-500 truncate">

                            {user.email}

                          </p>

                        </div>

                      </div>

                      {/* VIEW PROFILE */}

                      <Link
                        to={`/profile/${user.id}`}
                        className="ml-3 flex-shrink-0 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition"
                      >
                        View
                      </Link>

                    </div>

                  ))}

                </div>

              )}

            </div>

            {/* =================================================
                POSTS
            ================================================== */}

            <div className="bg-white rounded-xl shadow-md p-6">

              <div className="flex items-center justify-between mb-4">

                <h2 className="text-xl font-bold">
                  📝 Posts
                </h2>

                <span className="text-sm text-gray-500">
                  {posts.length} result
                  {posts.length !== 1 ? "s" : ""}
                </span>

              </div>

              {posts.length === 0 ? (

                <div className="text-center py-8">

                  <div className="text-4xl mb-3">
                    📝
                  </div>

                  <p className="text-gray-500">
                    No posts found.
                  </p>

                </div>

              ) : (

                <div className="space-y-4">

                  {posts.map((post) => (

                    <div
                      key={post.id}
                      className="border border-gray-200 rounded-lg overflow-hidden"
                    >

                      {/* POST CONTENT */}

                      <div className="p-4">

                        <p className="text-gray-800 whitespace-pre-wrap">
                          {post.content}
                        </p>

                        <p className="text-sm text-gray-500 mt-3">
                          {new Date(
                            post.created_at
                          ).toLocaleString()}
                        </p>

                      </div>

                      {/* POST IMAGE */}

                      {post.image_url && (

                        <img
                          src={getPostImage(post.image_url)}
                          alt="Post"
                          className="w-full max-h-[400px] object-cover"
                        />

                      )}

                    </div>

                  ))}

                </div>

              )}

            </div>

          </div>

        )}

        {/* =================================================
            INITIAL STATE
        ================================================== */}

        {!searched && !loading && (

          <div className="mt-6 bg-white rounded-xl shadow-md p-10 text-center">

            <div className="text-5xl mb-4">
              🔎
            </div>

            <h2 className="text-xl font-bold text-gray-800">
              Search RiseTogether
            </h2>

            <p className="text-gray-500 mt-2">
              Search for people, universities, courses,
              or posts.
            </p>

          </div>

        )}

      </div>

    </MainLayout>
  );
}

export default Search;
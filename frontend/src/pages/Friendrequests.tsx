import { useEffect, useState } from "react";
import api from "../api/axios";
import MainLayout from "../layout/MainLayout";
import { API_BASE_URL } from "../api/config";

interface FriendRequest {
  request_id: number;
  sender_id: number;
  first_name: string;
  last_name: string;
  profile_picture: string | null;
  created_at: string;
}

function FriendRequests() {
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);

  // =====================================================
  // LOAD PENDING FRIEND REQUESTS
  // =====================================================

  async function loadRequests() {
    try {
      setLoading(true);

      const response = await api.get("/friends/pending");

      setRequests(response.data);
    } catch (error: any) {
      console.error(
        "Failed to load friend requests:",
        error
      );

      if (error.response?.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("token");

        window.location.href = "/login";
        return;
      }

      alert(
        error.response?.data?.detail ||
          "Unable to load friend requests."
      );
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // INITIAL LOAD
  // =====================================================

  useEffect(() => {
    loadRequests();
  }, []);

  // =====================================================
  // ACCEPT FRIEND REQUEST
  // =====================================================

  async function acceptRequest(requestId: number) {
    try {
      setProcessingId(requestId);

      await api.put(
        `/friends/accept/${requestId}`
      );

      // Reload from backend
      await loadRequests();

    } catch (error: any) {
      console.error(
        "Accept request error:",
        error
      );

      alert(
        error.response?.data?.detail ||
          "Unable to accept friend request."
      );
    } finally {
      setProcessingId(null);
    }
  }

  // =====================================================
  // REJECT FRIEND REQUEST
  // =====================================================

  async function rejectRequest(requestId: number) {
    try {
      setProcessingId(requestId);

      await api.put(
        `/friends/reject/${requestId}`
      );

      // Reload from backend
      await loadRequests();

    } catch (error: any) {
      console.error(
        "Reject request error:",
        error
      );

      alert(
        error.response?.data?.detail ||
          "Unable to reject friend request."
      );
    } finally {
      setProcessingId(null);
    }
  }

  // =====================================================
  // PROFILE IMAGE
  // =====================================================

  function getProfileImage(
    request: FriendRequest
  ) {
    if (request.profile_picture) {
      return `${API_BASE_URL}${request.profile_picture}`;
    }

    return `https://ui-avatars.com/api/?name=${encodeURIComponent(
      `${request.first_name} ${request.last_name}`
    )}&background=dc2626&color=ffffff`;
  }

  // =====================================================
  // FORMAT DATE
  // =====================================================

  function formatDate(date: string) {
    const createdDate = new Date(date);
    const now = new Date();

    const difference =
      now.getTime() -
      createdDate.getTime();

    const minutes = Math.floor(
      difference / (1000 * 60)
    );

    if (minutes < 1) {
      return "Just now";
    }

    if (minutes < 60) {
      return `${minutes} minute${
        minutes === 1 ? "" : "s"
      } ago`;
    }

    const hours = Math.floor(
      minutes / 60
    );

    if (hours < 24) {
      return `${hours} hour${
        hours === 1 ? "" : "s"
      } ago`;
    }

    const days = Math.floor(
      hours / 24
    );

    if (days < 7) {
      return `${days} day${
        days === 1 ? "" : "s"
      } ago`;
    }

    return createdDate.toLocaleDateString();
  }

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <MainLayout>

      <div className="max-w-3xl mx-auto">

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="bg-white rounded-2xl shadow-md p-6 mb-6">

          <div className="flex items-center justify-between">

            <div>

              <h1 className="text-2xl font-bold text-gray-800">
                🤝 Friend Requests
              </h1>

              <p className="text-gray-500 mt-1">
                Manage people who want to connect
                with you.
              </p>

            </div>

            {/* REQUEST COUNT */}

            <div className="flex items-center justify-center min-w-10 h-10 px-3 bg-red-100 text-red-600 rounded-full font-bold">

              {requests.length}

            </div>

          </div>

        </div>

        {/* =================================================
            LOADING
        ================================================= */}

        {loading && (

          <div className="bg-white rounded-2xl shadow-md p-10 text-center">

            <div className="text-4xl mb-3">
              ⏳
            </div>

            <p className="text-gray-500">
              Loading friend requests...
            </p>

          </div>

        )}

        {/* =================================================
            EMPTY
        ================================================= */}

        {!loading &&
          requests.length === 0 && (

            <div className="bg-white rounded-2xl shadow-md p-10 text-center">

              <div className="text-6xl mb-4">
                🤝
              </div>

              <h2 className="text-xl font-bold text-gray-800">
                No friend requests
              </h2>

              <p className="text-gray-500 mt-2">
                You don't have any pending friend
                requests right now.
              </p>

              <button
                onClick={loadRequests}
                className="mt-6 bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-medium transition"
              >
                🔄 Refresh
              </button>

            </div>

          )}

        {/* =================================================
            REQUEST LIST
        ================================================= */}

        {!loading &&
          requests.length > 0 && (

            <div className="space-y-4">

              {requests.map((request) => (

                <div
                  key={request.request_id}
                  className="bg-white rounded-2xl shadow-md p-5 hover:shadow-lg transition"
                >

                  {/* USER */}

                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">

                    {/* PROFILE */}

                    <img
                      src={getProfileImage(request)}
                      alt={`${request.first_name} ${request.last_name}`}
                      className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
                    />

                    {/* INFORMATION */}

                    <div className="flex-1">

                      <h2 className="font-bold text-lg text-gray-800">

                        {request.first_name}{" "}
                        {request.last_name}

                      </h2>

                      <p className="text-sm text-gray-500 mt-1">

                        👤 Wants to be your friend

                      </p>

                      <p className="text-xs text-gray-400 mt-1">

                        {formatDate(
                          request.created_at
                        )}

                      </p>

                    </div>

                    {/* =================================================
                        ACTION BUTTONS
                    ================================================= */}

                    <div className="flex gap-2 w-full sm:w-auto">

                      {/* ACCEPT */}

                      <button
                        onClick={() =>
                          acceptRequest(
                            request.request_id
                          )
                        }
                        disabled={
                          processingId ===
                          request.request_id
                        }
                        className="flex-1 sm:flex-none px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white rounded-lg font-semibold transition"
                      >

                        {processingId ===
                        request.request_id
                          ? "..."
                          : "✓ Accept"}

                      </button>

                      {/* REJECT */}

                      <button
                        onClick={() =>
                          rejectRequest(
                            request.request_id
                          )
                        }
                        disabled={
                          processingId ===
                          request.request_id
                        }
                        className="flex-1 sm:flex-none px-5 py-2.5 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 text-gray-800 rounded-lg font-semibold transition"
                      >

                        {processingId ===
                        request.request_id
                          ? "..."
                          : "✕ Reject"}

                      </button>

                    </div>

                  </div>

                </div>

              ))}

            </div>

          )}

      </div>

    </MainLayout>
  );
}

export default FriendRequests;
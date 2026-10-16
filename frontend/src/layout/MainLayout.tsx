import type { ReactNode, FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";

import api from "../api/axios";

interface MainLayoutProps {
  children: ReactNode;
}

interface NotificationCountResponse {
  unread_count?: number;
}

function MainLayout({ children }: MainLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();

  // =====================================================
  // STATE
  // =====================================================

  const [searchQuery, setSearchQuery] = useState("");

  const [unreadNotifications, setUnreadNotifications] =
    useState(0);

  const [pendingFriendRequests, setPendingFriendRequests] =
    useState(0);

  const [loadingCounts, setLoadingCounts] =
    useState(false);

  // =====================================================
  // AUTH HELPERS
  // =====================================================

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("access_token");

    navigate("/login", {
      replace: true,
    });
  }, [navigate]);

  // =====================================================
  // LOAD NOTIFICATION COUNT
  // =====================================================

  const loadNotificationCount = useCallback(async () => {
    try {
      const response =
        await api.get<NotificationCountResponse>(
          "/notifications/unread-count"
        );

      const count = Number(
        response.data?.unread_count ?? 0
      );

      setUnreadNotifications(
        Number.isFinite(count) && count > 0
          ? count
          : 0
      );
    } catch (error: any) {
      console.error(
        "Failed to load notification count:",
        error
      );

      if (error.response?.status === 401) {
        logout();
      }
    }
  }, [logout]);

  // =====================================================
  // LOAD FRIEND REQUEST COUNT
  // =====================================================

  const loadFriendRequestCount = useCallback(async () => {
    try {
      const response =
        await api.get("/friends/pending");

      if (Array.isArray(response.data)) {
        setPendingFriendRequests(
          response.data.length
        );
      } else {
        setPendingFriendRequests(0);
      }
    } catch (error: any) {
      console.error(
        "Failed to load friend request count:",
        error
      );

      if (error.response?.status === 401) {
        logout();
      }
    }
  }, [logout]);

  // =====================================================
  // LOAD ALL COUNTS
  // =====================================================

  const loadCounts = useCallback(async () => {
    if (loadingCounts) {
      return;
    }

    setLoadingCounts(true);

    try {
      await Promise.all([
        loadNotificationCount(),
        loadFriendRequestCount(),
      ]);
    } finally {
      setLoadingCounts(false);
    }
  }, [
    loadingCounts,
    loadNotificationCount,
    loadFriendRequestCount,
  ]);

  // =====================================================
  // INITIAL COUNT LOAD + POLLING
  // =====================================================

  useEffect(() => {
    loadCounts();

    const interval = window.setInterval(() => {
      loadCounts();
    }, 10000);

    return () => {
      window.clearInterval(interval);
    };
  }, [loadCounts]);

  // =====================================================
  // REFRESH COUNTS WHEN ROUTE CHANGES
  // =====================================================

  useEffect(() => {
    loadNotificationCount();
    loadFriendRequestCount();
  }, [
    location.pathname,
    loadNotificationCount,
    loadFriendRequestCount,
  ]);

  // =====================================================
  // SEARCH
  // =====================================================

  function handleSearch(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const query =
      searchQuery.trim();

    if (!query) {
      navigate("/search");
      return;
    }

    navigate(
      `/search?q=${encodeURIComponent(query)}`
    );
  }

  // =====================================================
  // MENU ITEM
  // =====================================================

  function menuItem(
    path: string,
    icon: string,
    text: string,
    badge?: number
  ) {
    const isSearchRoute =
      path === "/search";

    const isActive =
      location.pathname === path ||
      (
        isSearchRoute &&
        location.pathname.startsWith("/search")
      );

    const hasBadge =
      badge !== undefined &&
      badge > 0;

    return (
      <Link
        to={path}
        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
          isActive
            ? "bg-red-600 text-white shadow-md"
            : "text-gray-700 hover:bg-gray-100"
        }`}
      >
        {/* ICON */}

        <span
          className="text-xl w-6 text-center"
          aria-hidden="true"
        >
          {icon}
        </span>

        {/* TEXT */}

        <span className="font-medium flex-1">
          {text}
        </span>

        {/* BADGE */}

        {hasBadge && (
          <span
            className={`min-w-[24px] h-6 px-2 flex items-center justify-center rounded-full text-xs font-bold ${
              isActive
                ? "bg-white text-red-600"
                : "bg-red-600 text-white"
            }`}
          >
            {badge! > 99
              ? "99+"
              : badge}
          </span>
        )}
      </Link>
    );
  }

  // =====================================================
  // LOGGED-IN NAVIGATION
  // =====================================================

  return (
    <div className="min-h-screen bg-gray-100">

      {/* =================================================
          TOP NAVBAR
      ================================================= */}

      <header className="sticky top-0 z-50 bg-red-600 text-white shadow-lg">

        <div className="max-w-7xl mx-auto flex items-center justify-between gap-6 px-6 py-4">

          {/* =================================================
              LOGO
          ================================================= */}

          <Link
            to="/dashboard"
            className="text-2xl md:text-3xl font-extrabold tracking-wide whitespace-nowrap"
          >
            RiseTogether
          </Link>

          {/* =================================================
              SEARCH
          ================================================= */}

          <form
            onSubmit={handleSearch}
            className="hidden md:block flex-1 max-w-xl"
          >
            <div className="relative">

              <span
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"
                aria-hidden="true"
              >
                🔎
              </span>

              <input
                type="search"
                value={searchQuery}
                onChange={(event) =>
                  setSearchQuery(
                    event.target.value
                  )
                }
                placeholder="Search users, posts..."
                aria-label="Search users and posts"
                className="w-full rounded-full bg-white text-gray-900 pl-11 pr-5 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-300"
              />

            </div>
          </form>

          {/* =================================================
              RIGHT NAVIGATION
          ================================================= */}

          <div className="flex items-center gap-2 md:gap-3">

            {/* NOTIFICATIONS */}

            <Link
              to="/notifications"
              title="Notifications"
              aria-label="Notifications"
              className="relative flex items-center justify-center w-11 h-11 rounded-full hover:bg-red-700 transition"
            >
              <span
                className="text-2xl"
                aria-hidden="true"
              >
                🔔
              </span>

              {unreadNotifications > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 flex items-center justify-center bg-white text-red-600 text-xs font-bold rounded-full border-2 border-red-600">
                  {unreadNotifications > 99
                    ? "99+"
                    : unreadNotifications}
                </span>
              )}
            </Link>

            {/* FRIEND REQUESTS */}

            <Link
              to="/friend-requests"
              title="Friend Requests"
              aria-label="Friend Requests"
              className="relative flex items-center justify-center w-11 h-11 rounded-full hover:bg-red-700 transition"
            >
              <span
                className="text-2xl"
                aria-hidden="true"
              >
                🤝
              </span>

              {pendingFriendRequests > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 flex items-center justify-center bg-white text-red-600 text-xs font-bold rounded-full border-2 border-red-600">
                  {pendingFriendRequests > 99
                    ? "99+"
                    : pendingFriendRequests}
                </span>
              )}
            </Link>

            {/* LOGOUT */}

            <button
              type="button"
              onClick={logout}
              className="hidden sm:block bg-white text-red-600 font-semibold px-5 py-2 rounded-full hover:bg-gray-100 transition"
            >
              Logout
            </button>

            {/* MOBILE LOGOUT */}

            <button
              type="button"
              onClick={logout}
              title="Logout"
              aria-label="Logout"
              className="sm:hidden flex items-center justify-center w-11 h-11 bg-white text-red-600 rounded-full hover:bg-gray-100 transition"
            >
              ↪
            </button>

          </div>

        </div>

      </header>

      {/* =================================================
          MOBILE SEARCH
      ================================================= */}

      <div className="md:hidden bg-white border-b px-4 py-3">

        <form
          onSubmit={handleSearch}
          className="w-full"
        >
          <div className="relative">

            <span
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"
              aria-hidden="true"
            >
              🔎
            </span>

            <input
              type="search"
              value={searchQuery}
              onChange={(event) =>
                setSearchQuery(
                  event.target.value
                )
              }
              placeholder="Search users, posts..."
              className="w-full border border-gray-300 rounded-full text-gray-900 pl-11 pr-5 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-500"
            />

          </div>
        </form>

      </div>

      {/* =================================================
          MAIN PAGE GRID
      ================================================= */}

      <div className="max-w-7xl mx-auto grid grid-cols-12 gap-6 p-5">

        {/* =================================================
            LEFT SIDEBAR
        ================================================= */}

        <aside className="hidden lg:block col-span-3">

          <div className="sticky top-24 bg-white rounded-2xl shadow-md p-5">

            <h2 className="font-bold text-lg mb-5 text-gray-800">
              Navigation
            </h2>

            <nav
              className="space-y-2"
              aria-label="Main navigation"
            >

              {/* HOME */}

              {menuItem(
                "/dashboard",
                "🏠",
                "Home"
              )}

              {/* PROFILE */}

              {menuItem(
                "/profile",
                "👤",
                "Profile"
              )}

              {/* SEARCH */}

              {menuItem(
                "/search",
                "🔎",
                "Search"
              )}

              {/* MESSAGES */}

              {menuItem(
                "/messages",
                "💬",
                "Messages"
              )}

              {/* FRIENDS */}

              {menuItem(
                "/friends",
                "👥",
                "Friends"
              )}

              {/* FRIEND REQUESTS */}

              {menuItem(
                "/friend-requests",
                "🤝",
                "Friend Requests",
                pendingFriendRequests
              )}

              {/* NOTIFICATIONS */}

              {menuItem(
                "/notifications",
                "🔔",
                "Notifications",
                unreadNotifications
              )}

              {/* SETTINGS */}

              {menuItem(
                "/settings",
                "⚙️",
                "Settings"
              )}

            </nav>

          </div>

        </aside>

        {/* =================================================
            MAIN CONTENT
        ================================================= */}

        <main className="col-span-12 lg:col-span-6 min-w-0">
          {children}
        </main>

        {/* =================================================
            RIGHT SIDEBAR
        ================================================= */}

        <aside className="hidden lg:block col-span-3">

          <div className="sticky top-24 space-y-6">

            {/* =================================================
                PEOPLE YOU MAY KNOW
            ================================================= */}

            <div className="bg-white rounded-2xl shadow-md p-5">

              <div className="flex items-center justify-between mb-4">

                <h2 className="font-bold text-lg text-gray-800">
                  People You May Know
                </h2>

              </div>

              {[
                "Alice",
                "Brian",
                "Cynthia",
                "Daniel",
                "Grace",
              ].map((person) => (

                <div
                  key={person}
                  className="flex items-center justify-between gap-3 mb-4 last:mb-0"
                >

                  {/* PERSON */}

                  <div className="flex items-center gap-3 min-w-0">

                    <img
                      src={`https://ui-avatars.com/api/?name=${encodeURIComponent(
                        person
                      )}&background=dc2626&color=ffffff`}
                      alt={person}
                      className="w-10 h-10 rounded-full flex-shrink-0"
                    />

                    <span className="font-medium text-gray-800 truncate">
                      {person}
                    </span>

                  </div>

                  {/* FOLLOW */}

                  <button
                    type="button"
                    className="flex-shrink-0 bg-red-600 text-white px-3 py-1 rounded-lg text-sm hover:bg-red-700 transition"
                  >
                    Follow
                  </button>

                </div>

              ))}

            </div>

            {/* =================================================
                QUICK LINKS
            ================================================= */}

            <div className="bg-white rounded-2xl shadow-md p-5">

              <h2 className="font-bold text-lg mb-4 text-gray-800">
                Quick Links
              </h2>

              <div className="space-y-3 text-gray-600">

                <button
                  type="button"
                  onClick={() =>
                    navigate("/photos")
                  }
                  className="w-full text-left hover:text-red-600 transition"
                >
                  📸 Photos
                </button>

                <button
                  type="button"
                  onClick={() =>
                    navigate("/videos")
                  }
                  className="w-full text-left hover:text-red-600 transition"
                >
                  🎥 Videos
                </button>

                <button
                  type="button"
                  onClick={() =>
                    navigate("/saved")
                  }
                  className="w-full text-left hover:text-red-600 transition"
                >
                  📚 Saved Posts
                </button>

                <button
                  type="button"
                  onClick={() =>
                    navigate("/favorites")
                  }
                  className="w-full text-left hover:text-red-600 transition"
                >
                  ⭐ Favorites
                </button>

                <button
                  type="button"
                  onClick={() =>
                    navigate("/events")
                  }
                  className="w-full text-left hover:text-red-600 transition"
                >
                  📅 Events
                </button>

              </div>

            </div>

          </div>

        </aside>

      </div>

      {/* =================================================
          FOOTER
      ================================================= */}

      <footer className="text-center text-gray-500 text-sm py-6 px-4">

        © {new Date().getFullYear()} RiseTogether
        {" "}• Built by Charles using React & FastAPI

      </footer>

    </div>
  );
}

export default MainLayout;
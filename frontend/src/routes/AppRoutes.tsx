import { Navigate, Routes, Route } from "react-router-dom";

import Home from "../pages/Home";
import Login from "../pages/Login";
import Register from "../pages/Register";
import Dashboard from "../pages/Dashboard";
import Notifications from "../pages/Notifications";
import Profile from "../pages/Profile";
import Search from "../pages/Search";
import Settings from "../pages/Settings";
import FriendRequests from "../pages/Friendrequests";
import Friends from "../pages/Friends";
import Messages from "../pages/Messages";
import Chat from "../pages/Chat";

import ProtectedRoute from "../components/ProtectedRoute";

function AppRoutes() {
  return (
    <Routes>

      {/* =====================================================
          PUBLIC ROUTES
      ===================================================== */}

      <Route
        path="/"
        element={<Home />}
      />

      <Route
        path="/login"
        element={<Login />}
      />

      <Route
        path="/register"
        element={<Register />}
      />


      {/* =====================================================
          PROTECTED ROUTES
      ===================================================== */}

      {/* DASHBOARD */}

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />


      {/* =====================================================
          NOTIFICATIONS
      ===================================================== */}

      <Route
        path="/notifications"
        element={
          <ProtectedRoute>
            <Notifications />
          </ProtectedRoute>
        }
      />


      {/* =====================================================
          PROFILE
      ===================================================== */}

      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />

      <Route
        path="/profile/:userId"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />


      {/* =====================================================
          SEARCH
      ===================================================== */}

      <Route
        path="/search"
        element={
          <ProtectedRoute>
            <Search />
          </ProtectedRoute>
        }
      />


      {/* =====================================================
          FRIENDS
      ===================================================== */}

      <Route
        path="/friends"
        element={
          <ProtectedRoute>
            <Friends />
          </ProtectedRoute>
        }
      />


      {/* =====================================================
          FRIEND REQUESTS
      ===================================================== */}

      <Route
        path="/friend-requests"
        element={
          <ProtectedRoute>
            <FriendRequests />
          </ProtectedRoute>
        }
      />


      {/* =====================================================
          MESSAGES
      ===================================================== */}

      <Route
        path="/messages"
        element={
          <ProtectedRoute>
            <Messages />
          </ProtectedRoute>
        }
      />


      {/* =====================================================
          CHAT WITH SPECIFIC USER
      ===================================================== */}

      <Route
        path="/chat/:userId"
        element={
          <ProtectedRoute>
            <Chat />
          </ProtectedRoute>
        }
      />


      {/* =====================================================
          SETTINGS
      ===================================================== */}

      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        }
      />


      {/* =====================================================
          FALLBACK
      ===================================================== */}

      <Route
        path="*"
        element={
          <Navigate
            to="/dashboard"
            replace
          />
        }
      />

    </Routes>
  );
}

export default AppRoutes;
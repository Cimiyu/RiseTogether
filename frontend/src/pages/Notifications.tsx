import { useEffect, useState } from "react";
import api from "../api/axios";
import MainLayout from "../layout/MainLayout";

interface Notification {
  id: number;
  message: string;
  notification_type: string;
  is_read: boolean;
  created_at: string;
}

function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingRead, setMarkingRead] = useState(false);

  // =====================================================
  // LOAD NOTIFICATIONS
  // =====================================================

  async function loadNotifications() {
    try {
      const response = await api.get("/notifications/");

      setNotifications(response.data);
    } catch (error) {
      console.error("Failed to load notifications:", error);
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // MARK ALL NOTIFICATIONS AS READ
  // =====================================================

  async function markAllAsRead() {
    try {
      setMarkingRead(true);

      await api.put("/notifications/read-all");

      // Immediately update the UI
      setNotifications((previousNotifications) =>
        previousNotifications.map((notification) => ({
          ...notification,
          is_read: true,
        }))
      );

      // Notify Navbar / Sidebar
      window.dispatchEvent(new Event("notificationsUpdated"));
    } catch (error) {
      console.error(
        "Failed to mark notifications as read:",
        error
      );
    } finally {
      setMarkingRead(false);
    }
  }

  // =====================================================
  // MARK ONE NOTIFICATION AS READ
  // =====================================================

  async function markAsRead(notificationId: number) {
    try {
      await api.put(
        `/notifications/${notificationId}/read`
      );

      setNotifications((previousNotifications) =>
        previousNotifications.map((notification) =>
          notification.id === notificationId
            ? {
                ...notification,
                is_read: true,
              }
            : notification
        )
      );

      // Notify Navbar / Sidebar
      window.dispatchEvent(new Event("notificationsUpdated"));
    } catch (error) {
      console.error(
        "Failed to mark notification as read:",
        error
      );
    }
  }

  // =====================================================
  // LOAD NOTIFICATIONS WHEN PAGE OPENS
  // =====================================================

  useEffect(() => {
    loadNotifications();
  }, []);

  // =====================================================
  // MARK ALL UNREAD NOTIFICATIONS AS READ
  // =====================================================

  useEffect(() => {
    if (
      !loading &&
      notifications.length > 0 &&
      notifications.some(
        (notification) => !notification.is_read
      )
    ) {
      markAllAsRead();
    }
  }, [loading, notifications]);

  // =====================================================
  // UI
  // =====================================================

  return (
    <MainLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">
          Notifications
        </h1>

        {notifications.some(
          (notification) => !notification.is_read
        ) && (
          <button
            onClick={markAllAsRead}
            disabled={markingRead}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {markingRead
              ? "Marking..."
              : "Mark all as read"}
          </button>
        )}
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : notifications.length === 0 ? (
        <div className="bg-white rounded-lg p-6 shadow text-gray-500">
          No notifications yet.
        </div>
      ) : (
        <div className="space-y-4">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              onClick={() => {
                if (!notification.is_read) {
                  markAsRead(notification.id);
                }
              }}
              className={`p-5 rounded-lg shadow cursor-pointer transition ${
                notification.is_read
                  ? "bg-white"
                  : "bg-red-50 border-l-4 border-red-500"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold">
                    {notification.message}
                  </h3>

                  <p className="text-sm text-gray-500 mt-2">
                    {new Date(
                      notification.created_at
                    ).toLocaleString()}
                  </p>
                </div>

                {!notification.is_read && (
                  <span className="text-xs font-semibold bg-red-500 text-white px-2 py-1 rounded-full">
                    NEW
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </MainLayout>
  );
}

export default Notifications;
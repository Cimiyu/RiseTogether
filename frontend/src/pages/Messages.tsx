
import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import api from "../api/axios";
import MainLayout from "../layout/MainLayout";
import { API_BASE_URL } from "../api/config";

interface Friend {
  id: number;
  first_name: string;
  last_name: string;
  profile_picture: string | null;
  online?: boolean;
}

interface Message {
  id: number;
  sender_id: number;
  receiver_id: number;
  content: string;
  is_read: boolean;
  created_at: string;
}

interface WebSocketMessage {
  type: "connected" | "message" | "error";
  id?: number;
  sender_id?: number;
  receiver_id?: number;
  content?: string;
  is_read?: boolean;
  created_at?: string;
  user_id?: number;
  message?: string;
}

function Messages() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [socketError, setSocketError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const shouldReconnectRef = useRef(true);
  const currentUserIdRef = useRef<number | null>(null);
  const selectedFriendRef = useRef<Friend | null>(null);

  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  useEffect(() => {
    selectedFriendRef.current = selectedFriend;
  }, [selectedFriend]);

  // =========================================================
  // LOAD CURRENT USER
  // =========================================================

  const loadCurrentUser = useCallback(async () => {
    try {
      const response = await api.get("/users/me");
      const userId = Number(response.data.id);

      setCurrentUserId(userId);
      currentUserIdRef.current = userId;

      return userId;
    } catch (error) {
      console.error("Failed to load current user:", error);
      return null;
    }
  }, []);

  // =========================================================
  // LOAD FRIENDS
  // =========================================================

  const loadFriends = useCallback(async () => {
    try {
      setLoadingFriends(true);

      const response = await api.get("/friends/my-friends");

      if (Array.isArray(response.data)) {
        setFriends(response.data);
      } else if (Array.isArray(response.data?.friends)) {
        setFriends(response.data.friends);
      } else {
        console.error("Unexpected friends response:", response.data);
        setFriends([]);
      }
    } catch (error: any) {
      console.error("Failed to load friends:", error);
      setFriends([]);

      if (error.response?.data?.detail) {
        console.error("Backend error:", error.response.data.detail);
      }
    } finally {
      setLoadingFriends(false);
    }
  }, []);

  // =========================================================
  // LOAD CONVERSATION
  // =========================================================

  const loadMessages = useCallback(async (friend: Friend) => {
    try {
      setSelectedFriend(friend);
      selectedFriendRef.current = friend;
      setMessages([]);
      setLoadingMessages(true);

      const response = await api.get(`/messages/${friend.id}`);

      if (Array.isArray(response.data)) {
        setMessages(response.data);
      } else {
        setMessages([]);
      }

      try {
        await api.put(`/messages/${friend.id}/read`);
      } catch (readError) {
        console.warn("Unable to mark messages as read:", readError);
      }
    } catch (error: any) {
      console.error("Failed to load messages:", error);
      setMessages([]);

      if (error.response?.data?.detail) {
        alert(error.response.data.detail);
      } else {
        alert("Unable to load this conversation.");
      }
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  // =========================================================
  // HANDLE WEBSOCKET MESSAGE
  // =========================================================

  const handleWebSocketMessage = useCallback((data: WebSocketMessage) => {
    if (data.type === "connected") {
      setSocketConnected(true);
      setSocketError(null);
      return;
    }

    if (data.type === "error") {
      setSocketError(data.message || "WebSocket error.");
      setSending(false);
      return;
    }

    if (
      data.type !== "message" ||
      typeof data.id !== "number" ||
      typeof data.sender_id !== "number" ||
      typeof data.receiver_id !== "number" ||
      typeof data.content !== "string" ||
      typeof data.created_at !== "string"
    ) {
      return;
    }

    const incomingMessage: Message = {
      id: data.id,
      sender_id: data.sender_id,
      receiver_id: data.receiver_id,
      content: data.content,
      is_read: data.is_read ?? false,
      created_at: data.created_at,
    };

    const userId = currentUserIdRef.current;
    const friend = selectedFriendRef.current;

    if (userId !== null && friend !== null) {
      const belongsToConversation =
        (incomingMessage.sender_id === userId &&
          incomingMessage.receiver_id === friend.id) ||
        (incomingMessage.sender_id === friend.id &&
          incomingMessage.receiver_id === userId);

      if (belongsToConversation) {
        setMessages((previousMessages) => {
          if (previousMessages.some((message) => message.id === incomingMessage.id)) {
            return previousMessages;
          }

          return [...previousMessages, incomingMessage];
        });
      }
    }

    if (userId !== null && incomingMessage.sender_id === userId) {
      setText("");
      setSending(false);
    }

    if (
      userId !== null &&
      incomingMessage.receiver_id === userId &&
      friend !== null &&
      incomingMessage.sender_id === friend.id
    ) {
      api.put(`/messages/${friend.id}/read`).catch((error) => {
        console.warn("Unable to mark real-time message as read:", error);
      });
    }
  }, []);

  // =========================================================
  // CONNECT WEBSOCKET
  // =========================================================

  const connectWebSocket = useCallback((userId: number) => {
    if (!userId) {
      console.error("Cannot connect WebSocket without user ID.");
      return;
    }

    if (
      socketRef.current &&
      (socketRef.current.readyState === WebSocket.OPEN ||
        socketRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    // Use wss:// for HTTPS deployment and ws:// locally.
    const websocketBaseUrl = API_BASE_URL
      .replace(/^https:/i, "wss:")
      .replace(/^http:/i, "ws:");

    const socketUrl =
      `${websocketBaseUrl}/chat/ws/${userId}`;

    console.log("Connecting to WebSocket:", socketUrl);

    const socket = new WebSocket(socketUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      console.log("WebSocket connected successfully.");
      setSocketConnected(true);
      setSocketError(null);
      reconnectAttemptsRef.current = 0;
    };

    socket.onmessage = (event) => {
      try {
        const data: WebSocketMessage = JSON.parse(event.data);
        handleWebSocketMessage(data);
      } catch (error) {
        console.error("Invalid WebSocket data:", error);
      }
    };

    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
      setSocketConnected(false);
      setSocketError("Real-time connection error.");
    };

    socket.onclose = (event) => {
      console.log("WebSocket disconnected.", event.code, event.reason);
      setSocketConnected(false);

      if (socketRef.current === socket) {
        socketRef.current = null;
      }

      if (!shouldReconnectRef.current) {
        return;
      }

      const attempts = reconnectAttemptsRef.current;
      const delay = Math.min(1000 * Math.pow(2, attempts), 10000);

      reconnectAttemptsRef.current = attempts + 1;

      reconnectTimerRef.current = setTimeout(() => {
        connectWebSocket(userId);
      }, delay);
    };
  }, [handleWebSocketMessage]);

  // =========================================================
  // INITIALIZATION
  // =========================================================

  useEffect(() => {
    let mounted = true;
    shouldReconnectRef.current = true;

    async function initialize() {
      const userId = await loadCurrentUser();

      if (!mounted) return;

      await loadFriends();

      if (!mounted) return;

      if (userId) {
        connectWebSocket(userId);
      } else {
        setSocketError("Unable to identify the current user.");
      }
    }

    void initialize();

    return () => {
      mounted = false;
      shouldReconnectRef.current = false;

      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }

      setSocketConnected(false);
    };
  }, [loadCurrentUser, loadFriends, connectWebSocket]);

  // =========================================================
  // AUTO SCROLL
  // =========================================================

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // =========================================================
  // SEND MESSAGE
  // =========================================================

  function sendMessage() {
    const messageText = text.trim();

    if (!messageText || !selectedFriend) return;

    if (
      !socketRef.current ||
      socketRef.current.readyState !== WebSocket.OPEN
    ) {
      alert("Real-time connection is not ready. Please wait a moment and try again.");
      return;
    }

    if (messageText.length > 5000) {
      alert("Message cannot exceed 5000 characters.");
      return;
    }

    try {
      setSending(true);
      setSocketError(null);

      socketRef.current.send(
        JSON.stringify({
          receiver_id: selectedFriend.id,
          content: messageText,
        })
      );
    } catch (error) {
      console.error("Failed to send WebSocket message:", error);
      setSending(false);
      alert("Unable to send message.");
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      if (!sending) sendMessage();
    }
  }

  // =========================================================
  // PROFILE IMAGES
  // =========================================================

  function getProfileImage(friend: Friend): string {
    const picture = friend.profile_picture?.trim();

    if (picture) {
      if (/^https?:\/\//i.test(picture)) {
        return picture;
      }

      return `${API_BASE_URL}/${picture.replace(/^\/+/, "")}`;
    }

    return getFallbackImage(friend);
  }

  function getFallbackImage(friend: Friend): string {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(
      `${friend.first_name} ${friend.last_name}`
    )}&background=dc2626&color=ffffff`;
  }

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="flex h-[650px]">
            {/* FRIENDS SIDEBAR */}
            <div className="w-80 flex-shrink-0 border-r bg-gray-50">
              <div className="p-5 border-b bg-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-800">
                      Messages
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                      Chat with your friends
                    </p>
                  </div>

                  <div
                    className={`w-3 h-3 rounded-full ${
                      socketConnected ? "bg-green-500" : "bg-gray-400"
                    }`}
                    title={socketConnected ? "Real-time connected" : "Connecting..."}
                  />
                </div>

                <div className="mt-3">
                  {socketConnected ? (
                    <p className="text-xs text-green-600">
                      ● Real-time chat connected
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500">
                      ● Connecting to chat...
                    </p>
                  )}
                </div>
              </div>

              <div className="overflow-y-auto h-[570px]">
                {loadingFriends && (
                  <div className="p-5 text-center text-gray-500">
                    Loading friends...
                  </div>
                )}

                {!loadingFriends && friends.length === 0 && (
                  <div className="p-5 text-center text-gray-500">
                    <div className="text-4xl mb-3">👥</div>
                    <p className="font-medium">No friends found</p>
                    <p className="text-sm mt-1">
                      Add friends to start chatting.
                    </p>
                  </div>
                )}

                {!loadingFriends && friends.length > 0 && (
                  <div>
                    {friends.map((friend) => (
                      <button
                        type="button"
                        key={friend.id}
                        onClick={() => void loadMessages(friend)}
                        className={`w-full flex items-center p-4 text-left border-b transition ${
                          selectedFriend?.id === friend.id
                            ? "bg-red-50 border-l-4 border-l-red-600"
                            : "bg-white hover:bg-gray-100"
                        }`}
                      >
                        <div className="relative flex-shrink-0">
                          <img
                            src={getProfileImage(friend)}
                            alt={`${friend.first_name} ${friend.last_name}`}
                            className="w-12 h-12 rounded-full object-cover border"
                            onError={(event) => {
                              event.currentTarget.onerror = null;
                              event.currentTarget.src = getFallbackImage(friend);
                            }}
                          />
                          {friend.online && (
                            <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full" />
                          )}
                        </div>

                        <div className="ml-3 min-w-0">
                          <p className="font-semibold text-gray-800 truncate">
                            {friend.first_name} {friend.last_name}
                          </p>
                          <p className="text-sm text-gray-500">
                            {friend.online ? "Online" : "Friend"}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* CHAT AREA */}
            <div className="flex-1 min-w-0 flex flex-col">
              {selectedFriend ? (
                <div className="p-4 border-b bg-white flex items-center">
                  <div className="relative">
                    <img
                      src={getProfileImage(selectedFriend)}
                      alt={`${selectedFriend.first_name} ${selectedFriend.last_name}`}
                      className="w-11 h-11 rounded-full object-cover border"
                      onError={(event) => {
                        event.currentTarget.onerror = null;
                        event.currentTarget.src = getFallbackImage(selectedFriend);
                      }}
                    />
                    {selectedFriend.online && (
                      <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full" />
                    )}
                  </div>

                  <div className="ml-3">
                    <h2 className="font-semibold text-lg text-gray-800">
                      {selectedFriend.first_name} {selectedFriend.last_name}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {selectedFriend.online ? "Online" : "Friend"}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-5 border-b bg-white">
                  <h2 className="font-semibold text-gray-800">
                    Select a friend
                  </h2>
                </div>
              )}

              {socketError && (
                <div className="px-4 py-2 bg-yellow-50 border-b border-yellow-200">
                  <p className="text-xs text-yellow-700">{socketError}</p>
                </div>
              )}

              {/* MESSAGES */}
              <div className="flex-1 overflow-y-auto p-5 bg-gray-100">
                {!selectedFriend && (
                  <div className="h-full flex items-center justify-center text-center">
                    <div>
                      <div className="text-6xl mb-4">💬</div>
                      <h2 className="text-xl font-semibold text-gray-700">
                        Start a conversation
                      </h2>
                      <p className="text-gray-500 mt-2">
                        Select a friend from the left.
                      </p>
                    </div>
                  </div>
                )}

                {selectedFriend && loadingMessages && (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-4xl mb-3">💬</div>
                      <p className="text-gray-500">Loading messages...</p>
                    </div>
                  </div>
                )}

                {selectedFriend && !loadingMessages && messages.length === 0 && (
                  <div className="h-full flex items-center justify-center text-center">
                    <div>
                      <div className="text-5xl mb-4">👋</div>
                      <h2 className="text-lg font-semibold text-gray-700">
                        No messages yet
                      </h2>
                      <p className="text-gray-500 mt-1">
                        Send the first message to {selectedFriend.first_name}.
                      </p>
                    </div>
                  </div>
                )}

                {selectedFriend && !loadingMessages && messages.length > 0 && (
                  <div className="space-y-3">
                    {messages.map((message) => {
                      const isMine = message.sender_id === currentUserId;

                      return (
                        <div
                          key={message.id}
                          className={`flex ${
                            isMine ? "justify-end" : "justify-start"
                          }`}
                        >
                          <div
                            className={`max-w-[70%] px-4 py-3 rounded-2xl ${
                              isMine
                                ? "bg-red-600 text-white rounded-br-md"
                                : "bg-white text-gray-800 rounded-bl-md shadow"
                            }`}
                          >
                            <p className="whitespace-pre-wrap break-words">
                              {message.content}
                            </p>
                            <p
                              className={`text-xs mt-1 ${
                                isMine ? "text-red-100" : "text-gray-400"
                              }`}
                            >
                              {new Date(message.created_at).toLocaleTimeString(
                                [],
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }
                              )}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* MESSAGE INPUT */}
              {selectedFriend && (
                <div className="p-4 border-t bg-white">
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={text}
                      onChange={(event) => setText(event.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={`Message ${selectedFriend.first_name}...`}
                      className="flex-1 min-w-0 border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      disabled={sending || !socketConnected}
                    />
                    <button
                      type="button"
                      onClick={sendMessage}
                      disabled={sending || !text.trim() || !socketConnected}
                      className="bg-red-600 text-white px-6 rounded-xl font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      {sending ? "Sending..." : "Send"}
                    </button>
                  </div>

                  {!socketConnected && (
                    <p className="text-xs text-gray-500 mt-2">
                      Connecting to real-time chat...
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

export default Messages;

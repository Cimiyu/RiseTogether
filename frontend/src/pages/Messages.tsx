import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import api from "../api/axios";
import MainLayout from "../layout/MainLayout";

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
  const [selectedFriend, setSelectedFriend] =
    useState<Friend | null>(null);

  const [currentUserId, setCurrentUserId] =
    useState<number | null>(null);

  const [text, setText] = useState("");

  const [loadingFriends, setLoadingFriends] =
    useState(true);

  const [loadingMessages, setLoadingMessages] =
    useState(false);

  const [sending, setSending] = useState(false);

  const [socketConnected, setSocketConnected] =
    useState(false);

  const [socketError, setSocketError] =
    useState<string | null>(null);

  const messagesEndRef =
    useRef<HTMLDivElement | null>(null);

  const socketRef =
    useRef<WebSocket | null>(null);

  const reconnectTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  const reconnectAttemptsRef =
    useRef(0);

  const shouldReconnectRef =
    useRef(true);

  /*
   * Keep the currently selected friend and user ID
   * in refs so the WebSocket callback always has
   * the latest values without repeatedly reconnecting.
   */
  const currentUserIdRef =
    useRef<number | null>(null);

  const selectedFriendRef =
    useRef<Friend | null>(null);

  // =========================================================
  // UPDATE CURRENT USER REF
  // =========================================================

  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  // =========================================================
  // UPDATE SELECTED FRIEND REF
  // =========================================================

  useEffect(() => {
    selectedFriendRef.current = selectedFriend;
  }, [selectedFriend]);

  // =========================================================
  // LOAD CURRENT USER
  // =========================================================

  const loadCurrentUser = useCallback(async () => {
    try {
      const response = await api.get("/users/me");

      console.log(
        "Current user:",
        response.data
      );

      const userId = Number(response.data.id);

      setCurrentUserId(userId);
      currentUserIdRef.current = userId;

      return userId;
    } catch (error) {
      console.error(
        "Failed to load current user:",
        error
      );

      return null;
    }
  }, []);

  // =========================================================
  // LOAD FRIENDS
  // =========================================================

  const loadFriends = useCallback(async () => {
    try {
      setLoadingFriends(true);

      const response =
        await api.get("/friends/my-friends");

      console.log(
        "Friends API response:",
        response.data
      );

      if (Array.isArray(response.data)) {
        setFriends(response.data);
      } else {
        console.error(
          "Friends API did not return an array:",
          response.data
        );

        setFriends([]);
      }
    } catch (error: any) {
      console.error(
        "Failed to load friends:",
        error
      );

      setFriends([]);

      if (error.response?.data?.detail) {
        console.error(
          "Backend error:",
          error.response.data.detail
        );
      }
    } finally {
      setLoadingFriends(false);
    }
  }, []);

  // =========================================================
  // LOAD CONVERSATION
  // =========================================================

  const loadMessages = useCallback(
    async (friend: Friend) => {
      try {
        console.log(
          "Opening conversation with:",
          friend
        );

        setSelectedFriend(friend);
        selectedFriendRef.current = friend;

        setMessages([]);
        setLoadingMessages(true);

        const response =
          await api.get(
            `/messages/${friend.id}`
          );

        console.log(
          `Messages with friend ${friend.id}:`,
          response.data
        );

        if (Array.isArray(response.data)) {
          setMessages(response.data);
        } else {
          setMessages([]);
        }

        // -----------------------------------------------------
        // MARK MESSAGES AS READ
        // -----------------------------------------------------

        try {
          await api.put(
            `/messages/${friend.id}/read`
          );
        } catch (readError) {
          console.warn(
            "Unable to mark messages as read:",
            readError
          );
        }
      } catch (error: any) {
        console.error(
          "Failed to load messages:",
          error
        );

        setMessages([]);

        if (error.response?.data?.detail) {
          alert(
            error.response.data.detail
          );
        } else {
          alert(
            "Unable to load this conversation."
          );
        }
      } finally {
        setLoadingMessages(false);
      }
    },
    []
  );

  // =========================================================
  // HANDLE WEBSOCKET MESSAGE
  // =========================================================

  const handleWebSocketMessage = useCallback(
    (data: WebSocketMessage) => {
      console.log(
        "WebSocket message:",
        data
      );

      // -----------------------------------------------------
      // CONNECTION
      // -----------------------------------------------------

      if (data.type === "connected") {
        console.log(
          "WebSocket connected for user:",
          data.user_id
        );

        setSocketConnected(true);
        setSocketError(null);

        return;
      }

      // -----------------------------------------------------
      // ERROR
      // -----------------------------------------------------

      if (data.type === "error") {
        console.error(
          "WebSocket server error:",
          data.message
        );

        setSocketError(
          data.message ||
            "WebSocket error."
        );

        setSending(false);

        return;
      }

      // -----------------------------------------------------
      // MESSAGE
      // -----------------------------------------------------

      if (
        data.type === "message" &&
        typeof data.id === "number" &&
        typeof data.sender_id === "number" &&
        typeof data.receiver_id === "number" &&
        typeof data.content === "string" &&
        typeof data.created_at === "string"
      ) {
        const incomingMessage: Message = {
          id: data.id,
          sender_id: data.sender_id,
          receiver_id: data.receiver_id,
          content: data.content,
          is_read:
            data.is_read ?? false,
          created_at: data.created_at,
        };

        const userId =
          currentUserIdRef.current;

        const friend =
          selectedFriendRef.current;

        // ---------------------------------------------------
        // ADD ONLY TO CURRENT CONVERSATION
        // ---------------------------------------------------

        if (
          userId !== null &&
          friend !== null
        ) {
          const belongsToConversation =
            (
              incomingMessage.sender_id ===
                userId &&
              incomingMessage.receiver_id ===
                friend.id
            ) ||
            (
              incomingMessage.sender_id ===
                friend.id &&
              incomingMessage.receiver_id ===
                userId
            );

          if (belongsToConversation) {
            setMessages(
              (previousMessages) => {
                // Prevent duplicate messages
                if (
                  previousMessages.some(
                    (message) =>
                      message.id ===
                      incomingMessage.id
                  )
                ) {
                  return previousMessages;
                }

                return [
                  ...previousMessages,
                  incomingMessage,
                ];
              }
            );
          }
        }

        // ---------------------------------------------------
        // MESSAGE SENT BY CURRENT USER
        // ---------------------------------------------------

        if (
          userId !== null &&
          incomingMessage.sender_id ===
            userId
        ) {
          setText("");
          setSending(false);
        }

        // ---------------------------------------------------
        // MESSAGE RECEIVED BY CURRENT USER
        // ---------------------------------------------------

        if (
          userId !== null &&
          incomingMessage.receiver_id ===
            userId &&
          friend !== null &&
          incomingMessage.sender_id ===
            friend.id
        ) {
          api
            .put(
              `/messages/${friend.id}/read`
            )
            .catch((error) => {
              console.warn(
                "Unable to mark real-time message as read:",
                error
              );
            });
        }
      }
    },
    []
  );

  // =========================================================
  // CONNECT WEBSOCKET
  // =========================================================

  const connectWebSocket =
    useCallback(
      (userId: number) => {
        if (!userId) {
          console.error(
            "Cannot connect WebSocket without user ID."
          );

          return;
        }

        // -----------------------------------------------------
        // DO NOT CREATE DUPLICATE CONNECTIONS
        // -----------------------------------------------------

        if (
          socketRef.current &&
          (
            socketRef.current.readyState ===
              WebSocket.OPEN ||
            socketRef.current.readyState ===
              WebSocket.CONNECTING
          )
        ) {
          return;
        }

        // -----------------------------------------------------
        // CLEAR PREVIOUS RECONNECT TIMER
        // -----------------------------------------------------

        if (reconnectTimerRef.current) {
          clearTimeout(
            reconnectTimerRef.current
          );

          reconnectTimerRef.current = null;
        }

        // -----------------------------------------------------
        // WEBSOCKET URL
        //
        // IMPORTANT:
        //
        // Backend:
        // @router.websocket("/ws/{user_id}")
        //
        // Router prefix:
        // /chat
        //
        // Therefore:
        // /chat/ws/{user_id}
        // -----------------------------------------------------

        const socketUrl =
          `ws://127.0.0.1:8000/chat/ws/${userId}`;

        console.log(
          "Connecting to WebSocket:",
          socketUrl
        );

        const socket =
          new WebSocket(socketUrl);

        socketRef.current = socket;

        // -----------------------------------------------------
        // OPEN
        // -----------------------------------------------------

        socket.onopen = () => {
          console.log(
            "WebSocket connected successfully."
          );

          setSocketConnected(true);
          setSocketError(null);

          reconnectAttemptsRef.current = 0;
        };

        // -----------------------------------------------------
        // MESSAGE
        // -----------------------------------------------------

        socket.onmessage = (event) => {
          try {
            const data: WebSocketMessage =
              JSON.parse(event.data);

            handleWebSocketMessage(data);
          } catch (error) {
            console.error(
              "Invalid WebSocket data:",
              error
            );
          }
        };

        // -----------------------------------------------------
        // ERROR
        // -----------------------------------------------------

        socket.onerror = (error) => {
          console.error(
            "WebSocket error:",
            error
          );

          setSocketConnected(false);
          setSocketError(
            "Real-time connection error."
          );
        };

        // -----------------------------------------------------
        // CLOSE
        // -----------------------------------------------------

        socket.onclose = (event) => {
          console.log(
            "WebSocket disconnected.",
            event.code,
            event.reason
          );

          setSocketConnected(false);

          if (
            socketRef.current === socket
          ) {
            socketRef.current = null;
          }

          if (
            !shouldReconnectRef.current
          ) {
            return;
          }

          // ---------------------------------------------------
          // EXPONENTIAL RECONNECT
          // ---------------------------------------------------

          const attempts =
            reconnectAttemptsRef.current;

          const delay = Math.min(
            1000 * Math.pow(2, attempts),
            10000
          );

          reconnectAttemptsRef.current =
            attempts + 1;

          console.log(
            `Reconnecting in ${delay}ms...`
          );

          reconnectTimerRef.current =
            setTimeout(() => {
              connectWebSocket(userId);
            }, delay);
        };
      },
      [handleWebSocketMessage]
    );

  // =========================================================
  // INITIALIZATION
  // =========================================================

  useEffect(() => {
    let mounted = true;

    shouldReconnectRef.current = true;

    async function initialize() {
      const userId =
        await loadCurrentUser();

      if (!mounted) {
        return;
      }

      await loadFriends();

      if (!mounted) {
        return;
      }

      if (userId) {
        connectWebSocket(userId);
      } else {
        setSocketError(
          "Unable to identify the current user."
        );
      }
    }

    initialize();

    return () => {
      mounted = false;

      shouldReconnectRef.current = false;

      // -----------------------------------------------------
      // CLEAR RECONNECT TIMER
      // -----------------------------------------------------

      if (
        reconnectTimerRef.current
      ) {
        clearTimeout(
          reconnectTimerRef.current
        );

        reconnectTimerRef.current = null;
      }

      // -----------------------------------------------------
      // CLOSE WEBSOCKET
      // -----------------------------------------------------

      if (socketRef.current) {
        socketRef.current.close();

        socketRef.current = null;
      }

      setSocketConnected(false);
    };
  }, [
    loadCurrentUser,
    loadFriends,
    connectWebSocket,
  ]);

  // =========================================================
  // AUTO SCROLL
  // =========================================================

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  // =========================================================
  // SEND REAL-TIME MESSAGE
  // =========================================================

  function sendMessage() {
    const messageText =
      text.trim();

    if (!messageText) {
      return;
    }

    if (!selectedFriend) {
      return;
    }

    // -----------------------------------------------------
    // CHECK CONNECTION
    // -----------------------------------------------------

    if (
      !socketRef.current ||
      socketRef.current.readyState !==
        WebSocket.OPEN
    ) {
      alert(
        "Real-time connection is not ready. Please wait a moment and try again."
      );

      return;
    }

    // -----------------------------------------------------
    // CHECK LENGTH
    // -----------------------------------------------------

    if (
      messageText.length > 5000
    ) {
      alert(
        "Message cannot exceed 5000 characters."
      );

      return;
    }

    try {
      setSending(true);
      setSocketError(null);

      socketRef.current.send(
        JSON.stringify({
          receiver_id:
            selectedFriend.id,
          content: messageText,
        })
      );

      /*
       * Do NOT add the message here.
       *
       * The backend saves the message and sends
       * the saved message back through WebSocket.
       *
       * This prevents duplicate messages.
       */
    } catch (error) {
      console.error(
        "Failed to send WebSocket message:",
        error
      );

      setSending(false);

      alert(
        "Unable to send message."
      );
    }
  }

  // =========================================================
  // ENTER KEY
  // =========================================================

  function handleKeyDown(
    event: KeyboardEvent<HTMLInputElement>
  ) {
    if (event.key === "Enter") {
      event.preventDefault();

      if (!sending) {
        sendMessage();
      }
    }
  }

  // =========================================================
  // PROFILE IMAGE
  // =========================================================

  function getProfileImage(
    friend: Friend
  ): string {
    if (friend.profile_picture) {
      if (
        friend.profile_picture.startsWith(
          "http"
        )
      ) {
        return friend.profile_picture;
      }

      return `http://127.0.0.1:8000${friend.profile_picture}`;
    }

    return `https://ui-avatars.com/api/?name=${encodeURIComponent(
      `${friend.first_name} ${friend.last_name}`
    )}&background=dc2626&color=ffffff`;
  }

  // =========================================================
  // FALLBACK PROFILE IMAGE
  // =========================================================

  function getFallbackImage(
    friend: Friend
  ): string {
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

            {/* =================================================
                FRIENDS SIDEBAR
            ================================================= */}

            <div className="w-80 flex-shrink-0 border-r bg-gray-50">

              {/* HEADER */}

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

                  {/* WEBSOCKET STATUS */}

                  <div
                    className={`w-3 h-3 rounded-full ${
                      socketConnected
                        ? "bg-green-500"
                        : "bg-gray-400"
                    }`}
                    title={
                      socketConnected
                        ? "Real-time connected"
                        : "Connecting..."
                    }
                  />

                </div>

                {/* CONNECTION STATUS */}

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

              {/* FRIEND LIST */}

              <div className="overflow-y-auto h-[570px]">

                {/* LOADING */}

                {loadingFriends && (
                  <div className="p-5 text-center text-gray-500">
                    Loading friends...
                  </div>
                )}

                {/* NO FRIENDS */}

                {!loadingFriends &&
                  friends.length === 0 && (
                    <div className="p-5 text-center text-gray-500">

                      <div className="text-4xl mb-3">
                        👥
                      </div>

                      <p className="font-medium">
                        No friends found
                      </p>

                      <p className="text-sm mt-1">
                        Add friends to start chatting.
                      </p>

                    </div>
                  )}

                {/* FRIENDS */}

                {!loadingFriends &&
                  friends.length > 0 && (
                    <div>

                      {friends.map(
                        (friend) => (
                          <button
                            type="button"
                            key={friend.id}
                            onClick={() =>
                              loadMessages(friend)
                            }
                            className={`w-full flex items-center p-4 text-left border-b transition ${
                              selectedFriend?.id ===
                              friend.id
                                ? "bg-red-50 border-l-4 border-l-red-600"
                                : "bg-white hover:bg-gray-100"
                            }`}
                          >

                            {/* PROFILE IMAGE */}

                            <div className="relative flex-shrink-0">

                              <img
                                src={getProfileImage(
                                  friend
                                )}
                                alt={`${friend.first_name} ${friend.last_name}`}
                                className="w-12 h-12 rounded-full object-cover border"
                                onError={(
                                  event
                                ) => {
                                  event.currentTarget.src =
                                    getFallbackImage(
                                      friend
                                    );
                                }}
                              />

                              {/* ONLINE INDICATOR */}

                              {friend.online && (
                                <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full" />
                              )}

                            </div>

                            {/* NAME */}

                            <div className="ml-3 min-w-0">

                              <p className="font-semibold text-gray-800 truncate">
                                {friend.first_name}{" "}
                                {friend.last_name}
                              </p>

                              <p className="text-sm text-gray-500">
                                {friend.online
                                  ? "Online"
                                  : "Friend"}
                              </p>

                            </div>

                          </button>
                        )
                      )}

                    </div>
                  )}

              </div>

            </div>

            {/* =================================================
                CHAT AREA
            ================================================= */}

            <div className="flex-1 min-w-0 flex flex-col">

              {/* CHAT HEADER */}

              {selectedFriend ? (
                <div className="p-4 border-b bg-white flex items-center">

                  <div className="relative">

                    <img
                      src={getProfileImage(
                        selectedFriend
                      )}
                      alt={`${selectedFriend.first_name} ${selectedFriend.last_name}`}
                      className="w-11 h-11 rounded-full object-cover border"
                      onError={(
                        event
                      ) => {
                        event.currentTarget.src =
                          getFallbackImage(
                            selectedFriend
                          );
                      }}
                    />

                    {selectedFriend.online && (
                      <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full" />
                    )}

                  </div>

                  <div className="ml-3">

                    <h2 className="font-semibold text-lg text-gray-800">
                      {selectedFriend.first_name}{" "}
                      {selectedFriend.last_name}
                    </h2>

                    <p className="text-sm text-gray-500">
                      {selectedFriend.online
                        ? "Online"
                        : "Friend"}
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

              {/* CONNECTION ERROR */}

              {socketError && (
                <div className="px-4 py-2 bg-yellow-50 border-b border-yellow-200">

                  <p className="text-xs text-yellow-700">
                    {socketError}
                  </p>

                </div>
              )}

              {/* =================================================
                  MESSAGES
              ================================================= */}

              <div className="flex-1 overflow-y-auto p-5 bg-gray-100">

                {/* NO FRIEND SELECTED */}

                {!selectedFriend && (
                  <div className="h-full flex items-center justify-center text-center">

                    <div>

                      <div className="text-6xl mb-4">
                        💬
                      </div>

                      <h2 className="text-xl font-semibold text-gray-700">
                        Start a conversation
                      </h2>

                      <p className="text-gray-500 mt-2">
                        Select a friend from the left.
                      </p>

                    </div>

                  </div>
                )}

                {/* LOADING */}

                {selectedFriend &&
                  loadingMessages && (
                    <div className="h-full flex items-center justify-center">

                      <div className="text-center">

                        <div className="text-4xl mb-3">
                          💬
                        </div>

                        <p className="text-gray-500">
                          Loading messages...
                        </p>

                      </div>

                    </div>
                  )}

                {/* EMPTY CONVERSATION */}

                {selectedFriend &&
                  !loadingMessages &&
                  messages.length === 0 && (
                    <div className="h-full flex items-center justify-center text-center">

                      <div>

                        <div className="text-5xl mb-4">
                          👋
                        </div>

                        <h2 className="text-lg font-semibold text-gray-700">
                          No messages yet
                        </h2>

                        <p className="text-gray-500 mt-1">
                          Send the first message to{" "}
                          {selectedFriend.first_name}.
                        </p>

                      </div>

                    </div>
                  )}

                {/* MESSAGES */}

                {selectedFriend &&
                  !loadingMessages &&
                  messages.length > 0 && (
                    <div className="space-y-3">

                      {messages.map(
                        (message) => {
                          const isMine =
                            message.sender_id ===
                            currentUserId;

                          return (
                            <div
                              key={
                                message.id
                              }
                              className={`flex ${
                                isMine
                                  ? "justify-end"
                                  : "justify-start"
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
                                  {
                                    message.content
                                  }
                                </p>

                                <p
                                  className={`text-xs mt-1 ${
                                    isMine
                                      ? "text-red-100"
                                      : "text-gray-400"
                                  }`}
                                >
                                  {new Date(
                                    message.created_at
                                  ).toLocaleTimeString(
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
                        }
                      )}

                      <div
                        ref={
                          messagesEndRef
                        }
                      />

                    </div>
                  )}

              </div>

              {/* =================================================
                  MESSAGE INPUT
              ================================================= */}

              {selectedFriend && (
                <div className="p-4 border-t bg-white">

                  <div className="flex gap-3">

                    <input
                      type="text"
                      value={text}
                      onChange={(
                        event
                      ) =>
                        setText(
                          event.target.value
                        )
                      }
                      onKeyDown={
                        handleKeyDown
                      }
                      placeholder={`Message ${selectedFriend.first_name}...`}
                      className="flex-1 min-w-0 border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      disabled={
                        sending ||
                        !socketConnected
                      }
                    />

                    <button
                      type="button"
                      onClick={
                        sendMessage
                      }
                      disabled={
                        sending ||
                        !text.trim() ||
                        !socketConnected
                      }
                      className="bg-red-600 text-white px-6 rounded-xl font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      {sending
                        ? "Sending..."
                        : "Send"}
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